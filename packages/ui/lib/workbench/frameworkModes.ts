/**
 * The modes of the frameworks besides iStar 2.0 (goal-controller#171): a
 * KAOS or NFR model is for its framework's modelling dialect (lib's `kaos`,
 * `nfr`; no engine reads it), chosen and recorded as a dialect is
 * (`diagram.customProperties.engine`), and read with its framework's root
 * (`hostFor`; the framework recorded beside the mode).
 */
import {
  kaos,
  kaosAgentContext,
  nfr,
  nfrAgentContext,
  type EngineContext,
} from '@goal-controller/lib';
import type { AnyDialect, Framework } from '@goal-controller/dialect';
import { DIALECT_LABEL, isDialectMode, type DialectMode } from './dialects';
import { FRAMEWORK_ENGINE_DIALECTS, isFrameworkEngine } from './engineDialects';
import { FRAMEWORK_LABEL } from './frameworks';

/** Each framework's dialect, by the mode a model records for it. */
export const FRAMEWORK_DIALECTS = { kaos, nfr } as const satisfies Record<
  string,
  AnyDialect & { framework: Framework }
>;

export type FrameworkMode = keyof typeof FRAMEWORK_DIALECTS;

/** Each framework dialect's part of an agent's context (goal-controller#415): lib's binding's. */
export const FRAMEWORK_AGENT_CONTEXTS: Readonly<
  Record<FrameworkMode, EngineContext>
> = { kaos: kaosAgentContext, nfr: nfrAgentContext };

export const isFrameworkMode = (mode: unknown): mode is FrameworkMode =>
  typeof mode === 'string' && mode in FRAMEWORK_DIALECTS;

/** Its framework's name: KAOS, NFR Framework. */
export const FRAMEWORK_MODE_LABEL: Readonly<Record<FrameworkMode, string>> = {
  kaos: FRAMEWORK_LABEL[kaos.framework],
  nfr: FRAMEWORK_LABEL[nfr.framework],
};

/**
 * A mode for modelling, without an engine: an iStar extension's dialect
 * (piStar-ext) or a framework's. The workbench keeps it as piStar mode with
 * its dialect (`ModelSettings.dialect`).
 */
export type ModellingMode = DialectMode | FrameworkMode;

export const isModellingMode = (mode: unknown): mode is ModellingMode =>
  isDialectMode(mode) || isFrameworkMode(mode);

/** A modelling mode's name, as the workbench shows it. */
export const MODELLING_LABEL: Readonly<Record<ModellingMode, string>> = {
  ...DIALECT_LABEL,
  ...FRAMEWORK_MODE_LABEL,
};

/**
 * The editor a mode of a framework besides iStar 2.0 has (goal-controller#171):
 * its framework's mode (its canvas, palette and language services) and the
 * dialect its lines are read in. A framework's modelling mode is its own; a
 * framework engine's (kaosdoc, nfrprop) is its framework's, its lines its
 * engine's dialect's. Null for an iStar mode.
 */
export const frameworkEditorOf = (
  mode: unknown,
): { mode: FrameworkMode; definition: AnyDialect } | null => {
  if (isFrameworkMode(mode))
    return { mode, definition: FRAMEWORK_DIALECTS[mode] };
  if (!isFrameworkEngine(mode)) return null;
  const definition: AnyDialect = FRAMEWORK_ENGINE_DIALECTS[mode];
  const framework = (Object.keys(FRAMEWORK_DIALECTS) as FrameworkMode[]).find(
    (m) => FRAMEWORK_DIALECTS[m].framework === definition.framework,
  );
  return framework ? { mode: framework, definition } : null;
};
