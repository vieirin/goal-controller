/**
 * The modes of the frameworks besides iStar 2.0 (goal-controller#171): a
 * KAOS or NFR model is for its framework's modelling dialect (lib's `kaos`,
 * `nfr`; no engine reads it), chosen and recorded as a dialect is
 * (`diagram.customProperties.engine`), and read with its framework's root
 * (`hostFor`; the framework recorded beside the mode).
 */
import { kaos, nfr } from '@goal-controller/lib';
import type { AnyDialect, Framework } from '@goal-controller/dialect';
import { DIALECT_LABEL, isDialectMode, type DialectMode } from './dialects';
import { FRAMEWORK_LABEL } from './frameworks';

/** Each framework's dialect, by the mode a model records for it. */
export const FRAMEWORK_DIALECTS = { kaos, nfr } as const satisfies Record<
  string,
  AnyDialect & { framework: Framework }
>;

export type FrameworkMode = keyof typeof FRAMEWORK_DIALECTS;

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
