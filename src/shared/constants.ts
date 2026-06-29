export const serverAgentBudgets: Record<string, number> = {
  toLuong: 100000000,
  thuongNguyet: 100000000,
  tramTinh: 100000000,
  daoTieuCuu: 100000000,
  hoaHuynh: 100000000,
  phiNguyet: 100000000,
  nhuNguyet: 100000000,
  suGia: 100000000,
  phiAnh: 100000000,
  bachDiHanh: 100000000,
  uVuongMau: 100000000,
  bachLoc: 100000000,
};

export const serverAgentGold: Record<string, number> = {
  toLuong: 10,
  thuongNguyet: 10,
  tramTinh: 10,
  daoTieuCuu: 10,
  hoaHuynh: 10,
  phiNguyet: 10,
  nhuNguyet: 10,
  suGia: 10,
  phiAnh: 10,
  bachDiHanh: 10,
  uVuongMau: 10,
  bachLoc: 10,
};

export const serverAgentEmployees: Record<string, number> = {
  toLuong: 5,
  thuongNguyet: 5,
  tramTinh: 5,
  daoTieuCuu: 5,
  hoaHuynh: 5,
  phiNguyet: 5,
  nhuNguyet: 5,
  suGia: 5,
  phiAnh: 5,
  bachDiHanh: 5,
  uVuongMau: 5,
  bachLoc: 5,
};

export const negotiationTitles: Record<number, string[]> = {
  1: ["Làm được (Doing) | Mẹo nhỏ", "Làm được (Doing) | Sơ cấp đàm phán", "Làm được (Doing) | Chập chững thương đạo"],
  2: ["Làm được (Doing) | Mẹo nhỏ", "Làm được (Doing) | Thương thảo cẩn trọng", "Làm được (Doing) | Khởi đầu dè dặt"],
  3: ["Làm được (Doing) | Mẹo nhỏ", "Làm được (Doing) | Biết mình biết ta", "Làm được (Doing) | Tự tin thương thảo"],
  4: [
    "Hiểu cốt lõi (Understanding) | Nguyên lý",
    "Hiểu cốt lõi (Understanding) | Kiên định lập trường",
    "Hiểu cốt lõi (Understanding) | Rõ ràng mục tiêu",
  ],
  5: [
    "Hiểu cốt lõi (Understanding) | Nguyên lý",
    "Hiểu cốt lõi (Understanding) | Chừng mực đối nhân",
    "Hiểu cốt lõi (Understanding) | Thực tế thương lượng",
  ],
  6: [
    "Hiểu cốt lõi (Understanding) | Nguyên lý",
    "Hiểu cốt lõi (Understanding) | Ngoại giao khéo léo",
    "Hiểu cốt lõi (Understanding) | Nhạy bén thời cuộc",
  ],
  7: [
    "Hiểu cốt lõi (Understanding) | Nguyên lý",
    "Hiểu cốt lõi (Understanding) | Sắc bén lý luận",
    "Hiểu cốt lõi (Understanding) | Nhanh nhạy ứng biến",
  ],
  8: [
    "Linh hoạt & biến đổi (Adapting) | Trải nghiệm + Phản hồi",
    "Linh hoạt & biến đổi (Adapting) | Cứng rắn lập trường",
    "Linh hoạt & biến đổi (Adapting) | Ý chí thép",
  ],
  9: [
    "Linh hoạt & biến đổi (Adapting) | Trải nghiệm + Phản hồi",
    "Linh hoạt & biến đổi (Adapting) | Lão luyện thương trường",
    "Linh hoạt & biến đổi (Adapting) | Cáo già thương hội",
  ],
  10: [
    "Linh hoạt & biến đổi (Adapting) | Trải nghiệm + Phản hồi",
    "Linh hoạt & biến đổi (Adapting) | Thần thương lượng",
    "Linh hoạt & biến đổi (Adapting) | Bậc thầy ngoại giao",
  ],
  11: [
    "Linh hoạt & biến đổi (Adapting) | Trải nghiệm + Phản hồi",
    "Linh hoạt & biến đổi (Adapting) | Đại sư thương đạo",
    "Linh hoạt & biến đổi (Adapting) | Dẫn dắt cuộc chơi",
  ],
  12: [
    "Sáng tạo (Creating) | Hệ thống + Quy trình + Tư duy",
    "Sáng tạo (Creating) | Kẻ định đoạt cuộc chơi",
    "Sáng tạo (Creating) | Xoay chuyển càn khôn",
  ],
  13: [
    "Sáng tạo (Creating) | Hệ thống + Quy trình + Tư duy",
    "Sáng tạo (Creating) | Thao túng tâm lý",
    "Sáng tạo (Creating) | Bất khả chiến bại",
  ],
  14: [
    "Sáng tạo (Creating) | Hệ thống + Quy trình + Tư duy",
    "Sáng tạo (Creating) | Quỷ quyệt vô song",
    "Sáng tạo (Creating) | Thống trị bàn cân",
  ],
  15: [
    "Sáng tạo (Creating) | Hệ thống + Quy trình + Tư duy",
    "Sáng tạo (Creating) | Chúa tể đàm phán",
    "Sáng tạo (Creating) | Đỉnh phong thương giới",
    "Sáng tạo (Creating) | Độc cô cầu bại",
  ],
};

