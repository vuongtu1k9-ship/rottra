// $P Point-Cloud Recognizer for Whiteboard Drawing Recognition
// Implements Wobbrock, Wilson & Li's $P algorithm for unistroke and multistroke gestures/shapes.

export interface Point {
  x: number;
  y: number;
  color?: string;
  isStart?: boolean;
}

export interface GestureTemplate {
  name: string;
  points: Point[];
}

// Resample a path to N points
export function resample(points: Point[], n: number): Point[] {
  if (points.length === 0) return [];
  const I = pathLength(points) / (n - 1);
  let D = 0;
  const newPoints: Point[] = [{ ...points[0] }];
  const workingPoints = [...points];

  for (let i = 1; i < workingPoints.length; i++) {
    const p1 = workingPoints[i - 1];
    const p2 = workingPoints[i];
    const d = distance(p1, p2);
    if (D + d >= I) {
      const qx = p1.x + ((I - D) / d) * (p2.x - p1.x);
      const qy = p1.y + ((I - D) / d) * (p2.y - p1.y);
      const q = { x: qx, y: qy };
      newPoints.push(q);
      workingPoints.splice(i, 0, q); // insert q
      D = 0;
    } else {
      D += d;
    }
  }

  while (newPoints.length < n) {
    newPoints.push({ ...points[points.length - 1] });
  }
  if (newPoints.length > n) {
    newPoints.length = n;
  }
  return newPoints;
}

export function pathLength(points: Point[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += distance(points[i - 1], points[i]);
  }
  return d;
}

export function distance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

// Scale points to fit a bounding box of [0, 1] x [0, 1]
export function scale(points: Point[]): Point[] {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const size = Math.max(width, height) || 1.0;
  return points.map((p) => ({
    x: (p.x - minX) / size,
    y: (p.y - minY) / size,
  }));
}

// Translate centroid to (0,0)
export function translateToOrigin(points: Point[]): Point[] {
  const c = centroid(points);
  return points.map((p) => ({
    x: p.x - c.x,
    y: p.y - c.y,
  }));
}

export function centroid(points: Point[]): Point {
  let x = 0,
    y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

// Greedy Cloud Match
export function greedyCloudMatch(points1: Point[], points2: Point[]): number {
  const n = points1.length;
  const matched = new Array(n).fill(false);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let index = -1;
    let min = Infinity;
    for (let j = 0; j < n; j++) {
      if (!matched[j]) {
        const d = distance(points1[i], points2[j]);
        if (d < min) {
          min = d;
          index = j;
        }
      }
    }
    if (index !== -1) {
      matched[index] = true;
      sum += min;
    }
  }
  return sum;
}

// Pre-process points to canonical form
export function preprocess(points: Point[], n: number = 32): Point[] {
  const resampled = resample(points, n);
  const scaled = scale(resampled);
  return translateToOrigin(scaled);
}

