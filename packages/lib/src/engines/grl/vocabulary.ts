/**
 * GRL's words, as jUCMNav's metamodel (`grl.ecore`) has them, in its
 * literals' order (the algorithms index tables by it): what the importer
 * reads, the definition offers and the evaluation computes with.
 */

/** ContributionType: Make … Break (default Help) */
export const GRL_CONTRIBUTIONS = [
  'Make',
  'Help',
  'SomePositive',
  'Unknown',
  'SomeNegative',
  'Hurt',
  'Break',
] as const;
export type GrlContribution = (typeof GRL_CONTRIBUTIONS)[number];

/** ImportanceType (default None) */
export const GRL_IMPORTANCES = ['High', 'Medium', 'Low', 'None'] as const;
export type GrlImportance = (typeof GRL_IMPORTANCES)[number];

/** DecompositionType (default And) */
export const GRL_DECOMPOSITIONS = ['And', 'Or', 'Xor'] as const;
export type GrlDecomposition = (typeof GRL_DECOMPOSITIONS)[number];

/** QualitativeLabel (default None) */
export const GRL_QUALITATIVE_LABELS = [
  'Denied',
  'WeaklyDenied',
  'WeaklySatisfied',
  'Satisfied',
  'Conflict',
  'Unknown',
  'None',
] as const;
export type GrlQualitativeLabel = (typeof GRL_QUALITATIVE_LABELS)[number];

/**
 * iStar 2.0's contribution value (a piStar link's `label`) for a GRL
 * contribution: GRL's seven are kept as the `contribution` property;
 * Unknown has no iStar value, and is drawn as help.
 */
export const ISTAR_CONTRIBUTION_OF: Readonly<
  Record<GrlContribution, 'make' | 'help' | 'hurt' | 'break'>
> = {
  Make: 'make',
  Help: 'help',
  SomePositive: 'help',
  Unknown: 'help',
  SomeNegative: 'hurt',
  Hurt: 'hurt',
  Break: 'break',
};
