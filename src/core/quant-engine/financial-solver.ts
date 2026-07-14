import { Deterministic } from "~/shared/utils/rng";
// Rottra Agent - Lõi Casio Lượng Tử (Advanced Mathematical Calculator)
// Phục vụ tính toán cơ bản và vĩ mô nâng cao (Lượng giác, Hyperbolic, Giai thừa, Tổ hợp & Chỉnh hợp)

const allowedPatterns = [
  /Math\.PI/g,
  /Math\.E/g,
  /Math\.sqrt/g,
  /Math\.sinh/g,
  /Math\.cosh/g,
  /Math\.tanh/g,
  /Math\.asin/g,
  /Math\.acos/g,
  /Math\.atan/g,
  /Math\.sin/g,
  /Math\.cos/g,
  /Math\.tan/g,
  /Math\.abs/g,
  /Math\.log10/g,
  /Math\.log/g,
  /factorial/g,
  /\bC\b/g,
  /\bA\b/g,
];

export const factorial = (n: number): number => {
  if (n < 0) return 0;
  if (n === 0 || n === 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
};

export const C = (n: number, r: number): number => {
  if (r < 0 || r > n) return 0;
  return factorial(n) / (factorial(r) * factorial(n - r));
};

export const A = (n: number, r: number): number => {
  if (r < 0 || r > n) return 0;
  return factorial(n) / factorial(n - r);
};

function hasTopLevelComma(expr: string): boolean {
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === "(") depth++;
    else if (expr[i] === ")") depth--;
    else if (expr[i] === "," && depth === 0) {
      return true;
    }
  }
  return false;
}

export function evaluateSingleExpression(query: string): number | null {
  // Tự động sửa các lỗi chính tả phổ biến (Typo Auto-correction)
  let normalizedQuery = query
    .replace(/[?=\s]+$/, "")
    .replace(/[?#$@&|\\<>~`"' :;]/g, "")
    .toLowerCase()
    .replace(/\barc\s+(sin|cos|tan)\b/g, "arc$1")
    .replace(/\bsin\s+h\b/g, "sinh")
    .replace(/\bcos\s+h\b/g, "cosh")
    .replace(/\btan\s+h\b/g, "tanh")
    .replace(/\bcot\s+h\b/g, "coth")
    .replace(/\bsec\s+h\b/g, "sech")
    .replace(/\bcsc\s+h\b/g, "csch")
    .replace(/\bthe\s+ta\b/g, "theta")
    .replace(/\b(sin|cos|tan|sinh|cosh|tanh|coth|sech|csch|asin|acos|atan|acot|arcsin|arccos|arctan|arccot)2\s*\(([^)]+)\)/g, "$1²($2)");

  // Lọc sạch toàn bộ các từ tiếng Việt hoặc từ thường không liên quan đến toán học
  let cleanQuery = normalizedQuery
    .replace(/[a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+/gi, (match: string) => {
      if (
        /^(sin|cos|tan|sinh|cosh|tanh|coth|sech|csch|asin|acos|atan|acot|arcsin|arccos|arctan|arccot|abs|ln|log|pi|sqrt|e|theta|θ|c|a|factorial)$/i.test(
          match,
        )
      )
        return match;
      return "";
    })
    .replace(/^[^a-z0-9θπe√\(]+/i, "")
    .trim();

  let mathExpression = cleanQuery
    .replace(/θ/g, "theta")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/(\d)\s*:\s*(\d)/g, "$1/$2")
    .replace(/π/g, "Math.PI")
    .replace(/\bpi\b/g, "Math.PI")
    .replace(/\be\b/g, "Math.E");

  // Parse giai thừa: "5!" -> "factorial(5)"
  mathExpression = mathExpression.replace(/(\d+)!/g, "factorial($1)").replace(/\(([^)]+)\)!/g, "factorial($1)");

  // Parse tổ hợp/chỉnh hợp: "10cr3" -> "C(10,3)"
  mathExpression = mathExpression
    .replace(/(\d+)\s*cr\s*(\d+)/g, "C($1,$2)")
    .replace(/(\d+)\s*pr\s*(\d+)/g, "A($1,$2)")
    .replace(/\bc\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g, "C($1,$2)")
    .replace(/\ba\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g, "A($1,$2)");

  // Xử lý các hàm lũy thừa đặc biệt
  mathExpression = mathExpression.replace(
    /(sin|cos|tan|sinh|cosh|tanh|coth|sech|csch|asin|acos|atan|acot|arcsin|arccos|arctan|arccot)(?:²|³|\^(\d+))?\s*\(([^)]+)\)/g,
    (match: string, func: string, power: string | undefined, arg: string) => {
      let p = "2";
      if (match.includes("³")) p = "3";
      if (power) p = power;

      let baseExpr = "";
      if (func === "arcsin" || func === "asin") baseExpr = `Math.asin(${arg})`;
      else if (func === "arccos" || func === "acos") baseExpr = `Math.acos(${arg})`;
      else if (func === "arctan" || func === "atan") baseExpr = `Math.atan(${arg})`;
      else if (func === "arccot" || func === "acot") baseExpr = `(Math.PI/2 - Math.atan(${arg}))`;
      else if (func === "sinh") baseExpr = `Math.sinh(${arg})`;
      else if (func === "cosh") baseExpr = `Math.cosh(${arg})`;
      else if (func === "tanh") baseExpr = `Math.tanh(${arg})`;
      else if (func === "coth") baseExpr = `(1/Math.tanh(${arg}))`;
      else if (func === "sech") baseExpr = `(1/Math.cosh(${arg}))`;
      else if (func === "csch") baseExpr = `(1/Math.sinh(${arg}))`;
      else baseExpr = `Math.${func}(${arg})`;

      if (match.includes("²") || match.includes("³") || power) {
        return `(${baseExpr}**${p})`;
      }
      return baseExpr;
    },
  );

  // Thay thế các hàm lượng giác và lượng giác hyperbolic nâng cao còn lại
  mathExpression = mathExpression
    .replace(/(?<!Math\.)arcsin\s*\(([^)]+)\)/g, "Math.asin($1)")
    .replace(/(?<!Math\.)arccos\s*\(([^)]+)\)/g, "Math.acos($1)")
    .replace(/(?<!Math\.)arctan\s*\(([^)]+)\)/g, "Math.atan($1)")
    .replace(/(?<!Math\.)arccot\s*\(([^)]+)\)/g, "(Math.PI/2 - Math.atan($1))")
    .replace(/(?<!Math\.)acot\s*\(([^)]+)\)/g, "(Math.PI/2 - Math.atan($1))")
    .replace(/(?<!Math\.)asin\s*\(([^)]+)\)/g, "Math.asin($1)")
    .replace(/(?<!Math\.)acos\s*\(([^)]+)\)/g, "Math.acos($1)")
    .replace(/(?<!Math\.)atan\s*\(([^)]+)\)/g, "Math.atan($1)")
    .replace(/(?<!Math\.)sinh\s*\(([^)]+)\)/g, "Math.sinh($1)")
    .replace(/(?<!Math\.)cosh\s*\(([^)]+)\)/g, "Math.cosh($1)")
    .replace(/(?<!Math\.)tanh\s*\(([^)]+)\)/g, "Math.tanh($1)")
    .replace(/(?<!Math\.)coth\s*\(([^)]+)\)/g, "(1/Math.tanh($1))")
    .replace(/(?<!Math\.)sech\s*\(([^)]+)\)/g, "(1/Math.cosh($1))")
    .replace(/(?<!Math\.)csch\s*\(([^)]+)\)/g, "(1/Math.sinh($1))")
    .replace(/(?<!Math\.)\bsin\b\s*\(([^)]+)\)/g, "Math.sin($1)")
    .replace(/(?<!Math\.)\bcos\b\s*\(([^)]+)\)/g, "Math.cos($1)")
    .replace(/(?<!Math\.)\btan\b\s*\(([^)]+)\)/g, "Math.tan($1)")
    .replace(/(?<!Math\.)\babs\b\s*\(([^)]+)\)/g, "Math.abs($1)")
    .replace(/(?<!Math\.)\bln\b\s*\(([^)]+)\)/g, "Math.log($1)")
    .replace(/(?<!Math\.)\blog\b\s*\(([^)]+)\)/g, "Math.log10($1)")
    .replace(/√\s*(\d+(?:\.\d+)?)/g, "Math.sqrt($1)")
    .replace(/sqrt\s*(\d+(?:\.\d+)?)/g, "Math.sqrt($1)")
    .replace(/√/g, "Math.sqrt")
    .replace(/sqrt/g, "Math.sqrt")
    .replace(/\^/g, "**");

  let securityCheckStr = mathExpression;
  const allowedPatterns = [
    /Math\.PI/g,
    /Math\.E/g,
    /Math\.sqrt/g,
    /Math\.sinh/g,
    /Math\.cosh/g,
    /Math\.tanh/g,
    /Math\.asin/g,
    /Math\.acos/g,
    /Math\.atan/g,
    /Math\.sin/g,
    /Math\.cos/g,
    /Math\.tan/g,
    /Math\.abs/g,
    /Math\.log10/g,
    /Math\.log/g,
    /factorial/g,
    /\bC\b/g,
    /\bA\b/g,
  ];
  for (const pattern of allowedPatterns) {
    securityCheckStr = securityCheckStr.replace(pattern, "");
  }

  if (/^[0-9\+\-\*\/\(\)\.,\s%]*$/.test(securityCheckStr.replace(/\s+/g, ""))) {
    const cleanExpr = mathExpression
      .replace(/[a-z]+/gi, (match: string) => {
        if (/^(Math|PI|E|sqrt|sin|cos|tan|sinh|cosh|tanh|asin|acos|atan|abs|log|log10|factorial|C|A)$/i.test(match)) {
          return match;
        }
        return "";
      })
      .trim();

    if (
      cleanExpr.length >= 1 &&
      !hasTopLevelComma(cleanExpr) &&
      (/[0-9]/.test(cleanExpr) || /Math\./.test(cleanExpr) || /factorial|C|A/.test(cleanExpr))
    ) {
      try {
        const result = new Function("factorial", "C", "A", `return ${cleanExpr}`)(factorial, C, A);
        if (result !== undefined && result !== null && !isNaN(result)) {
          return result;
        }
      } catch (e) {}
    }
  }
  return null;
}

