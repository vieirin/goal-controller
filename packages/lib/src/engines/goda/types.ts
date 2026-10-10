/**
 * GODA's typed properties: what its mapper reads of a goal model, for the
 * template (RTGoreProducer's containers).
 */
import type { CostData, RtTree } from '@goal-controller/goal-language';

export type GodaGoalProps = {
  /** its text as written: GODA names (and tells apart) elements by it */
  text: string;
  /** `selected: true`: the goal generated from */
  selected: boolean;
  /** its context conditions (`creationProperty`), as written, `%`-separated in the model */
  contexts: string[];
  /** its RT regex, read in GODA's dialect (spaces in its bracket ignored) */
  annotation: RtTree | null;
};

export type GodaTaskProps = {
  text: string;
  contexts: string[];
  /** a refined task's RT regex */
  annotation: RtTree | null;
  /** a leaf's cost (`[W = 0.1x]`) */
  cost: CostData | null;
};
