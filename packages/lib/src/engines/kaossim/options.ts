/**
 * kaossim's options (goal-controller#193): the Monte Carlo's sample count
 * and seed (a run is reproducible), and how the design space is searched
 * (./search.ts).
 */
import { defineOptions } from '@goal-controller/dialect';
import type { AnalysisContext } from '../analysis';
import type { SearchOptions } from './search';

export const DEFAULT_SIM_OPTIONS: SearchOptions = {
  samples: 10000,
  seed: 1,
  method: 'exhaustive',
  limit: 4096,
  population: 40,
  generations: 60,
};

/** The options a project sets, each its default when unset or not of its type. */
export const simOptionsOf = (context?: AnalysisContext): SearchOptions => {
  const given = context?.options ?? {};
  const int = (key: keyof SearchOptions, fallback: number, min = 1) => {
    const value = given[key];
    return typeof value === 'number' && Number.isInteger(value) && value >= min
      ? value
      : fallback;
  };
  return {
    samples: int('samples', DEFAULT_SIM_OPTIONS.samples),
    seed: int('seed', DEFAULT_SIM_OPTIONS.seed, 0),
    method:
      given.method === 'nsga2' || given.method === 'exhaustive'
        ? given.method
        : DEFAULT_SIM_OPTIONS.method,
    limit: int('limit', DEFAULT_SIM_OPTIONS.limit),
    population: int('population', DEFAULT_SIM_OPTIONS.population, 2),
    generations: int('generations', DEFAULT_SIM_OPTIONS.generations, 0),
  };
};

export const kaossimOptions = defineOptions([
  {
    key: 'samples',
    label: 'Samples',
    help: 'how many times the Monte Carlo draws every leaf variable, per design (RE’11 §III.A)',
    value: { type: 'int', min: 1, max: 1000000 },
    default: DEFAULT_SIM_OPTIONS.samples,
    summary: '{value} samples',
  },
  {
    key: 'seed',
    label: 'Seed',
    help: 'the random draws’ seed: the same seed, the same results',
    value: { type: 'int', min: 0, max: 2147483647 },
    default: DEFAULT_SIM_OPTIONS.seed,
  },
  {
    key: 'method',
    label: 'Design-space search',
    help: 'how the Pareto-optimal designs are found',
    value: {
      type: 'enum',
      options: [
        {
          value: 'exhaustive',
          label: 'Every design',
          help: 'every design simulated, the exact Pareto front (RE’11’s exhaustive search)',
        },
        {
          value: 'nsga2',
          label: 'NSGA-II',
          help: 'a seeded genetic search, as RE’11 runs Matlab’s, for a design space too large to enumerate',
        },
      ],
    },
    default: DEFAULT_SIM_OPTIONS.method,
    summary: '{value}',
  },
  {
    key: 'limit',
    label: 'Designs evaluated, at most',
    help: 'the exhaustive search evaluates at most this many designs',
    value: { type: 'int', min: 1, max: 1048576 },
    default: DEFAULT_SIM_OPTIONS.limit,
    summary: '{value} designs',
  },
  {
    key: 'population',
    label: 'NSGA-II population',
    help: 'how many designs each generation has',
    value: { type: 'int', min: 2, max: 10000 },
    default: DEFAULT_SIM_OPTIONS.population,
  },
  {
    key: 'generations',
    label: 'NSGA-II generations',
    help: 'how many generations the genetic search runs',
    value: { type: 'int', min: 0, max: 100000 },
    default: DEFAULT_SIM_OPTIONS.generations,
  },
]);
