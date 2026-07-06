import { spawnSync } from "child_process";
import { resolve } from "path";

const pythonScript = resolve(import.meta.dir, "sd_generator.py");
const args = process.argv.slice(2);

// Check if Python command needs to be python or python3
const pyCmd = process.platform === "win32" ? "python" : "python3";

console.log(`[Bun Bridge] Spawning Python process for Stable Diffusion offline generation...`);
const result = spawnSync(pyCmd, [pythonScript, ...args], { stdio: "inherit" });
process.exit(result.status ?? 0);
