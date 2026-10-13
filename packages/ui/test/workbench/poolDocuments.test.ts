/** The pool's documents in the Notation view (goal-controller#87): an element line's notation field. */
import { describe, expect, it } from 'vitest';
import { goda } from '@goal-controller/lib';
import type { DocumentNode, DocumentTree } from '@goal-controller/dialect';
import {
  appliedPoolEdits,
  notationPosition,
  notationRange,
} from '@/lib/workbench/poolDocuments';

const node = (
  iStarId: string,
  id: string,
  name: string,
  notation: string | null,
  children: string[],
): DocumentNode => ({
  iStarId,
  id,
  kind: notation === null ? 'task' : 'goal',
  name,
  notation,
  properties: {},
  children,
});

// BSN's way: a T1 under G2 and another under G3, keyed by their goal
const TREE: DocumentTree = {
  nodes: new Map([
    ['G1', node('a', 'G1', 'Root', 'G2;G3', ['G2', 'G3'])],
    ['G2', node('b', 'G2', 'Left', 'T1', ['G2/T1'])],
    ['G2/T1', node('c', 'T1', 'Do', null, [])],
    ['G3', node('d', 'G3', 'Right', 'T1', ['G3/T1'])],
    ['G3/T1', node('e', 'T1', 'Do', null, [])],
  ]),
  roots: ['G1'],
};
const TEXT = [
  'G1: Root [G2;G3]',
  '  G2: Left [T1]',
  '    T1: Do',
  '  G3: Right [ T1 ]',
  '    T1: Do',
].join('\n');

describe('an element line’s notation field', () => {
  const g3 = TEXT.indexOf('G3: Right');
  const inside = TEXT.indexOf('T1', g3);

  it('is where the notation’s ids are, inside the brackets', () => {
    expect(notationPosition(goda, TREE, TEXT, inside + 1)).toEqual({
      document: 'model:G3:notation',
      offset: 1,
    });
    expect(
      notationRange(goda, TREE, TEXT, {
        document: 'model:G3:notation',
        from: 0,
        to: 2,
      }),
    ).toEqual({ from: inside, to: inside + 2 });
    // the name still ends where the bracket starts
    expect(notationPosition(goda, TREE, TEXT, TEXT.indexOf('Right'))).toEqual({
      document: 'model:G3:name',
      offset: 0,
    });
  });

  it('a scoped child’s id is its own field, by its key', () => {
    expect(
      notationPosition(goda, TREE, TEXT, TEXT.lastIndexOf('T1: Do') + 1),
    ).toEqual({ document: 'model:G3/T1:id', offset: 1 });
  });

  it('a rename doesn’t edit the notation (nor an id)', () => {
    expect(
      appliedPoolEdits(
        [
          { document: 'model:G3:notation', from: 0, to: 2, text: 'T9' },
          { document: 'model:G3/T1:id', from: 0, to: 2, text: 'T9' },
        ],
        { resources: {}, tree: TREE, modelText: '{}' },
      ),
    ).toEqual({ resources: {}, modelText: null });
  });
});