// Programmatically generated templates
export function getTemplates(): GestureTemplate[] {
  const templates: GestureTemplate[] = [];

  // Helper to register template
  const addTemplate = (name: string, rawPoints: Point[]) => {
    templates.push({
      name,
      points: preprocess(rawPoints),
    });
  };

  // 1. Circle (Vòng tròn)
  const circlePts: Point[] = [];
  for (let i = 0; i < 32; i++) {
    const angle = (i * 2 * Math.PI) / 32;
    circlePts.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }
  addTemplate("Vòng tròn", circlePts);

  // 2. Square (Hình vuông)
  const squarePts: Point[] = [];
  for (let i = 0; i <= 8; i++) squarePts.push({ x: -0.5 + i / 8, y: -0.5 });
  for (let i = 1; i <= 8; i++) squarePts.push({ x: 0.5, y: -0.5 + i / 8 });
  for (let i = 1; i <= 8; i++) squarePts.push({ x: 0.5 - i / 8, y: 0.5 });
  for (let i = 1; i < 8; i++) squarePts.push({ x: -0.5, y: 0.5 - i / 8 });
  addTemplate("Hình vuông", squarePts);

  // 3. Triangle (Hình tam giác)
  const trianglePts: Point[] = [];
  for (let i = 0; i <= 10; i++) trianglePts.push({ x: -0.5 + 0.5 * (i / 10), y: 0.5 - 1.0 * (i / 10) });
  for (let i = 1; i <= 10; i++) trianglePts.push({ x: 0.5 * (i / 10), y: -0.5 + 1.0 * (i / 10) });
  for (let i = 1; i < 10; i++) trianglePts.push({ x: 0.5 - 1.0 * (i / 10), y: 0.5 });
  addTemplate("Hình tam giác", trianglePts);

  // 4. Line (Đường thẳng)
  const linePts: Point[] = [];
  for (let i = 0; i < 32; i++) {
    linePts.push({ x: -0.5 + i / 31, y: 0 });
  }
  addTemplate("Đường thẳng", linePts);

  // 5. Tick/Checkmark (Dấu tích)
  const tickPts: Point[] = [];
  for (let i = 0; i <= 10; i++) tickPts.push({ x: -0.5 + 0.4 * (i / 10), y: 0.1 + 0.4 * (i / 10) });
  for (let i = 1; i <= 20; i++) tickPts.push({ x: -0.1 + 0.6 * (i / 20), y: 0.5 - 1.0 * (i / 20) });
  addTemplate("Dấu tích", tickPts);

  // 6. X (Dấu nhân)
  const crossPts: Point[] = [];
  for (let i = 0; i < 16; i++) crossPts.push({ x: -0.5 + i / 15, y: -0.5 + i / 15 });
  for (let i = 0; i < 16; i++) crossPts.push({ x: 0.5 - i / 15, y: -0.5 + i / 15 });
  addTemplate("Chữ X", crossPts);

  // 7. Star (Ngôi sao)
  const starPts: Point[] = [];
  const starVertices = [
    { x: 0, y: -0.5 },
    { x: 0.3, y: 0.4 },
    { x: -0.4, y: -0.2 },
    { x: 0.4, y: -0.2 },
    { x: -0.3, y: 0.4 },
    { x: 0, y: -0.5 },
  ];
  for (let k = 0; k < 5; k++) {
    const p1 = starVertices[k];
    const p2 = starVertices[k + 1];
    for (let i = 0; i < 8; i++) {
      starPts.push({
        x: p1.x + (p2.x - p1.x) * (i / 7),
        y: p1.y + (p2.y - p1.y) * (i / 7),
      });
    }
  }
  addTemplate("Ngôi sao", starPts);

  // 8. Chữ A (Letter A)
  const letterAPts: Point[] = [];
  for (let i = 0; i <= 12; i++) letterAPts.push({ x: -0.4 + 0.4 * (i / 12), y: 0.5 - 1.0 * (i / 12) });
  for (let i = 1; i <= 12; i++) letterAPts.push({ x: 0.4 * (i / 12), y: -0.5 + 1.0 * (i / 12) });
  for (let i = 0; i < 8; i++) letterAPts.push({ x: -0.2 + 0.4 * (i / 7), y: 0.1 });
  addTemplate("Chữ A", letterAPts);

  // 9. Chữ C (Letter C)
  const letterCPts: Point[] = [];
  for (let i = 0; i < 32; i++) {
    const angle = Math.PI / 4 + (i * 1.5 * Math.PI) / 32;
    letterCPts.push({ x: 0.5 * Math.cos(angle), y: 0.5 * Math.sin(angle) });
  }
  addTemplate("Chữ C", letterCPts);

  // 10. Chữ V (Letter V)
  const letterVPts: Point[] = [];
  for (let i = 0; i <= 16; i++) letterVPts.push({ x: -0.5 + 0.5 * (i / 16), y: -0.5 + 1.0 * (i / 16) });
  for (let i = 1; i <= 16; i++) letterVPts.push({ x: 0.5 * (i / 16), y: 0.5 - 1.0 * (i / 16) });
  addTemplate("Chữ V", letterVPts);

  // 11. Củ tỏi (Garlic)
  const garlicPts: Point[] = [];
  // Bottom circle-like outline
  for (let i = 0; i <= 16; i++) {
    const angle = -Math.PI + (i * Math.PI) / 16;
    garlicPts.push({ x: 0.5 * Math.cos(angle), y: 0.5 * Math.sin(angle) + 0.1 });
  }
  // Taper to a top point at (0, -0.6)
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    garlicPts.push({ x: 0.5 * (1 - t), y: 0.1 * (1 - t) - 0.6 * t });
  }
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    garlicPts.push({ x: -0.5 * t, y: -0.6 * (1 - t) + 0.1 * t });
  }
  // Clove vertical line down the middle
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    garlicPts.push({ x: 0, y: -0.6 + 1.1 * t });
  }
  addTemplate("Củ tỏi", garlicPts);

  return templates;
}

