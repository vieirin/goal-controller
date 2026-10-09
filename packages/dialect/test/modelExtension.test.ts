/** What a model adds to its dialect, read with it (src/derive/modelExtension.ts). */
import { expect } from 'chai';
import {
  extensionCatalog,
  isEmptyModelExtension,
  metamodelExtensionOf,
  modelExtensionKinds,
  newLinkKind,
  newNodeKind,
  profileOf,
  takenName,
  withModelExtension,
  type ExtensionDefinition,
} from '../src';
import { toyDialect } from './support/toy';

const dialect = toyDialect as ExtensionDefinition;

describe('model extensions', () => {
  const mission = newNodeKind('Mission', 'M 0 0 L 10 0 L 10 10 Z');
  const assigns = newLinkKind(
    'Assigns',
    { sources: ['model.Mission'], targets: ['istar.Goal'] },
    { dash: 'dotted' },
  );

  it("makes kinds as piStar-ext's Add new does", () => {
    expect(mission).to.deep.equal({
      kind: 'model.Mission',
      label: 'Mission',
      category: 'node',
      pistarType: 'istar.Mission',
      size: { width: 90, height: 55 },
      shape: 'M 0 0 L 10 0 L 10 10 Z',
    });
    expect(assigns).to.include({
      kind: 'model.Assigns',
      pistarType: 'istar.Assigns',
    });
    expect(newNodeKind('Plain', undefined)).to.not.have.property('shape');
  });

  it('is read with its dialect: kinds, links, groupers, stereotypes and tags', () => {
    const model = {
      elements: [mission],
      links: [assigns],
      groupers: { missions: ['model.Mission', 'istar.Task'] },
      stereotypes: [{ name: 'late', appliesTo: ['missions'] }],
      taggedValues: [{ name: 'deadline', appliesTo: ['model.Mission'] }],
    };
    expect(isEmptyModelExtension(model)).to.equal(false);
    expect([...modelExtensionKinds(model)]).to.deep.equal([
      'model.Mission',
      'model.Assigns',
    ]);
    const read = withModelExtension(dialect, model);
    expect(read.elements.map((e) => e.kind)).to.deep.equal([
      'toyish.Plan',
      'toyish.Box',
      'model.Mission',
    ]);
    expect(profileOf(read, 'model.Mission').stereotypes).to.deep.equal([
      'late',
    ]);
    expect(profileOf(read, 'istar.Task').stereotypes).to.deep.equal([
      'urgent',
      'late',
    ]);
    expect(
      extensionCatalog(read).find((c) => c.id === 'groupers')?.entries,
    ).to.deep.include({
      name: 'missions',
      appliesTo: ['Mission', 'Task'],
    });
    expect(metamodelExtensionOf(read).links.map((l) => l.kind)).to.deep.equal([
      'toyish.Feeds',
      'model.Assigns',
    ]);
  });

  it('adds nothing when it is empty', () => {
    expect(isEmptyModelExtension({})).to.equal(true);
    expect(withModelExtension(dialect, {})).to.equal(dialect);
  });

  it('rejects names the dialect or iStar already has', () => {
    const bad = (model: Parameters<typeof withModelExtension>[1]) => () =>
      withModelExtension(dialect, model);
    expect(bad({ elements: [newNodeKind('Box', undefined)] })).to.throw(
      /the model's extension: Box is already a kind/,
    );
    expect(bad({ elements: [newNodeKind('task', undefined)] })).to.throw(
      /task is already a kind/,
    );
    expect(bad({ groupers: { agents: ['istar.Task'] } })).to.throw(
      /agents is already a grouper/,
    );
    expect(
      bad({ stereotypes: [{ name: 'Smart', appliesTo: ['istar.Goal'] }] }),
    ).to.throw(/Smart is already a stereotype/);
    expect(
      bad({ taggedValues: [{ name: 'note', appliesTo: ['istar.Goal'] }] }),
    ).to.throw(/note is already a tagged value/);
    expect(
      bad({
        elements: [
          { ...newNodeKind('Mission', undefined), pistarType: 'istar.Plan' },
        ],
      }),
    ).to.throw(/istar.Plan is already a Toyish kind/);
  });

  it('rejects kinds outside its namespace, and names nobody declares', () => {
    const bad = (model: Parameters<typeof withModelExtension>[1]) => () =>
      withModelExtension(dialect, model);
    expect(
      bad({ elements: [{ kind: 'other.Mission', category: 'node' }] }),
    ).to.throw(/not in the model namespace/);
    expect(
      bad({ stereotypes: [{ name: 'late', appliesTo: ['missions'] }] }),
    ).to.throw(/late applies to unknown missions/);
  });

  it('says which names are taken', () => {
    expect(takenName(dialect, 'kind', 'Plan')).to.equal(
      'Plan is already a kind',
    );
    expect(takenName(dialect, 'kind', 'Mission')).to.equal(null);
    expect(takenName(dialect, 'taggedValue', ' kind ')).to.equal(
      'kind is already a tagged value',
    );
  });
});
