/**
 * 🏌️‍♂️ RỐT-TRA CODE GOLF ENGINE (Native TS)
 * Trình thông dịch cực ngắn (Single-character Interpreter) phong cách Vyxal/Jelly.
 * Vẫn giữ được đặc tính Zero-allocation trên mảng Float32Array.
 */

import { crossProduct3D } from "../quant-engine/electromagnetism";
import { vecDot } from "../quant-engine/vector-simd";

export class GolfLangVM {
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
   * Trình quét chuỗi mã Golf (1 ký tự = 1 lệnh)
   */
  public eval(code: string): void {
    let i = 0;
    while (i < code.length) {
      const char = code[i];

      // Bỏ qua khoảng trắng
      if (char === " " || char === "\t" || char === "\n") {
        i++;
        continue;
      }

      // Quét số (bao gồm số thập phân và dấu âm)
      if ((char >= "0" && char <= "9") || (char === "-" && i + 1 < code.length && code[i + 1] >= "0" && code[i + 1] <= "9")) {
        let numStr = char;
        i++;
        while (i < code.length && ((code[i] >= "0" && code[i] <= "9") || code[i] === ".")) {
          numStr += code[i];
          i++;
        }
        this.push(Number(numStr));
        continue; // Đã tăng i trong lúc quét số, nhảy sang vòng lặp tiếp theo
      }

      // Quét toán tử (1 ký tự)
      switch (char) {
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

        // Tích vô hướng (nếu dấu '.' đứng độc lập)
        case ".": {
          const b = this.pop();
          const a = this.pop();
          if (a.length !== b.length) throw new Error("Dot product requires equal length vectors");
          this.push(vecDot(a, b));
          break;
        }

        // Tích có hướng
        case "x": {
          const b = this.pop();
          const a = this.pop();
          if (a.length !== 3 || b.length !== 3) throw new Error("Cross product requires 3D vectors");
          const out = new Float32Array(3);
          crossProduct3D(out, a, b);
          this.push(out);
          break;
        }

        // Vectorize: Pop phần tử trên cùng làm (N) (số chiều), sau đó Pop (N) phần tử gom thành 1 Vector
        case "v": {
          const nVec = this.pop();
          if (nVec.length !== 1) throw new Error("'v' command expects a scalar dimension");
          const n = nVec[0];
          if (this.stack.length < n) throw new Error("Stack underflow during vectorize 'v'");

          const vec = new Float32Array(n);
          // Pop theo thứ tự ngược
          for (let j = n - 1; j >= 0; j--) {
            const val = this.pop();
            if (val.length !== 1) throw new Error("Vectorize 'v' requires scalar values on stack");
            vec[j] = val[0];
          }
          this.push(vec);
          break;
        }

        // Toán tử ngăn xếp
        case "d": {
          // duplicate
          const top = this.peek();
          this.push(new Float32Array(top));
          break;
        }
        case "s": {
          // swap
          const b = this.pop();
          const a = this.pop();
          this.push(b);
          this.push(a);
          break;
        }
        case "_": {
          // drop
          this.pop();
          break;
        }

        default:
          throw new Error(`Golf Engine Error - Unknown glyph: '${char}'`);
      }
      i++;
    }
  }

  /**
   * Broadcast Toán tử 2 ngôi
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
}
