#!/bin/bash
echo "[MCP] Installing Python dependencies..."

# Check if uv is installed
if ! command -v uv &> /dev/null
then
    echo "uv could not be found. Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

echo "[MCP] Python environment ready."
echo "[MCP] cve-mcp-server and hyper-extract will be executed via 'uvx' dynamically."
