import { Deterministic } from "~/shared/utils/rng";
import {
  ga_init,
  evaluate_fitness,
  ga_set_fitness,
  ga_evolve,
  ga_get_best_fitness,
  ga_get_best,
  ga_get_generation,
  ga_get_individual,
  ga_free,
} from "../genetic/genetic_algorithm";

function levenshtein_distance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const d: number[][] = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; ++i) d[i][0] = i;
  for (let j = 0; j <= len2; ++j) d[0][j] = j;

  for (let i = 1; i <= len1; ++i) {
    for (let j = 1; j <= len2; ++j) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[len1][len2];
}

function to_lowercase(str: string): string {
  return str.toLowerCase();
}

function generate_image(prompt: string): void {
  const mock_file = `bin/output/image_${Math.floor(Deterministic.random() * 1000)}.avif`;
  console.log(
    JSON.stringify(
      {
        status: "success",
        type: "image",
        file_path: mock_file,
        message: `Da tao anh thanh cong cho prompt: ${prompt}`,
      },
      null,
      2,
    ),
  );
}

function generate_video(prompt: string): void {
  const mock_file = `bin/output/video_${Math.floor(Deterministic.random() * 1000)}.mp4`;
  console.log(
    JSON.stringify(
      {
        status: "success",
        type: "video",
        file_path: mock_file,
        message: `Da tao video thanh cong cho prompt: ${prompt}`,
      },
      null,
      2,
    ),
  );
}

function generate_text(prompt: string): void {
  console.log(
    JSON.stringify(
      {
        status: "success",
        type: "text",
        content: "Day la cau tra loi cua AI (Duoc sinh ra tu llama.cpp C++).",
        message: `Da suy luan text thanh cong cho prompt: ${prompt}`,
      },
      null,
      2,
    ),
  );
}

function generate_audio(prompt: string): void {
  const mock_file = `bin/output/audio_${Math.floor(Deterministic.random() * 1000)}.wav`;
  console.log(
    JSON.stringify(
      {
        status: "success",
        type: "audio",
        file_path: mock_file,
        message: `Da tao giong noi thanh cong cho prompt: ${prompt}`,
      },
      null,
      2,
    ),
  );
}

function run_fuzzy_search(query: string, targets_raw: string): void {
  const targets = targets_raw.split(";").filter((item) => item.length > 0);
  const clean_query = to_lowercase(query);

  const results = targets.map((target) => {
    const clean_target = to_lowercase(target);
    const dist = levenshtein_distance(clean_query, clean_target);

    const max_len = Math.max(clean_query.length, clean_target.length);
    const similarity = max_len === 0 ? 1.0 : (max_len - dist) / max_len;

    return {
      name: target,
      score: Number(similarity.toFixed(4)),
      distance: dist,
    };
  });

  console.log(
    JSON.stringify(
      {
        status: "success",
        results,
      },
      null,
      2,
    ),
  );
}

function run_genetic_algorithm(generations: number, pop_size: number, gene_length: number): void {
  ga_init(pop_size, gene_length, 0.05, 0.8);

  for (let gen = 0; gen < generations; ++gen) {
    for (let i = 0; i < pop_size; ++i) {
      const genes = ga_get_individual(i);
      if (genes) {
        let fitness = 0.0;
        for (let j = 0; j < gene_length; ++j) {
          fitness += genes[j];
        }
        ga_set_fitness(i, fitness);
      }
    }

    if (gen < generations - 1) {
      ga_evolve();
    }
  }

  const best_fitness = ga_get_best_fitness();
  const best_genes = ga_get_best();

  console.log(
    JSON.stringify(
      {
        status: "success",
        generations: ga_get_generation(),
        best_fitness: Number(best_fitness.toFixed(6)),
        best_genes: best_genes || [],
      },
      null,
      2,
    ),
  );

  ga_free();
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(
      JSON.stringify(
        {
          status: "error",
          message: "Thieu tham so! Cu phap: node main.js <mode> <prompt|args>",
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const mode = args[0];
  const arg = args[1];

  if (mode === "image") {
    generate_image(arg);
  } else if (mode === "video") {
    generate_video(arg);
  } else if (mode === "text") {
    generate_text(arg);
  } else if (mode === "audio") {
    generate_audio(arg);
  } else if (mode === "fuzzy") {
    if (args.length < 3) {
      console.log(
        JSON.stringify(
          {
            status: "error",
            message: "Thieu danh sach san pham de so khop mờ!",
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }
    const targets_raw = args[2];
    run_fuzzy_search(arg, targets_raw);
  } else if (mode === "genetic") {
    const gens = parseInt(arg, 10);
    const pop_size = args.length > 2 ? parseInt(args[2], 10) : 100;
    const gene_len = args.length > 3 ? parseInt(args[3], 10) : 10;
    run_genetic_algorithm(gens, pop_size, gene_len);
  } else {
    console.log(
      JSON.stringify(
        {
          status: "error",
          message: "Mode khong hop le!",
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
