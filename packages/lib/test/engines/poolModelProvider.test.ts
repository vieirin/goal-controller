/**
 * A toy dialect plugged into the pool with no change to its core: its goal
 * model read by the generic model provider (ids, names, notation children)
 * plus one field hook (`uses` names a device), a `.devices` file of its
 * own, and a check in TypeScript across the two.
 */
import { expect } from 'chai';
import type { DocumentNode, DocumentTree } from '@goal-controller/dialect';
import {
  createModelProvider,
  createPool,
  definePool,
  definitionAt,
  referencesAt,
  renameEdits,
  type PoolDefinition,
  type PoolDiagnostic,
  type PoolProvider,
} from '../../src/engines/definitionPool';

/** `lamp on` defines a device and says whether it is plugged in. */
const devicesProvider: PoolProvider = {
  id: 'toy',
  documents: { extensions: ['.devices'] },
  kinds: { device: { label: 'Device' } },
  extract: ({ id: document, text = '' }) => ({
    definitions: [...text.matchAll(/^(\w+) (on|off)$/gm)].map(
      (match): PoolDefinition => ({
        id: `toy.device:${match[1]}`,
        kind: 'toy.device',
        name: match[1]!,
        location: {
          document,
          from: match.index!,
          to: match.index! + match[1]!.length,
        },
        detail: match[2],
      }),
    ),
    references: [],
  }),
};

const node = (
  id: string,
  kind: string,
  extra: Partial<DocumentNode> = {},
): DocumentNode => ({
  iStarId: id,
  id,
  kind,
  name: `${id} name`,
  notation: null,
  properties: {},
  children: [],
  ...extra,
});

const MODEL: DocumentTree = {
  roots: ['G1'],
  nodes: new Map([
    ['G1', node('G1', 'goal', { notation: 'T1;T2', children: ['T1', 'T2'] })],
    ['T1', node('T1', 'task', { properties: { uses: 'lamp' } })],
    ['T2', node('T2', 'task', { properties: { uses: 'kettle' } })],
  ]),
};

const toyPool = definePool({
  engine: 'toy',
  providers: [
    createModelProvider({
      dialect: {},
      refers: ['toy.device'],
      field: (_node, key) =>
        key === 'uses'
          ? (text, { at }) => ({
              definitions: [],
              references: [
                {
                  kinds: ['toy.device'],
                  name: text,
                  location: at(0, text.length),
                },
              ],
            })
          : undefined,
    }),
    devicesProvider,
  ],
  // a check across the files, in TypeScript
  checks: (pool): PoolDiagnostic[] =>
    pool
      .references()
      .filter((r) => pool.target(r)?.detail === 'off')
      .map((r) => ({
        ...r.location,
        severity: 'warning',
        check: 'toy-unplugged',
        message: `${r.name} is off`,
      })),
});

const index = (devices: string) =>
  createPool(toyPool).update([
    { id: 'model', kind: 'model', value: MODEL },
    { id: 'house.devices', kind: 'file', text: devices },
  ]);

describe('a toy dialect on the pool (no change to its core)', () => {
  it('reports its check and what resolves to nothing', () => {
    expect(
      index('lamp off\n').diagnostics.map((d) => `${d.document} ${d.check}`),
    ).to.have.members([
      'model:T1:uses toy-unplugged',
      'model:T2:uses unresolved-reference',
    ]);
  });

  it('goes from a notation to the child, and from a field to its file', () => {
    const pool = index('lamp on\nkettle on\n');
    expect(
      definitionAt(pool, { document: 'model:G1:notation', offset: 4 }),
    ).to.deep.equal({ document: 'model:T2:id', from: 0, to: 2 });
    expect(
      definitionAt(pool, { document: 'model:T2:uses', offset: 1 }),
    ).to.deep.equal({ document: 'house.devices', from: 8, to: 14 });
    expect(
      referencesAt(pool, { document: 'house.devices', offset: 1 }).map(
        (l) => l.document,
      ),
    ).to.deep.equal(['house.devices', 'model:T1:uses']);
  });

  it('renames a device in its file and in the model', () => {
    const edits = renameEdits(
      index('lamp on\n'),
      { document: 'model:T1:uses', offset: 1 },
      'light',
    );
    expect(edits).to.be.an('array');
    expect(
      (edits as { document: string; text: string }[]).map(
        (e) => `${e.document} ${e.text}`,
      ),
    ).to.have.members(['house.devices light', 'model:T1:uses light']);
  });
});
