/**
 * Autonomous Goal Setting Engine
 * Tự đặt mục tiêu, lên kế hoạch, thực thi
 *
 * AI tự phân tích situation, đặt goals, tạo plans,
 * và thực thi tự chủ - không cần con người chỉ đạo.
 *
 * Capabilities:
 * - Self-assessment: Đánh giá tình hình hiện tại
 * - Goal generation: Tự tạo goals từ context
 * - Plan creation: Lên kế hoạch hành động
 * - Priority ranking: Xếp hạng goals
 * - Self-monitoring: Theo dõi tiến trình
 * - Adaptive replanning: Tự điều chỉnh kế hoạch
 */

export interface Goal {
  id: string;
  title: string;
  description: string;
  domain: string;
  priority: number; // 1-10
  urgency: "low" | "medium" | "high" | "critical";
  status: "pending" | "in_progress" | "completed" | "failed" | "deferred";
  progress: number; // 0-100
  createdAt: number;
  deadline?: number;
  dependencies: string[];
  subGoals: Goal[];
  metrics: GoalMetric[];
  plan: ActionPlan;
}

export interface GoalMetric {
  name: string;
  target: number;
  current: number;
  unit: string;
}

export interface ActionPlan {
  steps: ActionStep[];
  estimatedDuration: number; // minutes
  resources: string[];
  risks: Risk[];
}

export interface ActionStep {
  id: string;
  description: string;
  action: string;
  parameters: Record<string, any>;
  estimatedTime: number;
  status: "pending" | "in_progress" | "completed" | "skipped";
  result?: string;
}

export interface Risk {
  description: string;
  probability: number; // 0-1
  impact: number; // 0-1
  mitigation: string;
}

export interface Situation {
  context: string;
  domain: string;
  availableResources: string[];
  constraints: string[];
  recentEvents: string[];
  userGoals: string[];
}

// ===== GOAL GENERATION =====

/**
 * Phân tích situation và tạo goals
 */
export function generateGoalsFromSituation(situation: Situation, existingGoals: Goal[] = []): Goal[] {
  const goals: Goal[] = [];

  // 1. Performance improvement goals
  const perfGoals = generatePerformanceGoals(situation);
  goals.push(...perfGoals);

  // 2. Learning goals
  const learnGoals = generateLearningGoals(situation);
  goals.push(...learnGoals);

  // 3. Efficiency goals
  const effGoals = generateEfficiencyGoals(situation);
  goals.push(...effGoals);

  // 4. User satisfaction goals
  const satGoals = generateSatisfactionGoals(situation);
  goals.push(...satGoals);

  // 5. Deduplicate and prioritize
  const uniqueGoals = deduplicateGoals(goals);
  const prioritized = prioritizeGoals(uniqueGoals, existingGoals);

  return prioritized;
}

/**
 * Tạo performance goals
 */
function generatePerformanceGoals(situation: Situation): Goal[] {
  const goals: Goal[] = [];

  if (situation.domain === "agriculture") {
    goals.push(
      createGoal(
        "Tối ưu giá nông sản",
        "Phân tích thị trường và đề xuất giá bán tối ưu cho sản phẩm nông nghiệp",
        "agriculture",
        8,
        "high",
        [
          {
            id: "step1",
            description: "Thu thập dữ liệu giá thị trường",
            action: "fetch_market_data",
            parameters: { source: "local" },
            estimatedTime: 5,
            status: "pending",
          },
          {
            id: "step2",
            description: "Phân tích xu hướng giá",
            action: "analyze_trends",
            parameters: { period: "7d" },
            estimatedTime: 10,
            status: "pending",
          },
          {
            id: "step3",
            description: "Đề xuất giá tối ưu",
            action: "suggest_price",
            parameters: { margin: 0.15 },
            estimatedTime: 5,
            status: "pending",
          },
        ],
      ),
    );
  }

  return goals;
}

/**
 * Tạo learning goals
 */
