/**
 * How the Edge engines read each custom property, for the Inspector: the specs their
 * definitions give (@goal-controller/dialect), with each named check bound to the
 * engine's own check function (ENGINE_CHECKS).
 */
import {
  specsFromDefinition,
  type ElementKind,
  type PropertySpec as DefinitionSpec,
} from '@goal-controller/dialect';
import { firstResourceIssue, type Check } from '@goal-controller/lib';
import {
  ENGINE_CHECKS,
  ENGINE_DIALECTS,
  type DialectEngine,
} from './engineDialects';

export { firstResourceIssue };
export {
  inputOf,
  type Properties,
  type PropertyInput,
} from '@goal-controller/dialect';

export type PropertySpec<K extends string = string> = DefinitionSpec<K, Check>;

/** The node kinds an engine has properties for. */
export type NodeKindKey = ElementKind;

type Specs = Record<NodeKindKey, readonly PropertySpec[]>;

const specsOf = <E extends DialectEngine>(engine: E): Specs =>
  specsFromDefinition(ENGINE_DIALECTS[engine], ENGINE_CHECKS[engine]);

export const PROPERTY_SPECS: Record<DialectEngine, Specs> = {
  edge: specsOf('edge'),
  edgev2: specsOf('edgev2'),
  mutrose: specsOf('mutrose'),
  goda: specsOf('goda'),
};
