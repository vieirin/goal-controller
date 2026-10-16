/**
 * An STS-ml model as the analyses read it (goal-controller#161): the
 * social, information and authorisation views' concepts and relations (DKE
 * 2015 §3.1, Tables 1–4; IJSSE 2014 §4.1 for events), each by its piStar
 * id. A delegated goal and a transmitted document are elements of their
 * own in the receiver's model (`received`), the same goal or document as
 * the sender's (DKE Def. 3(3)(5)), linked to it by the delegation or
 * transmission. Nothing here reads a file: `readStsModel`
 * (./read) builds this from the dialect's model.
 */

/** An operation an authorisation grants or prohibits (DKE §3.1.3: R, M, P, T). */
export type Operation = 'read' | 'modify' | 'produce' | 'transmit';
export const OPERATIONS: readonly Operation[] = [
  'read',
  'modify',
  'produce',
  'transmit',
];

export type StsActor = { id: string; name: string; kind: 'role' | 'agent' };
export type StsGoal = { id: string; name: string; actor: string };
/** A document in an actor's model; `possessed`: it has it from scratch (DKE Table 1, possesses). */
export type StsDocument = {
  id: string;
  name: string;
  actor: string;
  possessed: boolean;
};
export type StsInformation = { id: string; name: string };

/** A goal's decomposition into its subgoals, by its links (DKE Table 1, decomposes). */
export type StsDecomposition = {
  goal: string;
  type: 'and' | 'or';
  subgoals: readonly string[];
  links: readonly string[];
};

/** A goal reading, modifying or producing a document of its actor (DKE Table 1). */
export type StsUse = {
  id: string;
  kind: 'read' | 'modify' | 'produce';
  goal: string;
  document: string;
};

/**
 * A goal delegation (DKE Table 2) of the delegator's goal, `received` the
 * delegatee's element for it, with the security needs expressed over it
 * (DKE §3.2.1.1: their names as the dialect writes them).
 */
export type StsDelegation = {
  id: string;
  from: string;
  to: string;
  goal: string;
  received?: string;
  needs: readonly string[];
  /** the availability level of R9, when given */
  availability?: string;
};

/** A document transmission (DKE Table 2) of the sender's document, `received` the receiver's. */
export type StsTransmission = {
  id: string;
  from: string;
  to: string;
  document: string;
  received?: string;
  needs: readonly string[];
  availability?: string;
};

/**
 * An authorisation (DKE Table 4): from an actor to another, over
 * information, in the scope of goals of the authorisee (none: every goal),
 * granting and prohibiting operations, transferable or not.
 */
export type StsAuthorisation = {
  id: string;
  from: string;
  to: string;
  information: readonly string[];
  scope: readonly string[];
  granted: readonly Operation[];
  prohibited: readonly Operation[];
  transferable: boolean;
};

export type StsOwnership = { id: string; actor: string; information: string };
/** Information made tangible by a document (DKE Table 3, makes-tangible). */
export type StsTangible = { id: string; information: string; document: string };
/** `part` is part of `whole`, both information or both documents (DKE Table 3). */
export type StsPartOf = {
  id: string;
  of: 'information' | 'document';
  part: string;
  whole: string;
};
export type StsPlay = { id: string; agent: string; role: string };
/** A separation (`sod`) or combination (`cod`) of duties between two goals or two roles (DKE §3.2.1.3). */
export type StsDuty = {
  id: string;
  type: 'sod' | 'cod';
  of: 'goal' | 'role';
  first: string;
  second: string;
};
export type StsContribution = {
  id: string;
  from: string;
  to: string;
  sign: '+' | '-';
};
export type StsEvent = { id: string; name: string };
/**
 * An event threatening an actor, goal or document (an element id), or a
 * delegation or transmission (a link id); `link`, the threatens link, when
 * the threat is drawn as one.
 */
export type StsThreat = { event: string; target: string; link?: string };

export type StsModel = {
  actors: readonly StsActor[];
  goals: readonly StsGoal[];
  documents: readonly StsDocument[];
  information: readonly StsInformation[];
  decompositions: readonly StsDecomposition[];
  uses: readonly StsUse[];
  delegations: readonly StsDelegation[];
  transmissions: readonly StsTransmission[];
  authorisations: readonly StsAuthorisation[];
  ownerships: readonly StsOwnership[];
  tangible: readonly StsTangible[];
  partOf: readonly StsPartOf[];
  plays: readonly StsPlay[];
  duties: readonly StsDuty[];
  contributions: readonly StsContribution[];
  events: readonly StsEvent[];
  threats: readonly StsThreat[];
};
