import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "src", "client", "views", "assembly.tsrx");
const content = fs.readFileSync(filePath, "utf8");

const lines = content.split("\n");
lines.forEach((line, index) => {
  if (line.includes("chatTick")) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
process.exit(0);
