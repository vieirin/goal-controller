/**
 * iStar-DT's engine mapper: how goal-tree reads an iStar-DT model (its
 * tree, the inspector's unread keys, and its `GoalModel`, goal-controller
 * #125). Entries by kind (goal-controller#215): iStar's plus Condition,
 * Effect, EffectGroup, Predicate and Variable. The writer reads the model
 * as a graph (`readIstardtModel`) over that `GoalModel`'s view, so a link's
 * and an actor's entries keep their properties as written.
 */
import {
  createEngineMapper,
  GoalTree,
  useIstarDefaultNaming,
  type IStarModel,
  type ModelOf,
} from '@goal-controller/goal-tree';
import type { IstarModel } from '@istar-ts/core';
import { analysisViewOf, type AnalysisModel } from '../analysis';
import { istardt } from './definition';

type IstardtProps = { text: string };

/** raw texts as written: what analysisViewOf keeps on a link or actor */
const asWritten = ({
  raw,
}: {
  raw: Readonly<Partial<Record<string, string | undefined>>>;
}) => raw;

export const istardtEngineMapper = createEngineMapper({
  dialect: istardt,
  naming: useIstarDefaultNaming(),
  elements: (entry) => [
    entry({
      kinds: ['istar.Goal', 'istar.Quality'],
      mapProps: ({ text }) => ({ text }) satisfies IstardtProps,
    }),
    entry({
      kind: 'istar.Task',
      mapProps: ({ text }) => ({ text }) satisfies IstardtProps,
    }),
    entry({
      kind: 'istardt.Condition',
      as: 'condition',
      mapProps: ({ text }) => ({ text }),
    }),
    entry({
      kind: 'istardt.Effect',
      as: 'effect',
      mapProps: ({ text }) => ({ text }),
    }),
    entry({
      kind: 'istardt.EffectGroup',
      as: 'effectGroup',
      mapProps: ({ text }) => ({ text }),
    }),
    entry({
      kind: 'istardt.Predicate',
      as: 'predicate',
      mapProps: ({ text }) => ({ text }),
    }),
    entry({
      kind: 'istardt.Variable',
      as: 'variable',
      mapProps: ({ text }) => ({ text }),
    }),
  ],
  ignore: ['istar.Resource'],
  mapActorProps: asWritten,
  links: (entry) => [
    entry({
      kinds: ['istardt.EffectGroupLink', 'istardt.UtilityLink'],
      mapProps: asWritten,
    }),
  ],
});

export type IstardtGoalModel = ModelOf<typeof istardtEngineMapper>;

/**
 * An iStar-DT model as the writer and the checks read it: the view of its
 * `GoalModel`. It has the extension's kinds (parsed with its metamodel
 * block), which goal-tree reads as it reads GRL's; its types name iStar's.
 */
export const istardtAnalysisModel = (
  model: IStarModel | IstarModel<string, string>,
): AnalysisModel =>
  analysisViewOf(GoalTree.goalModel(model as IStarModel, istardtEngineMapper));
