import { createSignal, onMount, onCleanup, createEffect, For, Show } from "solid-js";
import { Icon } from "solid-heroicons";
import { cpuChip, server, documentText, arrowRight, user, chatBubbleLeftEllipsis } from "solid-heroicons/outline";

type TokenData = { text: string; id: number };
type MessageData = {
  id: string;
  isUser: boolean;
  text: string;
  // For AI only:
  tokens?: TokenData[];
  embeddings?: { token: string, vector: number[] }[];
  attentions?: { from: string, to: string, weight: number }[];
  outputTokens?: string[];
  activeStep?: 0 | 1 | 2 | 3 | 4;
  isProcessing?: boolean;
}

export component LlmVisualizer() {
  const [prompt, setPrompt] = createSignal("");
  const [chat, setChat] = createSignal<MessageData[]>([]);
  const [isProcessing, setIsProcessing] = createSignal(false);
  
  // Helper to hash string to number
  const hashStr = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0; 
    }
    return Math.abs(hash);
  };

  const processPrompt = async () => {
    if (!prompt() || isProcessing()) return;
    
    const userMsg: MessageData = {
      id: Math.random().toString(36).substr(2, 9),
      isUser: true,
      text: prompt()
    };
    
    const aiMsgId = Math.random().toString(36).substr(2, 9);
    const aiMsg: MessageData = {
      id: aiMsgId,
      isUser: false,
      text: "",
      tokens: [],
      embeddings: [],
      attentions: [],
      outputTokens: [],
      activeStep: 1,
      isProcessing: true
    };
    
    setChat(prev => [...prev, userMsg, aiMsg]);
    const currentPrompt = prompt();
    setPrompt("");
    setIsProcessing(true);
    
    const updateAiMsg = (updater: (msg: MessageData) => MessageData) => {
      setChat(prev => prev.map(m => m.id === aiMsgId ? updater({...m}) : m));
    };

    // Step 1: Tokenization
    const words = currentPrompt.trim().split(/\s+/).filter(Boolean);
    const mockTokens = words.map((w) => ({ text: w, id: (hashStr(w) % 50000) + 10000 }));
    updateAiMsg(m => { m.tokens = mockTokens; return m; });
    
    await new Promise(r => setTimeout(r, 800));
    
    // Step 2: Vector Embedding (Show a few dimensions)
    updateAiMsg(m => { m.activeStep = 2; return m; });
    const mockEmbeddings = mockTokens.map(t => {
      const vec = [];
      const seed = hashStr(t.text);
      for(let i = 0; i < 5; i++) {
         vec.push(parseFloat(((seed * (i+1) % 1000) / 1000).toFixed(3)));
      }
      return { token: t.text, vector: vec };
    });
    updateAiMsg(m => { m.embeddings = mockEmbeddings; return m; });
    
    await new Promise(r => setTimeout(r, 800));
    
    // Step 3: Self-Attention (Top connections)
    updateAiMsg(m => { m.activeStep = 3; return m; });
    const mockAttentions = [];
    for(let i=0; i<mockTokens.length; i++) {
       for(let j=0; j<mockTokens.length; j++) {
          if (i !== j) {
             const weight = parseFloat((Math.random() * 0.5 + 0.3).toFixed(2));
             if (weight > 0.6) {
                 mockAttentions.push({from: mockTokens[i].text, to: mockTokens[j].text, weight});
             }
          }
       }
    }
    updateAiMsg(m => { m.attentions = mockAttentions.slice(0, 6); return m; }); // Max 6 lines to show
    
    await new Promise(r => setTimeout(r, 800));
    
    // Step 4: Output Generation (Prediction) - Real AI Backend
    updateAiMsg(m => { m.activeStep = 4; return m; });
    
    try {
      const aiRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chat().filter(m => !m.isProcessing).map(m => ({ role: m.isUser ? "user" : "assistant", content: m.text })),
          lang: "vi",
        }),
      });

      if (aiRes.ok && aiRes.body) {
        const reader = aiRes.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          sseBuffer += decoder.decode(value, { stream: true });
          
          let eolIndex;
          while ((eolIndex = sseBuffer.indexOf("\n\n")) >= 0) {
            const chunk = sseBuffer.slice(0, eolIndex);
            sseBuffer = sseBuffer.slice(eolIndex + 2);
            
            let eventType = "message";
            let dataStr = "";
            for (const line of chunk.split("\n")) {
              if (line.startsWith("event: ")) eventType = line.substring(7).trim();
              else if (line.startsWith("data: ")) dataStr = line.substring(6).trim();
            }
            
            if (dataStr) {
               try {
                 const parsed = JSON.parse(dataStr);
                 if (eventType === "token") {
                    updateAiMsg(m => { m.outputTokens = [...(m.outputTokens||[]), parsed]; m.text += parsed; return m; });
                 } else if (eventType === "thinking") {
                    updateAiMsg(m => { m.outputTokens = [...(m.outputTokens||[]), `\n[Suy luận: ${parsed}]\n`]; return m; });
                 }
               } catch(e) {
                 if (eventType === "token") {
                    updateAiMsg(m => { m.outputTokens = [...(m.outputTokens||[]), dataStr]; m.text += dataStr; return m; });
                 } else if (eventType === "thinking") {
                    updateAiMsg(m => { m.outputTokens = [...(m.outputTokens||[]), `\n[Suy luận: ${dataStr}]\n`]; return m; });
                 }
               }
            }
          }
        }
      } else {
        updateAiMsg(m => { m.outputTokens = [...(m.outputTokens||[]), " [Lỗi kết nối tới Server AI]"]; return m; });
      }
    } catch(err) {
      updateAiMsg(m => { m.outputTokens = [...(m.outputTokens||[]), " [Lỗi mạng hoặc Server không phản hồi]"]; return m; });
    }
    
    updateAiMsg(m => { m.isProcessing = false; m.activeStep = 0; return m; });
    setIsProcessing(false);
  };

  const renderAiInternalFlow = (msg: MessageData) => {
    return <tsx>
      <div class="mt-3 p-4 bg-black/30 border border-gray-700 rounded-xl flex flex-col gap-4 text-sm font-sans w-full max-w-4xl shadow-inner">
         <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-2">
            <Icon path={cpuChip} class="w-4 h-4 text-emerald-400" />
            Bóc tách tiến trình LLM (4 Bước)
         </div>
         
         <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1 */}
            <div class={`p-3 rounded-lg border transition-all ${msg.activeStep === 1 ? 'border-emerald-500 bg-emerald-900/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-gray-700 bg-gray-800/30'}`}>
               <div class="flex items-center gap-2 mb-2 text-emerald-400">
                  <Icon path={documentText} class="w-4 h-4" />
                  <span class="font-bold">1. Tokenization</span>
               </div>
               <p class="text-[10px] text-gray-500 mb-2">Tách văn bản người dùng thành các Token (mã ID) để máy tính hiểu.</p>
               <div class="flex flex-wrap gap-1.5">
                  <For each={msg.tokens}>
                     {t => <div class="px-1.5 py-0.5 bg-black/40 border border-gray-600 rounded text-[11px] font-mono flex items-center gap-1">
                        <span class="text-gray-300">"{t.text}"</span>
                        <span class="text-emerald-500 opacity-70">[{t.id}]</span>
                     </div>}
                  </For>
               </div>
            </div>

            {/* Step 2 */}
            <div class={`p-3 rounded-lg border transition-all ${msg.activeStep === 2 ? 'border-cyan-500 bg-cyan-900/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'border-gray-700 bg-gray-800/30'}`}>
               <div class="flex items-center gap-2 mb-2 text-cyan-400">
                  <Icon path={server} class="w-4 h-4" />
                  <span class="font-bold">2. Vector Embedding</span>
               </div>
               <p class="text-[10px] text-gray-500 mb-2">Chuyển từng Token thành một vector nhiều chiều trong không gian ngữ nghĩa.</p>
               <div class="flex flex-col gap-1">
                  <For each={msg.embeddings?.slice(0, 3)}>
                     {emb => <div class="text-[10px] font-mono text-gray-400 flex items-center justify-between bg-black/30 px-2 py-1 rounded">
                        <span class="text-cyan-300 font-bold w-16 truncate">"{emb.token}"</span>
                        <span class="text-gray-500 mx-2">→</span>
                        <span class="text-gray-300 tracking-tighter truncate">[{emb.vector.join(", ")}...]</span>
                     </div>}
                  </For>
                  <Show when={(msg.embeddings?.length || 0) > 3}>
                     <div class="text-[10px] text-gray-500 text-center italic mt-1">+{(msg.embeddings?.length || 0) - 3} tokens ẩn</div>
                  </Show>
               </div>
            </div>

            {/* Step 3 */}
            <div class={`p-3 rounded-lg border transition-all ${msg.activeStep === 3 ? 'border-fuchsia-500 bg-fuchsia-900/20 shadow-[0_0_10px_rgba(217,70,239,0.2)]' : 'border-gray-700 bg-gray-800/30'}`}>
               <div class="flex items-center gap-2 mb-2 text-fuchsia-400">
                  <Icon path={chatBubbleLeftEllipsis} class="w-4 h-4" />
                  <span class="font-bold">3. Self-Attention</span>
               </div>
               <p class="text-[10px] text-gray-500 mb-2">Tính toán trọng số chú ý chéo (Cross-Attention) giữa các Token trong câu.</p>
               <div class="flex flex-col gap-1.5 text-[11px]">
                  <For each={msg.attentions}>
                     {att => <div class="flex items-center gap-2">
                        <span class="text-gray-300 bg-black/40 px-1.5 py-0.5 rounded border border-gray-700">"{att.from}"</span>
                        <span class="flex-1 border-b border-dashed border-fuchsia-500/50 relative">
                           <span class="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] text-fuchsia-400 font-mono" title="Attention Score">{att.weight.toFixed(2)}</span>
                        </span>
                        <span class="text-gray-300 bg-black/40 px-1.5 py-0.5 rounded border border-gray-700">"{att.to}"</span>
                     </div>}
                  </For>
               </div>
            </div>

            {/* Step 4 */}
            <div class={`p-3 rounded-lg border transition-all ${msg.activeStep === 4 ? 'border-amber-500 bg-amber-900/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'border-gray-700 bg-gray-800/30'}`}>
               <div class="flex items-center gap-2 mb-2 text-amber-400">
                  <Icon path={arrowRight} class="w-4 h-4" />
                  <span class="font-bold">4. Next Token Stream</span>
               </div>
               <p class="text-[10px] text-gray-500 mb-2">Quá trình sinh Token liên tục từ Engine đưa về Frontend.</p>
               <div class="text-[11px] font-mono text-amber-300 bg-black/40 p-2 rounded h-24 overflow-y-auto break-words leading-relaxed">
                  <For each={msg.outputTokens}>
                     {t => <span>{t}</span>}
                  </For>
                  <Show when={msg.activeStep === 4}>
                     <span class="animate-pulse ml-1 inline-block w-1 h-3 bg-amber-400"></span>
                  </Show>
               </div>
            </div>
         </div>
      </div>
    </tsx>;
  };

  <tsx>
    <div class="flex flex-col w-full h-full p-4 md:p-6 lg:px-20 overflow-hidden bg-[#0A0A0A]">
      <div class="mb-4">
        <h2 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]">
          LLM Visualizer Chat
        </h2>
        <p class="text-sm text-gray-400 mt-1">Giao diện Chat kiểm thử kèm bóc tách tiến trình tư duy nội bộ cho từng tin nhắn (White-box Testing).</p>
      </div>

      <div class="flex-1 overflow-y-auto flex flex-col gap-6 pb-10 pr-2 scrollbar-thin scrollbar-thumb-gray-800">
         <Show when={chat().length === 0}>
            <div class="flex flex-col items-center justify-center h-full text-gray-500 gap-4 opacity-50 animate-pulse">
               <Icon path={cpuChip} class="w-16 h-16" />
               <p>Hãy nhập câu hỏi để bắt đầu phiên kiểm thử LLM Engine.</p>
            </div>
         </Show>
         <For each={chat()}>
            {msg => <tsx>
               <div class={`flex w-full ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                  <div class={`flex flex-col w-full md:max-w-[85%] ${msg.isUser ? 'items-end' : 'items-start'}`}>
                     <div class="flex items-center gap-2 mb-1">
                        <Icon path={msg.isUser ? user : server} class="w-4 h-4 text-gray-500" />
                        <span class="text-xs font-bold text-gray-500 uppercase">{msg.isUser ? 'User' : 'LLM Engine'}</span>
                     </div>
                     <div class={`px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed shadow-lg ${msg.isUser ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm' : 'bg-transparent text-gray-200'}`}>
                        {msg.text || (msg.isProcessing && !msg.isUser ? <span class="animate-pulse text-gray-400 flex items-center gap-2"><div class="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div> Khởi tạo...</span> : "")}
                     </div>
                     
                     <Show when={!msg.isUser}>
                        {renderAiInternalFlow(msg)}
                     </Show>
                  </div>
               </div>
            </tsx>}
         </For>
      </div>

      <div class="mt-4 pt-4 border-t border-gray-800 relative">
         <div class="flex gap-4">
           <input 
             type="text" 
             class="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-emerald-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans shadow-inner disabled:opacity-50"
             placeholder="Nhập câu hỏi để quan sát LLM tư duy (VD: Giải thích OOP)..."
             value={prompt()}
             onInput={(e) => setPrompt(e.currentTarget.value)}
             onKeyDown={(e) => e.key === "Enter" && processPrompt()}
             disabled={isProcessing()}
           />
           <button 
             class="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.6)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
             onClick={processPrompt}
             disabled={isProcessing() || !prompt()}
           >
             <Icon path={cpuChip} class="w-5 h-5" />
             Gửi
           </button>
         </div>
      </div>
    </div>
  </tsx>
}
