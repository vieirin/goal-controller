/**
 * nfrprop's mapper (goal-controller#171, #215): how goal-tree reads an NFR
 * model for its analysis. Its own naming: softgoals and operationalizations
 * are tree nodes; claims are not (`tree: false`). Each node's
 * `initialLabel` arrives through its entry when the dialect reads it as a
 * label (goal-controller#226); softgoals and operationalizations may be
 * leaves. `analysisViewOf` surfaces those engine properties on the analysis
 * model.
 */
import { parsePistar } from '@istar-ts/core';
import { NFR } from '@istar-ts/dsm3-nfr/metamodel';
import {
  createEngineMapper,
  GoalTree,
  type ModelFor,
  type ModelOf,
  type NodeOf,
} from '@goal-controller/goal-tree';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import { nfrprop } from './definition';
import { NFR_LABELS, type NfrLabel } from './labels';

const isLabel = (value: unknown): value is NfrLabel =>
  (NFR_LABELS as readonly string[]).includes(value as string);

export type NfrpropElementProps = {
  text: string;
  initialLabel?: NfrLabel;
};

const mapElement = ({
  text,
  props,
}: {
  text: string;
  props: { initialLabel?: string | null };
}): NfrpropElementProps => ({
  text,
  ...(isLabel(props.initialLabel) && { initialLabel: props.initialLabel }),
});

export const nfrpropEngineMapper = createEngineMapper({
  dialect: nfrprop,
  elements: (entry) => [
    entry({
      kind: 'nfr.NFR',
      as: 'softgoal',
      mapProps: mapElement,
    }),
    entry({
      kind: 'nfr.Operationalization',
      as: 'operationalization',
      mapProps: mapElement,
    }),
    entry({
      kind: 'nfr.Claim',
      as: 'claim',
      tree: false,
      mapProps: mapElement,
    }),
  ],
});

export type NfrpropGoalModel = ModelOf<typeof nfrpropEngineMapper>;
export type NfrpropNode = NodeOf<typeof nfrpropEngineMapper>;

/** An NFR model as nfrprop's analysis reads it: the view of its `KindModel`. */
export const nfrpropAnalysisModel = <EK extends string, LK extends string>(
  model: ModelFor<typeof nfrprop, EK, LK>,
): AnalysisModel =>
  analysisViewOf(GoalTree.goalModel(model, nfrpropEngineMapper), {
    fromEntries: true,
  });

/** An NFR model's piStar text (DSM3's), read with the NFR root. */
export const readNfrModel = (text: string) =>
  parsePistar(text, { metamodel: NFR });
