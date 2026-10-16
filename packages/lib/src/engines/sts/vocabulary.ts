/**
 * STS-ml's words (Paja, Dalpiaz, Giorgini; DKE 2015, the v2.1 language
 * manual; goal-controller#160 D-R4, D-R5): the kinds and links the `sts`
 * extension adds to iStar 2.0, the property keys the dialect writes and the
 * analyses read, and the values each key takes.
 */

/** The kinds it adds: the information view's information and the social view's events. */
export const STS_KINDS = {
  /** what actors own and documents make tangible (`I1`), outside actors */
  information: 'sts.Information',
  /** what threatens actors' assets (`E1`), outside actors */
  event: 'sts.Event',
} as const;

/** The links it adds (D-R4): the social, information and authorisation views' relationships. */
export const STS_LINKS = {
  /** delegator's goal → the delegatee's copy of it */
  delegates: 'sts.DelegatesLink',
  /** sender's document → the receiver's copy of it */
  transmits: 'sts.TransmitsLink',
  /** goal → document of its actor, read to fulfil it */
  reads: 'sts.ReadsLink',
  /** goal → document of its actor, modified while fulfilling it */
  modifies: 'sts.ModifiesLink',
  /** goal → document of its actor, produced while fulfilling it */
  produces: 'sts.ProducesLink',
  /** actor → information it owns */
  owns: 'sts.OwnsLink',
  /** information → document that makes it tangible */
  tangibleBy: 'sts.TangibleByLink',
  /** part → whole: information → information, or document → document */
  partOf: 'sts.PartOfLink',
  /** event → goal, document or actor */
  threatens: 'sts.ThreatensLink',
  /** separation of duties: goal–goal or role–role, symmetric */
  incompatible: 'sts.IncompatibleLink',
  /** combination (binding) of duties: goal–goal or role–role, symmetric */
  combines: 'sts.CombinesLink',
  /** authoriser → authorisee: operations on information, in a scope */
  authorises: 'sts.AuthorisesLink',
} as const;

/** iStar's kinds the dialect reads. */
export const ISTAR = {
  role: 'istar.Role',
  agent: 'istar.Agent',
  goal: 'istar.Goal',
  /** a document: what actors possess, read, modify, produce and transmit */
  document: 'istar.Resource',
  and: 'istar.AndRefinementLink',
  or: 'istar.OrRefinementLink',
  /** an agent plays a role */
  plays: 'istar.ParticipatesInLink',
  /** a goal contributes (help: ++, hurt: −−) to another */
  contribution: 'istar.ContributionLink',
} as const;

/** The actor kinds: STS-ml's roles and agents. */
export const STS_ACTORS = [ISTAR.role, ISTAR.agent] as const;

/** The operations an authorisation grants or prohibits (DKE §3.1.3: R, M, P, T). */
export const OPERATIONS = ['read', 'modify', 'produce', 'transmit'] as const;
export type Operation = (typeof OPERATIONS)[number];

/** The property keys (D-R5). */
export const STS_KEYS = {
  // a goal delegation's security needs (DKE §3.2.1.1)
  noRedelegation: 'noRedelegation',
  nonRepudiation: 'nonRepudiation',
  redundancy: 'redundancy',
  trustworthiness: 'trustworthiness',
  availability: 'availability',
  authentication: 'authentication',
  // a document transmission's (DKE §3.2.1.2), with availability, authentication, nonRepudiation
  integrity: 'integrity',
  confidentiality: 'confidentiality',
  // both: the events that threaten the relationship (manual Fig. 16, IJSSE 2014 §4.1)
  threatenedBy: 'threatenedBy',
  // an authorisation's four dimensions (DKE §3.1.3)
  granted: 'granted',
  prohibited: 'prohibited',
  information: 'information',
  scope: 'scope',
  transferable: 'transferable',
  // any element's, as the tool's properties tab has it
  description: 'description',
} as const;

/** Non-repudiation over a delegation: of acceptance (R1, by the delegatee), of delegation (R2, by the delegator), or both. */
export const DELEGATION_NON_REPUDIATION = [
  'acceptance',
  'delegation',
  'delegationAcceptance',
] as const;
/** Non-repudiation over a transmission: of transfer (R12), of acceptance (R13), or both. */
export const TRANSMISSION_NON_REPUDIATION = [
  'transfer',
  'acceptance',
  'transferAcceptance',
] as const;
/** Redundancy (R3–R6): true or fallback, by one actor or several. */
export const REDUNDANCY = [
  'trueSingleActor',
  'trueMultiActor',
  'fallbackSingleActor',
  'fallbackMultiActor',
] as const;
/** Who authenticates for a delegation (R10, R11). */
export const DELEGATION_AUTHENTICATION = ['delegator', 'delegatee'] as const;
/** Who authenticates for a transmission (R18, R19). */
export const TRANSMISSION_AUTHENTICATION = ['sender', 'receiver'] as const;
/** Who ensures a transmission's integrity (R14–R16) or confidentiality (R20–R22). */
export const TRANSMISSION_PARTY = ['sender', 'receiver', 'system'] as const;
