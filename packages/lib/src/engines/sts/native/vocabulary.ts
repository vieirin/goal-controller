/**
 * STS-Tool's `.sts` words (goal-controller#160, "The STS-Tool file format"):
 * an EMF XMI document, `<ststool:STSDiagram>` with a flat list of
 * `<elements xsi:type="ststool:…">` that reference each other by path
 * (`//@elements.N`), read from the three tutorial projects UniTN publishes
 * (sts-tool.eu/tutorials). The feature names are the tool's, misspellings
 * included (`resourceReaded`, `goalsModifing`, `threatedBy`).
 */

/** The model's namespace, as STS-Tool 2.x writes it. */
export const STS_NAMESPACE = 'http://sts-tool.eu/ststool/model/2.0.0';
export const STS_PREFIX = 'ststool';
export const STS_ROOT = `${STS_PREFIX}:STSDiagram`;

/** The diagram's header attributes besides its name, kept in the model's diagram properties. */
export const HEADER = ['author', 'revision', 'version', 'company'] as const;

/** STS-Tool's views, as `graphicalConstraints viewID` names them. */
export const VIEW = {
  social: 'it.unitn.disi.ststool.view.social',
  information: 'it.unitn.disi.ststool.view.information',
  authorization: 'it.unitn.disi.ststool.view.authorization',
} as const;

/** A security need's id, `elementNeedID`: this prefix and the need. */
export const NEED_PREFIX = 'it.unitn.disi.ststool.securityrequirements.';

/** The needs, as `elementNeedID` ends. */
export const NEED = {
  noDelegation: 'nodelegation',
  nonRepudiation: 'nonrepudiation',
  redundancy: 'redundancy',
  trustworthiness: 'trustworthiness',
  availability: 'availability',
  delegationAuthentication: 'authentication.delegation',
  transmissionAuthentication: 'authentication.transmission',
  integrity: 'integrity',
  confidentiality: 'confidentiality',
  noTransferability: 'notransferability',
} as const;

/** A need's typed values (`<properties name="type" value="…"/>`), as the dialect's options. */
export const NEED_TYPES: Readonly<Record<string, string>> = {
  acceptance: 'acceptance',
  delegation: 'delegation',
  'delegation-acceptance': 'delegationAcceptance',
  transfer: 'transfer',
  'transfer-acceptance': 'transferAcceptance',
  'true-single-actor': 'trueSingleActor',
  'true-multi-actor': 'trueMultiActor',
  'fallback-single-actor': 'fallbackSingleActor',
  'fallback-multi-actor': 'fallbackMultiActor',
  delegator: 'delegator',
  delegatee: 'delegatee',
  sender: 'sender',
  receiver: 'receiver',
  system: 'system',
};

/** The dialect's option back to the tool's value. */
export const TOOL_TYPES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(NEED_TYPES).map(([tool, option]) => [option, tool]),
);

/** An authorisation's operation attributes, by the dialect's operation. */
export const OPERATION_ATTRIBUTES = {
  read: 'read',
  modify: 'modification',
  produce: 'produce',
  transmit: 'transmit',
} as const;
export const AUTHORIZED = 'AUTHORIZED';
export const FORBIDDEN = 'FORBIDDEN';

/** The `elements` types, as `xsi:type` ends. */
export const TYPE = {
  role: 'Role',
  agent: 'Agent',
  goal: 'Goal',
  goalReference: 'GoalReference',
  document: 'Document',
  documentReference: 'DocumentReference',
  information: 'Information',
  event: 'Event',
  note: 'Note',
  decomposition: 'GoalDecomposition',
  read: 'Read',
  modify: 'Modify',
  produce: 'Produce',
  delegation: 'Delegation',
  delegationIn: 'DelegationIncomingLink',
  delegationOut: 'DelegationOutgoingLink',
  transmission: 'Transmission',
  transmissionIn: 'TransmissionIncomingLink',
  transmissionOut: 'TransmissionOutgoingLink',
  authorization: 'Authorization',
  authorizationIn: 'AuthorizationIncomingLink',
  authorizationOut: 'AuthorizationOutgoingLink',
  own: 'Own',
  tangibleBy: 'TangibleBy',
  partOf: 'PartOf',
  threat: 'Threat',
  play: 'Play',
  duty: 'DutyLink',
} as const;

/** A duty link's `type`: CoD written, SoD the default. */
export const COD = 'COD';
/** A decomposition's `type`: OR written, AND the default. */
export const OR = 'OR';
