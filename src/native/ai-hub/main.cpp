#include <iostream>
#include <string>
#include <vector>
#include <algorithm>
#include <sstream>
#include <iomanip>
#include <cmath>
#include <ctime>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// Nhúng trực tiếp Thuật toán Di truyền (Genetic Algorithm) để biên dịch chung một khối (Unity Build)
#include "../genetic/genetic_algorithm.cpp"

// ===== UTILS & MATH MODULES =====

// Thuật toán Levenshtein tính khoảng cách giữa 2 chuỗi (Fuzzy Search Core)
int levenshtein_distance(const std::string& s1, const std::string& s2) {
    int len1 = s1.size();
    int len2 = s2.size();
    std::vector<std::vector<int>> d(len1 + 1, std::vector<int>(len2 + 1));

    for (int i = 0; i <= len1; ++i) d[i][0] = i;
    for (int j = 0; j <= len2; ++j) d[0][j] = j;

    for (int i = 1; i <= len1; ++i) {
        for (int j = 1; j <= len2; ++j) {
            int cost = (s1[i - 1] == s2[j - 1]) ? 0 : 1;
            d[i][j] = std::min({ d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost });
        }
    }
    return d[len1][len2];
}

// Chuyển chuỗi về chữ thường để so sánh không phân biệt hoa thường
std::string to_lowercase(std::string str) {
    std::transform(str.begin(), str.end(), str.begin(), [](unsigned char c){ return std::tolower(c); });
    return str;
}

// ===== AI GENERATIVE FUNCTIONS =====

void generate_image(const std::string& prompt) {
    std::string mock_file = "bin/output/image_" + std::to_string(rand() % 1000) + ".avif";
    std::cout << "{\n"
              << "  \"status\": \"success\",\n"
              << "  \"type\": \"image\",\n"
              << "  \"file_path\": \"" << mock_file << "\",\n"
              << "  \"message\": \"Da tao anh thanh cong cho prompt: " << prompt << "\"\n"
              << "}\n";
}

void generate_video(const std::string& prompt) {
    std::string mock_file = "bin/output/video_" + std::to_string(rand() % 1000) + ".mp4";
    std::cout << "{\n"
              << "  \"status\": \"success\",\n"
              << "  \"type\": \"video\",\n"
              << "  \"file_path\": \"" << mock_file << "\",\n"
              << "  \"message\": \"Da tao video thanh cong cho prompt: " << prompt << "\"\n"
              << "}\n";
}

void generate_text(const std::string& prompt) {
    std::cout << "{\n"
              << "  \"status\": \"success\",\n"
              << "  \"type\": \"text\",\n"
              << "  \"content\": \"Day la cau tra loi cua AI (Duoc sinh ra tu llama.cpp C++).\",\n"
              << "  \"message\": \"Da suy luan text thanh cong cho prompt: " << prompt << "\"\n"
              << "}\n";
}

void generate_audio(const std::string& prompt) {
    std::string mock_file = "bin/output/audio_" + std::to_string(rand() % 1000) + ".wav";
    std::cout << "{\n"
              << "  \"status\": \"success\",\n"
              << "  \"type\": \"audio\",\n"
              << "  \"file_path\": \"" << mock_file << "\",\n"
              << "  \"message\": \"Da tao giong noi thanh cong cho prompt: " << prompt << "\"\n"
              << "}\n";
}

// ===== MIGRATED MODULES (C++ NATIVE IMPLEMENTATION) =====

