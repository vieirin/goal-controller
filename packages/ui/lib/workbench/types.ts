import type { GoalDiagnostic } from '@istar-ts/core';
import type { DialectMode } from './dialects';
import type { EdgeV2TaskLayout, TransformEngine } from '@/lib/types';

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
  knownProperties: {
    goal: string[];
    task: string[];
    resource: string[];
    quality: string[];
  };
};

export type GenerationOptions = {
  clean: boolean;
  generateDecisionVars: boolean;
  /** Edge only */
  achievabilitySpace: number;
  /** EdgeV2 only: N */
  discretisation: number;
  /** EdgeV2 only */
  taskLayout: EdgeV2TaskLayout;
  /** SLEEC only */
  generateFluents: boolean;
  /** generate from the model without its single-child goals (the model itself is kept) */
  reduce: boolean;
};

export const DEFAULT_OPTIONS: GenerationOptions = {
  clean: false,
  generateDecisionVars: true,
  achievabilitySpace: 4,
  discretisation: 10,
  taskLayout: 'taskModules',
  generateFluents: false,
  reduce: false,
};

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
  /** with `pistar`: the modelling dialect the model is for (lib/workbench/dialects.ts) */
  dialect?: DialectMode;
};

export type EngineName = TransformEngine;
