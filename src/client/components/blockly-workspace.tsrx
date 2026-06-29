import { createSignal, onMount, onCleanup, For, Show, createEffect } from "solid-js";
import * as Blockly from "blockly";

// Define the custom blocks for RottraAI
const blockDefinitions = [
  {
    type: "event_when_trend",
    message0: "Khi tài sản %1 có xu hướng %2 %3 Thực hiện: %4",
    args0: [
      {
        type: "field_dropdown",
        name: "ASSET",
        options: [
          ["Bitcoin (BTC)", "BTC"],
          ["Vàng PNJ", "Vàng PNJ"],
          ["Cổ phiếu ACB", "ACB"],
          ["Cổ phiếu BCM", "BCM"],
          ["Cổ phiếu BID", "BID"],
          ["Cổ phiếu BVH", "BVH"],
          ["Cổ phiếu CTG", "CTG"],
          ["Cổ phiếu FPT", "FPT"],
          ["Cổ phiếu GAS", "GAS"],
          ["Cổ phiếu GVR", "GVR"],
          ["Cổ phiếu HDB", "HDB"],
          ["Cổ phiếu HPG", "HPG"],
          ["Cổ phiếu MBB", "MBB"],
          ["Cổ phiếu MSN", "MSN"],
          ["Cổ phiếu MWG", "MWG"],
          ["Cổ phiếu PLX", "PLX"],
          ["Cổ phiếu POW", "POW"],
          ["Cổ phiếu SAB", "SAB"],
          ["Cổ phiếu SHB", "SHB"],
          ["Cổ phiếu SSB", "SSB"],
          ["Cổ phiếu SSI", "SSI"],
          ["Cổ phiếu STB", "STB"],
          ["Cổ phiếu TCB", "TCB"],
          ["Cổ phiếu TPB", "TPB"],
          ["Cổ phiếu VCB", "VCB"],
          ["Cổ phiếu VHM", "VHM"],
          ["Cổ phiếu VIB", "VIB"],
          ["Cổ phiếu VIC", "VIC"],
          ["Cổ phiếu VJC", "VJC"],
          ["Cổ phiếu VNM", "VNM"],
          ["Cổ phiếu VPB", "VPB"],
          ["Cổ phiếu VRE", "VRE"],
        ],
      },
      {
        type: "field_dropdown",
        name: "TREND",
        options: [
          ["TĂNG MẠNH 📈", "up"],
          ["GIẢM SÂU 📉", "down"],
        ],
      },
      { type: "input_dummy" },
      {
        type: "input_statement",
        name: "DO",
      },
    ],
    colour: 230,
    tooltip: "Kích hoạt khi xu hướng tài sản thay đổi",
    helpUrl: "",
  },
  {
    type: "action_trade",
    message0: "Đánh lệnh %1 với khối lượng %2",
    args0: [
      {
        type: "field_dropdown",
        name: "ACTION",
        options: [
          ["LONG (Mua lên 🚀)", "LONG"],
          ["SHORT (Bán khống 📉)", "SHORT"],
        ],
      },
      {
        type: "field_number",
        name: "VOL",
        value: 1,
        min: 1,
        max: 10000,
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 120,
    tooltip: "Thực hiện lệnh mua hoặc bán khống",
    helpUrl: "",
  },
  {
    type: "action_chat",
    message0: "Phát biểu câu thoại: %1",
    args0: [
      {
        type: "field_input",
        name: "MSG",
        text: "Ta đã bắt trúng sóng của thị trường rồi!",
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 160,
    tooltip: "Gửi một tin nhắn thoại vào phòng họp",
    helpUrl: "",
  },
  {
    type: "action_harmony",
    message0: "Hành xử Hòa Khí (Giảm giá bán %1%)",
    args0: [
      {
        type: "field_number",
        name: "DISCOUNT",
        value: 10,
        min: 5,
        max: 30,
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 340,
    tooltip: "Giảm giá bán sản phẩm để thu hút khách hàng và tạo hòa khí trên thị trường",
    helpUrl: "",
  },
];

function registerRottraBlocks() {
  try {
    Blockly.common.defineBlocksWithJsonArray(blockDefinitions);
  } catch (e) {
    // Prevent double registration error in HMR
  }
}

export component BlocklyWorkspace(props: any) {
  registerRottraBlocks();
  let blocklyArea: HTMLDivElement | undefined;
  let blocklyDiv: HTMLDivElement | undefined;
  let workspace: Blockly.WorkspaceSvg | undefined;

  const [selectedAgent, setSelectedAgent] = createSignal("");
  const [successMsg, setSuccessMsg] = createSignal("");

  createEffect(() => {
    if (props.agents && props.agents.length > 0 && !selectedAgent()) {
      setSelectedAgent(props.agents[0].id);
      loadAgentWorkspace(props.agents[0].id);
    }
  });

  const toolbox = {
    kind: "categoryToolbox",
    contents: [
      {
        kind: "category",
        name: "Sự Kiện",
        colour: "#5b67a5",
        contents: [
          {
            kind: "block",
            type: "event_when_trend",
          },
        ],
      },
      {
        kind: "category",
        name: "Hành Động",
        colour: "#5ba55b",
        contents: [
          {
            kind: "block",
            type: "action_trade",
          },
          {
            kind: "block",
            type: "action_chat",
          },
          {
            kind: "block",
            type: "action_harmony",
          },
        ],
      },
    ],
  };

  onMount(() => {
    if (!blocklyDiv || !blocklyArea) return;

    const options: any = {
      toolbox: toolbox,
      grid: {
        spacing: 20,
        length: 3,
        colour: props.theme() === "dark" ? "#2a2a35" : "#ccc",
        snap: true,
      },
      trashcan: true,
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2,
      },
    };
    if (props.theme() === "dark") {
      options.theme = Blockly.Themes.Classic;
    }

    workspace = Blockly.inject(blocklyDiv, options);

    const onResize = () => {
      if (!blocklyArea || !blocklyDiv || !workspace) return;
      // Position blocklyDiv over blocklyArea.
      let element: HTMLElement | null = blocklyArea;
      let x = 0;
      let y = 0;
      do {
        x += element.offsetLeft;
        y += element.offsetTop;
        element = element.offsetParent as HTMLElement;
      } while (element);
      blocklyDiv.style.left = x + "px";
      blocklyDiv.style.top = y + "px";
      blocklyDiv.style.width = blocklyArea.offsetWidth + "px";
      blocklyDiv.style.height = blocklyArea.offsetHeight + "px";
      Blockly.svgResize(workspace);
    };

    window.addEventListener("resize", onResize);
    onResize();

    // Load initial empty workspace or load saved rule if agent is selected
    if (props.agents.length > 0) {
      setSelectedAgent(props.agents[0].id);
      loadAgentWorkspace(props.agents[0].id);
    }

    onCleanup(() => {
      window.removeEventListener("resize", onResize);
      if (workspace) {
        workspace.dispose();
      }
    });
  });

  const loadAgentWorkspace = (agentId: string) => {
    if (!workspace) return;
    workspace.clear();

    const rules = props.savedRules[agentId] || [];
    if (rules.length === 0) {
      // Add a default event block to guide the user
      const defaultBlock = workspace.newBlock("event_when_trend");
      defaultBlock.initSvg();
      defaultBlock.render();
      defaultBlock.select();
      return;
    }

    // Reconstruct blocks from saved rules JSON
    // For simplicity, we just rebuild the event block with its children
    let currentY = 50;
    rules.forEach((rule: any) => {
      if (!workspace) return;
      const eventBlock = workspace.newBlock("event_when_trend");
      eventBlock.setFieldValue(rule.asset, "ASSET");
      eventBlock.setFieldValue(rule.trend, "TREND");
      eventBlock.initSvg();
      eventBlock.render();
      eventBlock.moveBy(50, currentY);

      let lastConnection = eventBlock.getInput("DO")?.connection;

      rule.actions.forEach((act: any) => {
        if (!workspace || !lastConnection) return;
        if (act.type === "trade") {
          const tradeBlock = workspace.newBlock("action_trade");
          tradeBlock.setFieldValue(act.action, "ACTION");
          tradeBlock.setFieldValue(act.vol, "VOL");
          tradeBlock.initSvg();
          tradeBlock.render();
          if (tradeBlock.previousConnection) {
            lastConnection.connect(tradeBlock.previousConnection);
            lastConnection = tradeBlock.nextConnection;
          }
        } else if (act.type === "chat") {
          const chatBlock = workspace.newBlock("action_chat");
          chatBlock.setFieldValue(act.msg, "MSG");
          chatBlock.initSvg();
          chatBlock.render();
          if (chatBlock.previousConnection) {
            lastConnection.connect(chatBlock.previousConnection);
            lastConnection = chatBlock.nextConnection;
          }
        } else if (act.type === "harmony") {
          const harmonyBlock = workspace.newBlock("action_harmony");
          harmonyBlock.setFieldValue(act.discount, "DISCOUNT");
          harmonyBlock.initSvg();
          harmonyBlock.render();
          if (harmonyBlock.previousConnection) {
            lastConnection.connect(harmonyBlock.previousConnection);
            lastConnection = harmonyBlock.nextConnection;
          }
        }
      });

      currentY += 180;
    });
  };

  const handleAgentChange = (e: any) => {
    const id = e.currentTarget.value;
    setSelectedAgent(id);
    loadAgentWorkspace(id);
  };

  const applyLogic = () => {
    if (!workspace || !selectedAgent()) return;

    const state = Blockly.serialization.workspaces.save(workspace);
    const rules: any[] = [];

    if (state && state.blocks && state.blocks.blocks) {
      for (const block of state.blocks.blocks) {
        if (block.type === "event_when_trend") {
          const asset = block.fields?.ASSET || "BTC";
          const trend = block.fields?.TREND || "up";

          const actions: any[] = [];
          // Parse statement input "DO"
          let nextBlock = block.inputs?.DO?.block;
          while (nextBlock) {
            if (nextBlock.type === "action_trade") {
              actions.push({
                type: "trade",
                action: nextBlock.fields?.ACTION || "LONG",
                vol: Number(nextBlock.fields?.VOL) || 1,
              });
            } else if (nextBlock.type === "action_chat") {
              actions.push({
                type: "chat",
                msg: nextBlock.fields?.MSG || "",
              });
            } else if (nextBlock.type === "action_harmony") {
              actions.push({
                type: "harmony",
                discount: Number(nextBlock.fields?.DISCOUNT) || 10,
              });
            }
            nextBlock = nextBlock.next?.block;
          }

          rules.push({ asset, trend, actions });
        }
      }
    }

    props.onSaveRules(selectedAgent(), rules);

    const agentName = props.agents.find((a: any) => a.id === selectedAgent())?.name || "Agent";
    setSuccessMsg(`Đã áp dụng thành công ${rules.length} kịch bản lập trình cho ${agentName}!`);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  <div class="flex flex-col w-full h-full min-h-0 relative z-10">
    {/* Control bar */}
    <div
      class={`flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-3 ${
        props.theme() === "dark" ? "border-white/10" : "border-gray-200"
      }`}>
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold">{"Lập trình tư duy cho Agent:"}</span>
        <select
          value={selectedAgent()}
          onChange={handleAgentChange}
          class={`text-xs font-bold rounded-lg border px-3 py-1.5 focus:outline-none ${
            props.theme() === "dark" ? "bg-[#181820] border-white/10 text-white" : "bg-white border-gray-250 text-gray-800"
          }`}>
          <For each={props.agents}>
            {(agent) => <tsx>
              <option value={agent.id}>
                {agent.name}
              </option>
            </tsx>}
          </For>
        </select>
      </div>

      <div class="flex items-center gap-3">
        <Show when={successMsg()}>
          <span class="text-xs font-bold text-emerald-400 animate-pulse">{successMsg()}</span>
        </Show>
        <button
          onClick={applyLogic}
          class="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg transition-all">
          {"⚡ Áp dụng Logic"}
        </button>
      </div>
    </div>

    {/* Workspace container */}
    <div class="flex-1 w-full h-full min-h-0 relative rounded-2xl overflow-hidden border border-white/5 bg-[#0f0f15]/50 flex">
      {/* Helper blockly area to calculate size */}
      <div ref={blocklyArea} class="absolute inset-0 w-full h-full" />
      {/* Actual blockly container */}
      <div ref={blocklyDiv} class="absolute" style="position: absolute;" />
    </div>
  </div>
}
