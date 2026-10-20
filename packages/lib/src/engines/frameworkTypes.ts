/**
 * Framework type regressions (goal-controller#185): a model is typed by its
 * framework's kinds, as its root reads it, and a mapper reads only its own
 * framework's models; one whose framework is known only at run time (its
 * kinds `string`, as the workbench parses it) is any mapper's. Never run:
 * only type-checked, as `checkTypes.ts` is.
 */
import { GoalTree, type AnyModel } from '@goal-controller/goal-tree';
import { parsePistar } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import { NFR } from '@istar-ts/dsm3-nfr/metamodel';
import { edgeEngineMapper } from './edge';
import { kaosdocEngineMapper } from './kaosdoc/mapper';
import { nfrpropEngineMapper } from './nfrprop/mapper';

declare const text: string;
const kaosModel = () => parsePistar(text, { metamodel: KAOS_OBSTACLES });
const nfrModel = () => parsePistar(text, { metamodel: NFR });
const istarModel = () => parsePistar(text);
const anyModel = (): AnyModel => parsePistar(text, { fileMetamodel: true });

export const frameworkTypes = (): void => {
  GoalTree.goalModel(kaosModel(), kaosdocEngineMapper);
  GoalTree.goalModel(nfrModel(), nfrpropEngineMapper);
  GoalTree.fromModel(istarModel(), edgeEngineMapper);
  GoalTree.goalModel(anyModel(), kaosdocEngineMapper);
  GoalTree.fromModel(anyModel(), edgeEngineMapper);
  // @ts-expect-error a KAOS model is no iStar engine's
  GoalTree.fromModel(kaosModel(), edgeEngineMapper);
  // @ts-expect-error an iStar model is no KAOS engine's
  GoalTree.goalModel(istarModel(), kaosdocEngineMapper);
  // @ts-expect-error an NFR model is no KAOS engine's
  GoalTree.goalModel(nfrModel(), kaosdocEngineMapper);
};
