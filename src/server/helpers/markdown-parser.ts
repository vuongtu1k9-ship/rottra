function parseLatexMath(math: string): string {
  let i = 0;
  let result = "";

  const findMatchingBrace = (str: string, startIdx: number): number => {
    let depth = 0;
    for (let j = startIdx; j < str.length; j++) {
      if (str[j] === "{") depth++;
      else if (str[j] === "}") {
        depth--;
        if (depth === 0) return j;
      }
    }
    return -1;
  };

  while (i < math.length) {
    if (math.startsWith("\\frac{", i)) {
      const startNum = i + 5;
      const endNum = findMatchingBrace(math, startNum);
      if (endNum !== -1 && math[endNum + 1] === "{") {
        const startDen = endNum + 1;
        const endDen = findMatchingBrace(math, startDen);
        if (endDen !== -1) {
          const num = math.slice(startNum + 1, endNum);
          const den = math.slice(startDen + 1, endDen);
          result += `<span class="inline-block text-center mx-1"><span class="block border-b border-gray-400 px-1">${parseLatexMath(num)}</span><span class="block px-1">${parseLatexMath(den)}</span></span>`;
          i = endDen + 1;
          continue;
        }
      }
    }

    if (math.startsWith("\\binom{", i)) {
      const startNum = i + 6;
      const endNum = findMatchingBrace(math, startNum);
      if (endNum !== -1 && math[endNum + 1] === "{") {
        const startDen = endNum + 1;
        const endDen = findMatchingBrace(math, startDen);
        if (endDen !== -1) {
          const num = math.slice(startNum + 1, endNum);
          const den = math.slice(startDen + 1, endDen);
          result += `C(${parseLatexMath(num)}, ${parseLatexMath(den)})`;
          i = endDen + 1;
          continue;
        }
      }
    }

    let matchedStyle = false;
    for (const cmd of ["\\mathbf{", "\\mathcal{", "\\text{"]) {
      if (math.startsWith(cmd, i)) {
        const startContent = i + cmd.length - 1;
        const endContent = findMatchingBrace(math, startContent);
        if (endContent !== -1) {
          const content = math.slice(startContent + 1, endContent);
          const parsedContent = parseLatexMath(content);
          if (cmd === "\\mathbf{") {
            result += `<strong class="font-bold">${parsedContent}</strong>`;
          } else if (cmd === "\\mathcal{") {
            result += `<span class="font-serif italic text-indigo-600 dark:text-indigo-400">${parsedContent}</span>`;
          } else {
            result += parsedContent;
          }
          i = endContent + 1;
          matchedStyle = true;
          break;
        }
      }
    }
    if (matchedStyle) continue;

    if (math.startsWith("^{", i)) {
      const endIdx = findMatchingBrace(math, i + 1);
      if (endIdx !== -1) {
        const content = math.slice(i + 2, endIdx);
        result += `<sup>${parseLatexMath(content)}</sup>`;
        i = endIdx + 1;
        continue;
      }
    }

    if (math.startsWith("_{", i)) {
      const endIdx = findMatchingBrace(math, i + 1);
      if (endIdx !== -1) {
        const content = math.slice(i + 2, endIdx);
        result += `<sub>${parseLatexMath(content)}</sub>`;
        i = endIdx + 1;
        continue;
      }
    }

    // Default: copy character
    result += math[i];
    i++;
  }

  // Post-processing replacements for symbols
  result = result
    .replace(/\\times/g, " × ")
    .replace(/\\le/g, " ≤ ")
    .replace(/\\ge/g, " ≥ ")
    .replace(/\\neq/g, " ≠ ")
    .replace(/\\approx/g, " ≈ ")
    .replace(/\\to/g, " → ")
    .replace(/\\min/g, "min ")
    .replace(/\\max/g, "max ")
    .replace(/\\Omega/g, "Ω")
    .replace(/\\omega/g, "ω")
    .replace(/\\beta_(\d)/g, "β<sub>$1</sub>")
    .replace(/\\beta/g, "β")
    .replace(/\\gamma/g, "γ")
    .replace(/\\epsilon_\{(.*?)\}/g, "ε<sub>$1</sub>")
    .replace(/\\epsilon/g, "ε")
    .replace(/_(\w)/g, "<sub>$1</sub>")
    .replace(/\^(\w)/g, "<sup>$1</sup>")
    .replace(/\\cdot/g, " · ")
    .replace(/\\quad/g, " &nbsp;&nbsp;&nbsp;&nbsp; ")
    .replace(/\\longrightarrow/g, " ──→ ");

  return result;
}

