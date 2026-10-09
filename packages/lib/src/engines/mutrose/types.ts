/**
 * MutRoSe's typed properties: what its mapper reads of a goal model, for the
 * template (the runtime annotation, the variables' scope).
 */
import type { RtTree } from '@goal-controller/goal-language';
import type { ForAll, MutroseVar, Select } from './checks';

export type MutroseGoalType = 'Perform' | 'Achieve' | 'Query';

export type MutroseGoalProps = {
  goalType: MutroseGoalType;
  description?: string;
  /** the variables it declares */
  controls: MutroseVar[];
  /** the variables it reads */
  monitors: MutroseVar[];
  /** an Achieve goal's condition: a forAll, or a plain condition */
  achieveCondition?: { forAll: ForAll | null; text: string };
  /** a Query goal's select */
  queriedProperty?: Select;
  creationCondition?: { kind: 'condition' | 'trigger'; value: string };
  group: boolean;
  divisible: boolean;
  /** its runtime annotation as written (`[G2;FALLBACK(G3,AT1)]`), if any */
  annotation: RtTree | null;
};

export type MutroseTaskProps = {
  description?: string;
  location?: string;
  params: string[];
  robotNumber?: number | [number, number];
};
