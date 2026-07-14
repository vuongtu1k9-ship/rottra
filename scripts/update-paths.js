const fs = require('fs');

const lines = fs.readFileSync('src/routes/api/[...paths].ts', 'utf8').split('\n');

let s = -1;
for(let i=0; i<lines.length; i++) {
  if(lines[i].includes('app.post("/agent/meeting-chat", async (c: any) => {')) {
    s=i;
    break;
  }
}

let open = 0, endLine = -1;
if(s !== -1) {
  for(let i=s; i<lines.length; i++) {
    if(lines[i].includes('{')) open += (lines[i].match(/\{/g) || []).length;
    if(lines[i].includes('}')) open -= (lines[i].match(/\}/g) || []).length;
    if(open === 0 && i > s) { endLine = i+1; break; }
  }
}

// Now update [...paths].ts
if (s !== -1) {
  // Add import to the top
  const newPaths = 'import { handleMeetingChat } from "~/orchestration/meeting-coordinator";\n' + 
                   'import { handleAgentChat } from "~/orchestration/chat-coordinator";\n' +
                   lines.slice(0, s).join('\n') + '\napp.post("/agent/meeting-chat", handleMeetingChat);\n' + lines.slice(endLine).join('\n');
  fs.writeFileSync('src/routes/api/[...paths].ts', newPaths);
  console.log("Done extracting /agent/meeting-chat from paths.ts");
} else {
  console.log("Could not find /agent/meeting-chat in paths.ts");
}
