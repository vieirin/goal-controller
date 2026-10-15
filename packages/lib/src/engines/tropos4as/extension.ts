/**
 * The kinds Tropos4AS has and iStar 2.0 doesn't (goal-controller#134 D2):
 * the environment's artifacts its conditions read, and the failure model,
 * failures, errors and symptoms, with the links between them and the
 * inter-goal relationships inhibition and sequence. iStar 2011's *Empirical
 * Evaluation of Tropos4AS Modelling*, Fig. 1, draws them: an artifact a
 * box, a failure a star, an error an oval its recovery plans are the means
 * to. A model carries them in its `"metamodel"` block, which istar-ts
 * reads, draws and writes back.
 */
import {
  defineExtension,
  extensionKind,
  extensionLink,
} from '@goal-controller/dialect';
import { DASH, metamodelBlock } from '../metamodelBlock';
import { TROPOS4AS_KINDS, TROPOS4AS_LINKS } from './vocabulary';

/** An artifact: a box. */
const ARTIFACT_SHAPE = 'M 2 2 L 98 2 L 98 38 L 2 38 Z';
/** A failure: a ten-pointed star (Fig. 1's). */
const FAILURE_SHAPE = (() => {
  const points = Array.from({ length: 20 }, (_, i) => {
    const angle = (Math.PI * i) / 10 - Math.PI / 2;
    const r = i % 2 ? 0.55 : 1;
    return `${(50 + 48 * r * Math.cos(angle)).toFixed(1)} ${(30 + 28 * r * Math.sin(angle)).toFixed(1)}`;
  });
  return `M ${points.join(' L ')} Z`;
})();
/** An error: an oval. */
const ERROR_SHAPE = 'M 2 22 A 48 20 0 1 0 98 22 A 48 20 0 1 0 2 22 Z';
/** A symptom: a diamond. */
const SYMPTOM_SHAPE = 'M 50 2 L 98 22 L 50 42 L 2 22 Z';

/** the kinds a goal's lifecycle links join: goals, and errors (adopted as goals) */
const GOALS = ['istar.Goal', TROPOS4AS_KINDS.error];

export const tropos4asExtension = defineExtension({
  name: 'tropos4as',
  label: 'Tropos4AS',
  elements: [
    extensionKind(TROPOS4AS_KINDS.artifact, {
      label: 'Artifact',
      category: 'node',
      size: { width: 100, height: 40 },
      shape: ARTIFACT_SHAPE,
      textBox: { top: 0.1, right: 0.06, bottom: 0.1, left: 0.06 },
    }),
    extensionKind(TROPOS4AS_KINDS.failure, {
      label: 'Failure',
      category: 'node',
      size: { width: 100, height: 60 },
      shape: FAILURE_SHAPE,
      textBox: { top: 0.3, right: 0.25, bottom: 0.3, left: 0.25 },
    }),
    extensionKind(TROPOS4AS_KINDS.error, {
      label: 'Error',
      // a means-end (a refinement from its recovery task) reaches it as a goal
      behavesLike: 'istar.Goal',
      size: { width: 100, height: 44 },
      shape: ERROR_SHAPE,
      textBox: { top: 0.15, right: 0.12, bottom: 0.15, left: 0.12 },
    }),
    extensionKind(TROPOS4AS_KINDS.symptom, {
      label: 'Symptom',
      category: 'node',
      size: { width: 100, height: 44 },
      shape: SYMPTOM_SHAPE,
      textBox: { top: 0.25, right: 0.22, bottom: 0.25, left: 0.22 },
    }),
  ],
  links: [
    extensionLink(TROPOS4AS_LINKS.inhibits, {
      label: 'inhibits',
      rules: { sources: GOALS, targets: GOALS, unique: 'kind' },
      line: { dash: 'dashed' },
    }),
    extensionLink(TROPOS4AS_LINKS.sequence, {
      label: 'seq',
      rules: { sources: GOALS, targets: GOALS, unique: 'kind' },
      line: { dash: 'dashed' },
    }),
    extensionLink(TROPOS4AS_LINKS.failure, {
      label: 'failure',
      rules: {
        sources: GOALS,
        targets: [TROPOS4AS_KINDS.failure],
        unique: 'kind',
      },
      line: { dash: 'dotted' },
    }),
    extensionLink(TROPOS4AS_LINKS.error, {
      label: 'error',
      rules: {
        sources: [TROPOS4AS_KINDS.error],
        targets: [TROPOS4AS_KINDS.failure],
        unique: 'kind',
      },
      line: { dash: 'continuous' },
    }),
    extensionLink(TROPOS4AS_LINKS.reads, {
      label: 'reads',
      rules: {
        sources: [TROPOS4AS_KINDS.artifact],
        targets: GOALS,
        unique: 'kind',
      },
      line: { dash: 'dashed' },
    }),
    extensionLink(TROPOS4AS_LINKS.symptom, {
      label: 'symptom',
      rules: {
        sources: [TROPOS4AS_KINDS.symptom],
        targets: [TROPOS4AS_KINDS.failure],
        unique: 'kind',
      },
      line: { dash: 'dotted' },
    }),
  ],
  groupers: {},
  stereotypes: [],
  taggedValues: [],
  defaultTags: [],
});

/** The kinds' file block (istar-ts's `"metamodel"`), shapes included. */
export const tropos4asMetamodelBlock = () =>
  metamodelBlock(tropos4asExtension, ({ line }) => {
    const dash = line && DASH[line.dash];
    return { ...(dash && { dash }) };
  });
