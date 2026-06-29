import fs from "fs";
import path from "path";
import https from "https";

const MODEL_URL = "https://huggingface.co/Xenova/quickdraw-mobilevit-small/resolve/main/onnx/model.onnx";
const MODELS_DIR = path.join(process.cwd(), "public/models");
const DEST_PATH = path.join(MODELS_DIR, "quickdraw.onnx");

if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

console.log(`Downloading ONNX model from ${MODEL_URL}...`);
console.log(`Saving to ${DEST_PATH}...`);

const file = fs.createWriteStream(DEST_PATH);

https.get(MODEL_URL, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download model. Status Code: ${response.statusCode}`);
    fs.unlinkSync(DEST_PATH);
    process.exit(1);
  }

  response.pipe(file);

  file.on("finish", () => {
    file.close();
    console.log("✅ Download completed successfully!");
  });
}).on("error", (err) => {
  fs.unlinkSync(DEST_PATH);
  console.error("Error downloading model:", err.message);
});