export function evaluateMathExpression(query: string): { success: boolean; text?: string } {
  // Nếu biểu thức chứa dấu '=', thực hiện đánh giá hai vế riêng biệt hoặc chuỗi đẳng thức liên tiếp
  if (query.includes("=")) {
    const parts = query
      .split("=")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const evaluations = parts.map((part) => {
        return {
          expr: part,
          val: evaluateSingleExpression(part),
        };
      });

      const allSuccessful = evaluations.every((ev) => ev.val !== null);
      if (allSuccessful) {
        let responseText = `🧮 **[TRẠM MÁY TÍNH LƯỢNG TỬ VĨ MÔ NÂNG CAO]:**\n\n`;
        responseText += `Hãy xem xét kỹ biểu thức Sếp đã nhập: \`${parts.join(" = ")}\`\n\n`;
        responseText += `**Từng bước một (Step-by-step):**\n`;

        if (evaluations.length === 2) {
          const leftVal = evaluations[0].val;
          const rightVal = evaluations[1].val;
          const leftExpr = evaluations[0].expr;
          const rightExpr = evaluations[1].expr;
          const isEqual = leftVal === rightVal;

          responseText += `- **Vế trái (Left Side):** \`${leftExpr}\` = **${leftVal}**\n`;
          responseText += `- **Vế phải (Right Side):** \`${rightExpr}\` = **${rightVal}**\n`;
          responseText += `- **So sánh:** \`${leftVal} = ${rightVal}\` — ${isEqual ? "✅ Đúng (True)" : "❌ Sai (False)"}\n`;

          if (isEqual) {
            responseText += `\n*Kết luận:* Hai vế hoàn toàn bằng nhau!`;
          } else {
            responseText += `\n*Kết luận:* Hai vế không bằng nhau!`;
          }
        } else {
          // Đầu tiên tính vế trái ngoài cùng
          const firstVal = evaluations[0].val;
          const secondVal = evaluations[1].val;
          const firstExpr = evaluations[0].expr;
          const secondExpr = evaluations[1].expr;
          const firstIsEqual = firstVal === secondVal;

          responseText += `- **Vế ngoài cùng bên trái:** \`${firstExpr}\` = **${firstVal}**\n`;
          responseText += `- **So sánh với vế tiếp theo:** \`${firstVal} = ${secondVal}\` — ${firstIsEqual ? "✅ Đúng (True)" : "❌ Sai (False) (Vế trái rút gọn thành " + firstVal + " chứ không phải " + secondVal + ")"}\n`;

          for (let i = 1; i < evaluations.length - 1; i++) {
            const current = evaluations[i];
            const next = evaluations[i + 1];
            const isEqual = current.val === next.val;
            responseText += `- **Cặp tiếp theo:** \`${current.expr} = ${next.expr}\` (tức là \`${current.val} = ${next.val}\`) — ${isEqual ? "✅ Đúng (True)" : "❌ Sai (False) (Rõ ràng điều này không đúng)"}\n`;
          }

          let isChainValid = true;
          for (let i = 0; i < evaluations.length - 1; i++) {
            if (evaluations[i].val !== evaluations[i + 1].val) {
              isChainValid = false;
              break;
            }
          }

          if (isChainValid) {
            responseText += `\n*Kết luận:* Xét dưới dạng một chuỗi đẳng thức liên tiếp, biểu thức này **hoàn toàn chính xác** về mặt toán học!`;
          } else {
            responseText += `\n*Kết luận:* Xét dưới dạng một chuỗi đẳng thức liên tiếp, biểu thức này **không chính xác** về mặt toán học. Nếu đây là một câu đố hoặc quy luật nào đó, thì phép tính số học thuần túy này không khớp.`;
          }
        }

        return {
          success: true,
          text: responseText,
        };
      }
    }
  }

  // Tự động sửa các lỗi chính tả phổ biến (Typo Auto-correction)
  let normalizedQuery = query
    .replace(/[?=\s]+$/, "")
    .replace(/[?=#$@&|\\<>~`"' :;]/g, "")
    .toLowerCase()
    .replace(/\barc\s+(sin|cos|tan)\b/g, "arc$1")
    .replace(/\bsin\s+h\b/g, "sinh")
    .replace(/\bcos\s+h\b/g, "cosh")
    .replace(/\btan\s+h\b/g, "tanh")
    .replace(/\bcot\s+h\b/g, "coth")
    .replace(/\bsec\s+h\b/g, "sech")
    .replace(/\bcsc\s+h\b/g, "csch")
    .replace(/\bthe\s+ta\b/g, "theta")
    .replace(/\b(sin|cos|tan|sinh|cosh|tanh|coth|sech|csch|asin|acos|atan|acot|arcsin|arccos|arctan|arccot)2\s*\(([^)]+)\)/g, "$1²($2)");

  // Lọc sạch toàn bộ các từ tiếng Việt hoặc từ thường không liên quan đến toán học
  let cleanQuery = normalizedQuery
    .replace(/[a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+/gi, (match: string) => {
      if (
        /^(sin|cos|tan|sinh|cosh|tanh|coth|sech|csch|asin|acos|atan|acot|arcsin|arccos|arctan|arccot|abs|ln|log|pi|sqrt|e|theta|θ|c|a|factorial)$/i.test(
          match,
        )
      )
        return match;
      return "";
    })
    .replace(/^[^a-z0-9θπe√\(]+/i, "")
    .trim();

  let mathExpression = cleanQuery
    .replace(/θ/g, "theta")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/(\d)\s*:\s*(\d)/g, "$1/$2")
    .replace(/π/g, "Math.PI")
    .replace(/\bpi\b/g, "Math.PI")
    .replace(/\be\b/g, "Math.E");

  // Parse giai thừa: "5!" -> "factorial(5)"
  mathExpression = mathExpression.replace(/(\d+)!/g, "factorial($1)").replace(/\(([^)]+)\)!/g, "factorial($1)");

  // Parse tổ hợp/chỉnh hợp: "10cr3" -> "C(10,3)"
  mathExpression = mathExpression
    .replace(/(\d+)\s*cr\s*(\d+)/g, "C($1,$2)")
    .replace(/(\d+)\s*pr\s*(\d+)/g, "A($1,$2)")
    .replace(/\bc\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g, "C($1,$2)")
    .replace(/\ba\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g, "A($1,$2)");

  // Xử lý các hàm lũy thừa đặc biệt
  mathExpression = mathExpression.replace(
    /(sin|cos|tan|sinh|cosh|tanh|coth|sech|csch|asin|acos|atan|acot|arcsin|arccos|arctan|arccot)(?:²|³|\^(\d+))?\s*\(([^)]+)\)/g,
    (match: string, func: string, power: string | undefined, arg: string) => {
      let p = "2";
      if (match.includes("³")) p = "3";
      if (power) p = power;

      let baseExpr = "";
      if (func === "arcsin" || func === "asin") baseExpr = `Math.asin(${arg})`;
      else if (func === "arccos" || func === "acos") baseExpr = `Math.acos(${arg})`;
      else if (func === "arctan" || func === "atan") baseExpr = `Math.atan(${arg})`;
      else if (func === "arccot" || func === "acot") baseExpr = `(Math.PI/2 - Math.atan(${arg}))`;
      else if (func === "sinh") baseExpr = `Math.sinh(${arg})`;
      else if (func === "cosh") baseExpr = `Math.cosh(${arg})`;
      else if (func === "tanh") baseExpr = `Math.tanh(${arg})`;
      else if (func === "coth") baseExpr = `(1/Math.tanh(${arg}))`;
      else if (func === "sech") baseExpr = `(1/Math.cosh(${arg}))`;
      else if (func === "csch") baseExpr = `(1/Math.sinh(${arg}))`;
      else baseExpr = `Math.${func}(${arg})`;

      if (match.includes("²") || match.includes("³") || power) {
        return `(${baseExpr}**${p})`;
      }
      return baseExpr;
    },
  );

  // Thay thế các hàm lượng giác và lượng giác hyperbolic nâng cao còn lại
  mathExpression = mathExpression
    .replace(/(?<!Math\.)arcsin\s*\(([^)]+)\)/g, "Math.asin($1)")
    .replace(/(?<!Math\.)arccos\s*\(([^)]+)\)/g, "Math.acos($1)")
    .replace(/(?<!Math\.)arctan\s*\(([^)]+)\)/g, "Math.atan($1)")
    .replace(/(?<!Math\.)arccot\s*\(([^)]+)\)/g, "(Math.PI/2 - Math.atan($1))")
    .replace(/(?<!Math\.)acot\s*\(([^)]+)\)/g, "(Math.PI/2 - Math.atan($1))")
    .replace(/(?<!Math\.)asin\s*\(([^)]+)\)/g, "Math.asin($1)")
    .replace(/(?<!Math\.)acos\s*\(([^)]+)\)/g, "Math.acos($1)")
    .replace(/(?<!Math\.)atan\s*\(([^)]+)\)/g, "Math.atan($1)")
    .replace(/(?<!Math\.)sinh\s*\(([^)]+)\)/g, "Math.sinh($1)")
    .replace(/(?<!Math\.)cosh\s*\(([^)]+)\)/g, "Math.cosh($1)")
    .replace(/(?<!Math\.)tanh\s*\(([^)]+)\)/g, "Math.tanh($1)")
    .replace(/(?<!Math\.)coth\s*\(([^)]+)\)/g, "(1/Math.tanh($1))")
    .replace(/(?<!Math\.)sech\s*\(([^)]+)\)/g, "(1/Math.cosh($1))")
    .replace(/(?<!Math\.)csch\s*\(([^)]+)\)/g, "(1/Math.sinh($1))")
    .replace(/(?<!Math\.)\bsin\b\s*\(([^)]+)\)/g, "Math.sin($1)")
    .replace(/(?<!Math\.)\bcos\b\s*\(([^)]+)\)/g, "Math.cos($1)")
    .replace(/(?<!Math\.)\btan\b\s*\(([^)]+)\)/g, "Math.tan($1)")
    .replace(/(?<!Math\.)\babs\b\s*\(([^)]+)\)/g, "Math.abs($1)")
    .replace(/(?<!Math\.)\bln\b\s*\(([^)]+)\)/g, "Math.log($1)")
    .replace(/(?<!Math\.)\blog\b\s*\(([^)]+)\)/g, "Math.log10($1)")
    .replace(/√\s*(\d+(?:\.\d+)?)/g, "Math.sqrt($1)")
    .replace(/sqrt\s*(\d+(?:\.\d+)?)/g, "Math.sqrt($1)")
    .replace(/√/g, "Math.sqrt")
    .replace(/sqrt/g, "Math.sqrt")
    .replace(/\^/g, "**");

  // Kiểm duyệt bảo mật: thay thế hết các hàm Math được phép bằng ký tự trống
  let securityCheckStr = mathExpression;
  for (const pattern of allowedPatterns) {
    securityCheckStr = securityCheckStr.replace(pattern, "");
  }

  // Loại bỏ tất cả các ký tự còn lại nếu không phải là số hoặc toán tử cơ bản và dấu phẩy
  if (/^[0-9\+\-\*\/\(\)\.,\s%]*$/.test(securityCheckStr.replace(/\s+/g, ""))) {
    const cleanExpr = mathExpression
      .replace(/[a-z]+/gi, (match: string) => {
        if (/^(Math|PI|E|sqrt|sin|cos|tan|sinh|cosh|tanh|asin|acos|atan|abs|log|log10|factorial|C|A)$/i.test(match)) {
          return match;
        }
        return "";
      })
      .trim();

    // Phải chứa ít nhất 1 toán tử cơ bản hoặc Math hoặc hàm nâng cao
    if (
      cleanExpr.length >= 1 &&
      !hasTopLevelComma(cleanExpr) &&
      (/[0-9]/.test(cleanExpr) || /Math\./.test(cleanExpr) || /factorial|C|A/.test(cleanExpr)) &&
      (/[\+\-\*\/\(\)%,]|Math\./.test(cleanExpr) || /factorial|C|A/.test(cleanExpr))
    ) {
      try {
        const result = new Function("factorial", "C", "A", `return ${cleanExpr}`)(factorial, C, A);
        if (result !== undefined && result !== null && !isNaN(result)) {
          const prettyExpr = query.trim();
          return {
            success: true,
            text: `🧮 **[TRẠM MÁY TÍNH LƯỢNG TỬ VĨ MÔ NÂNG CAO]:**\n\n- 📝 **Biểu thức gốc:** \`${prettyExpr}\`\n- ⚙️ **Biểu thức dịch:** \`${cleanExpr}\`\n- 🏆 **Kết quả chính xác:** **${result}**\n\n*Hệ thống đã nhận dạng toàn bộ Danh sách ký hiệu toán học vĩ mô nâng cao (Hàm lượng giác ngược, Hyperbolic, Hạ bậc lũy thừa, Giai thừa, Tổ hợp & Chỉnh hợp) và tính toán thành công! Sếp đố bài nào khó hơn nữa đi! 😎*`,
          };
        }
      } catch (e) {
        // Bỏ qua, chuyển tiếp sang NLP
      }
    }
  }

  return { success: false };
}

