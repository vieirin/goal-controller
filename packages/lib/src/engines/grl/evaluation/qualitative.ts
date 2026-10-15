/**
 * jUCMNav's qualitative GRL evaluation (`QualitativeGRLStrategyAlgorithm`):
 * labels, not numbers. A decomposition takes its children's labels by an
 * order (AND: the worst, OR and XOR: the best); each contribution maps its
 * source's label through its type (`contribTable1`), and several combine by
 * how many weak and full ones of each sign there are (`contribTable2`); a
 * dependency caps the element at its dependees' lowest label; an actor
 * weighs its elements' labels by their importance. A label's value is its
 * number (Satisfied 100, Weakly satisfied 50, …). The tables are jUCMNav's,
 * transcribed. Not ported: the ST_Legal stereotype, aggregate contributions,
 * contribution contexts.
 */
import {
  GRL_CONTRIBUTIONS,
  GRL_IMPORTANCES,
  GRL_QUALITATIVE_LABELS,
  type GrlQualitativeLabel,
} from '../vocabulary';
import type { GrlPreferences } from '../strategies';
import type { GrlGraph, GrlNode } from './graph';
import {
  CONFLICT,
  DENIED,
  labelOf,
  NONE,
  SATISFIED,
  UNDECIDED,
  WEAKLY_DENIED,
  WEAKLY_SATISFIED,
  type Evaluation,
} from './propagation';

// QualitativeLabel's values, the tables' indices
const D = 0;
const WD = 1;
const WS = 2;
const S = 3;
const C = 4;
const U = 5;
const N = 6;

/** a source's label (row) through a contribution type (column: M, H+, s+, u, s-, H-, B) */
const CONTRIB_TABLE_1 = [
  [D, WD, WD, N, WS, WS, S], // D
  [WD, WD, WD, N, WS, WS, WS], // WD
  [WS, WS, WS, N, WD, WD, WD], // WS
  [S, WS, WS, N, WD, WD, D], // S
  [U, U, U, U, U, U, U], // C
  [U, U, U, U, U, U, U], // U
  [N, N, N, N, N, N, N], // N
];

/** two labels combined (a decomposition's with the contributions', weak with full ones) */
const CONTRIB_TABLE_2 = [
  [D, D, WD, C, C, U, D], // D
  [D, WD, N, WS, C, U, WD], // WD
  [WD, N, WS, S, C, U, WS], // WS
  [C, WS, S, S, C, U, S], // S
  [C, C, C, C, C, C, C], // C
  [U, U, U, U, C, U, U], // U
  [D, WD, WS, S, C, U, N], // N
];

/** each label's number */
const CONTRIB_MAP = [
  DENIED,
  WEAKLY_DENIED,
  WEAKLY_SATISFIED,
  SATISFIED,
  CONFLICT,
  UNDECIDED,
  NONE,
];

/** an element's label (column) weighted by its importance (row: high, medium, low, none) */
const IMPORTANCE_MAP = [
  [D, WD, WS, S, C, U, N], // high
  [WD, WD, WS, WS, C, U, N], // medium
  [WD, N, N, WS, C, U, N], // low
  [N, N, N, N, N, N, N], // none
];

/** DependencyQualitativeLabelComparitor: whether a label is below another (1), above (−1) or level */
const COMPARE_MAP = [
  [0, 1, 1, 1, 1, 1, 1], // D
  [-1, 0, 1, 1, -1, -1, 1], // WD
  [-1, -1, 0, 1, -1, -1, -1], // WS
  [-1, -1, -1, 0, -1, -1, -1], // S
  [-1, 1, 1, 1, 0, 1, 1], // C
  [-1, 1, 1, 1, -1, 0, 1], // U
  [-1, -1, 1, 1, -1, -1, 0], // N
];

const indexOf = (label: GrlQualitativeLabel): number =>
  GRL_QUALITATIVE_LABELS.indexOf(label);

