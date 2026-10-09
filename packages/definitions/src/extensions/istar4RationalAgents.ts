import { defineExtension } from '../schema';

/**
 * iStar4RationalAgents, the dialect piStar-ext was demonstrated with
 * (Gonçalves et al., "piStar-ext: Supporting the Creation of iStar Extensions
 * with the piStar Tool", iStar 2020, Figs. 1, 3 and 4).
 *
 * - **Planning** and **Plan** are new node constructs. Planning is "the
 *   creation of a sequence of tasks by an agent", so it follows Task's rules.
 *   It is saved as `istar.Planning`, as piStar-ext saves it.
 *   Plan's rules and symbol aren't in the paper: here it is a plain node,
 *   drawn as piStar-ext draws a construct without a shape (a dashed «Plan» box).
 * - The paper declares no new link.
 * - The rational grouper (Actor, Role; Figs. 3-D and 4 apply goal-based to an
 *   Agent too) carries the agent-kind stereotypes. Tasks carry the stereotype
 *   `action` and the tagged value `type`, which is either duty (a mandatory
 *   task) or right (an optional one).
 */
export const istar4RationalAgents = defineExtension({
  name: 'rationalAgents',
  label: 'iStar4RationalAgents',
  elements: [
    {
      kind: 'rationalAgents.Planning',
      behavesLike: 'istar.Task',
      pistarType: 'istar.Planning',
      // piStar-ext's size for a new node
      size: { width: 90, height: 55 },
      // Fig. 4's: a task's pointed left side, and an arrow out of its right
      // side. The repository ships no construct (they live in the browser's
      // localStorage) and the figure's dialog cuts the path data off: its
      // visible start is kept as written, the rest follows the drawn outline.
      shape:
        'M 9.1814481,1.0179789 H 65.503448 L 65.025854,14.532293 72.4491,14.819567 73.29006,4.9 85.2,19.8 73.29006,30.6 72.4491,22.6 65.025854,22.6 65.503448,38.6 H 9.1814481 L 1,19.8 Z',
    },
    // its symbol isn't shown in the paper: piStar-ext's default for a new node
    // without one (a dashed box), as istar-ts draws it
    { kind: 'rationalAgents.Plan', category: 'node' },
  ],
  links: [],
  groupers: { rational: ['istar.Actor', 'istar.Agent', 'istar.Role'] },
  stereotypes: [
    { name: 'simple-reflex', appliesTo: ['rational'] },
    { name: 'model-based reflex', appliesTo: ['rational'] },
    { name: 'goal-based', appliesTo: ['rational'] },
    { name: 'utility-based', appliesTo: ['rational'] },
    // an agent's action (the paper's [14])
    { name: 'action', appliesTo: ['istar.Task'] },
  ],
  taggedValues: [
    { name: 'type', appliesTo: ['istar.Task'], values: ['duty', 'right'] },
  ],
  // the paper's defaults (its [4]): node identifier, reference, status, logic
  defaultTags: ['Id', 'Reference to', 'Status', 'Logic'],
  annotations: {
    // `<<goal-based>>`
    stereotype: {
      delimiters: ['<<', '>>'],
      parts: [{ key: 'stereotype', pattern: '[^<>]*[^<>\\s]' }],
    },
    // `{Id = G1}`, and piStar-ext's own `{Id=G1}`
    taggedValue: {
      delimiters: ['{', '}'],
      parts: [
        { key: 'tag', pattern: '[^{}=]*[^{}=\\s]' },
        {
          optional: [
            { literal: ' = ' },
            { key: 'tagValue', pattern: '[^{}]*[^{}\\s]' },
          ],
        },
      ],
    },
  },
});