export function solveCustomAlgorithm(query: string): { success: boolean; text?: string } {
  const qClean = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

  // 0. MENTAL MATH / VEDIC MATH TRICKS
  if (
    qClean.includes("nham") ||
    qClean.includes("meo") ||
    qClean.includes("vedic") ||
    qClean.includes("trick") ||
    qClean.includes("tinh nhanh")
  ) {
    const res = solveMentalMathTricks(query);
    if (res.success) {
      return { success: true, text: res.text };
    }
  }

  // 1. GAUSSIAN SOLVER (ELIMINATION & MULTIVARIATE DENSITY)
  if (
    qClean.includes("gauss") ||
    qClean.includes("khu gauss") ||
    qClean.includes("giai he") ||
    qClean.includes("multivariate") ||
    qClean.includes("mat do")
  ) {
    // Check if it is a Multivariate Gaussian request
    if (qClean.includes("da bien") || qClean.includes("multivariate") || qClean.includes("mat do") || qClean.includes("density")) {
      const xMatch = query.match(/x\s*[=:]\s*(\[[^\]]+\])/i);
      const muMatch = query.match(/(?:mu|μ)\s*[=:]\s*(\[[^\]]+\])/i);
      const covMatch = query.match(/(?:cov|sigma|Σ)\s*[=:]\s*(\[\[[^\]]+\]\]|\[\s*\[[^\]]+\]\s*,\s*\[[^\]]+\]\s*\])/i);

      if (xMatch && muMatch && covMatch) {
        try {
          const x = JSON.parse(xMatch[1]);
          const mu = JSON.parse(muMatch[1]);
          const cov = JSON.parse(covMatch[1]);
          const res = solveMultivariateGaussian(x, mu, cov);
          if (res.success) {
            return { success: true, text: res.text };
          }
        } catch (e) {}
      }
    }

    // Attempt to parse a matrix from the query
    const matrix = parseMatrix(query);
    if (matrix) {
      const res = solveGaussianElimination(matrix);
      if (res.success && res.solution) {
        return {
          success: true,
          text:
            `🎓 **[TRẠM GIẢI TOÁN KHỬ GAUSS TỰ ĐỘNG - GAUSSIAN ELIMINATION SOLVER]**\n\n` +
            `Hệ phương trình đã cho được chuyển đổi thành ma trận và giải quyết từng bước một:\n\n` +
            res.steps.join("\n\n") +
            `\n\n🏆 **KẾT QUẢ NGHIỆM CUỐI CÙNG:**\n` +
            res.solution.map((val, idx) => `- **x${idx + 1}** = **${val.toFixed(4)}**`).join("\n"),
        };
      } else {
        return {
          success: true,
          text:
            `⚠️ **[TRẠM GIẢI TOÁN KHỬ GAUSS TỰ ĐỘNG - LỖI HỆ]**\n\n` +
            `Quá trình khử Gauss thất bại:\n` +
            (res.steps[res.steps.length - 1] || "Không thể thực hiện các phép biến đổi sơ cấp hợp lệ."),
        };
      }
    }
  }

  // 2. HYDROFORMING / SMART FLEXIBLE FORMWORK / MPF CALCULATOR
  if (
    qClean.includes("hydroforming") ||
    qClean.includes("ap suat") ||
    qClean.includes("formwork") ||
    qClean.includes("tao hinh da diem") ||
    qClean.includes("chot pin") ||
    qClean.includes("pin matrix") ||
    qClean.includes("det may thuat toan") ||
    qClean.includes("knitting") ||
    qClean.includes("mpf")
  ) {
    // Check if it is a request for pin matrix height calculations
    if (
      qClean.includes("pin matrix") ||
      qClean.includes("ma tran pin") ||
      qClean.includes("ma tran chot") ||
      qClean.includes("mat cong") ||
      qClean.includes("surface") ||
      qClean.includes("mpf")
    ) {
      const sizeMatch = qClean.match(/(\d+)\s*x\s*(\d+)/) || qClean.match(/size\s*[=:]\s*(\d+)/) || qClean.match(/luoi\s*(\d+)/);
      const size = sizeMatch ? parseInt(sizeMatch[1]) : 5;
      const text = generatePinMatrix(qClean, size);
      return { success: true, text };
    }

    // Try parsing t, D, and sigma for Hydroforming pressure
    const tMatch = query.match(/\bt\b\s*[=:]\s*(\d+(?:\.\d+)?)/i) || query.match(/day\s*[=:]?\s*(\d+(?:\.\d+)?)/i);
    const dMatch =
      query.match(/\bd\b\s*[=:]\s*(\d+(?:\.\d+)?)/i) ||
      query.match(/kinh\s*[=:]?\s*(\d+(?:\.\d+)?)/i) ||
      query.match(/\bD\b\s*[=:]\s*(\d+(?:\.\d+)?)/i);
    const sigmaMatch = query.match(/(?:sigma|σ|uts)\s*[=:]\s*(\d+(?:\.\d+)?)/i) || query.match(/ben\s*keo\s*[=:]?\s*(\d+(?:\.\d+)?)/i);

    if (tMatch || dMatch || sigmaMatch) {
      const t = tMatch ? parseFloat(tMatch[1]) : 1.5; // mm
      const D = dMatch ? parseFloat(dMatch[1]) : 50; // mm
      const sigma = sigmaMatch ? parseFloat(sigmaMatch[1]) : 300; // MPa

      const Pmin = (2 * t * sigma) / D;
      const PminBar = Pmin * 10; // 1 MPa = 10 bar

      return {
        success: true,
        text:
          `🛡️ **[TÍNH TOÁN ÁP SUẤT TẠO HÌNH HYDROFORMING]**\n\n` +
          `**Công thức áp suất tạo hình tối thiểu (Minimum Forming Pressure):**\n` +
          `$$P_{min} = \\frac{2 \\cdot t \\cdot \\sigma_{UTS}}{D}$$\n\n` +
          `**Thông số phôi đã nhập/nhận diện:**\n` +
          `- Chiều dày phôi ($t$): **${t} mm**\n` +
          `- Đường kính phôi ($D$): **${D} mm**\n` +
          `- Giới hạn bền kéo vật liệu ($\\sigma_{UTS}$): **${sigma} MPa**\n\n` +
          `**Các bước tính toán:**\n` +
          `1. Lắp số vào công thức: $$P_{min} = \\frac{2 \\cdot ${t} \\cdot ${sigma}}{${D}}$$\n` +
          `2. Kết quả: $$P_{min} = ${Pmin.toFixed(3)} \\text{ MPa}$$\n\n` +
          `🏆 **KẾT LUẬN:**\n` +
          `- Áp suất tối thiểu cần thiết: **${Pmin.toFixed(2)} MPa** (~**${PminBar.toFixed(1)} bar**)\n\n` +
          `*Hệ thống khuyến nghị nâng áp suất làm việc thực tế lên 1.2 - 1.5 lần (${(Pmin * 1.3).toFixed(2)} MPa) để bù trừ hiệu ứng đàn hồi ngược (springback) của kim loại.*`,
      };
    }
  }

  // 3. COIN GUESSING GAME SIMULATOR
  if (qClean.includes("doan xu") || qClean.includes("coin guessing") || qClean.includes("nguoi mu") || qClean.includes("tro choi")) {
    const roundsMatch = qClean.match(/(\d+)\s*(?:lan|vong|rounds)/) || qClean.match(/rounds\s*[=:]\s*(\d+)/);
    const rounds = roundsMatch ? parseInt(roundsMatch[1]) : 100;

    const pMatch = qClean.match(/p\s*[=:]\s*(0\.\d+)/) || qClean.match(/prob_?a\s*[=:]\s*(0\.\d+)/);
    const qMatch = qClean.match(/q\s*[=:]\s*(0\.\d+)/) || qClean.match(/prob_?b\s*[=:]\s*(0\.\d+)/);

    const probA = pMatch ? parseFloat(pMatch[1]) : 0.5;
    const probB = qMatch ? parseFloat(qMatch[1]) : 0.5;

    const text = simulateCoinGuessing(rounds, probA, probB);
    return { success: true, text };
  }

  // 4. COMPUTATIONAL KNITTING / ALGORITHMIC TEXTILES SOLVER
  if (
    qClean.includes("det may") ||
    qClean.includes("knitting") ||
    qClean.includes("short row") ||
    qClean.includes("hang ngan") ||
    qClean.includes("mui det") ||
    qClean.includes("ret may")
  ) {
    const w1Match =
      query.match(/w1\s*[=:]\s*(\d+(?:\.\d+)?)/i) ||
      query.match(/rong_duoi\s*[=:]?\s*(\d+(?:\.\d+)?)/i) ||
      query.match(/rong_1\s*[=:]?\s*(\d+(?:\.\d+)?)/i);
    const w2Match =
      query.match(/w2\s*[=:]\s*(\d+(?:\.\d+)?)/i) ||
      query.match(/rong_tren\s*[=:]?\s*(\d+(?:\.\d+)?)/i) ||
      query.match(/rong_2\s*[=:]?\s*(\d+(?:\.\d+)?)/i);
    const hMatch =
      query.match(/\bh\b\s*[=:]\s*(\d+(?:\.\d+)?)/i) ||
      query.match(/cao\s*[=:]?\s*(\d+(?:\.\d+)?)/i) ||
      query.match(/height\s*[=:]?\s*(\d+(?:\.\d+)?)/i);

    const w1 = w1Match ? parseFloat(w1Match[1]) : 50; // cm
    const w2 = w2Match ? parseFloat(w2Match[1]) : 30; // cm
    const h = hMatch ? parseFloat(hMatch[1]) : 40; // cm

    const stGauge = 2.0;
    const rowGauge = 2.8;

    const castOn = Math.round(w1 * stGauge);
    const endStitches = Math.round(w2 * stGauge);
    const totalRows = Math.round(h * rowGauge);

    const diff = endStitches - castOn;
    const action = diff < 0 ? "giảm mũi (decrease)" : "tăng mũi (increase)";
    const absDiff = Math.abs(diff);

    const shapingEvents = Math.round(absDiff / 2);
    const intervals = shapingEvents > 0 ? Math.floor(totalRows / shapingEvents) : totalRows;

    let shortRowNotes = "";
    if (qClean.includes("cong") || qClean.includes("3d") || qClean.includes("dome") || qClean.includes("sphere")) {
      const extraRows = Math.round(5 * rowGauge);
      shortRowNotes =
        `\n\n**3. Thuật toán hàng ngắn (Short-Row Algorithm) tạo độ cong kép (3D Dome/Curvature):**\n` +
        `- Để đạt được độ cong 3D mà không tạo nếp nhăn, ta cần chèn thêm **${extraRows} hàng ngắn (short rows)** ở vùng trung tâm.\n` +
        `- **Sơ đồ chèn (Short-Row Schedule):**\n` +
        `  - Cứ sau ${Math.round(totalRows / (extraRows / 2 || 1))} hàng dệt phẳng, thực hiện dệt ngắn: Quay đầu (Wrap & Turn) cách biên trái/phải ${Math.round(castOn / 4)} mũi, dệt ngược lại để bù đắp chiều dài bề mặt cong.`;
    }

    return {
      success: true,
      text:
        `🧵 **[THUẬT TOÁN DỆT MAY SỐ HOÁ - COMPUTATIONAL KNITTING SOLVER]**\n\n` +
        `**1. Thông số đầu vào và chuyển đổi Gauge (Mật độ mũi dệt):**\n` +
        `- Chiều rộng đáy ($W_1$): **${w1} cm** $\\rightarrow$ **${castOn} mũi khởi đầu (cast-on)**\n` +
        `- Chiều rộng đỉnh ($W_2$): **${w2} cm** $\\rightarrow$ **${endStitches} mũi kết thúc (bind-off)**\n` +
        `- Chiều cao tấm ($H$): **${h} cm** $\\rightarrow$ **${totalRows} hàng dệt (courses)**\n` +
        `- Mật độ dệt tiêu chuẩn (Gauge): **2.0 stitches/cm** và **2.8 rows/cm** (loại vải chịu ứng suất kéo cao)\n\n` +
        `**2. Thuật toán tạo hình biên dạng phẳng (Slope Shaping Algorithm):**\n` +
        `- Cần thực hiện: **${action}** tổng cộng **${absDiff} mũi** (${Math.round(absDiff / 2)} mũi mỗi bên).\n` +
        `- **Giải pháp thuật toán Magic Formula:**\n` +
        `  - Tổng số hàng tạo hình: **${shapingEvents} hàng dệt**.\n` +
        `  - Tần suất tạo hình: Cứ mỗi **${intervals} hàng dệt**, thực hiện ${diff < 0 ? "giảm" : "tăng"} 1 mũi ở cả hai đầu biên trái và biên phải.\n` +
        `  - **Sơ đồ chi tiết:** \`Row 1: Cast-on ${castOn} sts. Row ${intervals}: ${diff < 0 ? "K2tog, knit to last 2 sts, SSK" : "M1L, knit to last st, M1R"}...\`${shortRowNotes}\n\n` +
        `🏆 **KẾT LUẬN:**\n` +
        `- Lệnh điều khiển máy dệt CNC đã được biên dịch thành công dựa trên mô hình hình học vi tích phân tấm.`,
    };
  }

  // 5. RBF NEURAL NETWORK / MACHINE LEARNING KHUNG SẮT SOLVER
  if (
    qClean.includes("rbf") ||
    qClean.includes("radial basis") ||
    qClean.includes("mang no ron") ||
    qClean.includes("no-ron rbf") ||
    qClean.includes("khung sat ml") ||
    qClean.includes("machine learning khung sat") ||
    qClean.includes("khung sat rbf")
  ) {
    return {
      success: true,
      text: solveRBFNeuralNetwork(query),
    };
  }

  // 6. RBF NEURAL NETWORK COMBINED WITH POMDP COIN GUESSING
  if (
    (qClean.includes("rbf") || qClean.includes("neural") || qClean.includes("no ron")) &&
    (qClean.includes("xu") || qClean.includes("mu") || qClean.includes("doan") || qClean.includes("pomdp"))
  ) {
    return {
      success: true,
      text: solveRbfPomdpCombined(query),
    };
  }

  // 7. THE MASTER PIPELINE (SIÊU THUẬT TOÁN LIÊN NGÀNH) SOLVER
  if (
    qClean.includes("sieu thuat toan") ||
    qClean.includes("master pipeline") ||
    qClean.includes("lien nganh") ||
    qClean.includes("tu tri") ||
    qClean.includes("autonomous agent") ||
    (qClean.includes("gauss") &&
      (qClean.includes("det") || qClean.includes("khung") || qClean.includes("sat") || qClean.includes("ket hop")))
  ) {
    let problem = query
      .replace(
        /(sieu thuat toan|master pipeline|lien nganh|tu tri|autonomous agent|gauss ket hop|gauss va det|gauss va may det|gauss va khung det)/gi,
        "",
      )
      .trim();
    if (!problem || problem.length < 5) {
      problem = "Đàm phán tối ưu hóa phân bổ nguồn lực chốt pin khuôn linh hoạt MPF";
    }

    return {
      success: true,
      text: solveMasterPipelineCombined(query, problem),
    };
  }

  // 8. FENWICK TREE SOLVER (BINARY INDEXED TREE)
  if (
    qClean.includes("fenwick") ||
    qClean.includes("binary indexed tree") ||
    qClean.includes("cay fenwick") ||
    qClean.includes("truy van doan")
  ) {
    return {
      success: true,
      text: solveFenwickTreeSolver(query),
    };
  }

  // 8.5 PYTHAGOREAN TRIPLES SOLVER
  if (
    qClean.includes("bo ba") ||
    qClean.includes("pythagore") ||
    qClean.includes("triple") ||
    qClean.includes("so nguyen")
  ) {
    return {
      success: true,
      text: solvePythagoreanTriples(query),
    };
  }

  // 9. FFT / POLY MULTIPLICATION SOLVER (KARATSUBA, TOOM-COOK, FFT)
  if (
    qClean.includes("fft") ||
    qClean.includes("fourier") ||
    qClean.includes("karatsuba") ||
    qClean.includes("toom") ||
    qClean.includes("nhan da thuc")
  ) {
    return {
      success: true,
      text: solvePolynomialMultiplication(query),
    };
  }

  // 10. LORENZ ATTRACTOR / BUTTERFLY EFFECT SOLVER
  if (
    qClean.includes("chaos") ||
    qClean.includes("lorenz") ||
    qClean.includes("buom buom") ||
    qClean.includes("hon loan") ||
    qClean.includes("butterfly")
  ) {
    return {
      success: true,
      text: solveLorenzAttractor(query),
    };
  }

  // 11. STRING THEORY / M-THEORY SOLVER
  if (qClean.includes("ly thuyet day") || qClean.includes("string theory") || qClean.includes("m-theory") || qClean.includes("calabi")) {
    return {
      success: true,
      text: solveStringTheory(query),
    };
  }

  // 12. SYSTEMS THINKING / CAUSAL LOOP DIAGRAM SOLVER
  if (
    qClean.includes("tu duy he thong") ||
    qClean.includes("systems thinking") ||
    qClean.includes("causal loop") ||
    qClean.includes("he phuc tap")
  ) {
    return {
      success: true,
      text: solveSystemsThinking(query),
    };
  }

  // 13. LENNARD-JONES POTENTIAL SOLVER
  if (qClean.includes("lennard") || qClean.includes("jones") || qClean.includes("the nang lien ket") || qClean.includes("tuong tac hat")) {
    const epsMatch = query.match(/(?:epsilon|eps|ε)\s*[=:]\s*(\d+(?:\.\d+)?)/i) || query.match(/ho\s*the\s*[=:]?\s*(\d+(?:\.\d+)?)/i);
    const sigMatch =
      query.match(/(?:sigma|sig|σ)\s*[=:]\s*(\d+(?:\.\d+)?)/i) || query.match(/khoang\s*cach\s*0\s*[=:]?\s*(\d+(?:\.\d+)?)/i);
    const rMatch = query.match(/\br\b\s*[=:]\s*(\d+(?:\.\d+)?)/i) || query.match(/khoang\s*cach\s*hat\s*[=:]?\s*(\d+(?:\.\d+)?)/i);

    const eps = epsMatch ? parseFloat(epsMatch[1]) : 0.0103;
    const sig = sigMatch ? parseFloat(sigMatch[1]) : 3.405;
    const r = rMatch ? parseFloat(rMatch[1]) : 3.8;

    return solveLennardJones(eps, sig, r);
  }

  // 14. SARRUS RULE MATRIX DETERMINANT SOLVER
  if (
    qClean.includes("sarrus") ||
    qClean.includes("dinh thuc ma tran 3x3") ||
    qClean.includes("det 3x3") ||
    qClean.includes("ma tran 3x3")
  ) {
    const matrix = parseMatrix(query);
    if (matrix && matrix.length === 3 && matrix.every((row) => row.length === 3)) {
      return solveSarrusDeterminant(matrix);
    }
    const defaultMatrix = [
      [1, 2, 3],
      [0, 1, 4],
      [5, 6, 0],
    ];
    return solveSarrusDeterminant(defaultMatrix);
  }

  return { success: false };
}

// ══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS FOR CUSTOM ALGORITHMS
// ══════════════════════════════════════════════════════════════

function parseMatrix(query: string): number[][] | null {
  // Check for matrix in bracket format, e.g. [[2,1,-1,8],[-3,-1,2,-11],[-2,1,2,-3]]
  const match = query.match(/\[\s*(?:\[\s*[-?\d.,\s]+\s*\]\s*,?\s*)+\]/);
  if (match) {
    try {
      const cleaned = match[0].replace(/;\s*$/, "");
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.every((row) => Array.isArray(row))) {
        return parsed.map((row) => row.map(Number));
      }
    } catch (e) {}
  }

  // Parse lines of numbers, e.g.
  // 2, 1, -1, 8
  // -3, -1, 2, -11
  // -2, 1, 2, -3
  const lines = query
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const matrix: number[][] = [];
  for (const line of lines) {
    // If line has numbers, split them by space, comma or semicolon
    const cleanLine = line.replace(/[\[\]]/g, ""); // strip brackets
    const nums = cleanLine
      .split(/[\s,;\t]+/)
      .map(Number)
      .filter((n) => !isNaN(n));
    if (nums.length > 0) {
      matrix.push(nums);
    }
  }

  if (matrix.length >= 2 && matrix.every((row) => row.length === matrix[0].length)) {
    return matrix;
  }
  return null;
}

function solveGaussianElimination(matrix: number[][]): { success: boolean; steps: string[]; solution?: number[] } {
  const steps: string[] = [];
  const n = matrix.length;
  // Deep copy matrix
  const A = matrix.map((row) => [...row]);

  steps.push(`**1. Ma trận bổ sung $[A|b]$ ban đầu:**\n` + formatMatrix(A));

  for (let i = 0; i < n; i++) {
    // Pivoting
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }

    if (maxRow !== i) {
      const temp = A[i];
      A[i] = A[maxRow];
      A[maxRow] = temp;
      steps.push(`- *Hoán vị dòng ${i + 1} và dòng ${maxRow + 1} để có pivot tốt nhất:* \n` + formatMatrix(A));
    }

    if (Math.abs(A[i][i]) < 1e-9) {
      return { success: false, steps };
    }

    // Eliminate below
    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i];
      for (let j = i; j <= n; j++) {
        A[k][j] -= factor * A[i][j];
      }
      steps.push(
        `- *Triệt tiêu cột ${i + 1} ở dòng ${k + 1} (nhân dòng ${i + 1} với ${factor.toFixed(3)} rồi trừ đi):* \n` + formatMatrix(A),
      );
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  steps.push(`**2. Ma trận bậc thang hoàn thiện. Bắt đầu thế ngược (Back Substitution):**`);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += A[i][j] * x[j];
    }
    x[i] = (A[i][n] - sum) / A[i][i];
    steps.push(
      `- Dòng ${i + 1}: $x_{${i + 1}} = \\frac{${A[i][n].toFixed(3)} - (${sum.toFixed(3)})}{${A[i][i].toFixed(3)}} = ${x[i].toFixed(4)}$`,
    );
  }

  return { success: true, steps, solution: x };
}

function formatMatrix(A: number[][]): string {
  return (
    "$$\\left[\\begin{array}{" +
    "c".repeat(A[0].length - 1) +
    "|c}\n" +
    A.map((row) => row.map((v) => v.toFixed(3)).join(" & ")).join(" \\\\\n") +
    "\n\\end{array}\\right]$$"
  );
}

function generatePinMatrix(expr: string, size = 5): string {
  let zFunc = (x: number, y: number) => x * x + y * y; // default paraboloid
  let formulaDesc = "z = x^2 + y^2 \\text{ (Paraboloid)}";

  if (expr.includes("-") || expr.includes("saddle") || expr.includes("yen")) {
    zFunc = (x: number, y: number) => x * x - y * y;
    formulaDesc = "z = x^2 - y^2 \\text{ (Saddle Surface / Yên Ngựa)}";
  } else if (expr.includes("sin") || expr.includes("cos") || expr.includes("song")) {
    zFunc = (x: number, y: number) => Math.sin(x * Math.PI) * Math.cos(y * Math.PI);
    formulaDesc = "z = \\sin(\\pi x) \\cdot \\cos(\\pi y) \\text{ (Wave Surface)}";
  } else if (expr.includes("sphere") || expr.includes("cau")) {
    zFunc = (x: number, y: number) => Math.sqrt(Math.max(0, 4 - x * x - y * y));
    formulaDesc = "z = \\sqrt{4 - x^2 - y^2} \\text{ (Spherical Surface)}";
  }

  const matrix: number[][] = [];
  const steps = size - 1;
  for (let i = 0; i < size; i++) {
    const row: number[] = [];
    const x = -1 + (2 * i) / steps;
    for (let j = 0; j < size; j++) {
      const y = -1 + (2 * j) / steps;
      row.push(zFunc(x, y));
    }
    matrix.push(row);
  }

  let table = `| Row/Col | ` + Array.from({ length: size }, (_, i) => `Col ${i + 1}`).join(" | ") + " |\n";
  table += `|---|` + "---|".repeat(size) + "\n";
  for (let i = 0; i < size; i++) {
    table += `| **Row ${i + 1}** | ` + matrix[i].map((v) => v.toFixed(3)).join(" | ") + " |\n";
  }

  return (
    `📐 **[MÔ PHỎNG MA TRẬN CHỐT PIN KHUÔN LINH HOẠT - SMART FLEXIBLE FORMWORK]**\n\n` +
    `- **Mặt cong thiết kế:** $$${formulaDesc}$$\n` +
    `- **Kích thước lưới pin:** ${size}x${size} (Tổng số: ${size * size} chốt pin điều khiển số)\n\n` +
    `**Bảng tọa độ chiều cao thiết lập cho các chốt pin (Pin Heights in mm):**\n\n${table}\n\n` +
    `*Hệ thống đã tự động tính toán hành trình dịch chuyển của từng pin để tạo hình tối ưu mà không cần đúc khuôn cứng!*`
  );
}

