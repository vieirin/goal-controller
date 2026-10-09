/** What a model adds to its dialect, read with it (src/derive/modelExtension.ts). */
import { expect } from 'chai';
import {
  extensionCatalog,
  isEmptyModelExtension,
  metamodelExtensionOf,
  profileOf,
  takenName,
  withModelEntries,
  type ExtensionDefinition,
  type ModelExtension,
} from '../src';
import { toyDialect } from './support/toy';

const dialect = toyDialect as ExtensionDefinition;

describe('model extensions', () => {
  // as a file's "metamodel" block has them: istar-ts's kinds, our entries beside them
  const model: ModelExtension = {
    name: 'model',
    elements: [
      {
        kind: 'model.Mission',
        label: 'Mission',
        category: 'node',
        pistarType: 'istar.Mission',
        shape: { path: 'M 0 0 L 10 0 L 10 10 Z' },
      },
    ],
    links: [
      {
        kind: 'model.Assigns',
        label: 'Assigns',
        pistarType: 'istar.Assigns',
        rules: { sources: ['model.Mission'], targets: ['istar.Goal'] },
        line: { dash: '1,3' },
      },
    ],
    groupers: { missions: ['model.Mission', 'istar.Task'] },
    stereotypes: [{ name: 'late', appliesTo: ['missions'] }],
    taggedValues: [{ name: 'deadline', appliesTo: ['model.Mission'] }],
  };

  it('is read with its dialect: kinds, links, groupers, stereotypes and tags', () => {
    expect(isEmptyModelExtension(model)).to.equal(false);
    const read = withModelEntries(dialect, model);
    expect(read.elements.map((e) => e.kind)).to.deep.equal([
      'toyish.Plan',
      'toyish.Box',
      'model.Mission',
    ]);
    // istar-ts draws the model's kinds: their drawing is not the dialect's
    expect(read.elements[2]).to.deep.equal({
      kind: 'model.Mission',
      label: 'Mission',
      category: 'node',
      pistarType: 'istar.Mission',
    });
    expect(profileOf(read, 'model.Mission').stereotypes).to.deep.equal([
      'late',
    ]);
    expect(profileOf(read, 'istar.Task').stereotypes).to.deep.equal([
      'urgent',
      'late',
    ]);
    expect(
      extensionCatalog(read).find((c) => c.id === 'groupers')?.entries,
    ).to.deep.include({ name: 'missions', appliesTo: ['Mission', 'Task'] });
    expect(metamodelExtensionOf(read).links.map((l) => l.kind)).to.deep.equal([
      'toyish.Feeds',
      'model.Assigns',
    ]);
  });

  it('adds nothing when it is empty', () => {
    expect(isEmptyModelExtension({ name: 'model' })).to.equal(true);
    expect(withModelEntries(dialect, { name: 'model' })).to.equal(dialect);
  });

  it('rejects groupers, stereotypes and tagged values the dialect already has', () => {
    const bad = (entries: Omit<ModelExtension, 'name'>) => () =>
      withModelEntries(dialect, { name: 'model', ...entries });
    expect(bad({ groupers: { agents: ['istar.Task'] } })).to.throw(
      /the model's extension: agents is already a grouper/,
    );
    expect(
      bad({ stereotypes: [{ name: 'Smart', appliesTo: ['istar.Goal'] }] }),
    ).to.throw(/Smart is already a stereotype/);
    expect(
      bad({ taggedValues: [{ name: 'note', appliesTo: ['istar.Goal'] }] }),
    ).to.throw(/note is already a tagged value/);
  });

  it('rejects kinds outside its namespace, and names nobody declares', () => {
    const bad = (entries: Omit<ModelExtension, 'name'>) => () =>
      withModelEntries(dialect, { name: 'model', ...entries });
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