export function getDynamicSkillTitle(agentId: string, level: number): string {
  const titles = negotiationTitles[level] || ["Thương thảo"];
  const cleanId = agentId.replace(/^user_?/, "");
  let charSum = 0;
  for (let i = 0; i < cleanId.length; i++) {
    charSum += cleanId.charCodeAt(i);
  }
  const idx = charSum % titles.length;
  return `${titles[idx]} (Cấp ${level})`;
}

export interface DecodingSettings {
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  repetitionPenalty?: number;
  maxTokens?: number;
}

export const defaultDecodingSettings: DecodingSettings = {
  temperature: 0.7,
  topP: 0.9,
  presencePenalty: 0.15,
  frequencyPenalty: 0.15,
  repetitionPenalty: 1.1,
};

export const maxContextChunkWords = 350;

export interface AgentLoanParameters {
  baseIncome: number;
  pDefault: number;
  behaviorScore: number;
  creditHistoryFactor: number;
  policyApproval: number;
  macroAdjustment: number;
}

export const agentLoanParametersMap: Record<string, AgentLoanParameters> = {
  toLuong: {
    baseIncome: 50000000,
    pDefault: 0.7,
    behaviorScore: 1.5,
    creditHistoryFactor: 1.6,
    policyApproval: 1.2,
    macroAdjustment: 0.12,
  },
  thuongNguyet: {
    baseIncome: 45000000,
    pDefault: 0.68,
    behaviorScore: 1.4,
    creditHistoryFactor: 1.5,
    policyApproval: 1.1,
    macroAdjustment: 0.11,
  },
  tramTinh: {
    baseIncome: 30000000,
    pDefault: 0.75,
    behaviorScore: 1.2,
    creditHistoryFactor: 1.2,
    policyApproval: 1.0,
    macroAdjustment: 0.1,
  },
  daoTieuCuu: {
    baseIncome: 25000000,
    pDefault: 0.8,
    behaviorScore: 1.1,
    creditHistoryFactor: 1.1,
    policyApproval: 0.9,
    macroAdjustment: 0.08,
  },
  hoaHuynh: {
    baseIncome: 35000000,
    pDefault: 0.78,
    behaviorScore: 1.3,
    creditHistoryFactor: 1.2,
    policyApproval: 1.1,
    macroAdjustment: 0.09,
  },
  phiNguyet: {
    baseIncome: 32000000,
    pDefault: 0.72,
    behaviorScore: 1.25,
    creditHistoryFactor: 1.3,
    policyApproval: 1.0,
    macroAdjustment: 0.12,
  },
  nhuNguyet: {
    baseIncome: 38000000,
    pDefault: 0.7,
    behaviorScore: 1.35,
    creditHistoryFactor: 1.4,
    policyApproval: 1.15,
    macroAdjustment: 0.13,
  },
  suGia: {
    baseIncome: 40000000,
    pDefault: 0.74,
    behaviorScore: 1.3,
    creditHistoryFactor: 1.35,
    policyApproval: 1.1,
    macroAdjustment: 0.11,
  },
  phiAnh: {
    baseIncome: 28000000,
    pDefault: 0.76,
    behaviorScore: 1.15,
    creditHistoryFactor: 1.2,
    policyApproval: 1.0,
    macroAdjustment: 0.09,
  },
  bachDiHanh: {
    baseIncome: 33000000,
    pDefault: 0.75,
    behaviorScore: 1.2,
    creditHistoryFactor: 1.25,
    policyApproval: 1.05,
    macroAdjustment: 0.1,
  },
  uVuongMau: {
    baseIncome: 48000000,
    pDefault: 0.71,
    behaviorScore: 1.45,
    creditHistoryFactor: 1.55,
    policyApproval: 1.2,
    macroAdjustment: 0.14,
  },
  bachLoc: {
    baseIncome: 22000000,
    pDefault: 0.85,
    behaviorScore: 1.0,
    creditHistoryFactor: 1.0,
    policyApproval: 0.9,
    macroAdjustment: 0.07,
  },
};

export function calculateAgentLoanAmount(agentId: string): number {
  const cleanId = agentId.replace(/^user_?/, "");
  const params = agentLoanParametersMap[cleanId] || {
    baseIncome: 25000000,
    pDefault: 0.1,
    behaviorScore: 1.0,
    creditHistoryFactor: 1.0,
    policyApproval: 1.0,
    macroAdjustment: 1.0,
  };
  return Math.round(
    params.baseIncome *
      (1 - params.pDefault) *
      params.behaviorScore *
      params.creditHistoryFactor *
      params.policyApproval *
      params.macroAdjustment,
  );
}