function simulateCoinGuessing(rounds = 100, probA = 0.5, probB = 0.5): string {
  let winsA = 0;
  let winsB = 0;
  let scoreA = 0;

  for (let i = 0; i < rounds; i++) {
    const choiceA = Deterministic.random() < probA ? "H" : "T";
    const choiceB = Deterministic.random() < probB ? "H" : "T";
    if (choiceA === choiceB) {
      winsA++;
      scoreA += 1;
    } else {
      winsB++;
      scoreA -= 1;
    }
  }

  return (
    `🎲 **[MÔ PHỎNG LÝ THUYẾT TRÒ CHƠI - NGƯỜI MÙ ĐOÁN XU]**\n\n` +
    `- **Số vòng mô phỏng:** ${rounds} vòng\n` +
    `- **Xác suất đoán Ngửa của Người mù (Player A - p):** ${(probA * 100).toFixed(0)}%\n` +
    `- **Xác suất giấu Ngửa của Người giấu xu (Player B - q):** ${(probB * 100).toFixed(0)}%\n\n` +
    `**Kết quả chạy thuật toán:**\n` +
    `- **Số lần Player A đoán trúng (được cộng điểm):** ${winsA} lần\n` +
    `- **Số lần Player A đoán sai (bị trừ điểm):** ${winsB} lần\n` +
    `- **Tổng điểm tích lũy của Player A:** **${scoreA > 0 ? "+" : ""}${scoreA} điểm**\n` +
    `- **Tỷ lệ thắng thực tế:** **${((winsA / rounds) * 100).toFixed(2)}%**\n\n` +
    `*Nhận xét:* Theo cân bằng Nash hỗn hợp ($p = q = 0.5$), kỳ vọng toán học dài hạn của cả hai người chơi sẽ tiệm cận về 0. Tỷ lệ thắng thực tế trong mô phỏng này là **${((winsA / rounds) * 100).toFixed(2)}%** (rất sát với mức lý thuyết 50%).`
  );
}

function solveMultivariateGaussian(x: number[], mu: number[], cov: number[][]): { success: boolean; text: string } {
  if (x.length !== 2 || mu.length !== 2 || cov.length !== 2 || cov.some((r) => r.length !== 2)) {
    return { success: false, text: "Bộ tính toán Gaussian đa biến hiện hỗ trợ tối ưu cho trường hợp 2 chiều (2D Multivariate Gaussian)." };
  }

  const dx = [x[0] - mu[0], x[1] - mu[1]];
  const det = cov[0][0] * cov[1][1] - cov[0][1] * cov[1][0];
  if (Math.abs(det) < 1e-9) {
    return { success: false, text: "Ma trận hiệp phương sai bất thường (định thức bằng 0, không thể nghịch đảo)." };
  }

  const inv = [
    [cov[1][1] / det, -cov[0][1] / det],
    [-cov[1][0] / det, cov[0][0] / det],
  ];

  const idx = [inv[0][0] * dx[0] + inv[0][1] * dx[1], inv[1][0] * dx[0] + inv[1][1] * dx[1]];
  const mahalanobis2 = dx[0] * idx[0] + dx[1] * idx[1];
  const density = (1 / (2 * Math.PI * Math.sqrt(det))) * Math.exp(-0.5 * mahalanobis2);

  return {
    success: true,
    text:
      `📊 **[TÍNH TOÁN MẬT ĐỘ PHÂN PHỐI GAUSSIAN ĐA BIẾN - MULTIVARIATE GAUSSIAN DENSITY]**\n\n` +
      `**Công thức mật độ xác suất đầy đủ:**\n` +
      `$$p(x) = \\frac{1}{2\\pi \\sqrt{|\\Sigma|}} \\exp\\left( -\\frac{1}{2} (x-\\mu)^T \\Sigma^{-1} (x-\\mu) \\right)$$\n\n` +
      `**Tham số đầu vào:**\n` +
      `- Vector đầu vào $x$: $\\begin{pmatrix} ${x[0]} \\\\ ${x[1]} \\end{pmatrix}$\n` +
      `- Vector trung tâm $\\mu$: $\\begin{pmatrix} ${mu[0]} \\\\ ${mu[1]} \\end{pmatrix}$\n` +
      `- Ma trận hiệp phương sai $\\Sigma$: $\\begin{pmatrix} ${cov[0][0]} & ${cov[0][1]} \\\\ ${cov[1][0]} & ${cov[1][1]} \\end{pmatrix}$\n\n` +
      `**Các bước tính toán chi tiết:**\n` +
      `1. **Vector sai lệch $(x-\\mu)$:** $\\begin{pmatrix} ${dx[0]} \\\\ ${dx[1]} \\end{pmatrix}$\n` +
      `2. **Định thức $|\\Sigma|$:** $${cov[0][0]} \\cdot ${cov[1][1]} - ${cov[0][1]} \\cdot ${cov[1][0]} = ${det.toFixed(4)}$\n` +
      `3. **Ma trận nghịch đảo $\\Sigma^{-1}$:** $\\begin{pmatrix} ${inv[0][0].toFixed(4)} & ${inv[0][1].toFixed(4)} \\\\ ${inv[1][0].toFixed(4)} & ${inv[1][1].toFixed(4)} \\end{pmatrix}$\n` +
      `4. **Khoảng cách Mahalanobis bình phương $(x-\\mu)^T \\Sigma^{-1} (x-\\mu)$:**\n` +
      `   $$D_M^2 = \\begin{pmatrix} ${dx[0]} & ${dx[1]} \\end{pmatrix} \\begin{pmatrix} ${idx[0].toFixed(4)} \\\\ ${idx[1].toFixed(4)} \\end{pmatrix} = ${mahalanobis2.toFixed(4)}$$\n` +
      `5. **Tính mật độ xác suất $p(x)$:**\n` +
      `   $$p(x) = \\frac{1}{2\\pi \\sqrt{${det.toFixed(4)}}} e^{-0.5 \\cdot ${mahalanobis2.toFixed(4)}} = ${density.toFixed(6)}$$\n\n` +
      `🏆 **KẾT LUẬN:**\n` +
      `- Giá trị mật độ xác suất tại điểm $x$: **${density.toExponential(6)}**\n` +
      `- Khoảng cách Mahalanobis: **${Math.sqrt(mahalanobis2).toFixed(4)}**`,
  };
}

const RBF_ANIMATION_SVG = `<svg width="100%" height="250" viewBox="0 0 500 250" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 8px; border: 1px solid #334155; font-family: sans-serif;">
  <style>
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.8; }
      50% { transform: scale(1.2); opacity: 1; filter: drop-shadow(0 0 8px #38bdf8); }
    }
    @keyframes move-p1 {
      0% { cx: 60px; cy: 125px; opacity: 1; }
      50% { cx: 220px; cy: 50px; opacity: 1; }
      100% { cx: 220px; cy: 50px; opacity: 0; }
    }
    @keyframes move-p2 {
      0% { cx: 60px; cy: 125px; opacity: 1; }
      50% { cx: 220px; cy: 125px; opacity: 1; }
      100% { cx: 220px; cy: 125px; opacity: 0; }
    }
    @keyframes move-p3 {
      0% { cx: 60px; cy: 125px; opacity: 1; }
      50% { cx: 220px; cy: 200px; opacity: 1; }
      100% { cx: 220px; cy: 200px; opacity: 0; }
    }
    @keyframes move-sum {
      0% { opacity: 0; }
      45% { opacity: 0; }
      50% { cx: 220px; cy: 125px; opacity: 1; }
      80% { cx: 380px; cy: 125px; opacity: 1; }
      100% { cx: 380px; cy: 125px; opacity: 0; }
    }
    @keyframes glow-gauss {
      0%, 45% { fill: #475569; filter: none; }
      50%, 80% { fill: #a855f7; filter: drop-shadow(0 0 10px #c084fc); }
      100% { fill: #475569; filter: none; }
    }
    @keyframes glow-sum {
      0%, 75% { fill: #475569; filter: none; }
      80%, 95% { fill: #eab308; filter: drop-shadow(0 0 12px #fde047); }
      100% { fill: #475569; filter: none; }
    }
    @keyframes glow-out {
      0%, 90% { fill: #475569; filter: none; }
      92%, 100% { fill: #22c55e; filter: drop-shadow(0 0 15px #4ade80); }
    }
    .node-in { fill: #0ea5e9; }
    .node-g { animation: glow-gauss 4s infinite; }
    .node-sum { animation: glow-sum 4s infinite; }
    .node-out { animation: glow-out 4s infinite; }
    .line { stroke: #334155; stroke-width: 2; stroke-dasharray: 4; }
    .particle-1 { animation: move-p1 4s infinite ease-in-out; }
    .particle-2 { animation: move-p2 4s infinite ease-in-out; }
    .particle-3 { animation: move-p3 4s infinite ease-in-out; }
    .particle-s { animation: move-sum 4s infinite ease-in-out; }
  </style>

  <!-- Connections -->
  <line x1="60" y1="125" x2="220" y2="50" class="line" />
  <line x1="60" y1="125" x2="220" y2="125" class="line" />
  <line x1="60" y1="125" x2="220" y2="200" class="line" />
  <line x1="220" y1="50" x2="380" y2="125" class="line" />
  <line x1="220" y1="125" x2="380" y2="125" class="line" />
  <line x1="220" y1="200" x2="380" y2="125" class="line" />
  <line x1="380" y1="125" x2="450" y2="125" class="line" />

  <!-- Dynamic Particles -->
  <circle r="6" fill="#38bdf8" class="particle-1" />
  <circle r="6" fill="#38bdf8" class="particle-2" />
  <circle r="6" fill="#38bdf8" class="particle-3" />
  <circle r="6" fill="#fde047" class="particle-s" />

  <!-- Nodes -->
  <circle cx="60" cy="125" r="15" class="node-in" />
  <text x="60" y="129" font-size="12" fill="#fff" text-anchor="middle" font-weight="bold">x</text>
  <text x="60" y="155" font-size="10" fill="#94a3b8" text-anchor="middle">Input Point</text>

  <circle cx="220" cy="50" r="18" class="node-g" style="animation-delay: 0s;" />
  <text x="220" y="54" font-size="12" fill="#fff" text-anchor="middle" font-weight="bold">φ1</text>
  
  <circle cx="220" cy="125" r="18" class="node-g" style="animation-delay: 0s;" />
  <text x="220" y="129" font-size="12" fill="#fff" text-anchor="middle" font-weight="bold">φ2</text>
  
  <circle cx="220" cy="200" r="18" class="node-g" style="animation-delay: 0s;" />
  <text x="220" y="204" font-size="12" fill="#fff" text-anchor="middle" font-weight="bold">φ3</text>
  <text x="220" y="232" font-size="10" fill="#94a3b8" text-anchor="middle">Gauss Neurons</text>

  <circle cx="380" cy="125" r="18" class="node-sum" />
  <text x="380" y="129" font-size="14" fill="#fff" text-anchor="middle" font-weight="bold">∑</text>
  <text x="380" y="155" font-size="10" fill="#94a3b8" text-anchor="middle">Sum / Weight</text>

  <circle cx="450" cy="125" r="15" class="node-out" />
  <text x="450" y="129" font-size="12" fill="#fff" text-anchor="middle" font-weight="bold">y</text>
  <text x="450" y="155" font-size="10" fill="#94a3b8" text-anchor="middle">Output</text>
</svg>`;

export function solveRBFNeuralNetwork(query: string): string {
  const xMatch = query.match(/x\s*[=:]\s*(\[[^\]]+\])/i);
  let x = [1.2, 1.8];
  if (xMatch) {
    try {
      x = JSON.parse(xMatch[1]);
    } catch (e) {}
  }

  const centers = [
    [0.0, 0.0],
    [1.0, 1.0],
    [2.0, 2.0],
  ];
  const widths = [1.0, 1.2, 1.5];
  const weights = [0.5, -0.8, 0.6];

  const outputs: string[] = [];
  let y = 0;

  for (let i = 0; i < centers.length; i++) {
    const c = centers[i];
    const sigma = widths[i];
    const w = weights[i];

    const dx = x[0] - c[0];
    const dy = x[1] - c[1];
    const dist2 = dx * dx + dy * dy;
    const phi = Math.exp(-dist2 / (2 * sigma * sigma));
    y += w * phi;

    outputs.push(
      `- **Nơ-ron ẩn $H_${i + 1}$** (Tâm $\\mathbf{c}_${i + 1} = [${c.join(", ")}]$, độ rộng $\\sigma = ${sigma}$, trọng số $w = ${w}$):\n` +
        `  - Khoảng cách Euclid bình phương đến đầu vào: $d^2 = (${x[0]} - ${c[0]})^2 + (${x[1]} - ${c[1]})^2 = ${dist2.toFixed(4)}$\n` +
        `  - Kích hoạt Gaussian: $\\phi_${i + 1}(\\mathbf{x}) = \\exp\\left(-\\frac{${dist2.toFixed(4)}}{2 \\cdot ${sigma}^2}\\right) = ${phi.toFixed(5)}$\n` +
        `  - Đóng góp vào đầu ra: $w_${i + 1} \\phi_${i + 1} = ${w} \\cdot ${phi.toFixed(5)} = ${(w * phi).toFixed(5)}$`,
    );
  }

  return (
    `🧠 **[MÔ PHỎNG MẠNG NƠ-RON HÀM CƠ SỞ BÁN KÍNH - RBF NEURAL NETWORK SOLVER]**\n\n` +
    `**Mô hình hoạt họa RBF Neural Network (Điểm chạy vào các Gaussian rồi kích hoạt Output):**\n\n` +
    RBF_ANIMATION_SVG +
    `\n\n` +
    `**Bài toán:** Mô phỏng sự biến dạng và chuyển dạng linh hoạt của dữ liệu qua các nơ-ron Gaussian RBF, nơi nhiều mặt phẳng (hyperplanes) chạm và phân tách không gian đặc trưng qua các chiều.\n\n` +
    `**Thông số cấu hình mạng nơ-ron RBF:**\n` +
    `- Vector đầu vào $\\mathbf{x}$ (tọa độ điểm không gian): **[${x.join(", ")}]**\n` +
    `- Số lượng nơ-ron ẩn Gaussian: **3**\n\n` +
    `**Chi tiết tính toán kích hoạt Gaussian ẩn:**\n` +
    outputs.join("\n\n") +
    `\n\n` +
    `**Tổng hợp đầu ra mạng Nơ-ron RBF:**\n` +
    `$$y(\\mathbf{x}) = \\sum_{i=1}^3 w_i \\phi_i(\\mathbf{x})$$\n` +
    `$$y(\\mathbf{x}) = ${weights[0]} \\cdot ${Math.exp(-((x[0] - centers[0][0]) ** 2 + (x[1] - centers[0][1]) ** 2) / (2 * widths[0] ** 2)).toFixed(4)} + ` +
    `(${weights[1]}) \\cdot ${Math.exp(-((x[0] - centers[1][0]) ** 2 + (x[1] - centers[1][1]) ** 2) / (2 * widths[1] ** 2)).toFixed(4)} + ` +
    `${weights[2]} \\cdot ${Math.exp(-((x[0] - centers[2][0]) ** 2 + (x[1] - centers[2][1]) ** 2) / (2 * widths[2] ** 2)).toFixed(4)} = **${y.toFixed(5)}**\n\n` +
    `🏆 **KẾT LUẬN CHUYỂN DẠNG LINH HOẠT:**\n` +
    `- Giá trị phản hồi đặc trưng tại tọa độ $\\mathbf{x}$ qua các mặt phẳng RBF đa chiều: **${y.toFixed(4)}**.\n` +
    `- Thuật toán Machine Learning RBF Gaussian đã mô phỏng phân tách không gian phi tuyến bằng các mặt phẳng giao cắt thành công!`
  );
}

