/**
 * GODA's typed properties: what its mapper reads of a goal model, for the
 * template (RTGoreProducer's containers).
 */
import type { CostData, Notation } from '@goal-controller/goal-language';

export type GodaGoalProps = {
  /** its text as written: GODA names (and tells apart) elements by it */
  text: string;
  /** `selected: true`: the goal generated from */
  selected: boolean;
  /**
   * its context conditions (`creationProperty`): each part as written when
   * `props` read the list (#232), or none when the dialect left it unset
   */
  contexts: string[];
  /** its RT regex, read in GODA's dialect (spaces in its bracket ignored) */
  annotation: Notation | null;
};

export type GodaTaskProps = {
  text: string;
  /** as on a goal: each part as written when `props` read the list (#232) */
  contexts: string[];
  /** a refined task's RT regex */
  annotation: Notation | null;
  /** a leaf's cost (`[W = 0.1x]`) */
  cost: CostData | null;
};
