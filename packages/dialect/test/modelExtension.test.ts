/** What a model adds to its dialect, read with it (src/derive/modelExtension.ts). */
import { expect } from 'chai';
import {
  ISTAR_2_0,
  canLink,
  defineMetamodelExtension,
  extendMetamodel,
  parsePistar,
} from '../../goal-tree/node_modules/@istar-ts/core';
import {
  extensionCatalog,
  metamodelExtensionOf,
  newLinkKind,
  newNodeKind,
  profileOf,
  takenName,
  withModelExtension,
  type ExtensionDefinition,
} from '../src';
import { istar4RationalAgents as dialect } from '../../lib/out';

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
  });

  it('is read with its dialect: kinds, links, groupers, stereotypes and tags', () => {
    const read = withModelExtension(dialect as ExtensionDefinition, {
      elements: [mission],
      links: [assigns],
      groupers: { missions: ['model.Mission', 'istar.Task'] },
      stereotypes: [{ name: 'urgent', appliesTo: ['missions'] }],
      taggedValues: [{ name: 'deadline', appliesTo: ['model.Mission'] }],
    });
    expect(read.elements.map((e) => e.kind)).to.deep.equal([
      'rationalAgents.Planning',
      'rationalAgents.Plan',
      'model.Mission',
    ]);
    expect(profileOf(read, 'model.Mission').stereotypes).to.deep.equal([
      'urgent',
    ]);
    expect(profileOf(read, 'istar.Task').stereotypes).to.deep.equal([
      'action',
      'urgent',
    ]);
    expect(
      extensionCatalog(read).find((c) => c.id === 'groupers')?.entries,
    ).to.deep.include({ name: 'missions', appliesTo: ['Mission', 'Task'] });
    // and istar-ts reads a model with it, the link's rules included
    const metamodel = extendMetamodel(
      ISTAR_2_0,
      defineMetamodelExtension(metamodelExtensionOf(read)),
    );
    const model = parsePistar(
      JSON.stringify({
        actors: [
          {
            id: 'a1',
            text: 'Robot',
            type: 'istar.Agent',
            x: 0,
            y: 0,
            nodes: [
              {
                id: 'm1',
                text: 'Deliver',
                type: 'istar.Mission',
                x: 10,
                y: 10,
              },
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
      }),
      { metamodel },
    );
    expect(model.elements.get('m1')?.kind).to.equal('model.Mission');
    expect(canLink(model, 'm1', 'g1', 'model.Assigns')).to.deep.equal({
      ok: true,
    });
    expect(canLink(model, 'g1', 'm1', 'model.Assigns').ok).to.equal(false);
  });

  it('adds nothing when it is empty', () => {
    expect(withModelExtension(dialect as ExtensionDefinition, {})).to.equal(
      dialect,
    );
  });

  it('rejects names the dialect already has', () => {
    const bad = (model: Parameters<typeof withModelExtension>[1]) => () =>
      withModelExtension(dialect as ExtensionDefinition, model);
    expect(bad({ elements: [newNodeKind('Planning', undefined)] })).to.throw(
      /Planning is already a kind/,
    );
    expect(bad({ elements: [newNodeKind('task', undefined)] })).to.throw(
      /task is already a kind/,
    );
    expect(bad({ groupers: { rational: ['istar.Task'] } })).to.throw(
      /rational is already a grouper/,
    );
    expect(
      bad({ stereotypes: [{ name: 'action', appliesTo: ['istar.Goal'] }] }),
    ).to.throw(/action is already a stereotype/);
    expect(
      bad({ taggedValues: [{ name: 'Status', appliesTo: ['istar.Goal'] }] }),
    ).to.throw(/Status is already a tagged value/);
    expect(
      bad({
        elements: [
          {
            ...newNodeKind('Mission', undefined),
            pistarType: 'istar.Planning',
          },
        ],
      }),
    ).to.throw(/istar.Planning is already a iStar4RationalAgents kind/);
  });

  it('rejects kinds outside its namespace, and names nobody declares', () => {
    const bad = (model: Parameters<typeof withModelExtension>[1]) => () =>
      withModelExtension(dialect as ExtensionDefinition, model);
    expect(
      bad({ elements: [{ kind: 'other.Mission', category: 'node' }] }),
    ).to.throw(/not in the model namespace/);
    expect(
      bad({ stereotypes: [{ name: 'urgent', appliesTo: ['missions'] }] }),
    ).to.throw(/urgent applies to unknown missions/);
  });

  it('says which names are taken', () => {
    expect(takenName(dialect as ExtensionDefinition, 'kind', 'Plan')).to.equal(
      'Plan is already a kind',
    );
    expect(
      takenName(dialect as ExtensionDefinition, 'kind', 'Mission'),
    ).to.equal(null);
  });
});