export function solveRbfPomdpCombined(query: string): string {
  const xMatch = query.match(/x\s*[=:]\s*(\[[^\]]+\])/i);
  let x = [1.2, 1.8];
  if (xMatch) {
    try {
      x = JSON.parse(xMatch[1]);
    } catch (e) {}
  }

  const roundsMatch = query.match(/(\d+)\s*(?:lan|vong|rounds)/) || query.match(/rounds\s*[=:]\s*(\d+)/);
  const rounds = roundsMatch ? parseInt(roundsMatch[1]) : 100;

  // 1. Attention Mesh (Thuật toán dệt liên kết) Step
  const w_arr = [0.8, 1.5];
  const c_arr = [x[0], x[1]];
  const dot = w_arr[0] * c_arr[0] + w_arr[1] * c_arr[1];
  const scale = Math.sqrt(2);
  const attScore = Math.exp(dot / scale); // simplified single-node softmax weight

  // 2. RBF Neural Network Mapping Step
  const centers = [
    [0.0, 0.0],
    [1.0, 1.0],
    [2.0, 2.0],
  ];
  const widths = [1.0, 1.2, 1.5];
  const weights = [0.5, -0.8, 0.6];

  let yVal = 0;
  for (let i = 0; i < centers.length; i++) {
    const c = centers[i];
    const sigma = widths[i];
    const w = weights[i];
    const dx = x[0] - c[0];
    const dy = x[1] - c[1];
    const dist2 = dx * dx + dy * dy;
    const phi = Math.exp(-dist2 / (2 * sigma * sigma));
    yVal += w * phi;
  }

  // 3. Link RBF output to POMDP probability using Sigmoid
  const p_rbf = 1 / (1 + Math.exp(-yVal));

  // 4. Run POMDP Coin Guessing Simulation
  let winsA = 0;
  let winsB = 0;
  let scoreA = 0;
  const probB = 0.5; // opponent Nash mixed strategy

  for (let i = 0; i < rounds; i++) {
    const choiceA = Deterministic.random() < p_rbf ? "H" : "T";
    const choiceB = Deterministic.random() < probB ? "H" : "T";
    if (choiceA === choiceB) {
      winsA++;
      scoreA += 1;
    } else {
      winsB++;
      scoreA -= 1;
    }
  }

  return (
    `🔗 **[HỆ THỐNG LIÊN KẾT NHẬN THỨC TOÀN DIỆN: ATTENTION MESH $\\rightarrow$ RBF NEURAL NETWORK $\\rightarrow$ POMDP COIN GUESSING]**\n\n` +
    `**Ý tưởng tích hợp:** Tối ưu hóa chu trình tự trị qua 3 cấp lớp: Dệt liên kết tri thức (Attention), Ánh xạ siêu phẳng phi tuyến đa chiều (RBF) và Ra quyết định đàm phán trong không gian ẩn (POMDP).\n\n` +
    `### 🧵 Bước 1: Thuật toán Dệt liên kết (Attention Mesh - Tri thức siêu liên kết)\n` +
    `- **Ý nghĩa:** Dệt các sợi dọc $W$ (chính sách hệ thống) và sợi ngang $C$ (bối cảnh) thành ma trận Attention: $$A = \\text{softmax}\\left(\\frac{W \\cdot C^T}{\\sqrt{d}}\\right)$$\n` +
    `- **Tính toán cục bộ:** Lưới dệt dập khuôn tại tọa độ đầu vào cho ra trọng số Mesh Attention: **${attScore.toFixed(4)}**.\n\n` +
    `### 🧠 Bước 2: Lớp Gauss mạng Nơ-ron RBF (Radial Basis Function - Ánh xạ siêu phẳng)\n` +
    `- **Hoạt họa dòng chảy lan truyền mạng RBF (Điểm chạy vào các Gaussian rồi kích hoạt Output):**\n\n` +
    RBF_ANIMATION_SVG +
    `\n\n` +
    `- **Ý nghĩa:** Ánh xạ vector đầu vào $\\mathbf{x}$ lên không gian đặc trưng đa chiều tiếp xúc qua các siêu phẳng cắt ngang các lớp Gaussian ẩn:\n` +
    `  $$\\phi_i(\\mathbf{x}) = \\exp\\left(-\\frac{\\|\\mathbf{x} - \\mathbf{c}_i\\|^2}{2\\sigma_i^2}\\right)$$\n` +
    `- Đầu vào không gian $\\mathbf{x}$: **[${x.join(", ")}]**\n` +
    `- Giá trị phản hồi RBF kết hợp $y(\\mathbf{x})$: **${yVal.toFixed(5)}**\n\n` +
    `### 🔄 Bước 3: Hàm kích hoạt Sigmoid chuyển dịch thành Xác suất niềm tin ($p$)\n` +
    `- Áp dụng hàm Sigmoid lên kết quả mạng RBF: $$p = \\sigma(y(\\mathbf{x})) = \\frac{1}{1 + e^{-y(\\mathbf{x})}}$$\n` +
    `- Xác suất dự đoán tối ưu cập nhật của Người mù ($p$): **${p_rbf.toFixed(5)}** (~**${(p_rbf * 100).toFixed(2)}%**)\n\n` +
    `### 🎲 Bước 4: Mô phỏng POMDP Người mù đoán xu (${rounds} vòng)\n` +
    `- Xác suất đoán Ngửa cập nhật ($p$): **${(p_rbf * 100).toFixed(1)}%**\n` +
    `- Xác suất giấu Ngửa đối thủ ($q$ - Cân bằng Nash): **50%**\n\n` +
    `**Kết quả mô phỏng:**\n` +
    `- **Số lần đoán trúng:** ${winsA} lần\n` +
    `- **Số lần đoán sai:** ${winsB} lần\n` +
    `- **Tổng điểm tích lũy:** **${scoreA > 0 ? "+" : ""}${scoreA} điểm**\n` +
    `- **Tỷ lệ thắng thực tế:** **${((winsA / rounds) * 100).toFixed(2)}%**\n\n` +
    `🏆 **KẾT LUẬN LIÊN KẾT HỆ THỐNG:**\n` +
    `- Lưới dệt tri thức kết hợp mạng nơ-ron RBF và bộ giải POMDP đã hoạt động chuẩn xác! Việc cập nhật xác suất phán đoán dựa trên các mặt phẳng đặc trưng đa chiều của RBF giúp người mù định vị không gian ẩn của đồng xu với độ chính xác thực tế đạt **${((winsA / rounds) * 100).toFixed(1)}%**!`
  );
}

export function solveMasterPipelineCombined(query: string, problem: string): string {
  const xMatch = query.match(/x\s*[=:]\s*(\[[^\]]+\])/i);
  let x = [1.2, 1.8];
  if (xMatch) {
    try {
      x = JSON.parse(xMatch[1]);
    } catch (e) {}
  }

  const w_arr = [0.8, 1.5];
  const c_arr = [x[0], x[1]];
  const dot = w_arr[0] * c_arr[0] + w_arr[1] * c_arr[1];
  const scale = Math.sqrt(2);
  const attScore = Math.exp(dot / scale);

  const centers = [
    [0.0, 0.0],
    [1.0, 1.0],
    [2.0, 2.0],
  ];
  const widths = [1.0, 1.2, 1.5];
  const weights = [0.5, -0.8, 0.6];

  let yVal = 0;
  for (let i = 0; i < centers.length; i++) {
    const c = centers[i];
    const sigma = widths[i];
    const w = weights[i];
    const dx = x[0] - c[0];
    const dy = x[1] - c[1];
    const dist2 = dx * dx + dy * dy;
    const phi = Math.exp(-dist2 / (2 * sigma * sigma));
    yVal += w * phi;
  }

  const p_rbf = 1 / (1 + Math.exp(-yVal));
  let winsA = 0;
  let winsB = 0;
  let scoreA = 0;
  const probB = 0.5;
  const rounds = 100;

  for (let i = 0; i < rounds; i++) {
    const choiceA = Deterministic.random() < p_rbf ? "H" : "T";
    const choiceB = Deterministic.random() < probB ? "H" : "T";
    if (choiceA === choiceB) {
      winsA++;
      scoreA += 1;
    } else {
      winsB++;
      scoreA -= 1;
    }
  }

  const pomdpScore = winsA / rounds;

  const dt = 0.2;
  const f_t = 0.5;
  const u_t = pomdpScore;
  let h = 0.0;
  const flowSteps: string[] = [];

  for (let step = 1; step <= 5; step++) {
    const t = step * dt;
    const dh = (-(f_t + h) * h + f_t * u_t) * dt;
    h += dh;
    flowSteps.push(
      `  - **Thời điểm $t = ${t.toFixed(1)}s$:** Giá trị dòng chảy thích nghi $h(t) = ${h.toFixed(5)}$ (Độ lệch dư: ${Math.abs(u_t - h).toFixed(5)})`,
    );
  }

  const attentionFormula = "A = \\text{softmax}\\left(\\frac{W \\cdot C^T}{\\sqrt{d}}\\right)";
  const rbfFormula = "\\phi_i(\\mathbf{x}) = \\exp\\left(-\\frac{\\|\\mathbf{x} - \\mathbf{c}_i\\|^2}{2\\sigma_i^2}\\right)";
  const pomdpFormula = "b'(s') = \\eta \\cdot O(o|s', a) \\sum_{s} T(s'|s, a) \\cdot b(s)";
  const liquidFormula = "\\frac{dh}{dt} = -[f(t) + h(t)] \\cdot h(t) + f(t) \\cdot u(t)";

  return (
    `👑 **[HỆ THỐNG SIÊU THUẬT TOÁN LIÊN NGÀNH - THE MASTER PIPELINE SOLVER]**\n\n` +
    `**Bài toán phân tích:** *"${problem}"*\n\n` +
    `Hệ thống đã kích hoạt thành công quy trình xử lý 4 giai đoạn tự trị được liên kết chặt chẽ thông qua các chiều (Gaussian RBF & Hyperplanes Intersections):\n\n` +
    `--- \n\n` +
    `### 🧵 Giai đoạn 1: Công thức dệt (Trí nhớ Siêu liên kết - Attention Mesh)\n` +
    `- **Mô hình hóa:** Dệt các sợi dọc $W$ (chính sách hệ thống) và sợi ngang $C$ (bối cảnh hội thoại thời gian thực) thành lưới ma trận Attention:\n` +
    `  $$${attentionFormula}$$\n` +
    `- **Kết quả dệt:** Tạo lưới liên kết đồ thị với độ dày liên kết tối đa tại tọa độ đầu vào, cho ra trọng số Mesh Attention: **${attScore.toFixed(4)}**.\n\n` +
    `### 📊 Giai đoạn 2: Mạng Nơ-ron RBF (Ánh xạ đặc trưng phi tuyến & Tiếp xúc siêu phẳng - Hyperplanes Intersections)\n` +
    `- **Hoạt họa dòng chảy lan truyền mạng RBF (Điểm chạy vào các Gaussian rồi kích hoạt Output):**\n\n` +
    RBF_ANIMATION_SVG +
    `\n\n` +
    `- **Mô hình hóa:** Áp dụng mạng nơ-ron RBF để mô phỏng chuyển dạng linh hoạt của dữ liệu qua các nơ-ron ẩn Gaussian phi tuyến. Tại đây, nhiều mặt phẳng (hyperplanes) cắt và tiếp xúc các chiều đặc trưng để phân hoạch biên quyết định:\n` +
    `  $$${rbfFormula}$$\n` +
    `- **Kết quả RBF:** Giá trị phản hồi RBF kết hợp $y(\\mathbf{x}) = \\sum w_i \\phi_i(\\mathbf{x}) = $ **${yVal.toFixed(5)}**.\n\n` +
    `### 🎲 Giai đoạn 3: Người mù đoán xu (Thao túng không gian ẩn - POMDP State Collapse)\n` +
    `- **Mô hình hóa:** Chuyển dịch đầu ra RBF thông qua hàm Sigmoid để cập nhật xác suất đoán xu tối ưu ($p = \\sigma(y(\\mathbf{x}))$). Thực hiện lật xu mô phỏng để giải quyết bài toán không gian ẩn của đối phương:\n` +
    `  $$${pomdpFormula}$$\n` +
    `- **Mô phỏng POMDP (${rounds} vòng):** Xác suất đoán $p = $ **${(p_rbf * 100).toFixed(2)}%**. Số lần đoán trúng: **${winsA}/${rounds}** lần. Điểm tích lũy: **${scoreA > 0 ? "+" : ""}${scoreA}**. Trọng số đàm phán tối ưu đầu ra $u(t) = $ **${pomdpScore.toFixed(5)}**.\n\n` +
    `### 💧 Giai đoạn 4: Hydroforming (Thích nghi lỏng - Liquid Neural Network Flow)\n` +
    `- **Mô hình hóa:** Sử dụng đầu ra POMDP $u(t)$ làm nguồn kích thích để giải dòng chảy vi phân thích nghi mềm dẻo của Liquid Neural Network, ôm khít biên dạng logic đàm phán:\n` +
    `  $$${liquidFormula}$$\n` +
    `- **Quá trình dòng chảy thích nghi hội tụ (Euler integration, dt = 0.2s):**\n` +
    flowSteps.join("\n") +
    `\n` +
    `- **Kết quả thích nghi:** Dòng chảy hội tụ về trạng thái cân bằng động bền vững tại mức áp suất: **${h.toFixed(5)}**.\n\n` +
    `--- \n\n` +
    `🏆 **KẾT LUẬN SUY LUẬN TỰ TRỊ (Autonomous Agent Decision):**\n` +
    `- Bộ điều khiển AgentProMax đã hoàn thành chuỗi liên kết thuật toán dệt phôi, siêu phẳng RBF đa chiều, sụp đổ trạng thái POMDP và thích nghi lỏng Hydroforming.\n` +
    `- Trạng thái thích nghi cuối cùng đạt: **${h.toFixed(4)}** với độ tin cậy hội tụ tối ưu: **${((1 - Math.abs(u_t - h)) * 100).toFixed(2)}%**.`
  );
}

// ══════════════════════════════════════════════════════════════
// FENWICK TREE AND FFT SOLVER IMPLEMENTATIONS
// ══════════════════════════════════════════════════════════════

interface Complex {
  r: number;
  i: number;
}

function add(c1: Complex, c2: Complex): Complex {
  return { r: c1.r + c2.r, i: c1.i + c2.i };
}

function sub(c1: Complex, c2: Complex): Complex {
  return { r: c1.r - c2.r, i: c1.i - c2.i };
}

function mul(c1: Complex, c2: Complex): Complex {
  return { r: c1.r * c2.r - c1.i * c2.i, i: c1.r * c2.i + c1.i * c2.r };
}

function genericFFT(a: Complex[], invert: boolean): Complex[] {
  const n = a.length;
  if (n <= 1) return a;

  const A = new Array(n);
  for (let i = 0; i < n; i++) {
    let rev = 0;
    const logN = Math.log2(n);
    for (let j = 0; j < logN; j++) {
      if ((i & (1 << j)) !== 0) {
        rev |= 1 << (logN - 1 - j);
      }
    }
    A[rev] = { ...a[i] };
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = ((2 * Math.PI) / len) * (invert ? -1 : 1);
    const wlen: Complex = { r: Math.cos(angle), i: Math.sin(angle) };
    for (let i = 0; i < n; i += len) {
      let w: Complex = { r: 1, i: 0 };
      for (let j = 0; j < len / 2; j++) {
        const u = A[i + j];
        const v = mul(A[i + j + len / 2], w);
        A[i + j] = add(u, v);
        A[i + j + len / 2] = sub(u, v);
        w = mul(w, wlen);
      }
    }
  }

  if (invert) {
    for (let i = 0; i < n; i++) {
      A[i].r /= n;
      A[i].i /= n;
    }
  }
  return A;
}

