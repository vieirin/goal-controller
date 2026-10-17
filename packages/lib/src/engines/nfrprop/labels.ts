/**
 * The NFR Framework's labels and how they propagate (Chung, Nixon, Yu and
 * Mylopoulos, Non-Functional Requirements in Software Engineering, 2000,
 * ch. 3, the evaluation procedure), goal-controller#171. A softgoal is
 * satisficed (✓), denied (✗), in conflict (⚡) or undecided (U); the
 * weak labels W+ and W− are what one contribution makes of its offspring's
 * label before the labels on a softgoal are combined.
 */

export const NFR_LABELS = [
  'satisficed',
  'weakly-satisficed',
  'undecided',
  'weakly-denied',
  'denied',
  'conflict',
] as const;
export type NfrLabel = (typeof NFR_LABELS)[number];

export const NFR_LABEL_SYMBOL: Readonly<Record<NfrLabel, string>> = {
  satisficed: '✓',
  'weakly-satisficed': 'W+',
  undecided: 'U',
  'weakly-denied': 'W−',
  denied: '✗',
  conflict: '⚡',
};

/** A contribution's type, by the label DSM3 writes on the link (`–` is U+2013). */
export type NfrContribution =
  | 'make'
  | 'help'
  | 'some+'
  | 'unknown'
  | 'some-'
  | 'hurt'
  | 'break';

export const NFR_CONTRIBUTION_OF: Readonly<Record<string, NfrContribution>> = {
  '++': 'make',
  '+': 'help',
  'some+': 'some+',
  unknown: 'unknown',
  'some-': 'some-',
  '–': 'hurt',
  '– –': 'break',
};

const POSITIVE = new Set<NfrContribution>(['make', 'help', 'some+']);

/**
 * What a contribution makes of its offspring's label, on its parent (Chung
 * et al.'s individual impact): from a satisficed offspring, MAKE satisfices,
 * HELP and SOME+ weakly satisfice, SOME− and HURT weakly deny, BREAK
 * denies; from a denied one, MAKE denies, HELP and SOME+ weakly deny, SOME−,
 * HURT and BREAK weakly satisfice. A conflict stays one, an undecided
 * offspring or an unknown contribution decides nothing. Chung et al. leave
 * a weak offspring label to the developer; here it propagates weakly, as in
 * Horkoff and Yu's automated forward propagation: W+ through a positive
 * contribution is W+, through a negative one W−, and W− the other way round.
 */
export const impact = (
  offspring: NfrLabel,
  contribution: NfrContribution,
): NfrLabel => {
  if (offspring === 'undecided' || contribution === 'unknown')
    return 'undecided';
  if (offspring === 'conflict') return 'conflict';
  const positive = POSITIVE.has(contribution);
  switch (offspring) {
    case 'satisficed':
      return contribution === 'make'
        ? 'satisficed'
        : contribution === 'break'
          ? 'denied'
          : positive
            ? 'weakly-satisficed'
            : 'weakly-denied';
    case 'denied':
      return contribution === 'make'
        ? 'denied'
        : positive
          ? 'weakly-denied'
          : 'weakly-satisficed';
    case 'weakly-satisficed':
      return positive ? 'weakly-satisficed' : 'weakly-denied';
    case 'weakly-denied':
      return positive ? 'weakly-denied' : 'weakly-satisficed';
  }
};

/** The order AND takes the least of, and OR the greatest. */
const RANK: Readonly<Record<NfrLabel, number>> = {
  denied: 0,
  'weakly-denied': 1,
  conflict: 2,
  undecided: 3,
  'weakly-satisficed': 4,
  satisficed: 5,
};

/** An AND refinement's label: its least offspring's; an OR's: its greatest's. */
export const refined = (
  relation: 'and' | 'or',
  offspring: readonly NfrLabel[],
): NfrLabel =>
  offspring.reduce((a, b) =>
    (relation === 'and' ? RANK[b] < RANK[a] : RANK[b] > RANK[a]) ? b : a,
  );

/**
 * The label the impacts on a softgoal give it (Chung et al.'s second step,
 * resolved without the developer): undecided ones decide nothing; a
 * conflict, or positive and negative impacts together, are a conflict;
 * positive ones satisfice if one does (else weakly), negative ones deny if
 * one does (else weakly).
 */
export const combined = (impacts: readonly NfrLabel[]): NfrLabel => {
  const decided = impacts.filter((label) => label !== 'undecided');
  if (decided.length === 0) return 'undecided';
  if (decided.includes('conflict')) return 'conflict';
  const positive = decided.filter(
    (label) => label === 'satisficed' || label === 'weakly-satisficed',
  );
  const negative = decided.filter(
    (label) => label === 'denied' || label === 'weakly-denied',
  );
  if (positive.length && negative.length) return 'conflict';
  if (positive.length)
    return positive.includes('satisficed') ? 'satisficed' : 'weakly-satisficed';
  return negative.includes('denied') ? 'denied' : 'weakly-denied';
};