/** getQualitativeContribution: the labels contributions bring, combined */
const combine = (sums: readonly number[], count: number): number => {
  if (count > 1) {
    const w1 = sums[WS]! > sums[WD]! ? WS : sums[WD]! > sums[WS]! ? WD : N;
    const w2 =
      sums[S]! > 0 && sums[D]! > 0
        ? C
        : sums[S]! > 0
          ? S
          : sums[D]! > 0
            ? D
            : N;
    const w3 = sums[C]! > 0 || sums[U]! > 0 ? U : -1;
    return w3 === -1 ? CONTRIB_TABLE_2[w1]![w2]! : w3;
  }
  let result = -1;
  sums.forEach((n, i) => {
    if (n > 0) result = i;
  });
  return result;
};

/** An element's value (a label's number), its sources evaluated (`getEvaluation`). */
export const qualitativeEvaluation =
  (graph: GrlGraph) =>
  (element: GrlNode, evaluations: ReadonlyMap<string, Evaluation>): number => {
    const own = evaluations.get(element.id)!;
    const incoming = graph.incoming.get(element.id) ?? [];
    if (!incoming.length || own.userDefined) return own.value;
    const labelOf = (id: string) =>
      indexOf(evaluations.get(id)?.label ?? 'None');
    let result = -1;
    let hasDecomposition = false;
    const decompositions = [0, 0, 0, 0, 0, 0, 0];
    const sums = [0, 0, 0, 0, 0, 0, 0];
    let contributions = 0;
    let dependencyMin: number | null = null;
    for (const edge of incoming) {
      if (edge.kind === 'decomposition') {
        hasDecomposition = true;
        decompositions[labelOf(edge.src)]!++;
      } else if (edge.kind === 'dependency') {
        // starts from the element's own label (its initial one)
        if (dependencyMin === null) dependencyMin = indexOf(own.label);
        const dependee = labelOf(edge.src);
        if (COMPARE_MAP[dependee]![dependencyMin]! > 0)
          dependencyMin = dependee;
      } else {
        const type = GRL_CONTRIBUTIONS.indexOf(edge.contribution);
        sums[CONTRIB_TABLE_1[labelOf(edge.src)]![type]!]!++;
        contributions++;
      }
    }
    if (hasDecomposition) {
      const [nd, nwd, nws, ns, nc, nu, nn] = decompositions as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      if (element.decompositionType === 'And')
        result =
          nd > 0
            ? D
            : nc > 0 || nu > 0
              ? U
              : nwd > 0
                ? WD
                : nn > 0
                  ? N
                  : nws > 0
                    ? WS
                    : ns > 0
                      ? S
                      : N;
      else if (ns > 0) result = S;
      else if (nc > 0 || nu > 0) result = U;
      else if (nws > 0) result = WS;
      else if (nn > 0) result = N;
      else if (nwd > 0) result = WD;
      else if (nd > 0) result = D;
    }
    if (contributions > 0 && result === -1)
      result = combine(sums, contributions);
    else if (contributions > 0)
      result = CONTRIB_TABLE_2[result]![combine(sums, contributions)]!;
    if (dependencyMin !== null) {
      const current = result !== -1 ? result : N;
      if (COMPARE_MAP[dependencyMin]![current]! > 0) result = dependencyMin;
    }
    return result !== -1 ? CONTRIB_MAP[result]! : 0;
  };

/** An actor's value: its elements' labels weighted by importance, combined as contributions are. */
export const qualitativeActorEvaluation = (
  graph: GrlGraph,
  actorId: string,
  evaluations: ReadonlyMap<string, Evaluation>,
  range: GrlPreferences['range'],
): number => {
  const actor = graph.actors.find((a) => a.id === actorId);
  if (!actor) return 0;
  const byId = new Map(graph.elements.map((e) => [e.id, e]));
  const sums = [0, 0, 0, 0, 0, 0, 0];
  let total = 0;
  for (const id of actor.elements) {
    const element = byId.get(id);
    if (!element) continue;
    const label = labelOf(evaluations.get(id)?.value ?? 0, range);
    if (!label) continue;
    const importance = GRL_IMPORTANCES.indexOf(element.importance);
    sums[IMPORTANCE_MAP[importance]![indexOf(label)]!]!++;
    total++;
  }
  const result = combine(sums, total);
  return result !== -1 ? CONTRIB_MAP[result]! : 0;
};