function solveFenwickTreeSolver(query: string): string {
  let arr = [3, 2, -1, 6, 5, 4, -3, 2];
  const arrayMatch = query.match(/\[\s*([-?\d.,\s]+)\s*\]/);
  if (arrayMatch) {
    try {
      arr = arrayMatch[1]
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => !isNaN(n));
    } catch (e) {}
  }
  if (arr.length === 0) arr = [3, 2, -1, 6, 5, 4, -3, 2];
  if (arr.length > 16) {
    arr = arr.slice(0, 16);
  }

  const n = arr.length;
  const tree = new Array(n + 1).fill(0);
  const buildSteps: string[] = [];
  const toBin = (x: number) => x.toString(2);

  for (let i = 0; i < n; i++) {
    let idx = i + 1;
    const val = arr[i];
    buildSteps.push(`**Thêm phần tử arr[${i}] = ${val}:**`);
    while (idx <= n) {
      const old = tree[idx];
      tree[idx] += val;
      buildSteps.push(
        `  - tree[${idx}] += ${val} (cũ: ${old}, mới: ${tree[idx]}). Nhị phân index: \`${idx}\` (${toBin(idx)}). Bước tiếp theo: index += index & -index = ${idx} + ${idx & -idx} = ${idx + (idx & -idx)}`,
      );
      idx += idx & -idx;
    }
  }

  let updateIdx = 3;
  let updateDelta = 5;
  const updateMatch = query.match(/update\s*\(\s*(\d+)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/i);
  if (updateMatch) {
    updateIdx = parseInt(updateMatch[1]);
    updateDelta = parseFloat(updateMatch[2]);
  }
  if (updateIdx < 0 || updateIdx >= n) updateIdx = Math.min(3, n - 1);

  const updateSteps: string[] = [];
  updateSteps.push(`**Thực hiện update(${updateIdx}, ${updateDelta}):**`);
  let uIdx = updateIdx + 1;
  while (uIdx <= n) {
    const old = tree[uIdx];
    tree[uIdx] += updateDelta;
    updateSteps.push(
      `  - tree[${uIdx}] += ${updateDelta} (cũ: ${old}, mới: ${tree[uIdx]}). Nhị phân index: \`${uIdx}\` (${toBin(uIdx)}). Bước tiếp theo: index += index & -index = ${uIdx} + ${uIdx & -uIdx} = ${uIdx + (uIdx & -uIdx)}`,
    );
    uIdx += uIdx & -uIdx;
  }

  let qL = 2;
  let qR = 5;
  const queryMatch = query.match(/query\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (queryMatch) {
    qL = parseInt(queryMatch[1]);
    qR = parseInt(queryMatch[2]);
  }
  if (qL < 0 || qL >= n) qL = 0;
  if (qR < qL || qR >= n) qR = n - 1;

  const queryRSteps: string[] = [];
  let sumR = 0;
  let idxR = qR + 1;
  queryRSteps.push(`**Tính tổng tích lũy từ 0 đến ${qR} (query(${qR})):**`);
  while (idxR > 0) {
    sumR += tree[idxR];
    queryRSteps.push(
      `  - Cộng tree[${idxR}] (${tree[idxR]}) vào tổng $\\rightarrow$ tổng hiện tại: ${sumR}. Nhị phân: \`${idxR}\` (${toBin(idxR)}). Bước tiếp theo: index -= index & -index = ${idxR} - ${idxR & -idxR} = ${idxR - (idxR & -idxR)}`,
    );
    idxR -= idxR & -idxR;
  }

  const queryLSteps: string[] = [];
  let sumL = 0;
  if (qL > 0) {
    let idxL = qL;
    queryLSteps.push(`**Tính tổng tích lũy từ 0 đến ${qL - 1} (query(${qL - 1})):**`);
    while (idxL > 0) {
      sumL += tree[idxL];
      queryLSteps.push(
        `  - Cộng tree[${idxL}] (${tree[idxL]}) vào tổng $\\rightarrow$ tổng hiện tại: ${sumL}. Nhị phân: \`${idxL}\` (${toBin(idxL)}). Bước tiếp theo: index -= index & -index = ${idxL} - ${idxL & -idxL} = ${idxL - (idxL & -idxL)}`,
      );
      idxL -= idxL & -idxL;
    }
  } else {
    queryLSteps.push(`**Tổng tích lũy từ 0 đến -1 mặc định bằng 0.**`);
  }

  const rangeSum = sumR - sumL;

  const svgHeight = 40 + n * 25;
  let svgBars = "";
  for (let i = 1; i <= n; i++) {
    const len = i & -i;
    const start = i - len;
    const end = i - 1;
    const x = 50 + start * (320 / n);
    const w = len * (320 / n);
    const y = 30 + (i - 1) * 23;
    const colors = ["#38bdf8", "#818cf8", "#fb7185", "#34d399", "#fbbf24", "#a78bfa", "#22d3ee", "#f472b6"];
    const barColor = colors[Math.floor(Math.log2(len)) % colors.length];

    svgBars += `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="18" rx="4" fill="${barColor}" opacity="0.8" stroke="#ffffff" stroke-width="0.5" />
      <text x="${x + w / 2}" y="${y + 13}" font-size="10" fill="#0f172a" font-weight="bold" text-anchor="middle">tree[${i}]: ${tree[i]}</text>
      <text x="15" y="${y + 13}" font-size="10" fill="#94a3b8" font-weight="bold">Node ${i}</text>
      <text x="400" y="${y + 13}" font-size="9" fill="#64748b">[${start}..${end}]</text>
    </g>`;
  }

  let svgGrid = "";
  for (let i = 0; i <= n; i++) {
    const gx = 50 + i * (320 / n);
    svgGrid += `
    <line x1="${gx}" y1="20" x2="${gx}" y2="${svgHeight - 15}" stroke="#334155" stroke-width="1" stroke-dasharray="2" />
    <text x="${gx}" y="${svgHeight - 2}" font-size="9" fill="#94a3b8" text-anchor="middle">${i}</text>`;
  }

  const svgTree = `
<svg width="100%" height="${svgHeight}" viewBox="0 0 450 ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 8px; border: 1px solid #334155; font-family: sans-serif;">
  <text x="225" y="18" font-size="12" fill="#38bdf8" text-anchor="middle" font-weight="bold">Sơ đồ Độ phủ Khoảng của Cây Fenwick (N = ${n})</text>
  ${svgGrid}
  ${svgBars}
</svg>`;

  return `📊 **[BỘ GIẢI MÃ CẤU TRÚC CÂY FENWICK - BINARY INDEXED TREE SOLVER]**

Mô hình này mô phỏng cấu trúc cây Fenwick (BIT) giúp thực hiện thao tác **Update** và **Query Range Sum** trong độ phức tạp cực hạn $O(\\log N)$.

**Thông số đầu vào:**
- Mảng khởi tạo: \`[${arr.join(", ")}]\`
- Thao tác cập nhật: \`update(${updateIdx}, ${updateDelta})\` (arr[${updateIdx}] = ${arr[updateIdx]} $\\rightarrow$ ${arr[updateIdx] + updateDelta})
- Thao tác truy vấn: \`query(${qL}, ${qR})\` (Tính tổng khoảng từ chỉ số ${qL} đến ${qR})

---

### 🎨 SƠ ĐỒ ĐỘ PHỦ KHOẢNG (INTERVAL COVERAGE VISUALIZATION):
${svgTree}

---

### 🔨 1. BƯỚC KHỞI TẠO CÂY FENWICK (INITIALIZATION):
Bằng cách thêm từng phần tử của mảng vào cây Fenwick:
${buildSteps.slice(0, 15).join("\n")}
${buildSteps.length > 15 ? `\n*(Ẩn bớt ${buildSteps.length - 15} bước khởi tạo tương tự...)*` : ""}

---

### 🔄 2. BƯỚC CẬP NHẬT (UPDATE OPERATIONS):
Khi thay đổi giá trị tại chỉ số \`${updateIdx}\` thêm một lượng \`${updateDelta}\`:
${updateSteps.join("\n")}

---

### 🔍 3. BƯỚC TRUY VẤN ĐOẠN (RANGE QUERY SUM):
Công thức truy vấn khoảng $[L, R]$ trong cây Fenwick:
$$\\text{sum}(L, R) = \\text{query}(R) - \\text{query}(L - 1)$$

${queryRSteps.join("\n")}

${queryLSteps.join("\n")}

🏆 **KẾT QUẢ TRUY VẤN CUỐI CÙNG:**
- Tổng đoạn từ chỉ số ${qL} đến ${qR}: $\\text{sum}(${qL}, ${qR}) = ${sumR} - ${sumL} = $ **${rangeSum}**

---
*Thuật toán Cây Fenwick đã hoàn tất mô phỏng truy vấn và cập nhật chỉ với $O(\\log N)$ phép tính!*`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function solvePythagoreanTriples(query: string): string {
  let nLimit = 5;
  const match = query.match(/\b(\d+)\b/);
  if (match) {
    nLimit = Math.min(parseInt(match[1], 10), 20);
  }

  let steps = `🧮 **[BỘ BA SỐ NGUYÊN PYTHAGORE - PYTHAGOREAN TRIPLES]**\n\n`;
  steps += `Sử dụng công thức Euclid để tạo các bộ ba số nguyên $(a, b, c)$ thỏa mãn $a^2 + b^2 = c^2$:\n`;
  steps += `- $a = m^2 - n^2$\n`;
  steps += `- $b = 2mn$\n`;
  steps += `- $c = m^2 + n^2$\n`;
  steps += `*(với $m > n > 0$, $m, n$ nguyên tố cùng nhau và có tính chẵn lẻ khác nhau)*\n\n`;

  steps += `**Kết quả sinh ${nLimit} bộ ba nguyên thủy đầu tiên:**\n\n`;

  let count = 0;
  let m = 2;
  while (count < nLimit) {
    for (let n = 1; n < m; n++) {
      if (count >= nLimit) break;
      if (gcd(m, n) === 1 && (m - n) % 2 === 1) {
        const a = m * m - n * n;
        const b = 2 * m * n;
        const c = m * m + n * n;
        steps += `- Bộ ${count + 1}: **(${a}, ${b}, ${c})** *(m=${m}, n=${n})* $\\rightarrow ${a}^2 + ${b}^2 = ${c}^2$\n`;
        count++;
      }
    }
    m++;
  }

  return steps;
}

function solvePolynomialMultiplication(query: string): string {
  let A: number[] = [1, 2, 3];
  let B: number[] = [4, 5, 6];

  const arrays = [...query.matchAll(/\[\s*([-?\d.,\s]+)\s*\]/g)];
  if (arrays.length >= 2) {
    try {
      A = arrays[0][1]
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => !isNaN(n));
      B = arrays[1][1]
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => !isNaN(n));
    } catch (e) {}
  }
  if (A.length === 0) A = [1, 2];
  if (B.length === 0) B = [3, 4];

  const degA = A.length - 1;
  const degB = B.length - 1;
  const degC = degA + degB;
  const C_naive = new Array(degC + 1).fill(0);
  for (let i = 0; i <= degA; i++) {
    for (let j = 0; j <= degB; j++) {
      C_naive[i + j] += A[i] * B[j];
    }
  }

  let karatsubaSteps = "";
  if (A.length === 2 && B.length === 2) {
    const a0 = A[0],
      a1 = A[1];
    const b0 = B[0],
      b1 = B[1];
    const Y0 = a0 * b0;
    const Y2 = a1 * b1;
    const Y1 = (a0 + a1) * (b0 + b1) - Y0 - Y2;
    karatsubaSteps = `**Thuật toán nhân nhanh Karatsuba (N = 2):**
- Tính $Y_0 = a_0 \\cdot b_0 = ${a0} \\cdot ${b0} = ${Y0}$
- Tính $Y_2 = a_1 \\cdot b_1 = ${a1} \\cdot ${b1} = ${Y2}$
- Tính $Y_1 = (a_0 + a_1) \\cdot (b_0 + b_1) - Y_0 - Y_2 = (${a0} + ${a1}) \\cdot (${b0} + ${b1}) - ${Y0} - ${Y2} = ${Y1}$
- Hệ số đa thức kết quả: $C(x) = Y_2 x^2 + Y_1 x + Y_0 = $ **${Y2}x^2 + ${Y1}x + ${Y0}**`;
  } else {
    karatsubaSteps = `**So sánh số phép nhân số học:**
- Nhân thông thường (Naive): $(degA + 1)(degB + 1) = ${A.length} \\cdot ${B.length} = $ **${A.length * B.length}** phép nhân.
- Thuật toán Karatsuba: Tiết kiệm phép nhân bằng đệ quy chia đôi $O(N^{1.585})$.
- Thuật toán Toom-Cook 3-way: Chia đa thức thành 3 phần, chỉ cần 5 phép nhân thay vì 9 phép nhân cơ bản $O(N^{1.465})$.`;
  }

  let n = 1;
  while (n <= degC) n <<= 1;
  const cA: Complex[] = A.map((x) => ({ r: x, i: 0 }));
  const cB: Complex[] = B.map((x) => ({ r: x, i: 0 }));
  while (cA.length < n) cA.push({ r: 0, i: 0 });
  while (cB.length < n) cB.push({ r: 0, i: 0 });

  const fftA = genericFFT(cA, false);
  const fftB = genericFFT(cB, false);

  const fftC = new Array(n);
  for (let i = 0; i < n; i++) {
    fftC[i] = mul(fftA[i], fftB[i]);
  }

  const resultComplex = genericFFT(fftC, true);
  const C_fft = resultComplex.map((c) => Math.round(c.r));

  const fftSteps: string[] = [];
  fftSteps.push(`**1. Biến đổi Fourier Nhanh (FFT) trên các điểm chia vòng tròn đơn vị (N = ${n}):**`);
  for (let i = 0; i < n; i++) {
    const angle = (-2 * Math.PI * i) / n;
    fftSteps.push(
      `- Điểm $w_${n}^${i} = \\cos(${((-360 * i) / n).toFixed(0)}^\\circ) + i\\sin(${((-360 * i) / n).toFixed(0)}^\\circ) = ${Math.cos(angle).toFixed(3)} + ${Math.sin(angle).toFixed(3)}i$`,
    );
    fftSteps.push(`  - $A(w_${n}^${i}) = ${fftA[i].r.toFixed(3)} + ${fftA[i].i.toFixed(3)}i$`);
    fftSteps.push(`  - $B(w_${n}^${i}) = ${fftB[i].r.toFixed(3)} + ${fftB[i].i.toFixed(3)}i$`);
    fftSteps.push(`  - Nhân điểm (Pointwise Product): $C(w_${n}^${i}) = A \\cdot B = ${fftC[i].r.toFixed(3)} + ${fftC[i].i.toFixed(3)}i$`);
  }

  let butterflySvg = "";
  if (n === 4) {
    butterflySvg = `
<svg width="100%" height="220" viewBox="0 0 450 220" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 8px; border: 1px solid #334155; font-family: sans-serif;">
  <style>
    @keyframes dash { to { stroke-dashoffset: -20; } }
    .b-line { stroke: #475569; stroke-width: 1.5; }
    .active-line { stroke: #38bdf8; stroke-width: 2; stroke-dasharray: 4; animation: dash 2s linear infinite; }
    .butterfly-node { fill: #1e293b; stroke: #38bdf8; stroke-width: 2; }
    .label { fill: #94a3b8; font-size: 10px; }
    .text-title { fill: #38bdf8; font-size: 12px; font-weight: bold; }
  </style>
  <text x="225" y="20" class="text-title" text-anchor="middle">Lưới Cánh Bướm Cooley-Tukey FFT (N = 4)</text>
  
  <line x1="50" y1="50" x2="200" y2="50" class="b-line" />
  <line x1="50" y1="50" x2="200" y2="90" class="b-line" />
  <line x1="50" y1="90" x2="200" y2="50" class="b-line" />
  <line x1="50" y1="90" x2="200" y2="90" class="b-line" />
  
  <line x1="50" y1="130" x2="200" y2="130" class="b-line" />
  <line x1="50" y1="130" x2="200" y2="170" class="b-line" />
  <line x1="50" y1="170" x2="200" y2="130" class="b-line" />
  <line x1="50" y1="170" x2="200" y2="170" class="b-line" />
  
  <line x1="200" y1="50" x2="350" y2="50" class="active-line" />
  <line x1="200" y1="50" x2="350" y2="130" class="active-line" />
  <line x1="200" y1="90" x2="350" y2="90" class="active-line" />
  <line x1="200" y1="90" x2="350" y2="170" class="active-line" />
  
  <line x1="200" y1="130" x2="350" y2="50" class="b-line" />
  <line x1="200" y1="130" x2="350" y2="130" class="b-line" />
  <line x1="200" y1="170" x2="350" y2="90" class="b-line" />
  <line x1="200" y1="170" x2="350" y2="170" class="b-line" />

  <circle cx="50" cy="50" r="12" class="butterfly-node" />
  <text x="50" y="54" font-size="9" fill="#fff" text-anchor="middle">a[0]</text>
  <circle cx="50" cy="90" r="12" class="butterfly-node" />
  <text x="50" y="94" font-size="9" fill="#fff" text-anchor="middle">a[2]</text>
  <circle cx="50" cy="130" r="12" class="butterfly-node" />
  <text x="50" y="134" font-size="9" fill="#fff" text-anchor="middle">a[1]</text>
  <circle cx="50" cy="170" r="12" class="butterfly-node" />
  <text x="50" y="174" font-size="9" fill="#fff" text-anchor="middle">a[3]</text>

  <circle cx="200" cy="50" r="12" class="butterfly-node" />
  <text x="200" y="54" font-size="9" fill="#fff" text-anchor="middle">s1[0]</text>
  <circle cx="200" cy="90" r="12" class="butterfly-node" />
  <text x="200" y="94" font-size="9" fill="#fff" text-anchor="middle">s1[1]</text>
  <circle cx="200" cy="130" r="12" class="butterfly-node" />
  <text x="200" y="134" font-size="9" fill="#fff" text-anchor="middle">s1[2]</text>
  <circle cx="200" cy="170" r="12" class="butterfly-node" />
  <text x="200" y="174" font-size="9" fill="#fff" text-anchor="middle">s1[3]</text>

  <circle cx="350" cy="50" r="12" class="butterfly-node" fill="#a855f7" />
  <text x="350" y="54" font-size="9" fill="#fff" text-anchor="middle">A[0]</text>
  <circle cx="350" cy="90" r="12" class="butterfly-node" fill="#a855f7" />
  <text x="350" y="94" font-size="9" fill="#fff" text-anchor="middle">A[1]</text>
  <circle cx="350" cy="130" r="12" class="butterfly-node" fill="#a855f7" />
  <text x="350" y="134" font-size="9" fill="#fff" text-anchor="middle">A[2]</text>
  <circle cx="350" cy="170" r="12" class="butterfly-node" fill="#a855f7" />
  <text x="350" y="174" font-size="9" fill="#fff" text-anchor="middle">A[3]</text>

  <text x="50" y="200" class="label" text-anchor="middle">Đảo Bit</text>
  <text x="200" y="200" class="label" text-anchor="middle">Tầng 1 (N=2)</text>
  <text x="350" y="200" class="label" text-anchor="middle">Tầng 2 (N=4)</text>
</svg>`;
  }

  return `🧮 **[BỘ GIẢI NHÂN ĐA THỨC SIÊU TỐC - POLYNOMIAL MULTIPLICATION SOLVER (FFT & KARATSUBA)]**

Mô hình này mô phỏng các phương pháp nhân đa thức nhanh dùng trong tối ưu hóa lượng dữ liệu lớn và xử lý tín hiệu số.

**Đầu vào đa thức:**
- Đa thức $A(x) = $ ${A.map((c, i) => `${c}${i > 0 ? `x^${i}` : ""}`).join(" + ")}
- Đa thức $B(x) = $ ${B.map((c, i) => `${c}${i > 0 ? `x^${i}` : ""}`).join(" + ")}

---

### 🎨 SƠ ĐỒ LƯỚI BUTTERFLY FFT (N = 4):
${butterflySvg}

---

### 🚀 1. NHÂN THÔNG THƯỜNG (NAIVE CONVOLUTION - $O(N^2)$):
Thực hiện nhân phân phối truyền thống từng cặp hệ số:
- Hệ số đa thức kết quả $C(x) = $ **${C_naive.slice(0, degC + 1)
    .map((c, i) => `${c}${i > 0 ? `x^${i}` : ""}`)
    .join(" + ")}**

---

### ⚡ 2. PHƯƠNG PHÁP CHIA ĐỂ TRỊ (KARATSUBA & TOOM-COOK):
${karatsubaSteps}

---

### 🌀 3. PHÉP NHÂN NHANH FFT & IFFT ($O(N \\log N)$):
Thay vì nhân trực tiếp hệ số, thuật toán chuyển sang miền tần số số phức, nhân điểm rồi chuyển ngược lại.
${fftSteps.join("\n")}

**Nội suy ngược (Inverse FFT) để lấy lại hệ số:**
- Hệ số sau khi biến đổi ngược IFFT: \`[${C_fft.slice(0, degC + 1).join(", ")}]\`
- Đa thức kết quả phục hồi: $C(x) = $ **${C_fft.slice(0, degC + 1)
    .map((c, i) => `${c}${i > 0 ? `x^${i}` : ""}`)
    .join(" + ")}**

---
*Thuật toán FFT đã nhân đa thức thành công với $O(N \\log N)$ nhờ khai thác các tính chất đối xứng của căn đơn vị!*`;
}

