/**
 * How the Edge engines read each custom property, for the Inspector: the specs their
 * definitions give (@goal-controller/definitions), with each named check bound to the
 * engine's own check function (ENGINE_CHECKS).
 */
import {
  specsFromDefinition,
  type ElementKind,
  type PropertySpec as DefinitionSpec,
} from '@goal-controller/definitions';
import { firstResourceIssue, type Check } from '@goal-controller/lib';
import {
  ENGINE_CHECKS,
  EDITOR_DEFINITIONS,
  type DefinedEngine,
} from './definitions';

export { firstResourceIssue };
export {
  inputOf,
  type Properties,
  type PropertyInput,
} from '@goal-controller/definitions';

export type PropertySpec<K extends string = string> = DefinitionSpec<K, Check>;

/** The node kinds an engine has properties for. */
export type NodeKindKey = ElementKind;

type Specs = Record<NodeKindKey, readonly PropertySpec[]>;

const specsOf = (engine: DefinedEngine): Specs =>
  specsFromDefinition(EDITOR_DEFINITIONS[engine], ENGINE_CHECKS[engine]);

export const PROPERTY_SPECS: Record<DefinedEngine, Specs> = {
  edge: specsOf('edge'),
  edgev2: specsOf('edgev2'),
};
