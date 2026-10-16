/**
 * The kinds STS-ml has and iStar 2.0 doesn't (goal-controller#160 D-R4):
 * information and events, outside actors, and its relationships as link
 * kinds. A goal delegation joins the delegator's goal to the delegatee's
 * copy of it, and a transmission the sender's document to the receiver's,
 * as STS-Tool's own file does (a GoalReference, a DocumentReference); so
 * both cross actors. Ownership, authorisations, an event threatening an
 * actor and role-based separation or combination of duties have an actor
 * at an end. A model carries them in its `"metamodel"` block, which
 * istar-ts reads, draws and writes back.
 */
import {
  defineExtension,
  extensionKind,
  extensionLink,
} from '@goal-controller/dialect';
import { DASH, metamodelBlock } from '../metamodelBlock';
import { ISTAR, STS_ACTORS, STS_KINDS, STS_LINKS } from './vocabulary';

/** Information: a sheet with lines (the manual's Table 3 draws a text). */
const INFORMATION_SHAPE =
  'M 2 2 L 98 2 L 98 38 L 2 38 Z M 12 13 L 88 13 M 12 20 L 88 20 M 12 27 L 70 27';
/** An event: a hexagon. */
const EVENT_SHAPE = 'M 14 2 L 86 2 L 98 22 L 86 42 L 14 42 L 2 22 Z';

const GOAL_OR_ROLE = [ISTAR.goal, ISTAR.role];

/** a duty constraint: symmetric, between two goals or two roles, any actors' */
const DUTY_RULES = {
  sources: GOAL_OR_ROLE,
  targets: GOAL_OR_ROLE,
  sameActor: false,
  unique: 'any',
} as const;

/** a goal–document relationship within one actor (DKE Table 1) */
const GOAL_DOCUMENT_RULES = {
  sources: [ISTAR.goal],
  targets: [ISTAR.document],
  unique: 'kind',
} as const;

export const stsExtension = defineExtension({
  name: 'sts',
  label: 'STS-ml',
  elements: [
    extensionKind(STS_KINDS.information, {
      label: 'Information',
      category: 'node',
      size: { width: 100, height: 40 },
      shape: INFORMATION_SHAPE,
      textBox: { top: 0.1, right: 0.06, bottom: 0.1, left: 0.06 },
    }),
    extensionKind(STS_KINDS.event, {
      label: 'Event',
      category: 'node',
      size: { width: 100, height: 44 },
      shape: EVENT_SHAPE,
      textBox: { top: 0.15, right: 0.14, bottom: 0.15, left: 0.14 },
    }),
  ],
  links: [
    extensionLink(STS_LINKS.delegates, {
      label: 'delegates',
      // the delegatee's copy is in another actor
      rules: {
        sources: [ISTAR.goal],
        targets: [ISTAR.goal],
        sameActor: false,
        unique: 'kind',
      },
      line: { dash: 'continuous' },
    }),
    extensionLink(STS_LINKS.transmits, {
      label: 'transmits',
      rules: {
        sources: [ISTAR.document],
        targets: [ISTAR.document],
        sameActor: false,
        unique: 'kind',
      },
      line: { dash: 'continuous' },
    }),
    extensionLink(STS_LINKS.reads, {
      label: 'read',
      rules: GOAL_DOCUMENT_RULES,
      line: { dash: 'dashed' },
    }),
    extensionLink(STS_LINKS.modifies, {
      label: 'modify',
      rules: GOAL_DOCUMENT_RULES,
      line: { dash: 'dashed' },
    }),
    extensionLink(STS_LINKS.produces, {
      label: 'produce',
      rules: GOAL_DOCUMENT_RULES,
      line: { dash: 'dashed' },
    }),
    extensionLink(STS_LINKS.owns, {
      label: 'own',
      rules: {
        sources: [...STS_ACTORS],
        targets: [STS_KINDS.information],
        sameActor: false,
        unique: 'kind',
      },
      line: { dash: 'continuous' },
    }),
    extensionLink(STS_LINKS.tangibleBy, {
      label: 'tangible by',
      rules: {
        sources: [STS_KINDS.information],
        targets: [ISTAR.document],
        sameActor: false,
        unique: 'kind',
      },
      line: { dash: 'dotted' },
    }),
    extensionLink(STS_LINKS.partOf, {
      label: 'part of',
      // homogeneous (the manual's Table 3): a check says so
      rules: {
        sources: [STS_KINDS.information, ISTAR.document],
        targets: [STS_KINDS.information, ISTAR.document],
        sameActor: false,
        unique: 'kind',
      },
      line: { dash: 'dotted' },
    }),
    extensionLink(STS_LINKS.threatens, {
      label: 'threaten',
      rules: {
        sources: [STS_KINDS.event],
        targets: [ISTAR.goal, ISTAR.document, ...STS_ACTORS],
        sameActor: false,
        unique: 'kind',
      },
      line: { dash: 'dashed' },
    }),
    extensionLink(STS_LINKS.incompatible, {
      label: '≠',
      rules: DUTY_RULES,
      line: { dash: 'dotted' },
    }),
    extensionLink(STS_LINKS.combines, {
      label: '=',
      rules: DUTY_RULES,
      line: { dash: 'dotted' },
    }),
    extensionLink(STS_LINKS.authorises, {
      label: 'authorises',
      // several between two actors are allowed: duplicates are a warning
      // of the well-formedness analysis, not a drawing error
      rules: {
        sources: [...STS_ACTORS],
        targets: [...STS_ACTORS],
        sameActor: false,
        unique: false,
      },
      line: { dash: 'continuous' },
    }),
  ],
  groupers: {},
  stereotypes: [],
  taggedValues: [],
  defaultTags: [],
});

/** The kinds' file block (istar-ts's `"metamodel"`), shapes included. */
export const stsMetamodelBlock = () =>
  metamodelBlock(stsExtension, ({ line }) => {
    const dash = line && DASH[line.dash];
    return { ...(dash && { dash }) };
  });