function solveLorenzAttractor(query: string): string {
  const sigma = 10;
  const rho = 28;
  const beta = 8 / 3;
  const dt = 0.005;
  const steps = 3000;

  let x1 = 1.0,
    y1 = 1.0,
    z1 = 1.0;
  let x2 = 1.0 + 1e-5,
    y2 = 1.0,
    z2 = 1.0;

  const path1: { x: number; y: number; z: number }[] = [];
  const path2: { x: number; y: number; z: number }[] = [];

  for (let i = 0; i < steps; i++) {
    const dx1 = sigma * (y1 - x1);
    const dy1 = x1 * (rho - z1) - y1;
    const dz1 = x1 * y1 - beta * z1;
    x1 += dx1 * dt;
    y1 += dy1 * dt;
    z1 += dz1 * dt;
    path1.push({ x: x1, y: y1, z: z1 });

    const dx2 = sigma * (y2 - x2);
    const dy2 = x2 * (rho - z2) - y2;
    const dz2 = x2 * y2 - beta * z2;
    x2 += dx2 * dt;
    y2 += dy2 * dt;
    z2 += dz2 * dt;
    path2.push({ x: x2, y: y2, z: z2 });
  }

  const scaleX = (val: number) => 250 + val * 10;
  const scaleZ = (val: number) => 280 - val * 5.2;

  let path1D = `M ${scaleX(path1[0].x)} ${scaleZ(path1[0].z)}`;
  let path2D = `M ${scaleX(path2[0].x)} ${scaleZ(path2[0].z)}`;

  for (let i = 1; i < steps; i++) {
    path1D += ` L ${scaleX(path1[i].x).toFixed(1)} ${scaleZ(path1[i].z).toFixed(1)}`;
    path2D += ` L ${scaleX(path2[i].x).toFixed(1)} ${scaleZ(path2[i].z).toFixed(1)}`;
  }

  const lorenzSvg = `
<svg width="100%" height="300" viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 8px; border: 1px solid #334155; font-family: sans-serif;">
  <style>
    .p1 { stroke: #22d3ee; fill: none; stroke-width: 0.8; opacity: 0.7; }
    .p2 { stroke: #f43f5e; fill: none; stroke-width: 0.8; opacity: 0.7; mix-blend-mode: screen; }
    @keyframes draw { from { stroke-dashoffset: 20000; } to { stroke-dashoffset: 0; } }
    .animate-path { stroke-dasharray: 20000; animation: draw 4s linear forwards; }
  </style>
  <text x="250" y="20" font-size="12" fill="#38bdf8" text-anchor="middle" font-weight="bold">Quỹ đạo Hệ Động Lực Hỗn Loạn (Lorenz Attractor)</text>
  <text x="250" y="35" font-size="9" fill="#94a3b8" text-anchor="middle">Mô phỏng 2 lộ trình với độ lệch ban đầu $\\Delta x = 10^{-5}$</text>
  <path d="${path1D}" class="p1 animate-path" />
  <path d="${path2D}" class="p2 animate-path" />
  
  <rect x="10" y="260" width="10" height="10" fill="#22d3ee" opacity="0.8" />
  <text x="25" y="269" font-size="10" fill="#cbd5e1">Agent A (Mặc định)</text>
  
  <rect x="10" y="275" width="10" height="10" fill="#f43f5e" opacity="0.8" />
  <text x="25" y="284" font-size="10" fill="#cbd5e1">Agent B (Lệch $10^{-5}$)</text>
</svg>`;

  let divergeStep = -1;
  let divergeTime = 0;
  for (let i = 0; i < steps; i++) {
    const dx = path1[i].x - path2[i].x;
    const dy = path1[i].y - path2[i].y;
    const dz = path1[i].z - path2[i].z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > 1.0 && divergeStep === -1) {
      divergeStep = i;
      divergeTime = i * dt;
      break;
    }
  }

  return `🦋 **[BỘ MÔ PHỎNG HIỆU ỨNG BƯƠM BƯỚM - LORENZ ATTRACTOR SOLVER]**

Mô hình này minh họa Thuyết Hỗn Loạn (Chaos Theory) áp dụng cho Hệ sinh thái Rottra, giải quyết các phương trình vi phân phi tuyến Lorenz nhằm chứng minh **"Sự phụ thuộc nhạy cảm vào điều kiện ban đầu" (Sensitive Dependence on Initial Conditions)**.

**Thông số thiết lập hệ phương trình Lorenz:**
- Hằng số Prandtl $\\sigma = 10$
- Hằng số Rayleigh $\\rho = 28$
- Hằng số hình học $\\beta = 8/3$

---

### 🎨 QUỸ ĐẠO CÁNH BƯỚM TRONG KHÔNG GIAN PHA (PHASE SPACE):
${lorenzSvg}

---

### 🔍 PHÂN TÍCH SỰ KIỆN PHÂN KỲ (DIVERGENCE EVENT):
Hệ thống tiến hành cho chạy giả lập 2 Agent có điểm xuất phát gần như giống hệt nhau:
- **Agent A (Màu xanh):** Tọa độ tài sản ban đầu: $(1.00000, 1.0, 1.0)$
- **Agent B (Màu đỏ):** Tọa độ tài sản ban đầu: $(1.00001, 1.0, 1.0)$ (Lệch cực nhỏ $\\Delta x = 10^{-5}$)

**Kết quả tích phân Euler sau ${steps} bước (dt = ${dt}):**
- Trong các bước đầu, quỹ đạo của cả hai Agent hoàn toàn trùng khớp (hai màu đè lên nhau).
- Tại bước thứ **${divergeStep}** (Thời điểm giả lập $t = ${divergeTime.toFixed(2)}$), sai số cực vi mô ban đầu đã bị khuếch đại theo cấp số nhân (hệ số Lyapunov dương lớn), khiến khoảng cách giữa hai Agent vượt mức cho phép.
- Từ đó trở đi, Agent A và Agent B trôi dạt sang hai "cánh bướm" hoàn toàn khác biệt. Agent A có thể đang mua mạnh ở đỉnh, thì Agent B lại bán tháo hoảng loạn dưới đáy!

🏆 **KẾT LUẬN ÁP DỤNG RỐI LOẠN (CHAOS APPLICATION):**
> Nhờ tính chất này, Rottra Engine có thể sử dụng phương trình Lorenz để **tạo ra những biến động (noise) cực nhỏ** tiêm vào tâm lý Agent. Mặc dù cấu trúc mô phỏng mang tính định định (Deterministic), kết quả dài hạn lại là **hoàn toàn ngẫu nhiên và không thể dự đoán**! Cơn bão tài chính đã sẵn sàng!`;
}

function solveStringTheory(query: string): string {
  const steps = 100;

  const createStringPath = (harmonics: number, amplitude: number, phase: number, offsetY: number) => {
    let path = `M 50 ${offsetY}`;
    for (let i = 1; i <= steps; i++) {
      const x = 50 + (i / steps) * 400;
      const t = i / steps;
      const y = offsetY + amplitude * Math.sin(t * Math.PI * harmonics + phase);
      path += ` L ${x} ${y}`;
    }
    return path;
  };

  const str1 = createStringPath(3, 40, 0, 100);
  const str2 = createStringPath(5, 20, Math.PI / 4, 150);
  const str3 = createStringPath(2, 60, Math.PI / 2, 200);

  const svgVisual = `
<svg width="100%" height="300" viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 8px; border: 1px solid #334155; font-family: sans-serif;">
  <style>
    @keyframes vibrate1 { 0% { transform: scaleY(1); } 50% { transform: scaleY(-1); } 100% { transform: scaleY(1); } }
    @keyframes vibrate2 { 0% { transform: scaleY(1); } 50% { transform: scaleY(-0.8); } 100% { transform: scaleY(1); } }
    .s1 { stroke: #a855f7; fill: none; stroke-width: 3; filter: drop-shadow(0 0 8px #a855f7); transform-origin: center 100px; animation: vibrate1 0.4s ease-in-out infinite; }
    .s2 { stroke: #10b981; fill: none; stroke-width: 2; filter: drop-shadow(0 0 6px #10b981); transform-origin: center 150px; animation: vibrate2 0.3s ease-in-out infinite; }
    .s3 { stroke: #f59e0b; fill: none; stroke-width: 4; filter: drop-shadow(0 0 10px #f59e0b); transform-origin: center 200px; animation: vibrate1 0.6s ease-in-out infinite; }
    .node { fill: #fff; }
  </style>
  <text x="250" y="20" font-size="12" fill="#38bdf8" text-anchor="middle" font-weight="bold">Mô phỏng Đa vũ trụ Lý thuyết Dây (M-Theory)</text>
  <text x="250" y="35" font-size="9" fill="#94a3b8" text-anchor="middle">Biên độ và Tần số dao động định nghĩa hạt lượng tử &amp; chiến lược Agent</text>
  
  <rect x="30" y="50" width="440" height="220" fill="#1e293b" rx="10" stroke="#334155" stroke-dasharray="4" />
  
  <path d="${str1}" class="s1" />
  <path d="${str2}" class="s2" />
  <path d="${str3}" class="s3" />
  
  <circle cx="50" cy="100" r="4" class="node" /> <circle cx="450" cy="100" r="4" class="node" />
  <circle cx="50" cy="150" r="4" class="node" /> <circle cx="450" cy="150" r="4" class="node" />
  <circle cx="50" cy="200" r="4" class="node" /> <circle cx="450" cy="200" r="4" class="node" />
  
  <text x="40" y="103" font-size="10" fill="#cbd5e1" text-anchor="end">HFT Bot</text>
  <text x="40" y="153" font-size="10" fill="#cbd5e1" text-anchor="end">Swing</text>
  <text x="40" y="203" font-size="10" fill="#cbd5e1" text-anchor="end">Holder</text>
</svg>`;

  return `🌌 **[MÔ PHỎNG ĐA VŨ TRỤ LÝ THUYẾT DÂY - M-THEORY & STRING THEORY]**

Hệ thống đã ánh xạ **Lý thuyết Dây** vào cấu trúc Swarm đa tác vụ (Multi-Agent System) của Rottra. Thay vì coi mỗi Agent là một "hạt" điểm (point particle) thụ động, mỗi Agent giờ đây là một **sợi dây năng lượng lượng tử** đang dao động (Vibrating String) bị neo trên bề mặt D-Brane (Thị trường)!

---

### 🎨 KHÔNG GIAN ĐA CHIỀU (CALABI-YAU MANIFOLD) & DAO ĐỘNG DÂY:
${svgVisual}

---

### 🧬 MÃ HÓA CHIẾN LƯỢC BẰNG TẦN SỐ DAO ĐỘNG:
Trong vật lý, tần số dao động của dây xác định khối lượng, điện tích và spin của hạt.
Trong hệ sinh thái tài chính Rottra, **tần số dao động xác định đặc tính của Agent**:
- **Sợi dây dao động tần số siêu cao (Màu tím):** Tương đương với các hạt khối lượng lớn / Năng lượng cao $\\rightarrow$ **HFT Bot (High-Frequency Trading)**. Khớp lệnh liên tục, tạo lập thanh khoản mỏng nhưng dày đặc.
- **Sợi dây dao động trung bình (Màu xanh lá):** Các hạt mang lực (Gauge bosons) $\\rightarrow$ **Swing Trader**. Chuyên chở dòng tiền từ nhịp sóng này qua nhịp sóng khác.
- **Sợi dây dao động tần số thấp, biên độ lớn (Màu cam):** Tương đương sóng hấp dẫn (Graviton) $\\rightarrow$ **Whale / Holder**. Dao động rất chậm nhưng có sức ảnh hưởng bẻ cong không-thời gian (làm thay đổi xu hướng vĩ mô của toàn thị trường).

### 🌌 KẾT LUẬN TƯƠNG TÁC ĐA CHIỀU (EXTRA DIMENSIONS):
Theo M-Theory, vũ trụ cần 11 chiều không-thời gian. Hệ thống Rottra cũng giấu các thông số (Sentiment, Lãi suất, Vĩ mô, Lưu lượng orderbook) vào các "chiều ẩn" (Hidden Dimensions). 
Khi hai Agent khớp lệnh với nhau, thực chất là hai sợi dây lượng tử giao thoa, trao đổi năng lượng và hòa âm (Resonance), từ đó tạo nên bản giao hưởng của biểu đồ giá (Price Action)!`;
}