// Main recognition entry point
export function getColorName(hex: string): string {
  const h = hex.toLowerCase().replace("#", "");
  if (h === "ec4899" || h === "f472b6" || h === "db2777" || h === "f43f5e") return "Hồng";
  if (h === "ef4444" || h === "b91c1c") return "Đỏ";
  if (h === "eab308" || h === "facc15" || h === "fbbf24" || h === "f59e0b" || h === "fde047" || h === "fef08a") return "Vàng";
  if (h === "78350f" || h === "92400e" || h === "d97706" || h === "a16207" || h === "854d0e") return "Nâu";
  if (h === "22c55e" || h === "4ade80" || h === "16a34a" || h === "15803d" || h === "10b981") return "Xanh lá";
  if (h === "3b82f6" || h === "60a5fa" || h === "2563eb") return "Xanh dương";
  if (h === "06b6d4" || h === "22d3ee" || h === "38bdf8" || h === "67e8f9") return "Xanh cyan";
  if (h === "cbd5e1" || h === "e2e8f0" || h === "f1f5f9" || h === "ffffff" || h === "f3f4f6") return "Trắng xám";
  if (h === "64748b" || h === "475569" || h === "94a3b8") return "Xám";
  if (h === "1f2937" || h === "111827" || h === "374151" || h === "000000") return "Đen";
  if (h === "8b5cf6" || h === "a78bfa") return "Tím";
  if (h === "f97316" || h === "fb923c") return "Cam";

  const hexToRgb = (hexStr: string) => {
    const r = parseInt(hexStr.substring(0, 2), 16) || 0;
    const g = parseInt(hexStr.substring(2, 4), 16) || 0;
    const b = parseInt(hexStr.substring(4, 6), 16) || 0;
    return { r, g, b };
  };

  try {
    const rgb = hexToRgb(h);
    const standardColors = [
      { name: "Hồng", r: 236, g: 72, b: 153 },
      { name: "Đỏ", r: 239, g: 68, b: 68 },
      { name: "Vàng", r: 234, g: 179, b: 8 },
      { name: "Nâu", r: 120, g: 53, b: 15 },
      { name: "Xanh lá", r: 34, g: 197, b: 94 },
      { name: "Xanh dương", r: 59, g: 130, b: 246 },
      { name: "Xanh cyan", r: 6, g: 182, b: 212 },
      { name: "Trắng xám", r: 243, g: 244, b: 246 },
      { name: "Xám", r: 100, g: 116, b: 139 },
      { name: "Đen", r: 31, g: 41, b: 55 },
      { name: "Tím", r: 139, g: 92, b: 246 },
      { name: "Cam", r: 249, g: 115, b: 22 },
    ];

    let closestName = "Khác";
    let minD = Infinity;
    for (const c of standardColors) {
      const d = Math.sqrt(Math.pow(rgb.r - c.r, 2) + Math.pow(rgb.g - c.g, 2) + Math.pow(rgb.b - c.b, 2));
      if (d < minD) {
        minD = d;
        closestName = c.name;
      }
    }
    return closestName;
  } catch {
    return "Khác";
  }
}

