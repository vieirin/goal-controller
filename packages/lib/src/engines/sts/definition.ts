/**
 * STS-ml (Paja, Dalpiaz, Giorgini; DISI Trento, 2011–2016; DKE 2015, the
 * v2.1 language manual, STS-Tool 2.x): actor- and goal-oriented security
 * requirements for socio-technical systems, over iStar 2.0
 * (goal-controller#163, plan and decisions in #160):
 *
 * - **Social view**: roles and agents (an agent plays a role), each with
 *   its goals (AND/OR refinement) and the documents it possesses (iStar's
 *   resources), which its goals read, modify and produce; goal delegations
 *   and document transmissions between actors, each annotated with the
 *   security needs the parties require; events threatening goals,
 *   documents and actors; separation and combination of duties between
 *   goals or roles.
 * - **Information view**: information, outside actors, owned by actors,
 *   made tangible by documents, structured by part-of.
 * - **Authorisation view**: authorisations between actors, each granting
 *   or prohibiting read, modify, produce and transmit on some information,
 *   in the scope of some of the authorisee's goals, transferable or not.
 *
 * A delegation joins the delegator's goal to the delegatee's copy of it,
 * a goal of the same name in the delegatee, and a transmission the
 * sender's document to the receiver's copy (#160 D-R4), as STS-Tool's file
 * does. Security needs are one key each on the relationship they annotate
 * (D-R5); the authorisation's needs are implied by its operations, scope
 * and transferability (DKE §3.2.2). The security analyses and the derived
 * requirements are green's (#161, ./analysis).
 *
 * - Ids: goals `G1`, documents `R1` (iStar's resource prefix), information
 *   `I1`, events `E1`.
 * - No notation: a decomposition is its refinement links.
 */
import {
  defineDialect,
  element,
  links,
  property,
  views,
} from '@goal-controller/dialect';
import type { StsCheckName } from './checks';
import { stsExtension } from './extension';
import { stsNativeFile } from './native';
import {
  DELEGATION_AUTHENTICATION,
  DELEGATION_NON_REPUDIATION,
  ISTAR,
  OPERATIONS,
  REDUNDANCY,
  STS_KEYS,
  STS_KINDS,
  STS_LINKS,
  TRANSMISSION_AUTHENTICATION,
  TRANSMISSION_NON_REPUDIATION,
  TRANSMISSION_PARTY,
} from './vocabulary';

const {
  bool,
  enum: choice,
  enumSet,
  int,
  refList,
  text,
} = property.for<StsCheckName>();

/** the istar-ts canvas's fill, as piStar */
const DEFAULT_FILL = '#CDFECD';

/** an option list with "not required" first */
const need = <const O extends readonly string[]>(options: O) =>
  [['', 'not required'], ...options] as const;

const description = text(STS_KEYS.description, {
  help: 'what it is, beyond its name (STS-Tool’s properties tab: names are short)',
});

const availability = (what: string) =>
  int(STS_KEYS.availability, {
    min: 0,
    max: 100,
    help: `availability (DKE R9, R17): the minimum availability level, in percent, ${what}`,
  });

const threatenedBy = (what: string) =>
  refList(STS_KEYS.threatenedBy, STS_KINDS.event, {
    help: `the events that threaten ${what} (the manual’s Fig. 16): a link can’t be a threat’s target, so the ${what.split(' ').pop()} names them`,
  });

const operations = (key: string, help: string) =>
  enumSet(key, OPERATIONS, { help, check: 'sts.authorisation.operations' });

