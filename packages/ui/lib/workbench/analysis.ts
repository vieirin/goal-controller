/**
 * An analysis engine's values on the model (goal-controller#107): what the
 * Analyse control runs, and how a result is drawn. The values go to the
 * canvas as istar-ts host diagnostics, keyed by the element's or actor's
 * piStar id, `info` (or the value's own severity) with the value as the
 * message: istar-ts 0.12 badges elements, actors and links with them. A
 * case that is a selection (a variant, goal-controller#152) dims the rest
 * of the diagram, and the case picker searches a run's many cases. A case's
 * findings (goal-controller#162) badge the elements and links they
 * involve, and a finding picked is drawn as a selection. Nothing
 * runs without a click, and results are never written to the model file.
 */
import type { GoalDiagnostic } from '@istar-ts/core';
import {
  runAnalysis,
  type Analysis,
  type AnalysisCase,
  type AnalysisFinding,
  type AnalysisModel,
  type AnalysisResult,
} from '@goal-controller/lib';
import type { ResourceSlot } from '@/lib/project';
import { partSelectors } from './canvasStyle';
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
  /** the finding picked, of the case shown (goal-controller#162): its index; none, null */
  finding?: number | null;
} & ({ result: AnalysisResult } | { error: string });

/** A finding as the picker and a badge show it: `<kind>: <message>`. */
export const findingLabel = (finding: AnalysisFinding): string =>
  `${finding.kind}: ${finding.message}`;

/**
 * A case's findings as the canvas's diagnostics (goal-controller#162): one
 * per finding and element, actor or link it involves, the finding's
 * severity, its kind and message the diagnostic's message.
 */
const findingDiagnostics = (
  findings: readonly AnalysisFinding[],
): GoalDiagnostic[] =>
  findings.flatMap((finding) =>
    [...new Set([...finding.elements, ...finding.links])].map((elementId) => ({
      elementId,
      severity: finding.severity,
      message: findingLabel(finding),
      source: ANALYSIS_SOURCE,
    })),
  );

/**
 * A case's values as the canvas's diagnostics: one per element or actor,
 * its value the message (`<case>: <value>`); a case run step by step, the
 * values of its step `step`, the value first and where it is after
 * (`<value> (<case>, <step>)`: the state is what a step shows). Its
 * findings follow (goal-controller#162).
 */
export const analysisDiagnostics = (
  analysisCase: AnalysisCase | undefined,
  step = 0,
): GoalDiagnostic[] => {
  if (!analysisCase) return [];
  return [
    ...valueDiagnostics(analysisCase, step),
    ...findingDiagnostics(analysisCase.findings ?? []),
  ];
};

const valueDiagnostics = (
  analysisCase: AnalysisCase,
  step: number,
): GoalDiagnostic[] => {
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

/**
 * How the canvas draws a case that is a selection (goal-controller#152): a
 * stylesheet, under the container's SELECTION_ATTRIBUTE, that dims every
 * element and link the case doesn't select (its actors stay); null for a
 * case without one. A finding picked (`finding`, its index,
 * goal-controller#162) is drawn so instead: what it involves is kept; one
 * that involves nothing (the model's as a whole) dims nothing. The
 * diagram's nodes and edges carry their piStar ids (React Flow's
 * `data-id`).
 */
export const selectionStyle = (
  analysisCase: AnalysisCase | undefined,
  finding: number | null = null,
): string | null => {
  const picked =
    finding === null ? undefined : analysisCase?.findings?.[finding];
  const selection = picked
    ? [...picked.elements, ...picked.links]
    : analysisCase?.selection;
  // a finding that involves nothing (the model's as a whole) selects nothing
  if (!selection || (picked && !selection.length)) return null;
  const scope = `[${SELECTION_ATTRIBUTE}]`;
  const all = `${scope} .react-flow__node.istar-node-element, ${scope} .react-flow__edge`;
  const kept = partSelectors(SELECTION_ATTRIBUTE, selection);
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

/** The finding a run picks, of the case it shows (goal-controller#162): its index, or null. */
export const shownFinding = (run: AnalysisRun | null): number | null => {
  const findings = shownCase(run)?.findings ?? [];
  return run?.finding != null && run.finding < findings.length
    ? run.finding
    : null;
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
    finding: null,
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
