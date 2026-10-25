/**
 * `modelSession.ts`'s `tagged()` wrapper (goal-controller#410, replaced for
 * istar-ts#213 in goal-controller#432): `wb.changeSource` reads the surface
 * off the dispatch's own `origin`, carried on `sourceModelChanged` instead of
 * a synchronous closure variable. This checks the switch kept the same
 * behaviour: a canvas edit, an inspector edit, a compound, and an undo and a
 * redo from each surface (goal-controller#432 review, finding 5).
 */
import { act, cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { useEffect } from 'react';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';

const ISTAR = readFileSync(
  join(__dirname, '../../../../examples/edge/simpleChoice.txt'),
  'utf8',
);
// in simpleChoice.txt: G1, OR-refined into G2 and G3
const G1 = '117b97d7-775b-41a9-8fec-9e923edde772';
const G2 = '10d8d506-1fd6-4808-b711-86dba7aca2f0';

afterEach(() => cleanup());

const workbench = () => {
  let wb: Workbench | null = null;
  const Probe = () => {
    const current = useWorkbench();
    useEffect(() => {
      wb = current;
    });
    return null;
  };
  render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
    </WorkbenchProvider>,
  );
  return { wb: () => wb! };
};

describe('wb.changeSource, by surface and by undo/redo (#432 review finding 5)', () => {
  it('a canvas edit', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await act(async () => {
      const result = await wb()
        .dispatcherFor('canvas')
        .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'Renamed' });
      expect(result.ok).toBe(true);
    });
    expect(wb().changeSource).toBe('canvas');
  });

  it('an inspector edit', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await act(async () => {
      const result = await wb()
        .dispatcherFor('inspector')
        .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'Renamed' });
      expect(result.ok).toBe(true);
    });
    expect(wb().changeSource).toBe('inspector');
  });

  it('a compound, from the surface that dispatched it', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await act(async () => {
      const result = await wb()
        .dispatcherFor('canvas')
        .dispatch({
          kind: 'compound',
          operationList: [
            { kind: 'applyLabelEdit', labelId: G1, text: 'First' },
            { kind: 'applyLabelEdit', labelId: G2, text: 'Second' },
          ],
        });
      expect(result.ok).toBe(true);
    });
    expect(wb().changeSource).toBe('canvas');
  });

  it.each(['canvas', 'inspector'] as const)(
    'an undo, after a %s edit',
    async (surface) => {
      const { wb } = workbench();
      await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
      await act(async () => {
        await wb()
          .dispatcherFor(surface)
          .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'Renamed' });
      });
      expect(wb().changeSource).toBe(surface);

      act(() => wb().undo());
      expect(wb().changeSource).toBe('undo');
    },
  );

  it.each(['canvas', 'inspector'] as const)(
    'a redo, after a %s edit and an undo',
    async (surface) => {
      const { wb } = workbench();
      await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
      await act(async () => {
        await wb()
          .dispatcherFor(surface)
          .dispatch({ kind: 'applyLabelEdit', labelId: G1, text: 'Renamed' });
      });
      act(() => wb().undo());
      expect(wb().changeSource).toBe('undo');

      act(() => wb().redo());
      expect(wb().changeSource).toBe('undo');
    },
  );
});
