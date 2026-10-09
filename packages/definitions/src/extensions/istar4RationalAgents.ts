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
      size: { width: 100, height: 40 },
      // an arrow, notched at the back, like Fig. 4's (whose path data is cut off)
      shape: 'M 0 0 L 80 0 L 100 20 L 80 40 L 0 40 L 14 20 Z',
    },
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
