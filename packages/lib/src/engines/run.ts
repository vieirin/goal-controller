/**
 * What the workbench does with a model for an engine (goal-controller#124
 * follow-up): how it reads the model, how the engine generates its files from
 * that reading, and what the engine finds wrong across elements or offers as
 * variables. An engine object carries one (`run`, built with `onTree`,
 * `onModel` or `onGraph`), so the workbench's transform and analysis
 * dispatch through it and name no engine.
 */
import {
  GoalTree,
  type AnyModel,
  type KindEngineMapper,
  type NodeOf,
} from '@goal-controller/goal-tree';
import type { LoggerReport } from './edge/logger/logger';
import type { EngineOutput } from './output';

/**
 * What a generation is given beside the model's reading: the model's name,
 * the model itself (as validated), and the options the run was asked for,
 * by key, as the workbench has them (no defaults applied: each engine applies
 * its own), with the values of the model's variables and the previous output.
 */
export type GenerateRequest = {
  modelName: string;
  model: AnyModel;
  options: Readonly<Record<string, unknown>>;
  /** the values set for the model's variables (the Edge engines' constants) */
  variables?: Record<string, boolean | number>;
  /** the primary file of the latest run for the same file and engine, for `clean: false` */
  previousOutput?: string;
};

/** What an engine finds wrong across elements, which no property check sees. */
export type EngineProblem = {
  severity: 'error' | 'warning' | 'info';
  message: string;
  /** the element it is on */
  element?: string;
  /** no element given: the workbench anchors it on the node its message names */
  elementInMessage?: true;
};

/** A variable the engine's output leaves open, with the nodes that use it. */
export type EngineVariable = {
  name: string;
  /** context: a boolean condition; achievability: a task's success probability (0–1) */
  kind: 'context' | 'achievability';
  usedBy: string[];
};

/** A log a generation writes to, read back as the run's report. */
export type EngineLog = {
  getReport: () => LoggerReport | null;
  close: () => void;
};

/** What the workbench does with a reading `R` of a model. */
export type RunSteps<R> = {
  /** its files, from the reading (none: an analysis engine) */
  generate?: (reading: R, request: GenerateRequest) => EngineOutput;
  /** what it finds wrong across elements (MutRoSe's variable scoping) */
  problems?: (reading: R, model: AnyModel) => EngineProblem[];
  /** the variables its output leaves open (the Edge engines') */
  variables?: (reading: R) => EngineVariable[];
  /** the log a generation writes to (default: lib's Edge logger) */
  log?: (modelName: string) => EngineLog;
};

/**
 * How the workbench reads a model for an engine: `graph`, as parsed (its
 * file's kinds, no root, no tree); `model`, validated (each actor's root as
 * its mapper's dialect reads it), then `read` into the engine's reading, a
 * failure there being the engine's (`Tree conversion failed`).
 */
export type EngineRun = RunSteps<never> & {
  reads: 'graph' | 'model';
  read: (model: AnyModel) => unknown;
};

/** A run over a reading of the engine's own (the IR its template takes: kaosdoc's). */
export const onModel = <R>(
  read: (model: AnyModel) => R,
  steps: RunSteps<R> = {},
): EngineRun => ({ reads: 'model', read, ...(steps as RunSteps<never>) });

/** A run over the tree the engine's mapper reads the validated model into. */
export const onTree = <
  M extends KindEngineMapper<any, any, any, any, any, any>,
>(
  mapper: M,
  steps: RunSteps<NodeOf<M>[]> = {},
): EngineRun =>
  onModel(
    (model): NodeOf<M>[] =>
      GoalTree.fromModel(model, mapper as never).nodes as NodeOf<M>[],
    steps,
  );

/** A run over the model as parsed (an analysis engine's; iStar-DT's writer). */
export const onGraph = (steps: RunSteps<AnyModel> = {}): EngineRun => ({
  reads: 'graph',
  read: (model) => model,
  ...(steps as RunSteps<never>),
});

/**
 * A generation option's value as the run was asked for it, or the engine's
 * default when it wasn't given.
 */
export const optionOr = <T>(
  options: GenerateRequest['options'],
  key: string,
  fallback: T,
): T => (options[key] === undefined ? fallback : (options[key] as T));
