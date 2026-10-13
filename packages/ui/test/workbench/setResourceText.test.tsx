/**
 * `setResourceText` in the workbench (goal-controller#64, #65): through a
 * WorkbenchProvider, a project read from a fake store. An edit of several
 * resources at once (a rename across them) saves each; a read-only store
 * is written nothing.
 */
import { act, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { openProject, type ProjectStore } from '@/lib/project';
import { declarationsOf } from '@/lib/workbench/projectResources';

const PROJECT = join(
  __dirname,
  '../../../../examples/projects/medicine-delivery',
);
const FILES = [
  'project.json',
  'gm/MedicineDelivery.txt',
  'knowledge/world_db.xml',
  'hddl/domain.hddl',
  'configuration/configuration.json',
];
const WORLD = 'knowledge/world_db.xml';
const CONFIGURATION = 'configuration/configuration.json';

/** medicine-delivery in memory: what it reads, what it is asked to write */
const memoryStore = (readOnly: boolean) => {
  const files = Object.fromEntries(
    FILES.map((path) => [path, readFileSync(join(PROJECT, path), 'utf8')]),
  );
  const write = vi.fn(async (path: string, text: string) => {
    if (readOnly) throw new Error('read only');
    files[path] = text;
  });
  const store: ProjectStore = {
    source: { kind: 'opfs', name: 'medicine-delivery' },
    readOnly,
    list: async () => Object.keys(files),
    read: async (path) => {
      const text = files[path];
      if (text === undefined) throw new Error(`no ${path}`);
      return text;
    },
    write,
  };
  return { store, write };
};

/** The workbench, with the project open and its resources read. */
const opened = async (readOnly: boolean) => {
  const { store, write } = memoryStore(readOnly);
  let workbench: Workbench | null = null;
  const Probe = () => {
    workbench = useWorkbench();
    return null;
  };
  render(
    <WorkbenchProvider lockedEngine='mutrose'>
      <Probe />
    </WorkbenchProvider>,
  );
  const project = await openProject(store, {
    projectResources: declarationsOf,
  });
  await act(async () => workbench!.openProject(project));
  await waitFor(() => {
    expect(workbench!.resourceTexts[WORLD]).toBeDefined();
    expect(workbench!.resourceTexts[CONFIGURATION]).toBeDefined();
  });
  return { workbench: () => workbench!, write };
};

describe('setResourceText', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves every file a rename-like action edits, after the pause', async () => {
    const { workbench, write } = await opened(false);
    vi.useFakeTimers();
    act(() => {
      workbench().setResourceText(WORLD, '<world_db><Order/></world_db>');
      workbench().setResourceText(CONFIGURATION, '{ "location_types": [] }');
    });
    // shown at once, saved after the pause
    expect(workbench().resourceTexts[WORLD]).toBe(
      '<world_db><Order/></world_db>',
    );
    expect(write).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
    expect(write.mock.calls.sort()).toEqual([
      [CONFIGURATION, '{ "location_types": [] }'],
      [WORLD, '<world_db><Order/></world_db>'],
    ]);
  });

  it('saves a file’s last text once', async () => {
    const { workbench, write } = await opened(false);
    vi.useFakeTimers();
    act(() => {
      workbench().setResourceText(WORLD, '<a/>');
      workbench().setResourceText(WORLD, '<b/>');
    });
    act(() => vi.advanceTimersByTime(500));
    expect(write.mock.calls).toEqual([[WORLD, '<b/>']]);
  });

  it('writes nothing to a read-only store, and still shows the edit', async () => {
    const { workbench, write } = await opened(true);
    vi.useFakeTimers();
    act(() => {
      workbench().setResourceText(WORLD, '<world_db/>');
      workbench().setResourceText(CONFIGURATION, '{}');
    });
    act(() => vi.advanceTimersByTime(5000));
    expect(write).not.toHaveBeenCalled();
    expect(workbench().resourceTexts[WORLD]).toBe('<world_db/>');
  });
});
