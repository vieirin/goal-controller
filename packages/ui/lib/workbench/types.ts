import type { GoalDiagnostic } from '@istar-ts/core';
import type { ModellingMode } from './frameworkModes';
import {
  optionDefaults,
  type ExtensionKind,
  type OptionValues,
} from '@goal-controller/dialect';
import type { TransformEngine } from '@/lib/types';
import { ENGINE_OPTIONS } from './engineDialects';

export type Severity = 'error' | 'warning' | 'info';

/**
 * A problem of the open model, as every producer reports it and every view
 * (Problems, canvas badges, inspector) consumes it: the hosts' contract,
 * istar-ts's `GoalDiagnostic` (goal-controller#24, decision D), its element
 * named by its RT id inside the workbench (the canvas maps it to the
 * diagram's). One about an element carries its id (and the property's key);
 * only one about the file or the run as a whole (the JSON doesn't parse, an
 * engine failed without naming an element) carries none.
 */
export type Problem = Omit<GoalDiagnostic, 'elementId'> & {
  elementId?: string;
  /** 1-based, for the file's JSON problems */
  line?: number;
  column?: number;
  /** where it is, in a project's file or a model field (a definition pool's problem): Problems goes there */
  reveal?: { document: string; from: number; to: number };
};

/**
 * Who reports a problem, besides an engine (its name) and an engine-owned
 * language server (its id): the Problems panel groups by it.
 */
export const SOURCE = {
  /** the model file itself (its JSON) */
  file: 'piStar file',
  /** the workbench's own checks of the model */
  workbench: 'workbench',
  /** the shared goal-language service */
  language: 'goal language',
  /** the model's settings, as its project manifest holds them */
  settings: 'model settings',
  /** an engine's definition pool: what spans the project's files (goal-controller#59) */
  pool: 'project files',
} as const;

export type VariableInfo = {
  name: string;
  /** context: boolean condition; achievability: task success probability (0–1) */
  kind: 'context' | 'achievability';
  /** model nodes whose conditions or achievability use the variable */
  usedBy: string[];
};

export type AnalyzeResponse = {
  success: true;
  variables: VariableInfo[];
  problems: Problem[];
  /** custom properties the engine reads, per node kind */
  /** by kind: iStar's, and the extension's kinds its dialect declares properties for */
  knownProperties: {
    goal: string[];
    task: string[];
    resource: string[];
    quality: string[];
  } & Partial<Record<ExtensionKind, string[]>>;
};

/** The options of every engine, by key, typed by their declarations (ENGINE_OPTIONS). */
export type GenerationOptions = OptionValues<
  (typeof ENGINE_OPTIONS)[TransformEngine][number]
>;

/** Each option's declared default (an option two engines share has one). */
export const DEFAULT_OPTIONS: GenerationOptions = optionDefaults(
  Object.values(ENGINE_OPTIONS).flat(),
);

/** Per-model generation settings, chosen when a model is first opened. */
export type ModelSettings = {
  engine: TransformEngine;
  options: GenerationOptions;
  /** regenerate after each change */
  live: boolean;
  /**
   * piStar mode: free iStar modelling with the plain editor, no engine (no analysis,
   * generation or engine problems). Missing in settings saved before it existed.
   */
  pistar?: boolean;
  /**
   * with `pistar`: the modelling dialect the model is for (an extension's,
   * lib/workbench/dialects.ts, or a framework's, lib/workbench/frameworkModes.ts)
   */
  dialect?: ModellingMode;
};

export type EngineName = TransformEngine;
