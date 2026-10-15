/**
 * An example on a page of its own (components/workbench/home/exampleRoute.tsx):
 * `?example=<path>` opens it, back (the URL without it) closes it to the
 * start screen, and the URL names no example once another model is open.
 * The examples are read from examples/ on disk, as GitHub would serve them.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExampleRoute } from '@/components/workbench/home/exampleRoute';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { location, router } from './support/navigation';

vi.mock('next/navigation', () => import('./support/navigation'));

const ROOT = join(__dirname, '../../../..');
vi.mock('@/services/examples', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/examples')>();
  return {
    ...actual,
    // the repository's files at the URLs the store asks for
    openExample: (entry: Parameters<typeof actual.openExample>[0]) =>
      actual.openExample(entry, async (url) => {
        const path = url.replace(/^https:\/\/[^/]+\/[^/]+\/[^/]+\/[^/]+\//, '');
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => readFileSync(join(ROOT, decodeURI(path)), 'utf8'),
        };
      }),
  };
});

afterEach(() => {
  cleanup();
  location.set('/');
});

const workbench = () => {
  let wb: Workbench | null = null;
  const Probe = () => {
    wb = useWorkbench();
    return null;
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkbenchProvider lockedEngine={null}>
        <ExampleRoute>
          <Probe />
        </ExampleRoute>
      </WorkbenchProvider>
    </QueryClientProvider>,
  );
  return () => wb!;
};

describe('ExampleRoute', () => {
  it('opens the example its URL names, and closes it when the browser goes back', async () => {
    location.set('/?example=mutrose/medicine-delivery');
    const wb = workbench();
    await waitFor(() => expect(wb().fileName).toBe('MedicineDelivery.txt'));
    expect(wb().project?.models).toHaveLength(1);
    act(() => location.set('/'));
    await waitFor(() => expect(wb().hasModel).toBe(false));
    // forward: open again
    act(() => location.set('/?example=mutrose/medicine-delivery'));
    await waitFor(() => expect(wb().hasModel).toBe(true));
  });

  it('keeps the URL’s other parameters, and names no example once another model is open', async () => {
    location.set('/?mode=edge&example=edge/simpleChoice.txt');
    const wb = workbench();
    await waitFor(() => expect(wb().fileName).toBe('simpleChoice.txt'));
    await act(() =>
      wb().openFile(
        'mine.txt',
        readFileSync(join(ROOT, 'examples/edge/simpleSequential.txt'), 'utf8'),
      ),
    );
    await waitFor(() => expect(location.href).toBe('/?mode=edge'));
    expect(wb().fileName).toBe('mine.txt');
  });

  it('goes back to the start screen from an example that is no more', async () => {
    location.set('/?example=edge/gone.txt');
    workbench();
    await waitFor(() => expect(location.href).toBe('/'));
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
