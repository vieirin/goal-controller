/**
 * kaosprop (goal-controller#181): probabilistic obstacle analysis on KAOS
 * models (Cailliau and van Lamsweerde, RE'12; REJ 18(2) 2013), an analysis
 * engine.
 *
 * - propagation.ts: the rules (RE'12 §IV, Table I), the analysis with its
 *   steps, and the critical obstacle combinations (§V)
 * - definition.ts: its dialect, `kaos` with the analysis's quantities
 * - mapper.ts: how goal-tree reads a KAOS model for it
 */
import { defineAnalyses } from '../analysis';
import { kaosprop } from './definition';
import { runCriticalCombinations, runPropagation } from './propagation';

export const kaospropAnalyses = defineAnalyses(kaosprop, {
  probabilities: {
    label: 'Obstacle and goal probabilities',
    run: runPropagation,
  },
  criticalCombinations: {
    label: 'Critical obstacle combinations',
    run: runCriticalCombinations,
  },
});

export { kaosprop } from './definition';
export {
  criticalCombinations,
  percent,
  probabilityValue,
  propagateProbabilities,
  runCriticalCombinations,
  runPropagation,
  type CriticalCombination,
  type KaosPropagation,
  type KaosStep,
} from './propagation';
export {
  kaospropAnalysisModel,
  kaospropEngineMapper,
  kaospropLinkKeys,
  readKaosObstacleModel,
} from './mapper';