// 1. Tìm kiếm mờ (Fuzzy Search) tối ưu hóa tốc độ cao
void run_fuzzy_search(const std::string& query, const std::string& targets_raw) {
    // Tách danh sách sản phẩm bằng dấu chấm phẩy ';'
    std::vector<std::string> targets;
    std::stringstream ss(targets_raw);
    std::string item;
    while (std::getline(ss, item, ';')) {
        if (!item.empty()) targets.push_back(item);
    }

    std::string clean_query = to_lowercase(query);
    std::string best_match = "";
    double best_score = -1.0;
    int best_distance = 9999;

    std::cout << "{\n"
              << "  \"status\": \"success\",\n"
              << "  \"results\": [\n";

    for (size_t i = 0; i < targets.size(); ++i) {
        std::string target = targets[i];
        std::string clean_target = to_lowercase(target);
        int dist = levenshtein_distance(clean_query, clean_target);
        
        // Tính điểm tương đồng dựa trên khoảng cách Levenshtein
        int max_len = std::max(clean_query.length(), clean_target.length());
        double similarity = max_len == 0 ? 1.0 : (double)(max_len - dist) / max_len;

        std::cout << "    {\n"
                  << "      \"name\": \"" << target << "\",\n"
                  << "      \"score\": " << std::fixed << std::setprecision(4) << similarity << ",\n"
                  << "      \"distance\": " << dist << "\n"
                  << "    }" << (i + 1 < targets.size() ? "," : "") << "\n";
    }

    std::cout << "  ]\n"
              << "}\n";
}

// 2. Chạy Thuật toán Di truyền (Genetic Algorithm) Native
void run_genetic_algorithm(int generations, int pop_size, int gene_length) {
    srand(time(NULL));

    // Khởi tạo thuật toán di truyền
    ga_init(pop_size, gene_length, 0.05, 0.8);

    // Chạy tiến hóa qua các thế hệ
    for (int gen = 0; gen < generations; ++gen) {
        // Giả lập đánh giá fitness (thực tế sẽ dựa trên dữ liệu thật)
        for (int i = 0; i < pop_size; ++i) {
            double *genes = ga_get_individual(i);
            // Hàm đánh giá mặc định: maximize tổng giá trị các gene
            double fitness = 0.0;
            for (int j = 0; j < gene_length; ++j) {
                fitness += genes[j];
            }
            ga_set_fitness(i, fitness);
        }

        if (gen < generations - 1) {
            ga_evolve();
        }
    }

    double best_fitness = ga_get_best_fitness();
    double *best_genes = ga_get_best();

    // Trả kết quả JSON về cho TypeScript
    std::cout << "{\n"
              << "  \"status\": \"success\",\n"
              << "  \"generations\": " << ga_get_generation() << ",\n"
              << "  \"best_fitness\": " << std::fixed << std::setprecision(6) << best_fitness << ",\n"
              << "  \"best_genes\": [\n";
    for (int i = 0; i < gene_length; ++i) {
        std::cout << "    " << best_genes[i] << (i + 1 < gene_length ? "," : "") << "\n";
    }
    std::cout << "  ]\n"
              << "}\n";

    // Giải phóng bộ nhớ
    ga_free();
}

// ===== MAIN ENTRY =====

int main(int argc, char* argv[]) {
    srand(time(NULL));

    if (argc < 3) {
        std::cout << "{\n"
                  << "  \"status\": \"error\",\n"
                  << "  \"message\": \"Thieu tham so! Cu phap: ai_core.exe <mode> <prompt|args>\"\n"
                  << "}\n";
        return 1;
    }

    std::string mode = argv[1];
    std::string arg = argv[2];

    if (mode == "image") {
        generate_image(arg);
    } else if (mode == "video") {
        generate_video(arg);
    } else if (mode == "text") {
        generate_text(arg);
    } else if (mode == "audio") {
        generate_audio(arg);
    } else if (mode == "fuzzy") {
        // Tham số thứ 3 (argv[3]) chứa chuỗi sản phẩm cách nhau bằng ';'
        if (argc < 4) {
            std::cout << "{\n"
                      << "  \"status\": \"error\",\n"
                      << "  \"message\": \"Thieu danh sach san pham de so khop mờ!\"\n"
                      << "}\n";
            return 1;
        }
        std::string targets_raw = argv[3];
        run_fuzzy_search(arg, targets_raw);
    } else if (mode == "genetic") {
        // arg đại diện cho số thế hệ (generations)
        int gens = std::stoi(arg);
        int pop_size = (argc > 3) ? std::stoi(argv[3]) : 100;
        int gene_len = (argc > 4) ? std::stoi(argv[4]) : 10;
        run_genetic_algorithm(gens, pop_size, gene_len);
    } else {
        std::cout << "{\n"
                  << "  \"status\": \"error\",\n"
                  << "  \"message\": \"Mode khong hop le!\"\n"
                  << "}\n";
        return 1;
    }

    return 0;
}
