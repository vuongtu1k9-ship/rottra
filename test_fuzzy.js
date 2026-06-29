const query = "Có thể xem lại danh sách sản phẩm MVP (MVP) không?";
const u = "Cho mình xem thông tin sản phẩm";

const qLower = query
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d");

const stopWords = new Set(["cua", "co", "la", "thi", "va", "nhung", "hoac", "ban", "cho", "toi", "em", "anh", "giup", "the", "nao", "mot", "nhieu", "cac", "nhung", "nay", "do", "kia", "ay", "nho", "lam", "rat", "qua", "duoc", "se", "da", "dang", "hay", "cung", "nen", "neu", "vi", "sao", "gi", "ai"]);

const uLower = u
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d");

const userWords = qLower.split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));
const trainWords = uLower.split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));

console.log("qLower:", qLower);
console.log("uLower:", uLower);
console.log("userWords:", userWords);
console.log("trainWords:", trainWords);

let score = 0;
for (const uw of userWords) {
  if (trainWords.includes(uw)) {
    score += 1.5;
  } else {
    for (const tw of trainWords) {
      if (Math.abs(tw.length - uw.length) <= 1 && (tw.includes(uw) || uw.includes(tw))) {
        score += 0.5;
      }
    }
  }
}

const qNorm = qLower.replace(/[^a-z0-9\s]/g, " ");
const uNorm = uLower.replace(/[^a-z0-9\s]/g, " ");
const qKeyTerms = qNorm.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
const uKeyTerms = uNorm.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
const exactKeyMatches = qKeyTerms.filter((qt) =>
  uKeyTerms.some((ut) => qt === ut || qt.includes(ut) || ut.includes(qt)),
);
score += exactKeyMatches.length * 2.0;

const requiredThreshold = Math.max(4.0, userWords.length * 1.5 * 0.5); 
console.log("score:", score);
console.log("exactKeyMatches:", exactKeyMatches);
console.log("requiredThreshold:", requiredThreshold);
console.log("Is Match?", score > requiredThreshold);