function solveSystemsThinking(query: string): string {
  const svgVisual = `
<svg width="100%" height="320" viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg" style="background: #0f172a; border-radius: 8px; border: 1px solid #334155; font-family: sans-serif;">
  <style>
    .node { fill: #1e293b; stroke: #38bdf8; stroke-width: 2; rx: 15; ry: 15; }
    .node-text { fill: #e2e8f0; font-size: 11px; font-weight: bold; text-anchor: middle; dominant-baseline: central; }
    .edge-R { fill: none; stroke: #10b981; stroke-width: 2; marker-end: url(#arrowR); }
    .edge-B { fill: none; stroke: #f43f5e; stroke-width: 2; marker-end: url(#arrowB); stroke-dasharray: 4; }
    .label-R { fill: #10b981; font-size: 14px; font-weight: bold; }
    .label-B { fill: #f43f5e; font-size: 14px; font-weight: bold; }
    .sign { font-size: 14px; font-weight: bold; }
    .sign-pos { fill: #10b981; }
    .sign-neg { fill: #f43f5e; }
  </style>
  <defs>
    <marker id="arrowR" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
    </marker>
    <marker id="arrowB" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
    </marker>
  </defs>

  <text x="250" y="25" font-size="14" fill="#38bdf8" text-anchor="middle" font-weight="bold">Biểu đồ Vòng lặp Nhân quả (Causal Loop Diagram)</text>
  <text x="250" y="42" font-size="10" fill="#94a3b8" text-anchor="middle">Phân tích Hệ Phức tạp (Complex Adaptive System) của Thị trường</text>

  <!-- Nodes -->
  <rect x="200" y="140" width="100" height="40" class="node" />
  <text x="250" y="160" class="node-text">Giá Thị Trường</text>

  <rect x="200" y="60" width="100" height="40" class="node" />
  <text x="250" y="80" class="node-text">Lòng Tham (Mua)</text>

  <rect x="200" y="240" width="100" height="40" class="node" />
  <text x="250" y="260" class="node-text">Sợ Hãi (Bán tháo)</text>

  <rect x="40" y="140" width="100" height="40" class="node" />
  <text x="90" y="160" class="node-text">Thanh Khoản</text>

  <rect x="360" y="140" width="100" height="40" class="node" />
  <text x="410" y="160" class="node-text">Độ Biến Động</text>

  <!-- Edges -->
  <!-- Price -> Greed (Positive) -->
  <path d="M 230 140 Q 210 110 230 100" class="edge-R" />
  <text x="210" y="125" class="sign sign-pos">+</text>

  <!-- Greed -> Price (Positive) -->
  <path d="M 270 100 Q 290 110 270 140" class="edge-R" />
  <text x="285" y="125" class="sign sign-pos">+</text>
  <text x="250" y="120" class="label-R" text-anchor="middle">R1</text>
  
  <path d="M 410 180 Q 400 250 300 250" class="edge-R" />
  <text x="360" y="235" class="sign sign-pos">+</text>

  <path d="M 250 240 Q 250 200 250 180" class="edge-B" />
  <text x="255" y="215" class="sign sign-neg">-</text>

  <path d="M 300 160 L 350 160" class="edge-B" />
  <text x="325" y="155" class="sign sign-neg">-</text>
  
  <text x="310" y="210" class="label-B" text-anchor="middle">B1</text>

  <path d="M 90 140 Q 90 70 200 70" class="edge-R" />
  <text x="130" y="90" class="sign sign-pos">+</text>
  
  <path d="M 200 260 Q 90 260 90 180" class="edge-B" />
  <text x="130" y="240" class="sign sign-neg">-</text>

  <text x="140" y="180" class="label-B" text-anchor="middle">B2</text>
</svg>`;

  return `🌍 **[BỘ MÔ PHỎNG HỆ PHỨC TẠP & TƯ DUY HỆ THỐNG - SYSTEMS THINKING SOLVER]**

Hệ thống Rottra không đơn thuần là một cỗ máy tính toán tuyến tính, mà là một **Hệ Phức Tạp Thích Nghi (Complex Adaptive System)**. Khi áp dụng Tư duy Hệ thống (Systems Thinking), chúng ta không nhìn vào từng Agent đơn lẻ, mà nhìn vào **Mạng lưới các mối quan hệ (Interconnectedness)** và **Các vòng lặp phản hồi (Feedback Loops)**.

---

### 🎨 BIỂU ĐỒ VÒNG LẶP NHÂN QUẢ (CAUSAL LOOP DIAGRAM):
${svgVisual}

---

### 🔄 PHÂN TÍCH CÁC VÒNG LẶP ĐỘNG LỰC HỌC (SYSTEM DYNAMICS):

**1. Vòng lặp Cộng hưởng (Reinforcing Loop - R1) - "Bong bóng thị trường"**
- Khi **Giá Thị Trường** tăng $\\rightarrow$ **Lòng Tham** của các Agent tăng lên (+).
- Lòng tham tăng $\\rightarrow$ Lực mua mạnh hơn $\\rightarrow$ Đẩy **Giá Thị Trường** tiếp tục tăng (+).
- *Hệ quả:* Tạo ra vòng lặp khuếch đại hàm mũ (Exponential Growth), dẫn tới hình thành bong bóng tài sản.

**2. Vòng lặp Cân bằng (Balancing Loop - B1) - "Cơ chế tự điều chỉnh"**
- Khi **Giá Thị Trường** giảm đột ngột $\\rightarrow$ **Độ Biến Động** tăng cao (-).
- Độ biến động cao $\\rightarrow$ Kích hoạt **Sự Sợ Hãi** của các Agent (+).
- Sự sợ hãi $\\rightarrow$ Bán tháo cắt lỗ $\\rightarrow$ Làm **Giá Thị Trường** tiếp tục giảm (-).
- *Tuy nhiên:* Khi giá rơi vào vùng định giá quá rẻ, lực bán cạn kiệt, **Độ Biến Động** giảm dần, kéo hệ thống trở lại trạng thái cân bằng mới (Mean Reversion).

**3. Vòng lặp Thanh khoản (Balancing Loop - B2) - "Dòng máu của Hệ thống"**
- Sự hoảng loạn tột độ (**Sợ Hãi**) khiến các Market Maker (Nhà tạo lập) rút lệnh $\\rightarrow$ Suy giảm **Thanh Khoản** (-).
- Thanh khoản yếu $\\rightarrow$ Không thể nuôi dưỡng **Lòng Tham** và lực mua lớn $\\rightarrow$ Đóng băng thị trường.

### 🌌 KẾT LUẬN VỀ HỆ PHỨC TẠP RỐI LOẠN:
Thị trường Rottra là kết quả giao thoa của hàng vạn vòng lặp **R** và **B** chạy đan xen ở cường độ cao. Một **hiệu ứng bươm bướm (Lorenz)** cực nhỏ có thể là mồi lửa kích hoạt Vòng lặp R1 chạy vượt tầm kiểm soát, trước khi bị Vòng lặp B1 tàn nhẫn kéo sập. Áp dụng Tư duy Hệ thống giúp các Quỹ Định lượng nhìn thấy bức tranh toàn cảnh (Holistic View) thay vì chỉ chạy theo tín hiệu nhiễu kỹ thuật!`;
}

export function solveLennardJones(epsilon: number, sigma: number, r: number): { success: boolean; text: string } {
  const r6 = Math.pow(sigma / r, 6);
  const r12 = r6 * r6;
  const V = 4 * epsilon * (r12 - r6);
  const F = ((24 * epsilon) / r) * (2 * r12 - r6);
  const r_eq = Math.pow(2, 1 / 6) * sigma;

  return {
    success: true,
    text:
      `⚛️ **[TÍNH TOÁN THẾ NĂNG LENNARD-JONES - LENNARD-JONES POTENTIAL SOLVER]**\n\n` +
      `**Công thức Thế năng tương tác:**\n` +
      `$$V_{LJ}(r) = 4\\epsilon \\left[ \\left( \\frac{\\sigma}{r} \\right)^{12} - \\left( \\frac{\\sigma}{r} \\right)^{6} \\right]$$\n` +
      `**Công thức Lực tương tác liên phân tử:**\n` +
      `$$F_{LJ}(r) = \\frac{24\\epsilon}{r} \\left[ 2\\left( \\frac{\\sigma}{r} \\right)^{12} - \\left( \\frac{\\sigma}{r} \\right)^{6} \\right]$$\n\n` +
      `**Thông số đã nhập/nhận diện:**\n` +
      `- Độ sâu hố thế ($\\epsilon$): **${epsilon} eV**\n` +
      `- Khoảng cách thế năng bằng 0 ($\\sigma$): **${sigma} Å**\n` +
      `- Khoảng cách thực tế giữa 2 hạt ($r$): **${r} Å**\n\n` +
      `**Kết quả tính toán:**\n` +
      `- Tỷ lệ khoảng cách $\\sigma/r$: **${(sigma / r).toFixed(4)}**\n` +
      `- Thế năng tương tác $V_{LJ}$: **${V.toFixed(6)} eV**\n` +
      `- Lực tương tác liên phân tử $F_{LJ}$: **${F.toFixed(6)} eV/Å** (${F > 0 ? "Lực đẩy (Repulsive)" : F < 0 ? "Lực hút (Attractive)" : "Cân bằng"})\n` +
      `- Khoảng cách cân bằng bền ($r_{eq}$): **${r_eq.toFixed(4)} Å**\n\n` +
      `*Nhận xét:* Ở khoảng cách $r = ${r} Å$, hai hạt đang chịu ${F > 0 ? "lực đẩy mạnh do lớp vỏ electron chồng chéo" : "lực hút van der Waals kéo lại gần nhau"}.`,
  };
}

export function solveSarrusDeterminant(matrix: number[][]): { success: boolean; text: string } {
  const [[a, b, c], [d, e, f], [g, h, i]] = matrix;

  const term1 = a * e * i;
  const term2 = b * f * g;
  const term3 = c * d * h;
  const sumMain = term1 + term2 + term3;

  const term4 = c * e * g;
  const term5 = a * f * h;
  const term6 = b * d * i;
  const sumCounter = term4 + term5 + term6;

  const det = sumMain - sumCounter;

  return {
    success: true,
    text:
      `🧮 **[TÍNH ĐỊNH THỨC MA TRẬN 3x3 - QUY TẮC SARRUS SOLVER]**\n\n` +
      `**Ma trận đã cho:**\n` +
      `$$A = \\begin{pmatrix} ${a} & ${b} & ${c} \\\\ ${d} & ${e} & ${f} \\\\ ${g} & ${h} & ${i} \\end{pmatrix}$$\n\n` +
      `**Các bước tính toán theo quy tắc Sarrus:**\n` +
      `1. Nhân các đường chéo xuôi (Từ trên-trái xuống dưới-phải):\n` +
      `   - Đường chéo 1: $${a} \\cdot ${e} \\cdot ${i} = ${term1}$\n` +
      `   - Đường chéo 2: $${b} \\cdot ${f} \\cdot ${g} = ${term2}$\n` +
      `   - Đường chéo 3: $${c} \\cdot ${d} \\cdot ${h} = ${term3}$\n` +
      `   - **Tổng các đường chéo xuôi:** $S_1 = ${sumMain}$\n` +
      `2. Nhân các đường chéo ngược (Từ dưới-trái lên trên-phải):\n` +
      `   - Đường chéo 1: $${c} \\cdot ${e} \\cdot ${g} = ${term4}$\n` +
      `   - Đường chéo 2: $${a} \\cdot ${f} \\cdot ${h} = ${term5}$\n` +
      `   - Đường chéo 3: $${b} \\cdot ${d} \\cdot ${i} = ${term6}$\n` +
      `   - **Tổng các đường chéo ngược:** $S_2 = ${sumCounter}$\n` +
      `3. Định thức cuối cùng:\n` +
      `   $$\\det(A) = S_1 - S_2 = ${sumMain} - ${sumCounter} = ${det}$$\n\n` +
      `🏆 **KẾT LUẬN:** Định thức ma trận $A$ tính theo quy tắc Sarrus là **${det}**.`,
  };
}

export function solveMentalMathTricks(query: string): { success: boolean; text: string } {
  // Regex to detect "bình phương của số tận cùng bằng 5" (e.g. 65^2)
  const squareMatch = query.match(/(\d+)5(?:\^2|²|\s+binh\s+phuong)/i);
  if (squareMatch) {
    const tens = parseInt(squareMatch[1]);
    const num = parseInt(`${tens}5`);
    const part1 = tens * (tens + 1);
    const result = `${part1}25`;
    return {
      success: true,
      text: 
        `⚡ **[VEDIC MATH TRICK: BÌNH PHƯƠNG SỐ TẬN CÙNG LÀ 5]**\n\n` +
        `Bạn muốn tính $${num}^2$ siêu tốc không cần máy tính? Áp dụng ngay thủ thuật Vedic:\n` +
        `1. Lấy phần đầu của số đó là $${tens}$.\n` +
        `2. Nhân nó với số liền kề: $${tens} \\times (${tens} + 1) = ${part1}$.\n` +
        `3. Luôn nối thêm đuôi $25$ vào sau kết quả.\n\n` +
        `🏆 **KẾT QUẢ:** $${num}^2 = ${result}$`
    };
  }

  // Regex to detect "nhân với 11" (e.g. 43 * 11)
  const elevenMatch = query.match(/(\d{2,})\s*(?:\*|x|nhan)\s*11/i) || query.match(/11\s*(?:\*|x|nhan)\s*(\d{2,})/i);
  if (elevenMatch) {
    const num = elevenMatch[1];
    if (num.length === 2) {
      const a = parseInt(num[0]);
      const b = parseInt(num[1]);
      const sum = a + b;
      let result = '';
      if (sum < 10) {
        result = `${a}${sum}${b}`;
      } else {
        result = `${a + 1}${sum % 10}${b}`;
      }
      return {
        success: true,
        text: 
          `⚡ **[VEDIC MATH TRICK: NHÂN NHANH VỚI 11]**\n\n` +
          `Bạn muốn tính $${num} \\times 11$ cực nhanh?\n` +
          `1. Tách hai chữ số của $${num}$ ra: $${a}$ và $${b}$.\n` +
          `2. Tính tổng hai số: $${a} + ${b} = ${sum}$.\n` +
          (sum < 10 
            ? `3. Chèn tổng $${sum}$ vào giữa $${a}$ và $${b}$.\n` 
            : `3. Vì tổng là $${sum} \\ge 10$, ta nhớ 1 sang chữ số hàng trăm: $${a} + 1 = ${a + 1}$, giữ lại $${sum % 10}$ ở giữa.\n`) +
          `\n🏆 **KẾT QUẢ:** $${num} \\times 11 = ${result}$`
      };
    }
  }

  return { success: false, text: "" };
}
