/**
 * How the Edge engines read each custom property, for the Inspector: the specs their
 * definitions give (@goal-controller/definitions), with each named check bound to the
 * engine's own check function (@goal-controller/lib's edgeCheckRegistry).
 */
import {
  specsFromDefinition,
  type ElementKind,
  type PropertySpec as DefinitionSpec,
} from '@goal-controller/definitions';
import {
  edgeCheckRegistry,
  firstResourceIssue,
  type Check,
} from '@goal-controller/lib';
import { ENGINE_DEFINITIONS, type DefinedEngine } from './definitions';

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
  specsFromDefinition<Check>(ENGINE_DEFINITIONS[engine], edgeCheckRegistry);

export const PROPERTY_SPECS: Record<DefinedEngine, Specs> = {
  edge: specsOf('edge'),
  edgev2: specsOf('edgev2'),
};
