/**
 * ROTTRA COGNITIVE QUATERNION CORTEX (QACRO)
 * -------------------------------------------------------------------------
 * Định lý xoay nhận thức 4 chiều trong không gian Euler-Hamilton:
 * Bảo toàn năng lượng tâm lý tổng quát: w^2 + x^2 + y^2 + z^2 = 1.
 * Tránh Gimbal Lock trong việc thay đổi tính cách của các Agent Swarm.
 * -------------------------------------------------------------------------
 */

export class Quaternion {
  constructor(
    public w: number, // Lý tính / Cân bằng
    public x: number, // Greed (Tham lam)
    public y: number, // Vengeance (Thù hằn)
    public z: number, // Malice (Thâm độc)
  ) {}

  // Chuẩn hóa về độ dài = 1 (Bảo toàn năng lượng nhận thức)
  normalize(): Quaternion {
    const len = Math.sqrt(this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z);
    if (len === 0) return new Quaternion(1, 0, 0, 0);
    return new Quaternion(this.w / len, this.x / len, this.y / len, this.z / len);
  }

  // Nhân Tứ nguyên số (Phép quay nhận thức)
  multiply(q: Quaternion): Quaternion {
    return new Quaternion(
      this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z,
      this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
      this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
      this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w,
    );
  }

  // Tứ nguyên số liên hợp (cognitive inverse rotation)
  conjugate(): Quaternion {
    return new Quaternion(this.w, -this.x, -this.y, -this.z);
  }
}

/**
 * Xoay hướng tính cách (DNA) của Agent dựa trên tâm lý/thái độ hội thoại.
 * w: Hợp lý (Rationality), x: Tham lam (Greed), y: Thù hằn (Vengeance), z: Thâm độc (Malice)
 */
export function rotateAgentCognitiveState(
  currentGreed: number,
  currentVengeance: number,
  currentMalice: number,
  influenceType: "angry" | "positive" | "neutral",
): { greed: number; vengeance: number; malice: number } {
  // Chuyển đổi trạng thái hiện tại sang tọa độ Quaternion
  // Lấy w làm đối trọng cân bằng (tổng bình phương bằng 1)
  const squaredSum = currentGreed * currentGreed + currentVengeance * currentVengeance + currentMalice * currentMalice;
  const w = Math.sqrt(Math.max(0.1, 1 - Math.min(0.9, squaredSum / 3)));

  const q = new Quaternion(w, currentGreed, currentVengeance, currentMalice).normalize();

  // Định nghĩa toán tử ảnh hưởng tâm lý (Quaternion Rotator p)
  let p: Quaternion;
  if (influenceType === "angry") {
    // Xoay mạnh về hướng Thù Hằn (trục y)
    const theta = 0.22; // góc xoay nhận thức
    p = new Quaternion(Math.cos(theta / 2), 0, Math.sin(theta / 2), 0).normalize();
  } else if (influenceType === "positive") {
    // Xoay về hướng Tham Lam (trục x) và Hợp Lý (w)
    const theta = 0.22;
    p = new Quaternion(Math.cos(theta / 2), Math.sin(theta / 2), 0, 0).normalize();
  } else {
    // Xoay nhẹ về hướng Thâm Độc/Mưu Mẹo (trục z) khi đàm phán thông thường
    const theta = 0.12;
    p = new Quaternion(Math.cos(theta / 2), 0, 0, Math.sin(theta / 2)).normalize();
  }

  // Thực hiện phép quay: q' = p * q * p_conjugate
  const qPrime = p.multiply(q).multiply(p.conjugate());

  // Ánh xạ ngược lại các tham số trong khoảng [0, 1]
  const nextGreed = Math.min(1, Math.max(0, Math.abs(qPrime.x)));
  const nextVengeance = Math.min(1, Math.max(0, Math.abs(qPrime.y)));
  const nextMalice = Math.min(1, Math.max(0, Math.abs(qPrime.z)));

  return {
    greed: parseFloat(nextGreed.toFixed(3)),
    vengeance: parseFloat(nextVengeance.toFixed(3)),
    malice: parseFloat(nextMalice.toFixed(3)),
  };
}

/**
 * Tự động điều chỉnh hoặc bổ sung hậu tố trạng thái cảm xúc (DNA Subtext)
 * dựa trên các tọa độ vectơ của Tứ nguyên số nhằm tăng độ sống động khi offline.
 */
export function applyDnaMoodToText(text: string, greed: number, vengeance: number, malice: number): string {
  const indicators: string[] = [];

  if (greed > 0.75) {
    indicators.push(`💰 Tham lam: ${(greed * 100).toFixed(0)}%`);
  } else if (greed < 0.25) {
    indicators.push(`⚖️ Công bằng: ${(100 - greed * 100).toFixed(0)}%`);
  }

  if (vengeance > 0.75) {
    indicators.push(`⚡ Thù hằn: ${(vengeance * 100).toFixed(0)}%`);
  } else if (vengeance < 0.25) {
    indicators.push(`🕊️ Ôn hòa: ${(100 - vengeance * 100).toFixed(0)}%`);
  }

  if (malice > 0.75) {
    indicators.push(`🔮 Thâm độc: ${(malice * 100).toFixed(0)}%`);
  } else if (malice < 0.25) {
    indicators.push(`🤝 Chân thành: ${(100 - malice * 100).toFixed(0)}%`);
  }

  if (indicators.length > 0) {
    return `${text}\n\n*(Trạng thái tâm lý: ${indicators.join(" | ")})*`;
  }
  return text;
}