function generateLearningGoals(situation: Situation): Goal[] {
  const goals: Goal[] = [];

  // Learn from recent errors
  if (situation.recentEvents.some((e) => e.includes("error") || e.includes("fail"))) {
    goals.push(
      createGoal("Cải thiện từ lỗi gần đây", "Phân tích và học hỏi từ các lỗi để tránh lặp lại", "learning", 7, "medium", [
        { id: "step1", description: "Liệt kê các lỗi gần đây", action: "list_errors", parameters: {}, estimatedTime: 5, status: "pending" },
        {
          id: "step2",
          description: "Phân tích root cause",
          action: "analyze_causes",
          parameters: {},
          estimatedTime: 15,
          status: "pending",
        },
        { id: "step3", description: "Tạo rules phòng tránh", action: "create_rules", parameters: {}, estimatedTime: 10, status: "pending" },
      ]),
    );
  }

  return goals;
}

/**
 * Tạo efficiency goals
 */
function generateEfficiencyGoals(situation: Situation): Goal[] {
  const goals: Goal[] = [];

  goals.push(
    createGoal("Tối ưu response time", "Giảm thời gian phản hồi bằng cách cache thêm queries phổ biến", "efficiency", 6, "medium", [
      {
        id: "step1",
        description: "Identify slow queries",
        action: "find_slow_queries",
        parameters: { threshold: 1000 },
        estimatedTime: 10,
        status: "pending",
      },
      { id: "step2", description: "Cache optimization", action: "optimize_cache", parameters: {}, estimatedTime: 20, status: "pending" },
    ]),
  );

  return goals;
}

/**
 * Tạo satisfaction goals
 */
function generateSatisfactionGoals(situation: Situation): Goal[] {
  const goals: Goal[] = [];

  if (situation.userGoals.length > 0) {
    goals.push(
      createGoal("Đáp ứng yêu cầu user", `Thực hiện: ${situation.userGoals.join(", ")}`, "user_satisfaction", 9, "high", [
        {
          id: "step1",
          description: "Parse user requirements",
          action: "parse_requirements",
          parameters: { goals: situation.userGoals },
          estimatedTime: 5,
          status: "pending",
        },
        { id: "step2", description: "Execute tasks", action: "execute_tasks", parameters: {}, estimatedTime: 30, status: "pending" },
        { id: "step3", description: "Verify completion", action: "verify_completion", parameters: {}, estimatedTime: 5, status: "pending" },
      ]),
    );
  }

  return goals;
}

/**
 * Helper: Create goal
 */
function createGoal(
  title: string,
  description: string,
  domain: string,
  priority: number,
  urgency: Goal["urgency"],
  steps: ActionStep[],
): Goal {
  return {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    description,
    domain,
    priority,
    urgency,
    status: "pending",
    progress: 0,
    createdAt: Date.now(),
    dependencies: [],
    subGoals: [],
    metrics: [],
    plan: {
      steps,
      estimatedDuration: steps.reduce((sum, s) => sum + s.estimatedTime, 0),
      resources: [],
      risks: [],
    },
  };
}

// ===== GOAL PRIORITIZATION =====

/**
 * Xếp hạng goals theo priority + urgency + dependency
 */
function prioritizeGoals(goals: Goal[], existingGoals: Goal[] = []): Goal[] {
  const urgencyWeight = { critical: 4, high: 3, medium: 2, low: 1 };

  return goals.sort((a, b) => {
    // Priority score
    const scoreA = a.priority * (urgencyWeight[a.urgency] || 1);
    const scoreB = b.priority * (urgencyWeight[b.urgency] || 1);

    // Penalty for existing goals (avoid duplication)
    const duplicatePenaltyA = existingGoals.some((g) => g.title === a.title) ? 0.5 : 1;
    const duplicatePenaltyB = existingGoals.some((g) => g.title === b.title) ? 0.5 : 1;

    return scoreB * duplicatePenaltyB - scoreA * duplicatePenaltyA;
  });
}

/**
 * Remove duplicate goals
 */
