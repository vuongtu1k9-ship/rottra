/**
 * Genetic Algorithm - C Implementation for WASM
 * Compile: emcc ga.c -o ga.js -s EXPORTED_FUNCTIONS="['_ga_init','_ga_evolve','_ga_get_best','_ga_free'" -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap']" -O3
 */

#include <stdlib.h>
#include <math.h>
#include <string.h>

// ===== TYPES =====

typedef struct {
    double *genes;
    double fitness;
    int length;
} Individual;

typedef struct {
    Individual *population;
    int pop_size;
    int gene_length;
    double mutation_rate;
    double crossover_rate;
    int generation;
    double best_fitness;
    int best_index;
} GAPopulation;

// ===== MEMORY MANAGEMENT =====

static GAPopulation *current_pop = NULL;

// ===== CORE GA FUNCTIONS =====

/**
 * Khởi tạo quần thể GA
 */
void* ga_init(int pop_size, int gene_length, double mutation_rate, double crossover_rate) {
    GAPopulation *pop = (GAPopulation*)malloc(sizeof(GAPopulation));
    if (!pop) return NULL;

    pop->pop_size = pop_size;
    pop->gene_length = gene_length;
    pop->mutation_rate = mutation_rate;
    pop->crossover_rate = crossover_rate;
    pop->generation = 0;
    pop->best_fitness = -1e10;
    pop->best_index = 0;

    // Allocate population
    pop->population = (Individual*)malloc(pop_size * sizeof(Individual));
    if (!pop->population) {
        free(pop);
        return NULL;
    }

    // Initialize each individual
    for (int i = 0; i < pop_size; i++) {
        pop->population[i].genes = (double*)malloc(gene_length * sizeof(double));
        pop->population[i].length = gene_length;
        pop->population[i].fitness = 0.0;

        // Random initialization [0, 1]
        for (int j = 0; j < gene_length; j++) {
            pop->population[i].genes[j] = (double)rand() / (double)RAND_MAX;
        }
    }

    current_pop = pop;
    return (void*)pop;
}

/**
 * Đánh giá fitness (user provided callback)
 * Trong WASM, fitness function sẽ được truyền từ JS
 */
double evaluate_fitness(double *genes, int length) {
    // Default: Sphere function f(x) = -sum(x^2)
    // User có thể override qua JS callback
    double sum = 0.0;
    for (int i = 0; i < length; i++) {
        sum += genes[i] * genes[i];
    }
    return -sum; // Maximize (negate for minimization)
}

/**
 * Set fitness cho individual (gọi từ JS)
 */
void ga_set_fitness(int index, double fitness) {
    if (!current_pop || index < 0 || index >= current_pop->pop_size) return;
    current_pop->population[index].fitness = fitness;

    if (fitness > current_pop->best_fitness) {
        current_pop->best_fitness = fitness;
        current_pop->best_index = index;
    }
}

/**
 * Tournament Selection
 */
int tournament_select(GAPopulation *pop, int tournament_size) {
    int best = rand() % pop->pop_size;
    for (int i = 1; i < tournament_size; i++) {
        int candidate = rand() % pop->pop_size;
        if (pop->population[candidate].fitness > pop->population[best].fitness) {
            best = candidate;
        }
    }
    return best;
}

/**
 * Uniform Crossover
 */
void crossover(Individual *parent1, Individual *parent2, Individual *child1, Individual *child2, double crossover_rate, int gene_length) {
    if ((double)rand() / (double)RAND_MAX < crossover_rate) {
        for (int i = 0; i < gene_length; i++) {
            if ((double)rand() / (double)RAND_MAX < 0.5) {
                child1->genes[i] = parent1->genes[i];
                child2->genes[i] = parent2->genes[i];
            } else {
                child1->genes[i] = parent2->genes[i];
                child2->genes[i] = parent1->genes[i];
            }
        }
    } else {
        memcpy(child1->genes, parent1->genes, gene_length * sizeof(double));
        memcpy(child2->genes, parent2->genes, gene_length * sizeof(double));
    }
}

