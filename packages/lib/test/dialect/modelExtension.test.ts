/**
 * What a model adds to iStar4RationalAgents, in its file's "metamodel" block:
 * read by istar-ts (its kinds, their rules and collisions) and by the dialect
 * (src/derive/modelExtension.ts: its groupers, stereotypes and tagged values).
 */
import { expect } from 'chai';
import {
  ISTAR_2_0,
  MetamodelError,
  canLink,
  defineMetamodelExtension,
  extendMetamodel,
  fileMetamodelOf,
  parsePistar,
  toPistar,
} from '../../../goal-tree/node_modules/@istar-ts/core';
import {
  extensionCatalog,
  metamodelExtensionOf,
  profileOf,
  takenName,
  withModelEntries,
  type ExtensionDefinition,
  type ModelExtension,
} from '@goal-controller/dialect';
import { istar4RationalAgents } from '../../src';

const dialect = istar4RationalAgents as ExtensionDefinition;
const HOST = extendMetamodel(
  ISTAR_2_0,
  defineMetamodelExtension(metamodelExtensionOf(dialect)),
);

/** A piStar file with a Mission and a goal in an agent, and `metamodel` as its block. */
const file = (metamodel: ModelExtension) =>
  JSON.stringify({
    actors: [
      {
        id: 'a1',
        text: 'Robot',
        type: 'istar.Agent',
        x: 0,
        y: 0,
        nodes: [
          { id: 'm1', text: 'Deliver', type: 'istar.Mission', x: 10, y: 10 },
          { id: 'g1', text: 'Delivered', type: 'istar.Goal', x: 20, y: 20 },
        ],
      },
    ],
    orphans: [],
    dependencies: [],
    links: [],
    display: {},
    tool: 'pistar.2.1.0',
    istar: '2.0',
    saveDate: '',
    diagram: { width: 100, height: 100 },
    metamodel,
  });

const read = (metamodel: ModelExtension) =>
  parsePistar(file(metamodel), { metamodel: HOST, fileMetamodel: true });

describe('model extensions', () => {
  const mission = {
    kind: 'model.Mission',
    label: 'Mission',
    category: 'node',
    pistarType: 'istar.Mission',
    shape: { path: 'M 0 0 L 10 0 L 10 10 Z' },
  } as const;
  const assigns = {
    kind: 'model.Assigns',
    label: 'Assigns',
    pistarType: 'istar.Assigns',
    rules: { sources: ['model.Mission'], targets: ['istar.Goal'] },
    line: { dash: '1,3' },
  };
  const block: ModelExtension = {
    name: 'model',
    elements: [mission],
    links: [assigns],
    groupers: { missions: ['model.Mission', 'istar.Task'] },
    stereotypes: [{ name: 'urgent', appliesTo: ['missions'] }],
    taggedValues: [{ name: 'deadline', appliesTo: ['model.Mission'] }],
  };

  it('is read with its dialect: kinds, links, groupers, stereotypes and tags', () => {
    const extension = withModelEntries(dialect, block);
    expect(extension.elements.map((e) => e.kind)).to.deep.equal([
      'rationalAgents.Planning',
      'rationalAgents.Plan',
      'model.Mission',
    ]);
    expect(profileOf(extension, 'model.Mission').stereotypes).to.deep.equal([
      'urgent',
    ]);
    expect(profileOf(extension, 'istar.Task').stereotypes).to.deep.equal([
      'action',
      'urgent',
    ]);
    expect(
      extensionCatalog(extension).find((c) => c.id === 'groupers')?.entries,
    ).to.deep.include({ name: 'missions', appliesTo: ['Mission', 'Task'] });
    // and istar-ts reads a model with it, its shape and the link's rules included
    const model = read(block);
    expect(model.elements.get('m1')?.kind).to.equal('model.Mission');
    expect(canLink(model, 'm1', 'g1', 'model.Assigns')).to.deep.equal({
      ok: true,
    });
    expect(canLink(model, 'g1', 'm1', 'model.Assigns').ok).to.equal(false);
    // the block is the file's, ours beside istar-ts's, written back as read
    expect(fileMetamodelOf(model)).to.deep.equal(block);
    expect(JSON.parse(toPistar(model)).metamodel).to.deep.equal(block);
  });

  it('adds nothing when it is empty', () => {
    expect(withModelEntries(dialect, { name: 'model' })).to.equal(dialect);
  });

  it('rejects names the dialect already has', () => {
    // its kinds: istar-ts, by kind and piStar type
    const kind = (element: ModelExtension['elements']) => () =>
      read({ name: 'model', elements: element });
    expect(
      kind([
        {
          kind: 'model.Planning',
          category: 'node',
          pistarType: 'istar.Planning',
        },
      ]),
    ).to.throw(
      MetamodelError,
      /pistarType "istar.Planning" of kind "model.Planning"/,
    );
    expect(
      kind([
        { kind: 'model.Task', category: 'node', pistarType: 'istar.Task' },
      ]),
    ).to.throw(MetamodelError, /pistarType "istar.Task"/);
    expect(kind([{ kind: 'rationalAgents.Plan', category: 'node' }])).to.throw(
      MetamodelError,
      /rationalAgents.Plan/,
    );
    // its groupers, stereotypes and tagged values: the dialect
    const bad = (entries: Omit<ModelExtension, 'name'>) => () =>
      withModelEntries(dialect, { name: 'model', ...entries });
    expect(bad({ groupers: { rational: ['istar.Task'] } })).to.throw(
      /rational is already a grouper/,
    );
    expect(
      bad({ stereotypes: [{ name: 'action', appliesTo: ['istar.Goal'] }] }),
    ).to.throw(/action is already a stereotype/);
    expect(
      bad({ taggedValues: [{ name: 'Status', appliesTo: ['istar.Goal'] }] }),
    ).to.throw(/Status is already a tagged value/);
  });

  it('rejects kinds outside its namespace, and names nobody declares', () => {
    const bad = (entries: Omit<ModelExtension, 'name'>) => () =>
      withModelEntries(dialect, { name: 'model', ...entries });
    expect(
      bad({ elements: [{ kind: 'other.Mission', category: 'node' }] }),
    ).to.throw(/not in the model namespace/);
    expect(
      bad({ stereotypes: [{ name: 'urgent', appliesTo: ['missions'] }] }),
    ).to.throw(/urgent applies to unknown missions/);
  });

  it('says which names are taken', () => {
    expect(takenName(dialect, 'kind', 'Plan')).to.equal(
      'Plan is already a kind',
    );
    expect(takenName(dialect, 'kind', 'Mission')).to.equal(null);
  });
});
