/**
 * How the Edge engines read each custom property, for the Inspector: the specs their
 * definitions give (@goal-controller/dialect), with each named check bound to the
 * engine's own check function (ENGINE_CHECKS).
 */
import {
  specsFromDefinition,
  type ElementKind,
  type ExtensionKind,
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

/** By kind: iStar's, and the extension's kinds the definition gives properties (goal-controller#132). */
type Specs = Record<NodeKindKey, readonly PropertySpec[]> &
  Partial<Record<ExtensionKind, readonly PropertySpec[]>>;

const specsOf = <E extends DialectEngine>(engine: E): Specs =>
  specsFromDefinition(ENGINE_DIALECTS[engine], ENGINE_CHECKS[engine]);

/** Each iStar engine's specs, by engine (every one in ENGINE_DIALECTS). */
export const PROPERTY_SPECS = Object.fromEntries(
  (Object.keys(ENGINE_DIALECTS) as DialectEngine[]).map((engine) => [
    engine,
    specsOf(engine),
  ]),
) as Record<DialectEngine, Specs>;
