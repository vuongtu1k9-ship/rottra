/**
 * 🧲 MÔ HÌNH VẬT LÝ ĐIỆN TỪ HỌC (Electromagnetism Engine)
 * Áp dụng vật lý từ trường vào không gian ngữ nghĩa lượng tử của bầy đàn AI.
 *
 * - Quy tắc bàn tay phải (Right-Hand Rule) thông qua tích có hướng (Cross Product).
 * - Cường độ từ trường B = 2*10^-7 * I / r.
 * - Lực hút/đẩy: Các dòng điện cùng chiều sẽ hút nhau, ngược chiều sẽ đẩy nhau.
 */

import { vecDot } from "./vector-simd";

// Hằng số từ trường theo không gian chân không (rút gọn)
export const MU_0_OVER_2PI = 2e-7;

/**
 * Tính tích có hướng (Cross Product) của 2 vector 3D
 * Mô phỏng Quy tắc bàn tay phải: Ngón cái (C) vuông góc với 4 ngón tay (A) và lòng bàn tay (B).
 * Zero-allocation: Ghi đè trực tiếp kết quả vào mảng `out`.
 */
export function crossProduct3D(out: Float32Array, a: Float32Array, b: Float32Array): void {
  const ax = a[0],
    ay = a[1],
    az = a[2];
  const bx = b[0],
    by = b[1],
    bz = b[2];

  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
}

/**
 * Tính bình phương khoảng cách giữa hai vector (Euclidean distance squared)
 */
export function distanceSquared(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
}

/**
 * Tính khoảng cách (r) giữa hai điểm.
 */
export function distance(a: Float32Array, b: Float32Array): number {
  return Math.sqrt(distanceSquared(a, b));
}

/**
 * Tính cảm ứng từ B sinh ra từ Agent 1 (dòng I1) tại vị trí của Agent 2 (khoảng cách r)
 * Công thức: B = 2*10^-7 * I / r
 * @param currentMagnitude Cường độ dòng điện (Khối lượng/Ý chí của Agent)
 * @param r Khoảng cách giữa 2 Agent
 * @returns Độ lớn cảm ứng từ B
 */
export function calculateMagneticFieldMagnitude(currentMagnitude: number, r: number): number {
  if (r < 1e-6) return 0; // Tránh chia cho 0 khi 2 agent quá gần
  return (MU_0_OVER_2PI * currentMagnitude) / r;
}

/**
 * Tính lực điện từ Ampère tương tác giữa hai Agent (Vector A và Vector B)
 * Áp dụng quy tắc: Cùng chiều hút nhau, ngược chiều đẩy nhau.
 *
 * Nếu Agent A và Agent B có vector dòng điện I1 và I2:
 * F = (2*10^-7 * I1 * I2 / r) * L (giả sử chiều dài L tương tác là 1 đơn vị)
 *
 * Hàm này tính toán và ghi lực dịch chuyển cho Agent B (bị tác dụng bởi Agent A)
 * vào vector `forceOut`.
 *
 * @param forceOut Vector lực tác dụng lên Agent B (zero-allocation)
 * @param posA Vị trí của Agent A (không gian n-chiều)
 * @param posB Vị trí của Agent B (không gian n-chiều)
 * @param currentA Vector chiều dòng điện (hoặc xu hướng ngữ nghĩa) của Agent A
 * @param currentB Vector chiều dòng điện (hoặc xu hướng ngữ nghĩa) của Agent B
 * @param massA "Cường độ dòng điện" I1 (Sức ảnh hưởng của A)
 * @param massB "Cường độ dòng điện" I2 (Sức ảnh hưởng của B)
 */
export function applyElectromagneticForce(
  forceOut: Float32Array,
  posA: Float32Array,
  posB: Float32Array,
  currentA: Float32Array,
  currentB: Float32Array,
  massA: number,
  massB: number,
): void {
  const r = distance(posA, posB);
  if (r < 1e-6) {
    // Quá gần, không xét lực
    for (let i = 0; i < forceOut.length; i++) forceOut[i] = 0;
    return;
  }

  // Độ lớn lực: F = 2*10^-7 * I1 * I2 / r
  const forceMagnitude = (MU_0_OVER_2PI * massA * massB) / r;

  // Xác định tương quan chiều: Cùng chiều hay Ngược chiều?
  // Dùng Tích vô hướng (Dot Product) để xác định thay vì Cosine.
  // dot(currentA, currentB) > 0 => Cùng chiều (Hút)
  // dot(currentA, currentB) < 0 => Ngược chiều (Đẩy)
  const directionFactor = vecDot(currentA, currentB);

  // Phân cực (Hút hay đẩy):
  // Trái dấu đẩy nhau (opposite direction), Cùng dấu hút nhau (same direction)
  const polarity = Math.sign(directionFactor) || 1;

  for (let i = 0; i < forceOut.length; i++) {
    // Vector chỉ phương đơn vị từ B tới A (hướng Hút)
    const unitDir = (posA[i] - posB[i]) / r;

    // Áp dụng độ lớn lực và phân cực
    // polarity = 1 -> Lực dương -> Hướng về phía A (Hút)
    // polarity = -1 -> Lực âm -> Hướng ra xa A (Đẩy)
    forceOut[i] = unitDir * forceMagnitude * polarity;
  }
}