// Main recognition entry point
export async function recognize(
  flatPoints: Point[],
  colorHex?: string,
  productName?: string,
): Promise<{
  name: string;
  score: number;
  colorScore?: number;
  shapeScore?: number;
  thinking?: any;
  colorPercentagesStr?: string;
  colorPercentagesList?: { name: string; percentage: number; color: string }[];
}> {
  if (flatPoints.length < 5) {
    return { name: "Nét quá ngắn", score: 0 };
  }

  // 1. Try Tensor Engine first for complex drawings
  try {
    const { isTensorEngineReady, recognizeWithONNX } = await import("./tensor-recognizer");
    if (isTensorEngineReady()) {
      try {
        const onnxRes = await recognizeWithONNX(flatPoints);
        // Fallback to $P if ONNX confidence is extremely low, otherwise return ONNX result
        if (onnxRes.score >= 0.15) {
          return {
            name: onnxRes.name,
            score: onnxRes.score,
            shapeScore: onnxRes.score,
            colorScore: 1.0,
            thinking: { model: "ONNX MobileViT", confidence: Math.round(onnxRes.score * 100) },
          };
        }
      } catch (err) {
        console.warn("ONNX Inference Failed, falling back to $P Recognizer:", err);
      }
    }
  } catch (importErr) {
    console.warn("Failed to dynamically load Tensor Engine:", importErr);
  }

  // Fallback points' color if colorHex is provided
  if (colorHex) {
    for (const pt of flatPoints) {
      if (!pt.color) {
        pt.color = colorHex;
      }
    }
  }

  const processedInput = preprocess(flatPoints);
  const templates = getTemplates();

  let bestName = "Không nhận diện được";
  let minDistance = Infinity;

  for (const template of templates) {
    const dist = greedyCloudMatch(processedInput, template.points);
    if (dist < minDistance) {
      minDistance = dist;
      bestName = template.name;
    }
  }

  // Calculate base confidence score (normalized)
  const baseScore = Math.max(0, parseFloat((1.0 - minDistance / 8.0).toFixed(2)));

  // Calculate Picasso Artistic quality factors from original points
  const detailFactor = Math.min(1.0, flatPoints.length / 80.0);

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of flatPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const maxDim = Math.max(width, height);
  const scaleFactor = Math.min(1.0, maxDim / 150.0);

  let pathLength = 0;
  for (let i = 1; i < flatPoints.length; i++) {
    pathLength += Math.sqrt((flatPoints[i].x - flatPoints[i - 1].x) ** 2 + (flatPoints[i].y - flatPoints[i - 1].y) ** 2);
  }
  const startEndDist = Math.sqrt(
    (flatPoints[flatPoints.length - 1].x - flatPoints[0].x) ** 2 + (flatPoints[flatPoints.length - 1].y - flatPoints[0].y) ** 2,
  );
  const complexityFactor = Math.min(1.0, pathLength / (startEndDist + 10.0));

  // Leonardo da Vinci Index multiplier: base weight 40% + 30% detail + 20% size + 10% complexity
  const daVinciMultiplier = 0.4 + 0.3 * detailFactor + 0.2 * scaleFactor + 0.1 * complexityFactor;

  const thinking = {
    curiosita: Math.round(detailFactor * 100),
    sensazione: Math.round(scaleFactor * 100),
    sfumato: Math.round(complexityFactor * 100),
    proportion: Math.round(baseScore * 100),
  };

  let colorScore = 1.0;
  let finalScore = parseFloat((baseScore * daVinciMultiplier).toFixed(2));

  // Color Evaluation Algorithm
  if (colorHex && productName) {
    const p = productName.toLowerCase();
    let expectedColors: string[] = [];
    if (p.includes("ngô") || p.includes("corn") || p.includes("bắp")) expectedColors = ["#eab308", "#facc15", "#fef08a"];
    else if (
      p.includes("thảo dược") ||
      p.includes("herb") ||
      p.includes("bơ") ||
      p.includes("avocado") ||
      p.includes("trùn") ||
      p.includes("green") ||
      p.includes("chè") ||
      p.includes("trà") ||
      p.includes("tea") ||
      p.includes("sâm") ||
      p.includes("ginseng") ||
      p.includes("măng") ||
      p.includes("bamboo")
    )
      expectedColors = ["#22c55e", "#16a34a", "#15803d", "#4ade80", "#10b981"];
    else if (p.includes("cà phê") || p.includes("coffee") || p.includes("than") || p.includes("charcoal"))
      expectedColors = ["#78350f", "#92400e", "#b45309", "#1f2937", "#000000"];
    else if (p.includes("heo") || p.includes("pig") || p.includes("thịt") || p.includes("táo") || p.includes("red"))
      expectedColors = ["#f472b6", "#ec4899", "#ef4444", "#f43f5e"];
    else if (p.includes("nước") || p.includes("water") || p.includes("mát") || p.includes("làm mát"))
      expectedColors = ["#3b82f6", "#60a5fa", "#06b6d4"];
    else if (p.includes("tỏi") || p.includes("garlic")) expectedColors = ["#f3f4f6", "#e5e7eb", "#ffffff", "#d1d5db"];
    else if (p.includes("gạo") || p.includes("lúa") || p.includes("rice")) expectedColors = ["#fef08a", "#fde047", "#ffffff"];
    else if (p.includes("mật") || p.includes("honey")) expectedColors = ["#f59e0b", "#d97706", "#b45309"];
    else if (
      p.includes("mít") ||
      p.includes("fruit") ||
      p.includes("khoai") ||
      p.includes("potato") ||
      p.includes("hạt điều") ||
      p.includes("cashew") ||
      p.includes("lạc") ||
      p.includes("peanut") ||
      p.includes("tiêu") ||
      p.includes("pepper")
    )
      expectedColors = ["#fb923c", "#22c55e", "#f97316"];

    if (expectedColors.length > 0) {
      // Parse hex to RGB
      const hexToRgb = (hex: string) => {
        const h = hex.replace("#", "");
        return {
          r: parseInt(h.substring(0, 2), 16) || 0,
          g: parseInt(h.substring(2, 4), 16) || 0,
          b: parseInt(h.substring(4, 6), 16) || 0,
        };
      };

      const actualRgb = hexToRgb(colorHex);
      let minColorDist = Infinity;

      for (const expHex of expectedColors) {
        const expRgb = hexToRgb(expHex);
        const dist = Math.sqrt(
          Math.pow(actualRgb.r - expRgb.r, 2) + Math.pow(actualRgb.g - expRgb.g, 2) + Math.pow(actualRgb.b - expRgb.b, 2),
        );
        if (dist < minColorDist) minColorDist = dist;
      }

      // Max possible distance is sqrt(255^2*3) = 441.67
      colorScore = Math.max(0, 1.0 - minColorDist / 441.67);

      // Combine shape score and color score (e.g. 70% shape, 30% color)
      finalScore = parseFloat((finalScore * 0.7 + colorScore * 0.3).toFixed(2));
    }
  }

  // Color distribution analysis
  const colorCounts: Record<string, number> = {};
  let validColorsCount = 0;
  for (const pt of flatPoints) {
    if (pt.color) {
      const name = getColorName(pt.color);
      colorCounts[name] = (colorCounts[name] || 0) + 1;
      validColorsCount++;
    }
  }

  let colorPercentagesStr = "";
  const colorPercentagesList: { name: string; percentage: number; color: string }[] = [];
  if (validColorsCount > 0) {
    const list = Object.entries(colorCounts)
      .map(([name, count]) => {
        const matchingPt = flatPoints.find((pt) => pt.color && getColorName(pt.color) === name);
        return {
          name,
          percentage: Math.round((count / validColorsCount) * 100),
          color: matchingPt ? matchingPt.color! : "#ccc",
        };
      })
      .sort((a, b) => b.percentage - a.percentage);

    colorPercentagesList.push(...list);
    colorPercentagesStr = list.map((c) => `${c.name} ${c.percentage}%`).join(", ");
  }

  const resultObj = {
    name: bestName,
    score: finalScore,
    colorScore,
    shapeScore: parseFloat((baseScore * daVinciMultiplier).toFixed(2)),
    thinking,
    colorPercentagesStr,
    colorPercentagesList,
  };

  if (finalScore < 0.6) {
    return { ...resultObj, name: "Không nhận diện được" };
  }

  return resultObj;
}
