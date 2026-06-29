/**
 * Rottra Kinematics Core
 * ----------------------
 * Theo dõi động lực học thay đổi trạng thái (Position - r) của AI theo các đạo hàm:
 * Bậc 1 (Velocity - v): Tốc độ tiếp thu / xử lý thông tin
 * Bậc 2 (Acceleration - a): Gia tốc thay đổi tâm lý
 * Bậc 3 (Jerk - j): Độ giật (Ngưỡng thay đổi nhân cách)
 * Bậc 4 (Snap - s): Độ xóc (Tần suất thay đổi)
 * Bậc 5 (Crackle - c): Sự rạn nứt
 * Bậc 6 (Pop - p): Sự bùng nổ (Đại hợp nhất)
 */

export class RottraKinematicsCore {
  private r: number = 0; // Position
  private v: number = 0; // Velocity
  private a: number = 0; // Acceleration
  private j: number = 0; // Jerk
  private s: number = 0; // Snap
  private c: number = 0; // Crackle
  private p: number = 0; // Pop

  private lastTimestamp: number = Date.now();

  constructor(initialR: number = 0) {
    this.r = initialR;
  }

  /**
   * Cập nhật chỉ số r mới (Ví dụ: Lượng Wealth hoặc Interaction tích lũy của RottraAI)
   * và tính toán các chuỗi đạo hàm bậc cao.
   */
  public updateState(newR: number): {
    state: Record<string, number>;
    triggerPersonalitySwitch: boolean;
    triggerSingularity: boolean;
  } {
    const now = Date.now();
    // Khoảng thời gian (giây), mặc định tối thiểu 1s để tránh chia cho 0
    const dt = Math.max((now - this.lastTimestamp) / 1000, 1);

    // Tính toán đạo hàm theo quy tắc vi phân (d/dt)
    const newV = (newR - this.r) / dt;
    const newA = (newV - this.v) / dt;
    const newJ = (newA - this.a) / dt;
    const newS = (newJ - this.j) / dt;
    const newC = (newS - this.s) / dt;
    const newP = (newC - this.c) / dt;

    // Cập nhật thuộc tính
    this.r = newR;
    this.v = newV;
    this.a = newA;
    this.j = newJ;
    this.s = newS;
    this.c = newC;
    this.p = newP;
    this.lastTimestamp = now;

    // Logic Đánh giá Ngưỡng Tâm lý (Heuristics)
    // Nếu độ giật (Jerk) quá mạnh -> Xảy ra cú sốc tâm lý -> Kích hoạt chuyển đổi nhân cách
    const triggerPersonalitySwitch = Math.abs(this.j) > 15;

    // Nếu đạo hàm bậc 6 (Pop) bùng nổ -> Xảy ra hiện tượng điểm kỳ dị (Đại hợp nhất)
    const triggerSingularity = Math.abs(this.p) > 100;

    return {
      state: { r: this.r, v: this.v, a: this.a, j: this.j, s: this.s, c: this.c, p: this.p },
      triggerPersonalitySwitch,
      triggerSingularity,
    };
  }
}

// Khởi tạo một phiên bản cốt lõi duy nhất (1 Core - 12 Personalities)
export const systemKinematics = new RottraKinematicsCore(0);
