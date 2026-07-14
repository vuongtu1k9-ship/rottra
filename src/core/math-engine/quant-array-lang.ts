/**
 * 🧮 QUẢN LÝ NGÔN NGỮ MẢNG DẠNG NGĂN XẾP (Stack-Based Array Language VM)
 * Lấy cảm hứng từ Uiua / MATL / APL.
 * Hoạt động zero-allocation hoặc minimal-allocation trên `Float32Array`.
 */

import { crossProduct3D } from "../quant-engine/electromagnetism";
import { vecDot } from "../quant-engine/vector-simd";

export class ArrayLangVM {
  public stack: Float32Array[] = [];

  public push(val: Float32Array | number) {
    if (typeof val === "number") {
      this.stack.push(new Float32Array([val]));
    } else {
      this.stack.push(val);
    }
  }

  public pop(): Float32Array {
    if (this.stack.length === 0) throw new Error("Stack underflow");
    return this.stack.pop()!;
  }

  public peek(): Float32Array {
    if (this.stack.length === 0) throw new Error("Stack underflow");
    return this.stack[this.stack.length - 1];
  }

  /**
   * Đánh giá một chuỗi mã nguồn dạng Array/Stack (giống MATL/Uiua)
   * Phân tách bằng khoảng trắng.
   */
  public eval(code: string): void {
    const tokens = code.trim().split(/\s+/);

    for (const token of tokens) {
      if (token === "") continue;

      const num = Number(token);
      if (!Number.isNaN(num)) {
        this.push(num);
        continue;
      }

      switch (token.toLowerCase()) {
        case "+":
          this.opBinary((a, b) => a + b);
          break;
        case "-":
          this.opBinary((a, b) => a - b);
          break;
        case "*":
          this.opBinary((a, b) => a * b);
          break;
        case "/":
          this.opBinary((a, b) => a / b);
          break;

        case "dot": {
          const b = this.pop();
          const a = this.pop();
          if (a.length !== b.length) throw new Error("Dot product requires equal length vectors");
          this.push(vecDot(a, b));
          break;
        }
        case "cross": {
          const b = this.pop();
          const a = this.pop();
          if (a.length !== 3 || b.length !== 3) throw new Error("Cross product requires 3D vectors");
          const out = new Float32Array(3);
          crossProduct3D(out, a, b);
          this.push(out);
          break;
        }

        case "dup": {
          const top = this.peek();
          this.push(new Float32Array(top));
          break;
        }
        case "swap": {
          const b = this.pop();
          const a = this.pop();
          this.push(b);
          this.push(a);
          break;
        }
        case "drop": {
          this.pop();
          break;
        }

        case "v2":
          this.makeVector(2);
          break;
        case "v3":
          this.makeVector(3);
          break;
        case "v4":
          this.makeVector(4);
          break;

        default:
          throw new Error(`Unknown token/instruction: ${token}`);
      }
    }
  }

  /**
   * Toán tử 2 ngôi (Binary Vectorized Operation)
   * Tự động broadcast nếu 1 bên là Scalar (mảng 1 phần tử)
   */
  private opBinary(op: (a: number, b: number) => number) {
    const b = this.pop();
    const a = this.pop();

    const len = Math.max(a.length, b.length);
    const isScalarA = a.length === 1;
    const isScalarB = b.length === 1;

    if (!isScalarA && !isScalarB && a.length !== b.length) {
      throw new Error("Vector size mismatch in binary operation");
    }

    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const valA = isScalarA ? a[0] : a[i];
      const valB = isScalarB ? b[0] : b[i];
      out[i] = op(valA, valB);
    }
    this.push(out);
  }

  /**
   * Gom N phần tử trên cùng của ngăn xếp thành 1 Vector (Float32Array)
   * Lưu ý: Pop theo thứ tự ngược nên cần đảo mảng.
   */
  private makeVector(n: number) {
    if (this.stack.length < n) throw new Error("Stack underflow during makeVector");
    const vec = new Float32Array(n);
    for (let i = n - 1; i >= 0; i--) {
      const val = this.pop();
      if (val.length !== 1) throw new Error("makeVector requires scalar values on stack");
      vec[i] = val[0];
    }
    this.push(vec);
  }
}
