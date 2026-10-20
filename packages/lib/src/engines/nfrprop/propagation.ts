/**
 * nfrprop's analysis (goal-controller#171): the NFR Framework's label
 * propagation over a softgoal interdependency graph (Chung et al. 2000,
 * ch. 3; the rules in ./labels). Each element's label is its initial label
 * when it has one, else what its offspring make of it: its AND or OR
 * refinement's, combined with its contributions' and correlations'
 * impacts. A contribution a claim argues stands while every claim on it is
 * held, is set aside when one is denied, and decides nothing while one is
 * undecided. A cycle decides nothing where it closes.
 *
 * The result is one case, its labels drawn on the model, run as steps: one
 * per element, in the order the propagation labels them, each saying why
 * (the propagation report).
 */
import type {
  AnalysisLink,
  AnalysisModel,
  AnalysisResult,
  AnalysisStep,
  AnalysisValue,
} from '../analysis';
import {
  combined,
  impact,
  NFR_CONTRIBUTION_OF,
  NFR_LABEL_SYMBOL,
  NFR_LABELS,
  refined,
  type NfrLabel,
} from './labels';

const REFINEMENTS: Readonly<Record<string, 'and' | 'or'>> = {
  'nfr.AndRefinementLink': 'and',
  'nfr.OrRefinementLink': 'or',
};
const CONTRIBUTIONS = new Set(['nfr.ContributionLink', 'nfr.CorrelationLink']);
const ARGUMENT = 'nfr.ArgumentLink';
/** the kinds whose unset label, with nothing contributing, is satisficed */
const CHOSEN = new Set(['nfr.Operationalization', 'nfr.Claim']);

const isLabel = (value: string | undefined): value is NfrLabel =>
  (NFR_LABELS as readonly string[]).includes(value ?? '');

/** A label on the model: its word, shown with its symbol; denied or conflicting, a warning. */
export const labelValue = (label: NfrLabel): AnalysisValue => ({
  value: label,
  label: `${NFR_LABEL_SYMBOL[label]} ${label.replace('-', ' ')}`,
  ...((label === 'denied' ||
    label === 'weakly-denied' ||
    label === 'conflict') && { severity: 'warning' }),
});

/** Every element's label, and the steps that gave them, in order. */
export const propagateLabels = (
  model: AnalysisModel,
): {
  labels: ReadonlyMap<string, NfrLabel>;
  steps: readonly { id: string; label: NfrLabel; why: string }[];
} => {
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const nameOf = (id: string) => elements.get(id)?.name.trim() ?? id;
  const into = (id: string) => model.links.filter((l) => l.target === id);
  const labels = new Map<string, NfrLabel>();
  const steps: { id: string; label: NfrLabel; why: string }[] = [];
  const visiting = new Set<string>();

  const settle = (id: string, label: NfrLabel, why: string): NfrLabel => {
    labels.set(id, label);
    steps.push({ id, label, why });
    return label;
  };

  /** A contribution's impact, and why, its claims considered. */
  const impactOf = (link: AnalysisLink): [NfrLabel, string] => {
    const contribution = NFR_CONTRIBUTION_OF[link.label ?? ''] ?? 'unknown';
    const claims = model.links
      .filter((l) => l.kind === ARGUMENT && l.target === link.id)
      .map((l) => [l.source, labelOf(l.source)] as const);
    const from = `${link.label ?? '?'} from ${nameOf(link.source)}`;
    const denied = claims.find(
      ([, l]) => l === 'denied' || l === 'weakly-denied',
    );
    if (denied)
      return [
        'undecided',
        `${from} set aside (claim ${nameOf(denied[0])} ${denied[1]})`,
      ];
    const open = claims.find(([, l]) => l === 'undecided' || l === 'conflict');
    if (open)
      return [
        'undecided',
        `${from} undecided (claim ${nameOf(open[0])} ${open[1]})`,
      ];
    const offspring = labelOf(link.source);
    const label = impact(offspring, contribution);
    return [
      label,
      `${from} (${NFR_LABEL_SYMBOL[offspring]}): ${NFR_LABEL_SYMBOL[label]}${
        claims.length
          ? `, argued by ${claims.map(([c]) => nameOf(c)).join(', ')}`
          : ''
      }`,
    ];
  };

  const labelOf = (id: string): NfrLabel => {
    const known = labels.get(id);
    if (known) return known;
    const element = elements.get(id);
    if (!element) return 'undecided';
    // its entry's: the mapper keeps a label only (goal-controller#226)
    const initial = element.properties.initialLabel;
    if (isLabel(initial)) return settle(id, initial, 'its initial label');
    // a cycle decides nothing where it closes
    if (visiting.has(id)) return 'undecided';
    visiting.add(id);
    const links = into(id);
    const refinements = links.filter((l) => REFINEMENTS[l.kind]);
    const contributions = links.filter((l) => CONTRIBUTIONS.has(l.kind));
    const reasons: string[] = [];
    const impacts: NfrLabel[] = [];
    if (refinements.length) {
      const relation = REFINEMENTS[refinements[0]!.kind]!;
      const offspring = refinements.map((l) => labelOf(l.source));
      const label = refined(relation, offspring);
      impacts.push(label);
      reasons.push(
        `${relation.toUpperCase()} of ${refinements
          .map(
            (l, i) =>
              `${nameOf(l.source)} (${NFR_LABEL_SYMBOL[offspring[i]!]})`,
          )
          .join(', ')}: ${NFR_LABEL_SYMBOL[label]}`,
      );
    }
    for (const link of contributions) {
      const [label, why] = impactOf(link);
      impacts.push(label);
      reasons.push(why);
    }
    visiting.delete(id);
    if (impacts.length === 0)
      return CHOSEN.has(element.kind)
        ? settle(id, 'satisficed', 'chosen: nothing contributes to it')
        : settle(id, 'undecided', 'nothing contributes to it');
    return settle(id, combined(impacts), reasons.join('; '));
  };

  for (const element of model.elements)
    if (element.kind.startsWith('nfr.')) labelOf(element.id);
  return { labels, steps };
};

/** The propagation as an analysis result: one case, a step per element labelled. */
export const runPropagation = (model: AnalysisModel): AnalysisResult => {
  const { labels, steps } = propagateLabels(model);
  const nameOf = (id: string) =>
    model.elements.find((e) => e.id === id)?.name.trim() ?? id;
  const values: Record<string, AnalysisValue> = {};
  const series: AnalysisStep[] = steps.map(({ id, label, why }) => {
    values[id] = labelValue(label);
    return {
      label: `${nameOf(id)}: ${NFR_LABEL_SYMBOL[label]} ${label} (${why})`,
      values: { ...values },
    };
  });
  return {
    cases: [
      {
        id: 'labels',
        label: 'Labels',
        values: Object.fromEntries(
          [...labels].map(([id, label]) => [id, labelValue(label)]),
        ),
        steps: series,
      },
    ],
  };
};
