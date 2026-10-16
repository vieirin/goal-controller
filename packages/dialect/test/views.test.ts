/**
 * A dialect's views (goal-controller#162): what each hides of one model, a
 * toy dialect's (no engine's) with a box kind of its extension and its feeds
 * links beside iStar's goals and refinements.
 */
import { expect } from 'chai';
import { defineDialect, viewHides, viewsOf, type AnyDialect } from '../src';
import { toy, toyDialect } from './support/toy';

const viewed = defineDialect({
  ...(structuredClone(toy) as AnyDialect),
  id: 'viewed',
  extension: toyDialect,
  views: {
    goals: {
      label: 'Goals',
      kinds: ['istar.Role', 'istar.Goal', 'istar.Task'],
    },
    feeds: {
      label: 'Feeds',
      kinds: ['istar.Role', 'istar.Goal', 'toyish.Box'],
      links: ['toyish.Feeds'],
      help: 'what the boxes feed',
    },
  },
});

const elements = [
  { id: 'r1', kind: 'istar.Role' },
  { id: 'g1', kind: 'istar.Goal' },
  { id: 't1', kind: 'istar.Task' },
  { id: 'b1', kind: 'toyish.Box' },
];
const links = [
  { id: 'and', kind: 'istar.AndRefinementLink', source: 't1', target: 'g1' },
  { id: 'feed', kind: 'toyish.Feeds', source: 'b1', target: 'g1' },
  { id: 'dep', kind: 'istar.DependencyLink', source: 'r1', target: 'g1' },
];

describe('views (#162)', () => {
  it('lists a dialect’s views in its order, none for one without', () => {
    expect(viewsOf(viewed).map(([id, view]) => [id, view.label])).to.deep.equal(
      [
        ['goals', 'Goals'],
        ['feeds', 'Feeds'],
      ],
    );
    expect(viewsOf(toy)).to.deep.equal([]);
    expect(viewsOf(undefined)).to.deep.equal([]);
  });

  it('hides the kinds a view doesn’t list, and the links to what it hides', () => {
    const goals = viewed.views.goals;
    // every link between shown ends: refinement and dependency; the box and its feed hidden
    expect(viewHides(goals, elements, links)).to.deep.equal(['b1', 'feed']);
  });

  it('hides the links a view’s link kinds don’t list, between shown ends too', () => {
    expect(viewHides(viewed.views.feeds, elements, links)).to.deep.equal([
      't1',
      'and',
      'dep',
    ]);
  });
});