function tryFormatJsonPlan(text: string): string {
  const trimmed = text.trim();
  if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      const isPlan = items.every(
        (item) =>
          item &&
          typeof item === "object" &&
          (item.title !== undefined ||
            item.description !== undefined ||
            item.step !== undefined ||
            item.intent !== undefined ||
            (item.id !== undefined && item.path !== undefined)),
      );

      if (isPlan && items.length > 0) {
        let md = `### 📋 Kế Hoạch Hành Động Thực Thi\n\n`;
        items.forEach((item, index) => {
          let stepNum = item.step || item.id || `Bước ${index + 1}`;
          if (typeof stepNum === "string" && stepNum.startsWith("step_")) {
            stepNum = stepNum.replace("step_", "Bước ");
          }
          const title = item.title || item.intent || "Tác vụ";
          const desc = item.description || item.subQuery || "";
          const type = item.type ? ` (${item.type})` : "";
          const pathOrCmd = item.path || item.subQuery || "";

          md += `* **${stepNum}: ${title}**${type}\n`;
          if (desc) md += `  * *Chi tiết*: ${desc}\n`;
          if (pathOrCmd) md += `  * *Đối tượng/Lệnh*: \`${pathOrCmd}\`\n`;
          md += `\n`;
        });
        return md.trim();
      }
    } catch (e) {
      // ignore
    }
  }
  return text;
}

