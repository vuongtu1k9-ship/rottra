export interface Individual {
  genes: number[];
  fitness: number;
  length: number;
}

export class GAPopulation {
  population: Individual[] = [];
  pop_size: number = 0;
  gene_length: number = 0;
  mutation_rate: number = 0;
  crossover_rate: number = 0;
  generation: number = 0;
  best_fitness: number = -1e10;
  best_index: number = 0;
}

let current_pop: GAPopulation | null = null;

export function ga_init(
  pop_size: number,
  gene_length: number,
  mutation_rate: number,
  crossover_rate: number
): GAPopulation | null {
  const pop = new GAPopulation();
  pop.pop_size = pop_size;
  pop.gene_length = gene_length;
  pop.mutation_rate = mutation_rate;
  pop.crossover_rate = crossover_rate;
  pop.generation = 0;
  pop.best_fitness = -1e10;
  pop.best_index = 0;

  for (let i = 0; i < pop_size; i++) {
    const genes: number[] = [];
    for (let j = 0; j < gene_length; j++) {
      genes.push(Math.random());
    }
    pop.population.push({
      genes,
      fitness: 0.0,
      length: gene_length,
    });
  }

  current_pop = pop;
  return pop;
}

export function evaluate_fitness(genes: number[], length: number): number {
  let sum = 0.0;
  for (let i = 0; i < length; i++) {
    sum += genes[i] * genes[i];
  }
  return -sum;
}

export function ga_set_fitness(index: number, fitness: number): void {
  if (!current_pop || index < 0 || index >= current_pop.pop_size) return;
  current_pop.population[index].fitness = fitness;

  if (fitness > current_pop.best_fitness) {
    current_pop.best_fitness = fitness;
    current_pop.best_index = index;
  }
}

export function tournament_select(pop: GAPopulation, tournament_size: number): number {
  let best = Math.floor(Math.random() * pop.pop_size);
  for (let i = 1; i < tournament_size; i++) {
    const candidate = Math.floor(Math.random() * pop.pop_size);
    if (pop.population[candidate].fitness > pop.population[best].fitness) {
      best = candidate;
    }
  }
  return best;
}

export function crossover(
  parent1: Individual,
  parent2: Individual,
  child1: Individual,
  child2: Individual,
  crossover_rate: number,
  gene_length: number
): void {
  if (Math.random() < crossover_rate) {
    for (let i = 0; i < gene_length; i++) {
      if (Math.random() < 0.5) {
        child1.genes[i] = parent1.genes[i];
        child2.genes[i] = parent2.genes[i];
      } else {
        child1.genes[i] = parent2.genes[i];
        child2.genes[i] = parent1.genes[i];
      }
    }
  } else {
    child1.genes = [...parent1.genes];
    child2.genes = [...parent2.genes];
  }
}

export function mutate(individual: Individual, mutation_rate: number, gene_length: number): void {
  for (let i = 0; i < gene_length; i++) {
    if (Math.random() < mutation_rate) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u1 + 1e-10)) * Math.cos(2.0 * Math.PI * u2);
      individual.genes[i] += z * 0.1;

      if (individual.genes[i] < 0.0) individual.genes[i] = 0.0;
      if (individual.genes[i] > 1.0) individual.genes[i] = 1.0;
    }
  }
}

export function elitism(pop: GAPopulation, new_pop: Individual[]): void {
  new_pop[0].genes = [...pop.population[pop.best_index].genes];
  new_pop[0].fitness = pop.population[pop.best_index].fitness;
}

export function ga_evolve(): void {
  if (!current_pop) return;

  const pop = current_pop;
  const pop_size = pop.pop_size;
  const gene_length = pop.gene_length;

  const new_pop: Individual[] = [];
  for (let i = 0; i < pop_size; i++) {
    new_pop.push({
      genes: new Array(gene_length).fill(0),
      fitness: 0.0,
      length: gene_length,
    });
  }

  elitism(pop, new_pop);

  const elite_count = 2;
  
  for (let i = elite_count; i < pop_size; i += 2) {
    const p1 = tournament_select(pop, 3);
    const p2 = tournament_select(pop, 3);

    const child1 = new_pop[i];
    const child2 = i + 1 < pop_size ? new_pop[i + 1] : new_pop[i];

    crossover(pop.population[p1], pop.population[p2], child1, child2, pop.crossover_rate, gene_length);

    mutate(child1, pop.mutation_rate, gene_length);
    if (i + 1 < pop_size) {
      mutate(new_pop[i + 1], pop.mutation_rate, gene_length);
    }
  }

  pop.population = new_pop;
  pop.generation++;
  pop.best_fitness = -1e10;
  pop.best_index = 0;
}

export function ga_get_best(): number[] | null {
  if (!current_pop) return null;
  return current_pop.population[current_pop.best_index].genes;
}

export function ga_get_best_fitness(): number {
  if (!current_pop) return -1e10;
  return current_pop.best_fitness;
}

export function ga_get_generation(): number {
  if (!current_pop) return 0;
  return current_pop.generation;
}

export function ga_get_pop_size(): number {
  if (!current_pop) return 0;
  return current_pop.pop_size;
}

export function ga_get_individual(index: number): number[] | null {
  if (!current_pop || index < 0 || index >= current_pop.pop_size) return null;
  return current_pop.population[index].genes;
}

export function ga_free(): void {
  current_pop = null;
}