/**
 * Gaussian Mutation
 */
void mutate(Individual *individual, double mutation_rate, int gene_length) {
    for (int i = 0; i < gene_length; i++) {
        if ((double)rand() / (double)RAND_MAX < mutation_rate) {
            // Gaussian mutation with sigma = 0.1
            double u1 = (double)rand() / (double)RAND_MAX;
            double u2 = (double)rand() / (double)RAND_MAX;
            double z = sqrt(-2.0 * log(u1 + 1e-10)) * cos(2.0 * M_PI * u2);
            individual->genes[i] += z * 0.1;

            // Clamp to [0, 1]
            if (individual->genes[i] < 0.0) individual->genes[i] = 0.0;
            if (individual->genes[i] > 1.0) individual->genes[i] = 1.0;
        }
    }
}

/**
 * Elitism: Giữ lại individual tốt nhất
 */
void elitism(GAPopulation *pop, Individual *new_pop) {
    // Copy best individual directly
    memcpy(new_pop[0].genes, pop->population[pop->best_index].genes, pop->gene_length * sizeof(double));
    new_pop[0].fitness = pop->population[pop->best_index].fitness;
}

/**
 * Evolve 1 thế hệ
 */
void ga_evolve() {
    if (!current_pop) return;

    GAPopulation *pop = current_pop;
    int pop_size = pop->pop_size;
    int gene_length = pop->gene_length;

    // Create new population
    Individual *new_pop = (Individual*)malloc(pop_size * sizeof(Individual));
    for (int i = 0; i < pop_size; i++) {
        new_pop[i].genes = (double*)malloc(gene_length * sizeof(double));
        new_pop[i].length = gene_length;
        new_pop[i].fitness = 0.0;
    }

    // Elitism: keep best
    elitism(pop, new_pop);

    // Generate rest of population
    int elite_count = 2; // Keep top 2
    for (int i = elite_count; i < pop_size; i += 2) {
        // Select parents
        int p1 = tournament_select(pop, 3);
        int p2 = tournament_select(pop, 3);

        // Crossover
        crossover(&pop->population[p1], &pop->population[p2],
                  &new_pop[i], &new_pop[i + 1 < pop_size ? i + 1 : i],
                  pop->crossover_rate, gene_length);

        // Mutate
        mutate(&new_pop[i], pop->mutation_rate, gene_length);
        if (i + 1 < pop_size) {
            mutate(&new_pop[i + 1], pop->mutation_rate, gene_length);
        }
    }

    // Replace old population
    for (int i = 0; i < pop_size; i++) {
        free(pop->population[i].genes);
    }
    free(pop->population);

    pop->population = new_pop;
    pop->generation++;

    // Reset best tracking
    pop->best_fitness = -1e10;
    pop->best_index = 0;
}

/**
 * Get best individual's genes
 */
double* ga_get_best() {
    if (!current_pop) return NULL;
    return current_pop->population[current_pop->best_index].genes;
}

/**
 * Get best fitness
 */
double ga_get_best_fitness() {
    if (!current_pop) return -1e10;
    return current_pop->best_fitness;
}

/**
 * Get generation number
 */
int ga_get_generation() {
    if (!current_pop) return 0;
    return current_pop->generation;
}

/**
 * Get population size
 */
int ga_get_pop_size() {
    if (!current_pop) return 0;
    return current_pop->pop_size;
}

/**
 * Get individual's genes by index
 */
double* ga_get_individual(int index) {
    if (!current_pop || index < 0 || index >= current_pop->pop_size) return NULL;
    return current_pop->population[index].genes;
}

/**
 * Free memory
 */
void ga_free() {
    if (!current_pop) return;

    for (int i = 0; i < current_pop->pop_size; i++) {
        free(current_pop->population[i].genes);
    }
    free(current_pop->population);
    free(current_pop);
    current_pop = NULL;
}