function deduplicateGoals(goals: Goal[]): Goal[] {
  const seen = new Set<string>();
  return goals.filter((g) => {
    const key = g.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ===== PLAN EXECUTION =====

/**
 * Execute goal plan
 */
export function executeGoal(goal: Goal): Goal {
  const updated = { ...goal };
  updated.status = "in_progress";

  for (const step of updated.plan.steps) {
    if (step.status === "completed" || step.status === "skipped") continue;

    step.status = "in_progress";

    // Execute step (simplified - in real implementation, would call actual functions)
    try {
      executeStep(step);
      step.status = "completed";
      step.result = "Success";
    } catch (error) {
      step.status = "skipped";
      step.result = `Error: ${error}`;
    }

    // Update progress
    const completedSteps = updated.plan.steps.filter((s) => s.status === "completed").length;
    updated.progress = (completedSteps / updated.plan.steps.length) * 100;
  }

  // Check if all steps completed
  const allCompleted = updated.plan.steps.every((s) => s.status === "completed");
  updated.status = allCompleted ? "completed" : "failed";

  return updated;
}

/**
 * Execute single step (placeholder)
 */
function executeStep(step: ActionStep): void {
  // In real implementation, this would dispatch to actual functions
  console.log(`[Goal Executor] Executing: ${step.description}`);

  switch (step.action) {
    case "fetch_market_data":
      // Would call market API
      break;
    case "analyze_trends":
      // Would run analysis
      break;
    case "suggest_price":
      // Would calculate optimal price
      break;
    default:
      // Generic execution
      break;
  }
}

// ===== SELF-MONITORING =====

/**
 * Đánh giá progress của tất cả goals
 */
export function evaluateGoalProgress(goals: Goal[]): {
  summary: string;
  completedCount: number;
  inProgressCount: number;
  failedCount: number;
  averageProgress: number;
  recommendations: string[];
} {
  const completed = goals.filter((g) => g.status === "completed").length;
  const inProgress = goals.filter((g) => g.status === "in_progress").length;
  const failed = goals.filter((g) => g.status === "failed").length;
  const avgProgress = goals.length > 0 ? goals.reduce((sum, g) => sum + g.progress, 0) / goals.length : 0;

  const recommendations: string[] = [];

  if (failed > 0) {
    recommendations.push(`${failed} goals failed - cần phân tích root cause`);
  }

  if (inProgress > 3) {
    recommendations.push("Quá nhiều goals đang chạy - nên defer bớt");
  }

  if (avgProgress < 30 && goals.length > 0) {
    recommendations.push("Tiến độ chậm - cần tăng resources hoặc giảm scope");
  }

  return {
    summary: `${completed}/${goals.length} completed, ${inProgress} in progress, ${failed} failed`,
    completedCount: completed,
    inProgressCount: inProgress,
    failedCount: failed,
    averageProgress: avgProgress,
    recommendations,
  };
}

// ===== ADAPTIVE REPLANNING =====

/**
 * Tự điều chỉnh kế hoạch khi có thay đổi
 */
export function replanGoal(goal: Goal, newSituation: Situation): Goal {
  const updated = { ...goal };

  // Re-prioritize based on new situation
  if (newSituation.constraints.length > 0) {
    updated.priority = Math.max(1, updated.priority - 1);
  }

  // Add new steps if needed
  if (newSituation.recentEvents.some((e) => e.includes("opportunity"))) {
    updated.plan.steps.push({
      id: `step_new_${Date.now()}`,
      description: "Capture new opportunity",
      action: "capture_opportunity",
      parameters: { events: newSituation.recentEvents },
      estimatedTime: 15,
      status: "pending",
    });
  }

  // Recalculate duration
  updated.plan.estimatedDuration = updated.plan.steps.filter((s) => s.status !== "completed").reduce((sum, s) => sum + s.estimatedTime, 0);

  return updated;
}

// ===== GOAL STORE =====

const goalStore = new Map<string, Goal[]>();

export function saveGoals(userId: string, goals: Goal[]): void {
  goalStore.set(userId, goals);
}

export function loadGoals(userId: string): Goal[] {
  return goalStore.get(userId) || [];
}

export function addGoal(userId: string, goal: Goal): Goal[] {
  const goals = loadGoals(userId);
  goals.push(goal);
  saveGoals(userId, goals);
  return goals;
}

export function updateGoalStatus(userId: string, goalId: string, status: Goal["status"], progress?: number): Goal[] {
  const goals = loadGoals(userId);
  const goal = goals.find((g) => g.id === goalId);

  if (goal) {
    goal.status = status;
    if (progress !== undefined) goal.progress = progress;
  }

  saveGoals(userId, goals);
  return goals;
}
