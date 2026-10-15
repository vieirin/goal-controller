/**
 * An analysis engine's values on the model (goal-controller#107): what the
 * Analyse control runs, and how a result is drawn. The values go to the
 * canvas as istar-ts host diagnostics, keyed by the element's or actor's
 * piStar id, `info` (or the value's own severity) with the value as the
 * message: istar-ts 0.12 badges elements, actors and links with them. Nothing
 * runs without a click, and results are never written to the model file.
 */
import type { GoalDiagnostic } from '@istar-ts/core';
import {
  runAnalysis,
  type Analysis,
  type AnalysisCase,
  type AnalysisModel,
  type AnalysisResult,
} from '@goal-controller/lib';
import type { ResourceSlot } from '@/lib/project';
import { parseModel } from './dialects';
import type { IStarModel } from '@goal-controller/goal-tree';

/** Where the canvas's analysis diagnostics come from (one source, replaced as a whole). */
export const ANALYSIS_SOURCE = 'analysis';

/** A run of one analysis on a model text: its result or why it failed, and the case shown. */
export type AnalysisRun = {
  analysis: string;
  label: string;
  /** the model text it ran on: once the model changes, it is stale */
  text: string;
  caseId: string | null;
  /** the step shown, of a case run step by step (goal-controller#135): its index */
  step: number;
} & ({ result: AnalysisResult } | { error: string });

/**
 * A case's values as the canvas's diagnostics: one per element or actor,
 * its value the message; a case run step by step, the values of its step
 * `step` (its label in the message).
 */
export const analysisDiagnostics = (
  analysisCase: AnalysisCase | undefined,
  step = 0,
): GoalDiagnostic[] => {
  if (!analysisCase) return [];
  const shown = analysisCase.steps?.length
    ? analysisCase.steps[Math.min(step, analysisCase.steps.length - 1)]
    : undefined;
  const label = shown
    ? `${analysisCase.label}, ${shown.label}`
    : analysisCase.label;
  return Object.entries(shown?.values ?? analysisCase.values).map(
    ([elementId, value]) => ({
      elementId,
      severity: value.severity ?? 'info',
      message: `${label}: ${value.label ?? String(value.value)}`,
      source: ANALYSIS_SOURCE,
    }),
  );
};

/** The step control's model: the shown case's step, of how many, its label (null: no steps). */
export type ShownStep = { index: number; count: number; label: string };

/** The step a run shows, of a case run step by step; null for a case without steps. */
export const shownStep = (run: AnalysisRun | null): ShownStep | null => {
  const steps = shownCase(run)?.steps;
  if (!run || !steps?.length) return null;
  const index = Math.max(0, Math.min(run.step, steps.length - 1));
  return { index, count: steps.length, label: steps[index]!.label };
};

/** A run at another step (`delta` steps on, back when negative), kept within its case's steps. */
export const stepped = (run: AnalysisRun, delta: number): AnalysisRun => {
  const step = shownStep(run);
  return step
    ? {
        ...run,
        step: Math.max(0, Math.min(step.index + delta, step.count - 1)),
      }
    : run;
};

/** The case a run shows: the one picked, or its first. */
export const shownCase = (run: AnalysisRun | null): AnalysisCase | undefined =>
  run && 'result' in run
    ? (run.result.cases.find((c) => c.id === run.caseId) ?? run.result.cases[0])
    : undefined;

/** What an analysis reads of the project: its input kind's files (path → text), as the tabs hold them. */
export const analysisResource = (
  analysis: Pick<Analysis, 'input'>,
  slots: readonly ResourceSlot[],
  texts: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> | undefined => {
  if (!analysis.input) return undefined;
  const slot = slots.find((s) => s.kind === analysis.input);
  return Object.fromEntries(
    (slot?.paths ?? [])
      .filter((path) => texts[path] !== undefined)
      .map((path) => [path, texts[path]!]),
  );
};

/** Runs an analysis on a model text, read as its engine reads it (`readModel`: the view of its `GoalModel`). */
export const analyse = (
  id: string,
  analysis: Analysis,
  text: string,
  readModel: (model: IStarModel) => AnalysisModel,
  resource?: Readonly<Record<string, string>>,
): AnalysisRun => {
  const base = {
    analysis: id,
    label: analysis.label,
    text,
    caseId: null,
    step: 0,
  };
  let model;
  try {
    model = readModel(parseModel(text));
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return { ...base, ...runAnalysis(analysis, model, resource) };
};
