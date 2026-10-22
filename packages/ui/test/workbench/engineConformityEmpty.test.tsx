/**
 * An empty model (a new one, or settings reopened on one) conforms to every
 * engine vacuously: it must not read as "has problems" (goal-controller#371).
 * A non-empty model an engine truly rejects, and a mismatched framework,
 * still block.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  ConformityStatus,
  useEngineConformity,
} from '@/components/workbench/engineConformity';
import ModelSettingsModal from '@/components/workbench/ModelSettingsModal';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { EMPTY_PISTAR_MODEL } from '@/lib/workbench/pistar';

const ROOT = join(__dirname, '../../../..');
const ISTAR = readFileSync(
  join(ROOT, 'examples/edge/simpleChoice.txt'),
  'utf8',
);

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => cleanup());

const workbench = () => {
  let wb: Workbench | null = null;
  const Shell = () => {
    wb = useWorkbench();
    return <>{wb.settingsDialog && wb.hasModel && <ModelSettingsModal />}</>;
  };
  render(
    <WorkbenchProvider lockedEngine={null}>
      <Shell />
    </WorkbenchProvider>,
  );
  return () => wb!;
};

describe('an empty model conforms vacuously (#371)', () => {
  it('shows no "has problems" on a new, empty model', async () => {
    const wb = workbench();
    await act(() =>
      wb().openFile('untitled.txt', EMPTY_PISTAR_MODEL, { setup: true }),
    );
    await screen.findByRole('dialog');
    expect(screen.queryByText(/has problems/)).toBeNull();
    // istardt and edgev2 reject the truly empty model (no actor, no root goal)
    expect(screen.getAllByText(/not checked yet/).length).toBeGreaterThan(0);
  });

  it('shows no "has problems" on Model settings reopened on an empty model', async () => {
    const wb = workbench();
    await act(() =>
      wb().openFile('untitled.txt', EMPTY_PISTAR_MODEL, { setup: false }),
    );
    act(() => wb().openSettings());
    await screen.findByRole('dialog');
    expect(screen.queryByText(/has problems/)).toBeNull();
    expect(screen.getAllByText(/not checked yet/).length).toBeGreaterThan(0);
  });

  it('still blocks a non-empty model an engine rejects', async () => {
    const wb = workbench();
    await act(() => wb().openFile('simpleChoice.txt', ISTAR, { setup: true }));
    await screen.findByRole('dialog');
    await waitFor(() =>
      expect(screen.queryAllByText(/checking…/).length).toBe(0),
    );
    expect(screen.queryAllByText(/has problems/).length).toBeGreaterThan(0);
  });
});

describe("the hook's status for a skipped (empty) model", () => {
  it('reports "unchecked", not "blocked", for an engine the model would otherwise suit', async () => {
    const { result } = renderHook(() =>
      useEngineConformity(EMPTY_PISTAR_MODEL, ['goda'], true, 'istar-2.0'),
    );
    expect(result.current.statusOf('goda')).toBe('unchecked');
    render(
      <ConformityStatus
        status={result.current.statusOf('goda')}
        warnings={0}
      />,
    );
    expect(screen.getByText(/not checked yet/)).toBeTruthy();
  });

  it('still reports "blocked" for a mismatched framework, skipped or not', () => {
    const { result } = renderHook(() =>
      useEngineConformity(EMPTY_PISTAR_MODEL, ['edgev2'], true, 'kaos'),
    );
    expect(result.current.statusOf('edgev2')).toBe('blocked');
  });

  it('reports "blocked" with the rejecting engine’s own message for a non-empty model', async () => {
    const { result } = renderHook(() =>
      useEngineConformity(ISTAR, ['edgev2'], false, 'istar-2.0'),
    );
    await waitFor(() =>
      expect(result.current.statusOf('edgev2')).toBe('blocked'),
    );
    expect(result.current.detailOf('edgev2')).toMatch(
      /not valid for this engine/i,
    );
  });
});
