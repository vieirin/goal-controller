/**
 * STS-ml's derived security requirements (goal-controller#161 item 3; DKE
 * §3.2). Each security need one actor expresses towards another gives one
 * requirement in the opposite direction: the responsible actor must comply
 * with it, for the requester. The NESSoS chapter's Table 1 and the
 * reports' Table 14 print them as rows of a responsible actor, a
 * requirement with its arguments, and a requester. Organisational
 * constraints bind all agents, at the organisation's request (NESSoS Table
 * 1: "All Agents", "Org").
 */
import type { StsIndex } from './graph';
import type { Operation } from './model';

export const ALL_AGENTS = '(all agents)';
export const ORGANISATION = '(organisation)';
/** The socio-technical system itself (DKE R16, R22: "the system shall ensure"). */
export const SYSTEM = '(system)';

export type StsRequirement = {
  /** DKE Fig. 4's name: `no-redelegation`, `need-to-know`, … */
  requirement: string;
  /** DKE's number, R1–R32 */
  number: number;
  responsible: string;
  requester: string;
  /** what it is over, by piStar id: `goal`, `document`, `information` (comma-separated), `goals`, `level` */
  over: Readonly<Record<string, string>>;
  /** the link it is expressed on */
  link: string;
};

/** A need on a delegation: its requirement, its number, whether the delegator (not the delegatee) is responsible. */
const DELEGATION: Record<string, [string, number, boolean]> = {
  nonRepudiationOfDelegation: ['non-repudiation-of-delegation', 1, true],
  nonRepudiationOfAcceptance: ['non-repudiation-of-acceptance', 2, false],
  trueRedundancySingle: ['true-redundancy-single', 3, false],
  fallbackRedundancySingle: ['fallback-redundancy-single', 4, false],
  trueRedundancyMulti: ['true-redundancy-multi', 5, false],
  fallbackRedundancyMulti: ['fallback-redundancy-multi', 6, false],
  noRedelegation: ['no-redelegation', 7, false],
  trustworthiness: ['trustworthiness', 8, false],
  availability: ['goal-availability', 9, false],
  delegatorAuthentication: ['delegator-authentication', 10, true],
  delegateeAuthentication: ['delegatee-authentication', 11, false],
};

/** A need on a transmission: its requirement, its number, who is responsible. */
const TRANSMISSION: Record<
  string,
  [string, number, 'sender' | 'receiver' | 'system']
> = {
  nonRepudiationOfTransfer: ['non-repudiation-of-transfer', 12, 'sender'],
  nonRepudiationOfAcceptance: ['non-repudiation-of-acceptance', 13, 'receiver'],
  senderIntegrity: ['sender-integrity', 14, 'sender'],
  receiverIntegrity: ['receiver-integrity', 15, 'receiver'],
  systemIntegrity: ['system-integrity', 16, 'system'],
  availability: ['document-availability', 17, 'sender'],
  senderAuthentication: ['sender-authentication', 18, 'sender'],
  receiverAuthentication: ['receiver-authentication', 19, 'receiver'],
  senderConfidentiality: ['sender-confidentiality', 20, 'sender'],
  receiverConfidentiality: ['receiver-confidentiality', 21, 'receiver'],
  systemConfidentiality: ['system-confidentiality', 22, 'system'],
};

/** A prohibited operation's requirement (DKE §3.2.2). */
const PROHIBITION: Record<Operation, [string, number]> = {
  read: ['non-reading', 28],
  modify: ['non-modification', 29],
  produce: ['non-production', 30],
  transmit: ['non-disclosure', 31],
};

/** Every requirement the model's security needs give, in the model's order of their links. */
export const securityRequirements = (index: StsIndex): StsRequirement[] => {
  const { model } = index;
  const delegations = model.delegations.flatMap((d) =>
    d.needs.flatMap((need) => {
      const known = DELEGATION[need];
      if (!known) return [];
      const [requirement, number, delegator] = known;
      return [
        {
          requirement,
          number,
          responsible: delegator ? d.from : d.to,
          requester: delegator ? d.to : d.from,
          over: {
            goal: d.goal,
            ...(need === 'availability' &&
              d.availability !== undefined && { level: d.availability }),
          },
          link: d.id,
        },
      ];
    }),
  );
  const transmissions = model.transmissions.flatMap((t) =>
    t.needs.flatMap((need) => {
      const known = TRANSMISSION[need];
      if (!known) return [];
      const [requirement, number, who] = known;
      return [
        {
          requirement,
          number,
          responsible:
            who === 'system' ? SYSTEM : who === 'sender' ? t.from : t.to,
          requester:
            who === 'system' ? ORGANISATION : who === 'sender' ? t.to : t.from,
          over: {
            document: t.document,
            ...(need === 'availability' &&
              t.availability !== undefined && { level: t.availability }),
          },
          link: t.id,
        },
      ];
    }),
  );
  const authorisations = model.authorisations.flatMap((a) => {
    const over = { information: a.information.join(',') };
    const row = (requirement: string, number: number, more = {}) => ({
      requirement,
      number,
      responsible: a.to,
      requester: a.from,
      over: { ...over, ...more },
      link: a.id,
    });
    return [
      ...(a.scope.length
        ? [row('need-to-know', 27, { goals: a.scope.join(',') })]
        : []),
      ...a.prohibited.map((op) => row(...PROHIBITION[op])),
      ...(!a.transferable && a.granted.length
        ? [row('non-reauthorisation', 32)]
        : []),
    ];
  });
  const duties = model.duties.map((duty) => {
    const [requirement, number] =
      duty.of === 'role'
        ? duty.type === 'sod'
          ? ['role-sod', 23]
          : ['role-cod', 25]
        : duty.type === 'sod'
          ? ['goal-sod', 24]
          : ['goal-cod', 26];
    return {
      requirement: requirement as string,
      number: number as number,
      responsible: ALL_AGENTS,
      requester: ORGANISATION,
      over: { first: duty.first, second: duty.second },
      link: duty.id,
    };
  });
  return [...delegations, ...transmissions, ...authorisations, ...duties];
};
