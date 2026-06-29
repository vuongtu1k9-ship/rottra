// Turn-Minimizing Maze Solver using 0-1 BFS
// Finds the path from Start to End that minimizes the number of turns (direction changes).

export interface Point {
  r: number;
  c: number;
}

export type Direction = 0 | 1 | 2 | 3; // 0: Up, 1: Right, 2: Down, 3: Left

export interface State {
  r: number;
  c: number;
  dir: Direction;
}

// Direction vectors matching index 0..3
const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];
const DIR_SYMBOLS = ["▲", "▶", "▼", "◀"];
const DIR_NAMES = ["Lên", "Phải", "Xuống", "Trái"];

export interface SolveResult {
  path: Point[];
  turns: number;
  visualGrid: string[][];
  turnPoints: { point: Point; fromDir: string; toDir: string }[];
}

/**
 * Solves the maze to minimize turns using 0-1 BFS.
 * @param grid 2D array where 0 is empty/walkable, 1 is wall
 * @param start Starting coordinates
 * @param end Ending coordinates
 */
export function solveMazeMinTurns(grid: number[][], start: Point, end: Point): SolveResult | null {
  const rows = grid.length;
  const cols = grid[0].length;

  // dist[r][c][dir] stores the minimum turns to reach cell (r, c) facing direction dir
  const dist: number[][][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => Array(4).fill(Infinity)));

  // parent[r][c][dir] stores parent state to reconstruct the path
  const parent: (State | null)[][][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => Array(4).fill(null)));

  // Deque for 0-1 BFS
  const deque: State[] = [];

  // Initialize: start facing all 4 directions with 0 turns
  for (let d = 0; d < 4; d++) {
    dist[start.r][start.c][d] = 0;
    deque.push({ r: start.r, c: start.c, dir: d as Direction });
  }

  while (deque.length > 0) {
    const curr = deque.shift()!; // Pop from front

    const { r, c, dir } = curr;
    const currentTurns = dist[r][c][dir];

    // If we reached the end, we don't return immediately because we want to make sure
    // we find the absolute minimum turns. But since 0-1 BFS processes in increasing order
    // of cost, the first time we pop a state at the destination, it is optimal.
    // However, to trace the path, we can continue or stop if we hit the destination.
    if (r === end.r && c === end.c) {
      break;
    }

    // Try all 4 possible movements
    for (let nd = 0; nd < 4; nd++) {
      const nr = r + DR[nd];
      const nc = c + DC[nd];

      // Check boundaries and walls
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === 0) {
        // Turn cost: 0 if going straight (nd === dir), 1 if turning (nd !== dir)
        const cost = nd === dir ? 0 : 1;
        const nextTurns = currentTurns + cost;

        if (nextTurns < dist[nr][nc][nd]) {
          dist[nr][nc][nd] = nextTurns;
          parent[nr][nc][nd] = curr;

          const nextState: State = { r: nr, c: nc, dir: nd as Direction };
          if (cost === 0) {
            // Push to FRONT of deque (0-weight edge)
            deque.unshift(nextState);
          } else {
            // Push to BACK of deque (1-weight edge)
            deque.push(nextState);
          }
        }
      }
    }
  }

  // Find the optimal end state (minimum turns facing any direction)
  let bestDir: Direction = 0;
  let minTurns = Infinity;
  for (let d = 0; d < 4; d++) {
    if (dist[end.r][end.c][d] < minTurns) {
      minTurns = dist[end.r][end.c][d];
      bestDir = d as Direction;
    }
  }

  if (minTurns === Infinity) {
    return null; // Unreachable
  }

  // Reconstruct path and turn points
  const pathStates: State[] = [];
  let currState: State | null = { r: end.r, c: end.c, dir: bestDir };

  while (currState !== null) {
    pathStates.push(currState);
    currState = parent[currState.r][currState.c][currState.dir];
  }
  pathStates.reverse();

  const path = pathStates.map((s) => ({ r: s.r, c: s.c }));

  // Identify where the turns happen
  const turnPoints: { point: Point; fromDir: string; toDir: string }[] = [];
  for (let i = 1; i < pathStates.length - 1; i++) {
    const prev = pathStates[i - 1];
    const curr = pathStates[i];
    const next = pathStates[i + 1];

    if (curr.dir !== next.dir) {
      turnPoints.push({
        point: { r: curr.r, c: curr.c },
        fromDir: DIR_NAMES[curr.dir],
        toDir: DIR_NAMES[next.dir],
      });
    }
  }

  // Create visual grid
  const visualGrid: string[][] = grid.map((row) => row.map((cell) => (cell === 1 ? "█" : ".")));

  // Draw path with directions
  for (let i = 0; i < pathStates.length; i++) {
    const s = pathStates[i];
    visualGrid[s.r][s.c] = DIR_SYMBOLS[s.dir];
  }
  visualGrid[start.r][start.c] = "S";
  visualGrid[end.r][end.c] = "E";

  return {
    path,
    turns: minTurns,
    visualGrid,
    turnPoints,
  };
}

// 5x5 Maze Example run
export function runExample() {
  // 5x5 maze: 0 is road, 1 is wall
  const maze = [
    [0, 0, 0, 0, 0],
    [1, 1, 0, 1, 1],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 0],
  ];

  const start = { r: 0, c: 0 };
  const end = { r: 4, c: 4 };

  const result = solveMazeMinTurns(maze, start, end);

  console.log("--------------------------------------------------");
  console.log("🌀 BẢN ĐỒ MÊ CUNG GỐC (5x5):");
  console.log("S: Start (0,0), E: End (4,4), █: Tường");
  console.log("--------------------------------------------------");
  for (let r = 0; r < maze.length; r++) {
    let line = "";
    for (let c = 0; c < maze[r].length; c++) {
      if (r === start.r && c === start.c) line += "S ";
      else if (r === end.r && c === end.c) line += "E ";
      else line += maze[r][c] === 1 ? "█ " : ". ";
    }
    console.log(line);
  }

  if (!result) {
    console.log("❌ Không tìm thấy đường đi!");
    return;
  }

  console.log("\n--------------------------------------------------");
  console.log("🎯 ĐƯỜNG ĐI TỐI ƯU HÓA SỐ LẦN RẼ (0-1 BFS):");
  console.log("--------------------------------------------------");
  for (let r = 0; r < result.visualGrid.length; r++) {
    console.log(result.visualGrid[r].join(" "));
  }

  console.log(`\n👉 Tổng số lần rẽ tối thiểu: ${result.turns} lần`);
  console.log("👉 Chi tiết các bước rẽ:");
  if (result.turnPoints.length === 0) {
    console.log("   - Đi thẳng suốt tuyến, không cần rẽ!");
  } else {
    result.turnPoints.forEach((t, i) => {
      console.log(`   ${i + 1}. Rẽ tại ô (${t.point.r}, ${t.point.c}): Hướng [${t.fromDir}] ➔ Hướng [${t.toDir}]`);
    });
  }
  console.log("--------------------------------------------------");
}

// Run if executed directly
if (import.meta.main) {
  runExample();
}
