import { generateTextLocal } from "./ai-sdk";
import { getAgentTools } from "~/core/cognitive-swarm/game-theory";
import { db, pgClient } from "~/infra/database/db-pool";
import { IntentClassifier } from "./intent-classifier";

export interface Task {
  step: number;
  intent: string;
  subQuery: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
}

/**
 * Trích xuất & vá JSON an toàn (best-effort) từ output tự do.
 * Chống các lỗi phổ biến của LLM nhỏ: bọc ```json, có text thừa 2 đầu,
 * dấu phẩy treo. KHÔNG ném lỗi — trả null nếu không cứu được.
 */
export function safeParseJsonArray(raw: string): any[] | null {
  if (!raw) return null;
  let s = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  // Cắt lấy đoạn từ '[' đầu tiên đến ']' cuối cùng (bỏ preamble/hậu tố).
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  s = s.slice(start, end + 1);
  // Xoá dấu phẩy treo trước ] hoặc }.
  s = s.replace(/,\s*([\]}])/g, "$1");
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 1. Planner (DETERMINISTIC — không dùng LLM sinh JSON)
 * ------------------------------------------------------------------
 * Lõi Rottra chạy cục bộ KHÔNG có LLM sinh token thật, nên việc yêu cầu
 * mô hình xuất JSON luôn thất bại -> trước đây rơi xuống WEB_SEARCH ->
 * DuckDuckGo. Nay ta suy diễn kế hoạch trực tiếp từ IntentClassifier và
 * map sang tool key hợp lệ của getAgentTools(). Nhanh, ổn định, 0% lỗi JSON.
 */
export async function generatePlan(query: string): Promise<Task[]> {
  const intent = IntentClassifier.classify(query);
  const toolKey = IntentClassifier.toToolKey(intent.intent);

  return [
    {
      step: 1,
      intent: toolKey,
      subQuery: query,
      description: `Thực thi intent ${intent.intent} (tool: ${toolKey}, confidence: ${intent.confidence.toFixed(2)})`,
      status: "pending",
    },
  ];
}

/**
 * 2. Execution Loop & Replanner
 * Chạy tuần tự các Task, kiểm tra kết quả, tự động điều chỉnh kế hoạch (Replan) nếu phát sinh lỗi
 */
export async function executePlanWithReplanner(tasks: Task[], baseParams: any): Promise<{ text: string; resultsLog: string[] }> {
  const resultsLog: string[] = [];
  let currentTasks = [...tasks];
  let stepIndex = 0;

  while (stepIndex < currentTasks.length) {
    const task = currentTasks[stepIndex];
    task.status = "running";
    console.log(`[LOOP EXECUTOR] Running Step ${task.step}: ${task.description} (${task.intent})...`);

    try {
      // Initialize tools dynamically for this step's query/intent
      const tools = getAgentTools({
        pgClient,
        db,
        ...baseParams,
        intent: task.intent,
        query: task.subQuery,
        q: task.subQuery,
      });

      const toolFn = tools[task.intent] || tools["WEB_SEARCH"];
      const response = await toolFn();

      task.result = response.text || "No response content.";
      task.status = "completed";
      resultsLog.push(`[Bước ${task.step} - ${task.intent}]: ${task.result}`);

      // Chạy Replanner kiểm tra rủi ro (Self-Reflection on Execution)
      const replannerPrompt = `You are the Replanner Bot.
Analyze the execution log so far:
=== LOG ===
${resultsLog.join("\n")}
===========

And the remaining tasks:
=== REMAINING ===
${JSON.stringify(currentTasks.slice(stepIndex + 1))}
=================

Did the last task run successfully? Do we need to change/add/remove tasks in the remaining list?
If everything is perfect, return EXACTLY "[NO_CHANGE]".
If we need to adjust the plan, return a brand new JSON array for the remaining tasks (without markdown format):
[
  { "step": 3, "intent": "WEB_SEARCH", "subQuery": "tra cứu thêm về rủi ro đầu tư", "description": "Tìm kiếm thêm thông tin bổ sung" }
]`;

      const { text: replanAction } = await generateTextLocal({
        system: "You are a planning optimizer.",
        prompt: replannerPrompt,
        isInternalReasoning: true,
      });

      const cleanedReplan = replanAction
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      if (!cleanedReplan.includes("[NO_CHANGE]")) {
        const newRemainingTasks = safeParseJsonArray(cleanedReplan);
        if (newRemainingTasks) {
          console.log(`[REPLANNER] Plan updated! Appending ${newRemainingTasks.length} new tasks.`);
          currentTasks = [
            ...currentTasks.slice(0, stepIndex + 1),
            ...newRemainingTasks.map((t, idx) => ({
              step: stepIndex + 2 + idx,
              intent: t.intent,
              subQuery: t.subQuery,
              description: t.description,
              status: "pending" as const,
            })),
          ];
        }
      }
    } catch (err: any) {
      task.status = "failed";
      task.result = err.message;
      resultsLog.push(`[Bước ${task.step} - ${task.intent} LỖI]: ${err.message}`);

      // Auto-replan on failure: insert web search fallback
      console.log(`[REPLANNER] Step ${task.step} failed. Inserting search fallback.`);
      currentTasks.splice(stepIndex + 1, 0, {
        step: task.step + 1,
        intent: "WEB_SEARCH",
        subQuery: `Sửa lỗi: ${task.subQuery} thất bại do ${err.message}`,
        description: "Fallback search on failure",
        status: "pending",
      });
    }

    stepIndex++;
  }

  // Combine execution results
  const summaryText = resultsLog.join("\n\n");
  return { text: summaryText, resultsLog };
}