export const sts = defineDialect({
  id: 'sts',
  name: 'STS-ml',
  // information and events; the relationships (./extension)
  extension: stsExtension,
  elements: {
    goal: element('G', { fill: DEFAULT_FILL }),
    // a document: STS-Tool's grey
    resource: element('R', { fill: '#BFBFBF' }),
    [STS_KINDS.information]: element('I', { fill: '#FFFFFF' }),
    [STS_KINDS.event]: element('E', { fill: '#F4B183' }),
  },
  defaultFill: DEFAULT_FILL,
  notation: {
    operand: { kinds: ['goal'] },
    operators: {},
    constructs: {
      and: {
        label: 'And',
        help: 'every subgoal is achieved (DKE Table 1, decomposes … and)',
        relation: 'and',
      },
      or: {
        label: 'Or',
        help: 'some subgoal is achieved (DKE Table 1, decomposes … or)',
        relation: 'or',
      },
    },
    defaultConstruct: { and: 'and', or: 'or' },
    // the papers' names are free text (`Write doc for I.O.`)
    names: 'text',
  },
  properties: {
    goal: [description],
    task: [],
    resource: [description],
    quality: [],
    [STS_KINDS.information]: [description],
    [STS_KINDS.event]: [description],
  },
  propertyLineOrder: [STS_KEYS.description],
  indent: '  ',
  links: links({
    [ISTAR.and]: [],
    [ISTAR.or]: [],
    [ISTAR.plays]: [],
    [ISTAR.contribution]: [],
    // a delegation's security needs (DKE §3.2.1.1, the manual's §2.1)
    [STS_LINKS.delegates]: [
      bool(STS_KEYS.noRedelegation, {
        help: 'no-redelegation (R7): the delegatee shall not delegate the goal, or any of its subgoals, further',
      }),
      choice(STS_KEYS.nonRepudiation, need(DELEGATION_NON_REPUDIATION), {
        help: 'non-repudiation (R1, R2): of acceptance (the delegatee can’t deny it accepted), of delegation (the delegator can’t deny it delegated), or both',
      }),
      choice(STS_KEYS.redundancy, need(REDUNDANCY), {
        help: 'redundancy (R3–R6): the delegatee achieves the goal in two or more ways, simultaneously (true) or as backups (fallback), alone (single actor) or with others (multi actor)',
      }),
      bool(STS_KEYS.trustworthiness, {
        help: 'trustworthiness (R8): the goal is delegated only to a trustworthy delegatee',
      }),
      availability('the delegatee guarantees for the goal'),
      choice(STS_KEYS.authentication, need(DELEGATION_AUTHENTICATION), {
        help: 'authentication (R10, R11): the delegator, or the delegatee, authenticates for the delegation',
      }),
      threatenedBy('this delegation'),
    ],
    // a transmission's (DKE §3.2.1.2)
    [STS_LINKS.transmits]: [
      choice(STS_KEYS.integrity, need(TRANSMISSION_PARTY), {
        help: 'integrity of transmission (R14–R16): who ensures the document isn’t altered while transmitted',
      }),
      choice(STS_KEYS.confidentiality, need(TRANSMISSION_PARTY), {
        help: 'confidentiality of transmission (R20–R22): who ensures the document isn’t disclosed while transmitted',
      }),
      availability('the sender guarantees for the document'),
      choice(STS_KEYS.authentication, need(TRANSMISSION_AUTHENTICATION), {
        help: 'authentication (R18, R19): the sender, or the receiver, authenticates for the transmission',
      }),
      choice(STS_KEYS.nonRepudiation, need(TRANSMISSION_NON_REPUDIATION), {
        help: 'non-repudiation (R12, R13): of the transfer (by the sender), of its acceptance (by the receiver), or both',
      }),
      threatenedBy('this transmission'),
    ],
    [STS_LINKS.reads]: [],
    [STS_LINKS.modifies]: [],
    [STS_LINKS.produces]: [],
    [STS_LINKS.owns]: [],
    [STS_LINKS.tangibleBy]: [],
    [STS_LINKS.partOf]: [],
    [STS_LINKS.threatens]: [],
    [STS_LINKS.incompatible]: [],
    [STS_LINKS.combines]: [],
    // an authorisation's four dimensions (DKE §3.1.3, Table 4); its
    // security needs are implied by them (§3.2.2)
    [STS_LINKS.authorises]: [
      operations(
        STS_KEYS.granted,
        'the operations it allows on documents making the information tangible: read, modify, produce, transmit (R, M, P, T)',
      ),
      operations(
        STS_KEYS.prohibited,
        'the operations it forbids (non-reading, non-modification, non-production, non-disclosure: R28–R31); one in neither list is left unspecified',
      ),
      refList(STS_KEYS.information, STS_KINDS.information, {
        required: 'always',
        help: 'the information it is over, at least one; its parts too (DKE §3.1.3)',
        check: 'sts.authorisation.information',
      }),
      refList(STS_KEYS.scope, 'goal', {
        help: 'the authorisee’s goals it is limited to, each with its subgoals (need-to-know, R27); none: any goal',
        check: 'sts.authorisation.scope',
      }),
      bool(STS_KEYS.transferable, {
        help: 'whether the authorisee may authorise others in turn (default true); false: non-reauthorisation (R32), the dashed line',
      }),
    ],
  }),
  // a root per actor, every actor's tree
  model: { actors: 'many', treesPerActor: 'many' },
  // the three views of one model (DKE §3.1, the manual's §2)
  views: views({
    social: {
      label: 'Social',
      kinds: [
        ISTAR.role,
        ISTAR.agent,
        ISTAR.goal,
        ISTAR.document,
        STS_KINDS.event,
      ],
      links: [
        ISTAR.and,
        ISTAR.or,
        ISTAR.plays,
        ISTAR.contribution,
        STS_LINKS.delegates,
        STS_LINKS.transmits,
        STS_LINKS.reads,
        STS_LINKS.modifies,
        STS_LINKS.produces,
        STS_LINKS.threatens,
        STS_LINKS.incompatible,
        STS_LINKS.combines,
      ],
      help: 'actors, their goals and documents, delegations, transmissions, threats and duties (DKE §3.1.1)',
    },
    information: {
      label: 'Information',
      kinds: [ISTAR.role, ISTAR.agent, ISTAR.document, STS_KINDS.information],
      links: [STS_LINKS.owns, STS_LINKS.tangibleBy, STS_LINKS.partOf],
      help: 'who owns which information, the documents that make it tangible, and its structure (DKE §3.1.2)',
    },
    authorisation: {
      label: 'Authorisation',
      kinds: [ISTAR.role, ISTAR.agent, STS_KINDS.information],
      links: [STS_LINKS.authorises, STS_LINKS.owns],
      help: 'the permissions and prohibitions actors pass on information (DKE §3.1.3)',
    },
  }),
  // STS-Tool's own file, read and written (#160 D-R9)
  nativeFiles: { sts: stsNativeFile },
  problems: {
    notAChild: { severity: 'error', message: 'Not a child of this element' },
    missingFromNotation: {
      severity: 'warning',
      message: 'Missing from the decomposition',
    },
    relationMismatch: {
      severity: 'error',
      message:
        '{construct} needs {needs} refinement links, but this goal is refined with {relation} links',
    },
    notInDiagram: {
      severity: 'error',
      message: 'Add this element in the diagram',
    },
  },
});