export function formatMarkdown(text: string): string {
  if (!text) return "";

  let formatted = tryFormatJsonPlan(text);

  // --- HIỂN THỊ TIẾN TRÌNH TƯ DUY CHUYÊN SÂU (DEEP THINK REASONING BLOCKS) ---
  formatted = formatted.replace(/<(think|thought)>([\s\S]*?)(?:<\/\1>|$)/gi, (match, tag, p1) => {
    const cleanThink = p1.trim().replace(/\n/g, "<br />");
    return `<details class="group my-4 border border-blue-500/20 bg-blue-500/5 rounded-2xl overflow-hidden transition-all duration-300 shadow-sm">
      <summary class="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none bg-blue-500/5 hover:bg-blue-500/10 transition-colors">
        <div class="flex items-center gap-2.5">
          <svg class="w-4 h-4 text-blue-500 animate-pulse" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
          </svg>
          <span class="font-semibold text-[11px] tracking-wider uppercase text-blue-600 dark:text-blue-400">Tiến trình tư duy</span>
        </div>
        <svg class="w-4 h-4 text-blue-500/50 group-open:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path></svg>
      </summary>
      <div class="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 font-mono leading-relaxed whitespace-pre-line border-t border-blue-500/10 bg-white/50 dark:bg-black/20">${cleanThink}</div>
    </details>`;
  });

  formatted = formatted.replace(/<\/?(think|thought)>/gi, "");

  // --- PARSE MERMAID DIAGRAM BLOCKS ---
  formatted = formatted.replace(/```mermaid([\s\S]*?)```/g, (match, p1) => {
    const cleanCode = p1
      .trim()
      .split("\n")
      .map((line: string) => {
        let l = line.trim();
        // Remove markdown list indicators if LLM accidentally formats mermaid lines as a list
        if (l.startsWith("*") || l.startsWith("-")) {
          l = l.substring(1).trim();
        }
        return l;
      })
      .filter((line: string) => line.length > 0)
      .join("\n");
    return `<div class="mermaid-diagram-placeholder my-4 p-4 rounded-2xl border border-blue-500/10 bg-blue-500/5 shadow-md max-w-full overflow-x-auto flex justify-center items-center cursor-pointer active:scale-[0.99] transition-transform duration-200" data-code="${encodeURIComponent(cleanCode)}"></div>`;
  });

  // --- PARSE TYPST CODE BLOCKS ---
  formatted = formatted.replace(/```typst([\s\S]*?)```/g, (match, p1) => {
    const cleanCode = p1.trim();
    return `<div class="typst-diagram-placeholder my-4 p-4 rounded-2xl border border-indigo-500/10 bg-indigo-500/5 shadow-md max-w-full overflow-x-auto flex justify-center items-center cursor-pointer active:scale-[0.99] transition-transform duration-200" data-code="${encodeURIComponent(cleanCode)}"></div>`;
  });

  // --- PARSE STANDARD CODE BLOCKS ---
  formatted = formatted.replace(/```([a-z0-9]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre class="my-3 p-4 bg-[#1e1e1e] text-gray-100 rounded-xl overflow-x-auto text-sm font-mono whitespace-pre"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim()}</code></pre>`;
  });

  // --- PARSE INLINE CODE ---
  formatted = formatted.replace(/(?<!`)`([^`\n]+)`(?!`)/g, '<code class="text-pink-600 dark:text-pink-400 text-sm font-mono">$1</code>');

  // --- TRÌNH BÀY TOÁN HỌC CAO CẤP CHUYÊN NGHIỆP ---
  // 1. Dọn dẹp và chuẩn hóa các khối bao quanh display math: \[ ... \] hoặc \\[ ... \\] hoặc $$ ... $$
  formatted = formatted.replace(/(?:\$\$|\\\[)([\s\S]*?)(?:\$\$|\\\])/g, (match, p1) => {
    const cleanMath = parseLatexMath(p1.trim());
    return `<div class="my-3 py-1.5 text-center font-serif text-gray-900 dark:text-white overflow-x-auto tracking-wide text-sm flex items-center justify-center gap-1.5 flex-wrap">${cleanMath}</div>`;
  });

  // 2. Chuẩn hóa inline math: \( ... \) hoặc \\( ... \\) hoặc $ ... $
  formatted = formatted.replace(/(?:\$|\\\()([^$\n]+?)(?:\$|\\\))/g, (match, p1) => {
    // Tránh trùng với các đoạn chứa code HTML hoặc tag
    if (p1.includes("<") || p1.includes(">") || p1.length > 100) return match;

    const cleanMath = parseLatexMath(p1.trim());
    return `<code class="font-serif text-xs mx-0.5 text-blue-600 dark:text-blue-400">${cleanMath}</code>`;
  });

  // --- PARSE MARKDOWN TABLES ---
  const tableLines = formatted.split("\n");
  let tableRows: string[][] = [];
  let tableAlignments: string[] = [];
  let parsedLines: string[] = [];

  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .slice(1, -1);
      const isSeparator = cells.every((cell) => /^[:\s-]*$/.test(cell) && cell.includes("-"));

      if (isSeparator) {
        tableAlignments = cells.map((cell) => {
          if (cell.startsWith(":") && cell.endsWith(":")) return "center";
          if (cell.endsWith(":")) return "right";
          return "left";
        });
      } else {
        tableRows.push(cells);
      }
    } else {
      if (tableRows.length > 0) {
        let tableHtml = `<div class="my-3 overflow-x-auto rounded-xl border border-gray-200/50 dark:border-white/10 shadow-sm"><table class="min-w-full divide-y divide-gray-200 dark:divide-white/10 text-sm">`;
        const headerRow = tableRows[0];
        tableHtml += `<thead class="bg-gray-50/75 dark:bg-white/5"><tr>`;
        headerRow.forEach((cell, idx) => {
          const align = tableAlignments[idx] || "left";
          const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
          tableHtml += `<th class="px-4 py-2.5 ${alignClass} font-semibold text-gray-950 dark:text-white text-xs tracking-wider uppercase">${cell}</th>`;
        });
        tableHtml += `</tr></thead>`;

        tableHtml += `<tbody class="divide-y divide-gray-100 dark:divide-white/5 bg-white dark:bg-transparent">`;
        for (let r = 1; r < tableRows.length; r++) {
          tableHtml += `<tr class="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">`;
          tableRows[r].forEach((cell, idx) => {
            const align = tableAlignments[idx] || "left";
            const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
            tableHtml += `<td class="px-4 py-2 ${alignClass} text-gray-700 dark:text-gray-300 font-sans">${cell}</td>`;
          });
          tableHtml += `</tr>`;
        }
        tableHtml += `</tbody></table></div>`;

        parsedLines.push(tableHtml);
        tableRows = [];
        tableAlignments = [];
      }
      parsedLines.push(tableLines[i]);
    }
  }

  if (tableRows.length > 0) {
    let tableHtml = `<div class="my-3 overflow-x-auto rounded-xl border border-gray-200/50 dark:border-white/10 shadow-sm"><table class="min-w-full divide-y divide-gray-200 dark:divide-white/10 text-sm">`;
    const headerRow = tableRows[0];
    tableHtml += `<thead class="bg-gray-50/75 dark:bg-white/5"><tr>`;
    headerRow.forEach((cell, idx) => {
      const align = tableAlignments[idx] || "left";
      const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
      tableHtml += `<th class="px-4 py-2.5 ${alignClass} font-semibold text-gray-950 dark:text-white text-xs tracking-wider uppercase">${cell}</th>`;
    });
    tableHtml += `</tr></thead>`;

    tableHtml += `<tbody class="divide-y divide-gray-100 dark:divide-white/5 bg-white dark:bg-transparent">`;
    for (let r = 1; r < tableRows.length; r++) {
      tableHtml += `<tr class="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">`;
      tableRows[r].forEach((cell, idx) => {
        const align = tableAlignments[idx] || "left";
        const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
        tableHtml += `<td class="px-4 py-2 ${alignClass} text-gray-700 dark:text-gray-300 font-sans">${cell}</td>`;
      });
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table></div>`;
    parsedLines.push(tableHtml);
  }

  formatted = parsedLines.join("\n");

  // 1. Dọn sạch các ký tự rác hoặc thừa thải theo yêu cầu của Sếp (~@#$^&*\]_)
  // Chỉ loại bỏ nếu chúng xuất hiện liên tiếp hoặc vô nghĩa ở đầu/cuối câu/dòng (tránh đụng vào $ hoặc \ của công thức toán)
  formatted = formatted.replace(/[~@#%^&*_]{3,}/g, "");

  // 2. Chuyển đổi --- thành đường kẻ phân cách mảnh mai, sang trọng
  formatted = formatted.replace(/^---$/gm, '<hr class="my-3 border-t border-gray-100 dark:border-white/10" />');

  // 3. Xử lý các tiêu đề dạng ### hoặc ## để trông chuyên nghiệp như ChatGPT
  formatted = formatted.replace(
    /^### (.*$)/gim,
    '<h3 class="text-sm font-bold text-blue-600 dark:text-blue-400 mt-3 mb-1 flex items-center gap-1.5">$1</h3>',
  );
  formatted = formatted.replace(/^## (.*$)/gim, '<h2 class="text-base font-bold text-gray-900 dark:text-white mt-4 mb-2">$1</h2>');
  formatted = formatted.replace(/^# (.*$)/gim, '<h1 class="text-lg font-bold text-gray-900 dark:text-white mt-5 mb-2.5">$1</h1>');

  // 4. Định dạng trích dẫn > phong cách tối giản, sang trọng
  formatted = formatted.replace(
    /^\> (.*$)/gim,
    '<blockquote class="border-l-4 border-blue-500/50 pl-3 my-2 text-gray-600 dark:text-gray-400 italic">$1</blockquote>',
  );

  // 5. Định dạng chữ in đậm **text** thành thẻ strong được thiết kế cao cấp
  formatted = formatted.replace(/\*\frac\_/g, ""); // Dọn dẹp lỗi ký tự đặc biệt nếu có
  formatted = formatted.replace(
    /\*\*(.*?)\*\*/g,
    '<strong class="font-semibold text-gray-900 dark:text-white bg-blue-500/5 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">$1</strong>',
  );

  // 5b. Định dạng hình ảnh ![alt](url) thành thẻ img được thiết kế đẹp mắt
  formatted = formatted.replace(
    /!\[(.*?)\]\((.*?)\)/g,
    '<img src="$2" alt="$1" referrerpolicy="no-referrer" class="max-w-full rounded-2xl my-3 border border-gray-200/50 dark:border-white/10 shadow-md transition-all hover:scale-[1.02] duration-300 block" />',
  );

  // 5c. Định dạng đường dẫn [text](url) thành thẻ a được thiết kế đẹp mắt
  formatted = formatted.replace(
    /(?<!\!)\[(.*?)\]\((.*?)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-600 underline font-semibold mx-0.5">$1</a>',
  );

  // 6. Định dạng danh sách gạch đầu dòng (- hoặc *) thành các cụm flex-row
  formatted = formatted.replace(
    /^[\-\*]\s+(.*$)/gim,
    '<div class="flex items-start gap-2 my-1.5"><span class="text-blue-500 mt-1.5 text-[6px]">●</span><span class="flex-1">$1</span></div>',
  );

  // 7. Định dạng danh sách đánh số (1., 2...)
  formatted = formatted.replace(
    /^(\d+\.)\s+(.*$)/gim,
    '<div class="flex items-start gap-2 my-1.5"><span class="font-semibold text-blue-500 min-w-[16px] text-xs">$1</span><span class="flex-1">$2</span></div>',
  );

  // 8. Tách các dòng và xuống dòng tự nhiên, hỗ trợ thẻ P
  const paragraphs = formatted.split(/\n{2,}/g);
  formatted = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";

      // Nếu là khối HTML có sẵn, giữ nguyên
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<div") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<hr") ||
        trimmed.startsWith("<img") ||
        trimmed.startsWith("<a")
      ) {
        return p;
      }

      // Xuống dòng đơn lẻ trong cùng 1 paragraph -> chuyển thành <br />
      const lineWithBr = p.replace(/\n/g, "<br />");
      return `<p class="mb-2 leading-relaxed">${lineWithBr}</p>`;
    })
    .join("");

  // 9. Dọn dẹp rác ký tự ngoặc vuông đơn lẻ (stray bracket) thường do stream bị cắt tạo ra
  formatted = formatted.replace(/(?:^|<br \/>|<\/p>|<p>)\s*\]\s*(?:<br \/>|<\/p>|<p>|$)/g, "");

  return formatted;
}
