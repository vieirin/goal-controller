import type { EdgeV2TaskLayout, TransformEngine } from '@/lib/types';

export type Severity = 'error' | 'warning' | 'info';

/** Something the modeller should look at, with the node it concerns if known. */
export type Problem = {
  severity: Severity;
  message: string;
  /** where it was found */
  source: 'json' | 'model' | 'engine' | 'generation';
  nodeId?: string;
  /** 1-based, for JSON problems */
  line?: number;
  column?: number;
};

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
};

export type ExampleFile = { path: string; group: string; name: string };

export type EngineName = TransformEngine;
