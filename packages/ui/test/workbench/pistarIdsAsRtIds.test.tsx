/**
 * An element whose piStar id is its RT id (`"id": "T17"`, `T17: …`) has an
 * id: the view says so (`hasId`), not `id !== iStarId` (goal-controller#158).
 * No "has no id" problem; its Notation line keeps its id; the Problems
 * panel and the inspector's chips show the id. An element whose text has no
 * id is still told apart, its piStar id or not.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePistar } from '@istar-ts/core';
import { goalView } from '@goal-controller/goal-tree';
import { notationDocument } from '@goal-controller/goal-language';
import { ENGINE_DIALECTS } from '@/lib/workbench/engineDialects';
import { treeProblems } from '@/lib/workbench/localProblems';
import { SOURCE } from '@/lib/workbench/types';

const node = (id: string, text: string, type: string, x: number) => ({
  id,
  text,
  type,
  x,
  y: 100,
  customProperties: {},
});

// GODA lists elements without ids nowhere (`idlessElements: 'unlisted'`)
const MODEL = {
  actors: [
    {
      id: 'A',
      text: 'Robot',
      type: 'istar.Actor',
      x: 0,
      y: 0,
      customProperties: {},
      nodes: [
        node('G1', 'G1: Deliver', 'istar.Goal', 100),
        node('T1', 'T1: Drive', 'istar.Task', 100),
        node('G9', 'Fetch', 'istar.Goal', 300),
      ],
    },
  ],
  orphans: [],
  dependencies: [],
  links: [
    { id: 'l1', type: 'istar.OrRefinementLink', source: 'T1', target: 'G1' },
  ],
  display: {},
  tool: 'pistar.2.1.0',
  istar: '2.0',
  saveDate: '',
  diagram: { width: 800, height: 600 },
};

const tree = goalView(
  parsePistar(MODEL as never) as never,
  ENGINE_DIALECTS.goda,
);

const wb = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/components/workbench/WorkbenchContext', () => ({
  useWorkbench: () => wb.current,
}));

afterEach(cleanup);

describe('an RT id that is also the piStar id', () => {
  it('is an id: the view says so, whatever the piStar id is', () => {
    expect(tree.nodes.get('G1')!.hasId).toBe(true);
    expect(tree.nodes.get('T1')!.hasId).toBe(true);
    expect(tree.nodes.get('G9')!.hasId).toBe(false);
  });

  it('gives no "has no id" problem, but to the element whose text has none', () => {
    const noId = treeProblems(tree, 'goda').filter((p) =>
      p.message.includes('has no id'),
    );
    expect(noId.map((p) => p.elementId)).toEqual(['G9']);
  });

  it('keeps its Notation line, its id first', () => {
    const { text } = notationDocument(ENGINE_DIALECTS.goda, tree);
    expect(text).toContain('G1: Deliver');
    expect(text).toContain('T1: Drive');
    expect(text).not.toContain('Fetch');
  });

  it('shows its id in the Problems panel and the inspector’s chips', async () => {
    const { ProblemsView } = await import('@/components/workbench/BottomPanel');
    const { QualificationChips } =
      await import('@/components/workbench/engines/shared/inspector');
    wb.current = {
      hasModel: true,
      analyzing: false,
      tree,
      select: () => {},
      problems: [
        {
          severity: 'error',
          source: SOURCE.workbench,
          elementId: 'T1',
          message: 'about T1',
        },
        {
          severity: 'error',
          source: SOURCE.workbench,
          elementId: 'G9',
          message: 'about G9',
        },
      ],
    };
    render(<ProblemsView />);
    // T1 heads its group with its chip and name; G9, without an id, by its key
    expect(screen.getByText('T1')).toBeTruthy();
    expect(screen.getByText('Drive')).toBeTruthy();
    expect(screen.getByText('G9')).toBeTruthy();
    cleanup();
    render(<QualificationChips ids={['G1', 'G9']} />);
    expect(screen.getByText('G1')).toBeTruthy();
    expect(screen.getByText('Fetch')).toBeTruthy();
  });
});
