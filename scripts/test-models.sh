#!/bin/bash

# Test each GGUF model one by one
LLAMA_SERVER="/usr/local/lib/ollama/llama-server"
MODELS_DIR="/home/l/Documents/rottra/models"
PORT=8080

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Get all GGUF files
models=()
for f in "$MODELS_DIR"/*.gguf; do
    if [ -f "$f" ]; then
        models+=("$f")
    fi
done

if [ ${#models[@]} -eq 0 ]; then
    log_error "No GGUF models found in $MODELS_DIR"
    exit 1
fi

log_info "Found ${#models[@]} models to test:"
for model in "${models[@]}"; do
    log_info "  - $(basename "$model") ($(du -h "$model" | cut -f1))"
done

echo ""

# Test prompts
PROMPTS=(
    "Hello, who are you?"
    "What is the capital of France?"
    "Write a short poem about technology."
    "Explain quantum computing in simple terms."
    "What are the benefits of sustainable agriculture?"
)

# Function to test a single model
test_model() {
    local model_path="$1"
    local model_name=$(basename "$model_path" .gguf)
    local model_size=$(du -h "$model_path" | cut -f1)
    
    log_info "========================================="
    log_info "Testing Model: $model_name"
    log_info "Size: $model_size"
    log_info "========================================="
    
    # Start llama-server in background
    log_info "Starting llama-server..."
    $LLAMA_SERVER \
        -m "$model_path" \
        --port $PORT \
        --ctx-size 4096 \
        --n-predict 256 \
        --threads 4 \
        --flash-attn auto \
        --log-disable \
        > "/tmp/llama-server-${model_name}.log" 2>&1 &
    
    local server_pid=$!
    log_info "Server PID: $server_pid"
    
    # Wait for server to start
    log_info "Waiting for server to start..."
    local max_wait=60
    local waited=0
    while [ $waited -lt $max_wait ]; do
        if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
            log_success "Server started successfully"
            break
        fi
        sleep 2
        waited=$((waited + 2))
        echo -n "."
    done
    echo ""
    
    if [ $waited -ge $max_wait ]; then
        log_error "Server failed to start within $max_wait seconds"
        kill $server_pid 2>/dev/null
        return 1
    fi
    
    # Get model info
    log_info "Model Info:"
    curl -s "http://localhost:$PORT/health" | python3 -m json.tool 2>/dev/null || echo "Could not get health info"
    
    # Test each prompt
    local success_count=0
    local total_time=0
    local total_tokens=0
    
    for i in "${!PROMPTS[@]}"; do
        local prompt="${PROMPTS[$i]}"
        log_info "Test $((i+1)): \"$prompt\""
        
        local start_time=$(date +%s%N)
        
        local response=$(curl -s -X POST "http://localhost:$PORT/completion" \
            -H "Content-Type: application/json" \
            -d "{
                \"prompt\": \"$prompt\",
                \"n_predict\": 256,
                \"temperature\": 0.7,
                \"top_p\": 0.9
            }" 2>/dev/null)
        
        local end_time=$(date +%s%N)
        local duration_ms=$(( (end_time - start_time) / 1000000 ))
        
        if [ $? -eq 0 ] && [ -n "$response" ]; then
            local content=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('content', 'No content'))" 2>/dev/null)
            local tokens_eval=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('tokens_evaluated', 0))" 2>/dev/null)
            local tokens_pred=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('tokens_predicted', 0))" 2>/dev/null)
            
            log_success "Response ($duration_ms ms, ${tokens_eval} eval, ${tokens_pred} pred):"
            echo "   $content" | head -5
            echo ""
            
            success_count=$((success_count + 1))
            total_time=$((total_time + duration_ms))
            total_tokens=$((total_tokens + tokens_pred))
        else
            log_error "Failed to get response"
        fi
    done
    
    # Calculate statistics
    local avg_time=0
    local tokens_per_second=0
    if [ $success_count -gt 0 ]; then
        avg_time=$((total_time / success_count))
        if [ $total_time -gt 0 ]; then
            tokens_per_second=$((total_tokens * 1000 / total_time))
        fi
    fi
    
    log_info "========================================="
    log_info "Results for $model_name:"
    log_info "  Successful tests: $success_count/${#PROMPTS[@]}"
    log_info "  Average response time: ${avg_time}ms"
    log_info "  Total tokens generated: $total_tokens"
    log_info "  Average tokens/second: $tokens_per_second"
    log_info "========================================="
    
    # Stop server
    log_info "Stopping server..."
    kill $server_pid 2>/dev/null
    wait $server_pid 2>/dev/null
    log_success "Server stopped"
    
    echo ""
    
    # Return results as JSON
    echo "{\"model\":\"$model_name\",\"size\":\"$model_size\",\"success\":$success_count,\"total\":${#PROMPTS[@]},\"avg_time_ms\":$avg_time,\"tokens_per_sec\":$tokens_per_second}"
}

# Run tests for each model
results=()
for model in "${models[@]}"; do
    result=$(test_model "$model")
    results+=("$result")
done

# Summary
log_info "========================================="
log_info "FINAL SUMMARY"
log_info "========================================="
echo ""
echo "Model | Size | Success | Avg Time | Tokens/sec"
echo "------|------|---------|----------|------------"

for result in "${results[@]}"; do
    if [ -n "$result" ]; then
        model_name=$(echo "$result" | python3 -c "import sys, json; print(json.load(sys.stdin)['model'])" 2>/dev/null)
        model_size=$(echo "$result" | python3 -c "import sys, json; print(json.load(sys.stdin)['size'])" 2>/dev/null)
        success=$(echo "$result" | python3 -c "import sys, json; print(json.load(sys.stdin)['success'])" 2>/dev/null)
        total=$(echo "$result" | python3 -c "import sys, json; print(json.load(sys.stdin)['total'])" 2>/dev/null)
        avg_time=$(echo "$result" | python3 -c "import sys, json; print(json.load(sys.stdin)['avg_time_ms'])" 2>/dev/null)
        tokens_per_sec=$(echo "$result" | python3 -c "import sys, json; print(json.load(sys.stdin)['tokens_per_sec'])" 2>/dev/null)
        
        echo "$model_name | $model_size | $success/$total | ${avg_time}ms | $tokens_per_sec"
    fi
done

echo ""
log_info "Testing completed!"