/**
 * 3. Tree-of-Thoughts (ToT) Reasoning:
 * Sinh ra 3 góc nhìn (nhánh suy nghĩ), tự chấm điểm theo luật logic, chọn nhánh có số điểm cao nhất để phản hồi.
 */
export async function treeOfThoughtsReasoning(promptContext: string, userQuery: string): Promise<string> {
  console.log("[TOT REASONING] Generating reasoning tree branches...");

  const generateBranchesPrompt = `Given the query: "${userQuery}" and context:
"${promptContext}"

Generate exactly 3 alternative response strategies (thoughts):
Thought 1: A conservative, risk-averse analysis.
Thought 2: An optimistic, profit-maximizing analysis.
Thought 3: A balanced, highly technical/mathematical analysis.

If the query or context refers to a commercial prank, sabotage, or system disruption (trò phá hoại, lỗi/biến cố thương mại từ các agent), each thought MUST explicitly calculate and include:
- The type of prank/sabotage detected (e.g., pricing manipulation to 0, inventory hiding, routing blockage).
- The detection time (thời gian phát hiện tự động bằng hệ thống telemetry/ANPR).
- The recovery/resolution time in commerce (thời gian giải quyết để đưa giao thương trở lại bình thường).
- The mitigation steps (sử dụng Replanner để tự khôi phục dữ liệu hoặc điều phối thay thế).

Format strictly as:
=== THOUGHT 1 ===
[content]
=== THOUGHT 2 ===
[content]
=== THOUGHT 3 ===
[content]`;

  const { text: branchesText } = await generateTextLocal({
    system: "You are an analytical strategist.",
    prompt: generateBranchesPrompt,
    isInternalReasoning: true,
  });

  // Self-Evaluate and score each branch
  const evaluatePrompt = `You are a strict Logic Evaluator.
Analyze these 3 response thoughts:
${branchesText}

Evaluate each on a scale of 0-100 based on accuracy, depth, and helpfulness.
Format your response exactly like this:
Thought 1 Score: [score]
Thought 2 Score: [score]
Thought 3 Score: [score]`;

  const { text: scoreText } = await generateTextLocal({
    system: "You are a quantitative scoring engine.",
    prompt: evaluatePrompt,
    isInternalReasoning: true,
  });

  console.log(`[TOT REASONING] Evaluator scores:\n${scoreText}`);

  // Parse scores and choose best thought
  let bestThought = 3;
  let maxScore = 0;

  const matches = scoreText.match(/Thought (\d) Score:\s*(\d+)/gi);
  if (matches) {
    matches.forEach((m) => {
      const parts = /Thought (\d) Score:\s*(\d+)/i.exec(m);
      if (parts) {
        const thoughtNum = parseInt(parts[1]);
        const score = parseInt(parts[2]);
        if (score > maxScore) {
          maxScore = score;
          bestThought = thoughtNum;
        }
      }
    });
  }

  console.log(`[TOT REASONING] Selected Thought ${bestThought} with score ${maxScore}`);

  // Extract the text of the selected thought
  const thoughtMarker = `=== THOUGHT ${bestThought} ===`;
  const nextMarker = `=== THOUGHT ${bestThought + 1} ===`;
  let bestThoughtText = "";

  const startIndex = branchesText.indexOf(thoughtMarker);
  if (startIndex !== -1) {
    const contentStart = startIndex + thoughtMarker.length;
    const endIndex = nextMarker ? branchesText.indexOf(nextMarker) : -1;
    if (endIndex !== -1) {
      bestThoughtText = branchesText.substring(contentStart, endIndex).trim();
    } else {
      bestThoughtText = branchesText.substring(contentStart).trim();
    }
  }

  if (!bestThoughtText) {
    // Fallback to the original context
    return promptContext;
  }

  return bestThoughtText;
}
