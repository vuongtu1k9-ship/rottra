import { teachRottraViaCloudLLM } from "./src/server/api/cloud-teacher";

async function run() {
  console.log("Starting Teacher Test...");
  await teachRottraViaCloudLLM("Kiến trúc hệ thống Rottra sử dụng công nghệ gì?");
  console.log("Done.");
  process.exit(0);
}

run();
