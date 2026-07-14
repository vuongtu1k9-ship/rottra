import { Deterministic } from "~/shared/utils/rng";
export interface KnowledgeItem {
  id: string;
  title: string;
  subtitle?: string;
  definition: string;
  explanation: string;
  application: string;
  formulas?: string[];
  tags: string[];
  tenantId?: string | null;
}

export const AgentKnowledgeBase: Record<string, KnowledgeItem[]> = {
  statistics: [
    {
      id: "stat_desc",
      title: "Thống kê Mô tả & Số đặc trưng",
      subtitle: "Mean, Median, Variance, StdDev, Covariance, Pearson",
      definition: "Đo lường các đặc trưng mô tả của dữ liệu lúa và cây trồng nông nghiệp.",
      explanation: "Bao gồm tính toán kỳ vọng (mean), phương sai (variance), hiệp phương sai (covariance) và hệ số tương quan Pearson.",
      application: "Đánh giá sự ổn định của năng suất nông sản qua các mùa vụ.",
      formulas: [
        "Trung bình: mean = (1/n) * sum(x_i)",
        "Phương sai mẫu: s^2 = (1/(n-1)) * sum((x_i - mean)^2)",
        "Độ lệch chuẩn: s = sqrt(s^2)",
      ],
      tags: ["statistics", "math"],
    },
    {
      id: "stat_kalman",
      title: "Bộ lọc Kalman",
      subtitle: "Lọc Kalman khử nhiễu cảm biến IoT",
      definition: "Thuật toán ước lượng trạng thái từ dữ liệu nhiễu đo lường.",
      explanation: "Ước lượng trạng thái thực qua hai bước: Dự báo và Cập nhật trạng thái.",
      application: "Khử nhiễu dữ liệu cảm biến độ ẩm, nhiệt độ đất trong nông nghiệp thông minh.",
      formulas: [
        "Dự báo: x_hat_k = phi * x_hat_k-1",
        "Độ lợi Kalman: K_k = P_k / (P_k + R)",
        "Cập nhật: x_hat_k = x_hat_k + K_k * (z_k - x_hat_k)",
      ],
      tags: ["algorithm", "sensor", "kalman"],
    },
    {
      id: "stat_bertrand",
      title: "Nghịch lý Bertrand",
      subtitle: "Xác suất cổ điển và phương pháp chọn ngẫu nhiên",
      definition: "Nghịch lý chỉ ra xác suất chọn dây cung lớn hơn cạnh tam giác đều phụ thuộc cách chọn ngẫu nhiên.",
      explanation: "Ba phương pháp chọn ngẫu nhiên: đầu mút ngẫu nhiên (P=1/3), bán kính ngẫu nhiên (P=1/2), điểm giữa ngẫu nhiên (P=1/4).",
      application: "Nghiên cứu tính bất biến nhóm dưới các phép tịnh tiến và quay trong không gian liên tục.",
      formulas: ["P_endpoints: P = 1/3", "P_radius: P = 1/2", "P_point: P = 1/4"],
      tags: ["probability", "paradox"],
    },
  ],
  academic: [
    {
      id: "acad_olbers",
      title: "Nghịch lý Olbers",
      subtitle: "Bầu trời đêm tối và sự giãn nở vũ trụ",
      definition: "Nghịch lý vũ trụ học về việc tại sao bầu trời đêm lại tối trong vũ trụ vô hạn.",
      explanation: "Giải quyết bằng tuổi hữu hạn của vũ trụ và dịch chuyển đỏ do vũ trụ giãn nở phi tuyến.",
      application: "Ứng dụng trong các bài toán thiên văn học và vật lý hiện đại.",
      formulas: ["Cường độ ánh sáng: I = integral(4*pi*rho*dr) = infinity"],
      tags: ["cosmology", "physics", "paradox"],
    },
  ],
  cognitive: [
    {
      id: "cog_deltafosb",
      title: "DeltaFosB & Hệ thống khen thưởng",
      subtitle: "Cơ chế thần kinh củng cố thói quen",
      definition: "DeltaFosB là protein phiên mã bền vững đóng vai trò là công tắc phân tử cho hành vi dài hạn.",
      explanation: "Sự tích lũy DeltaFosB thúc đẩy độ dẻo synapse và củng cố hành vi thích nghi tích cực.",
      application: "Mô hình hóa hành vi dài hạn và học tăng cường của tác nhân AI (Agent).",
      formulas: [],
      tags: ["neurobiology", "cognitive", "learning"],
    },
  ],
  economics: [
    {
      id: "econ_bertrand",
      title: "Cạnh tranh Bertrand",
      subtitle: "Mô hình độc quyền nhóm cạnh tranh giá",
      definition: "Mô hình lý thuyết trò chơi kinh tế mô tả sự cạnh tranh giá giữa các doanh nghiệp độc quyền nhóm.",
      explanation: "Doanh nghiệp cạnh tranh bằng cách đặt giá, dẫn đến cân bằng khi giá bán bằng chi phí biên.",
      application: "Xây dựng chiến lược định giá tối ưu cho thị trường nông sản.",
      formulas: ["Cân bằng Nash: P_1 = P_2 = MC"],
      tags: ["economics", "game_theory"],
    },
  ],
};

export function getRandomKnowledge(category: string): KnowledgeItem | undefined {
  const items = AgentKnowledgeBase[category];
  if (!items || items.length === 0) return undefined;
  const idx = Math.floor(Deterministic.random() * items.length);
  return items[idx];
}
