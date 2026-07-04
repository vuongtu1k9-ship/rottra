import fs from "fs";
const p = "scripts/db-ops/seeders/seed-economy.ts";
let content = fs.readFileSync(p, "utf-8");
content = content.replace(
  /media: \["\/assets\/Rottra-default-agri\.png"\],/g,
  `media: [(tmpl.name.toLowerCase().includes("coffee") ? "/coffee.jpg" :
          tmpl.name.toLowerCase().includes("tea") ? "/tea.jpg" :
          tmpl.name.toLowerCase().includes("durian") ? "/durian.jpg" :
          tmpl.name.toLowerCase().includes("mango") ? "/mango.jpg" :
          tmpl.name.toLowerCase().includes("rice") || tmpl.name.toLowerCase().includes("st25") ? "/rice.jpg" :
          "/vegetable.jpg")],`
);
fs.writeFileSync(p, content);
console.log("Updated seed-economy.ts");
