/**
 * An analysis engine's values on the model (goal-controller#107): what the
 * Analyse control runs, and how a result is drawn. The values go to the
 * canvas as istar-ts host diagnostics, keyed by the element's or actor's
 * piStar id, `info` (or the value's own severity) with the value as the
 * message: istar-ts 0.12 badges elements, actors and links with them. A
 * case that is a selection (a variant, goal-controller#152) dims the rest
 * of the diagram, and the case picker searches a run's many cases. Nothing
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
 * its value the message (`<case>: <value>`); a case run step by step, the
 * values of its step `step`, the value first and where it is after
 * (`<value> (<case>, <step>)`: the state is what a step shows).
 */
export const analysisDiagnostics = (
  analysisCase: AnalysisCase | undefined,
  step = 0,
): GoalDiagnostic[] => {
  if (!analysisCase) return [];
  const shown = analysisCase.steps?.length
    ? analysisCase.steps[Math.min(step, analysisCase.steps.length - 1)]
    : undefined;
  return Object.entries(shown?.values ?? analysisCase.values).map(
    ([elementId, value]) => {
      const written = value.label ?? String(value.value);
      return {
        elementId,
        severity: value.severity ?? 'info',
        message: shown
          ? `${written} (${analysisCase.label}, ${shown.label})`
          : `${analysisCase.label}: ${written}`,
        source: ANALYSIS_SOURCE,
      };
    },
  );
};

/** The attribute the canvas's container has while a selection is drawn (goal-controller#152). */
export const SELECTION_ATTRIBUTE = 'data-analysis-selection';

/** An id as a CSS string, for an attribute selector. */
const cssString = (id: string) => `"${id.replace(/["\\]/g, '\\$&')}"`;

/**
 * How the canvas draws a case that is a selection (goal-controller#152): a
 * stylesheet, under the container's SELECTION_ATTRIBUTE, that dims every
 * element and link the case doesn't select (its actors stay); null for a
 * case without one. The diagram's nodes and edges carry their piStar ids
 * (React Flow's `data-id`).
 */
export const selectionStyle = (
  analysisCase: AnalysisCase | undefined,
): string | null => {
  if (!analysisCase?.selection) return null;
  const scope = `[${SELECTION_ATTRIBUTE}]`;
  const all = `${scope} .react-flow__node.istar-node-element, ${scope} .react-flow__edge`;
  const kept = analysisCase.selection
    .flatMap((id) => [
      `${scope} .react-flow__node[data-id=${cssString(id)}]`,
      `${scope} .react-flow__edge[data-id=${cssString(id)}]`,
    ])
    .join(', ');
  return `${all} { opacity: 0.25; }${kept ? `\n${kept} { opacity: 1; }` : ''}`;
};

/** How many cases the picker lists at once: a run may have thousands (variants). */
export const PICKED_CASES = 100;

/** A case as the picker lists it: its label, and its summary after it. */
export const caseText = (analysisCase: AnalysisCase): string =>
  analysisCase.summary
    ? `${analysisCase.label} — ${analysisCase.summary}`
    : analysisCase.label;

/**
 * The cases the picker lists for what is typed in its search (every word,
 * in the label or the summary, any case), at most PICKED_CASES, and how many
 * match; the case shown is listed too, first, when it doesn't match.
 */
export const pickableCases = (
  cases: readonly AnalysisCase[],
  query: string,
  shown?: AnalysisCase,
): { cases: AnalysisCase[]; matching: number } => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matching = cases.filter((c) => {
    const text = caseText(c).toLowerCase();
    return words.every((word) => text.includes(word));
  });
  const listed = matching.slice(0, PICKED_CASES);
  return {
    cases: shown && !listed.includes(shown) ? [shown, ...listed] : listed,
    matching: matching.length,
  };
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

/** Runs an analysis on a model text, read as its engine reads it (`readModel`: the view of its `KindModel`). */
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
