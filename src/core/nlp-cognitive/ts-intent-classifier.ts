import { MLPNetwork } from "./mlp-network";
import { TextVectorizer } from "./vectorizer";

/**
 * Mô hình Phân loại Ý định (Intent Classifier) - Thuần TypeScript
 * Tích hợp MLP Neural Network và Text Vectorizer.
 */
export class TSIntentClassifier {
  private mlp: MLPNetwork | null = null;
  private vectorizer: TextVectorizer;
  private intents: string[] = [];

  constructor() {
    this.vectorizer = new TextVectorizer();
  }

  /**
   * Huấn luyện mô hình từ dữ liệu thô
   * @param data Mảng các object chứa text và intent
   */
  public train(data: { text: string; intent: string }[], epochs: number = 200, learningRate: number = 0.05) {
    console.log(`[TS-AI] Đang khởi tạo huấn luyện cho ${data.length} mẫu...`);

    // 1. Thu thập tất cả các Intent (Classes)
    const uniqueIntents = new Set<string>();
    const corpus = [];
    for (const item of data) {
      uniqueIntents.add(item.intent);
      corpus.push(item.text);
    }
    this.intents = Array.from(uniqueIntents).sort();
    
    console.log(`[TS-AI] Nhận diện được ${this.intents.length} Intent:`, this.intents);

    // 2. Học từ vựng (Fit Vectorizer)
    this.vectorizer.fit(corpus);

    // 3. Khởi tạo Mạng Nơ-ron
    const inputSize = this.vectorizer.getVocabSize();
    const hiddenSize = Math.floor(inputSize * 1.5); // Lớp ẩn lớn hơn 1 chút
    const outputSize = this.intents.length;
    
    this.mlp = new MLPNetwork(inputSize, hiddenSize, outputSize, learningRate);

    // 4. Chuẩn bị dữ liệu huấn luyện (Vector hóa Text và One-Hot Encoding Intent)
    const trainInputs = data.map(item => this.vectorizer.vectorize(item.text));
    const trainOutputs = data.map(item => {
      const oneHot = new Array(outputSize).fill(0);
      oneHot[this.intents.indexOf(item.intent)] = 1;
      return oneHot;
    });

    // 5. Epoch Training Loop
    console.log(`[TS-AI] Bắt đầu Epoch Training (Softmax + Cross-Entropy)...`);
    for (let epoch = 1; epoch <= epochs; epoch++) {
      let totalLoss = 0;

      for (let i = 0; i < trainInputs.length; i++) {
        // Lan truyền tiến để tính loss trước khi train
        const prediction = this.mlp.predict(trainInputs[i]);
        
        // Tính Cross Entropy Loss: -sum(target * log(prediction))
        let loss = 0;
        for (let j = 0; j < outputSize; j++) {
          if (trainOutputs[i][j] === 1) {
            loss -= Math.log(prediction[j] + 1e-15); // Cộng epsilon nhỏ để tránh log(0)
          }
        }
        totalLoss += loss;

        // Lan truyền ngược & Cập nhật
        this.mlp.train(trainInputs[i], trainOutputs[i]);
      }

      if (epoch % 50 === 0 || epoch === 1) {
        console.log(`Epoch ${epoch}/${epochs} - Loss: ${(totalLoss / trainInputs.length).toFixed(4)}`);
      }
    }
    console.log(`[TS-AI] Hoàn tất huấn luyện! Sẵn sàng dự đoán.`);
  }

  /**
   * Dự đoán ý định của một câu chat
   */
  public predict(text: string): { intent: string; confidence: number } {
    if (!this.mlp) throw new Error("Mô hình chưa được huấn luyện! Vui lòng gọi train() trước.");

    const inputVector = this.vectorizer.vectorize(text);
    const probabilities = this.mlp.predict(inputVector);

    // Tìm index có xác suất cao nhất
    let maxIdx = 0;
    let maxProb = probabilities[0];

    for (let i = 1; i < probabilities.length; i++) {
      if (probabilities[i] > maxProb) {
        maxProb = probabilities[i];
        maxIdx = i;
      }
    }

    return {
      intent: this.intents[maxIdx],
      confidence: maxProb
    };
  }
}
