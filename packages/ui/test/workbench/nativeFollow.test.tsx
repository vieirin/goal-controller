/**
 * A native file that follows the model, in the workbench (goal-controller#143):
 * through a WorkbenchProvider, a project with a native file beside its model
 * (a toy format: the piStar JSON under its own extension). In sync when the
 * project opens, it isn't written; once the model is edited, it is written
 * from it and saved where the project can be written; a read-only project
 * keeps it with the model, in memory.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonText, type NativeFileDefinition } from '@goal-controller/dialect';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { openProject, type ProjectStore } from '@/lib/project';
import { declarationsOf } from '@/lib/workbench/projectResources';

/** the toy format: the model's JSON, under `.mirror` */
const mirror: NativeFileDefinition = {
  label: 'Mirror',
  extensions: ['.mirror'],
  format: 'json',
  read: (text) => ({
    model: JSON.parse(text) as Record<string, unknown>,
    dialectRecord: { engine: 'mutrose', projectResources: {} },
    diagnostics: [],
  }),
  write: (model) => ({ text: jsonText(model), diagnostics: [] }),
};

// MutRoSe's dialect declares the toy format, for these tests only
vi.mock('@/lib/workbench/nativeFiles', async (original) => ({
  ...(await original<typeof import('@/lib/workbench/nativeFiles')>()),
  nativeDeclarationsOf: (mode: string | null) =>
    mode === 'mutrose' ? { mirror } : undefined,
}));

const PROJECT = join(
  __dirname,
  '../../../../examples/mutrose/medicine-delivery',
);
const FILES = [
  'project.json',
  'gm/MedicineDelivery.txt',
  'knowledge/world_db.xml',
  'hddl/domain.hddl',
  'configuration/configuration.json',
];
const MODEL = 'gm/MedicineDelivery.txt';
const NATIVE = 'gm/MedicineDelivery.mirror';

/** medicine-delivery in memory with its mirror beside the model: what it is asked to write */
const memoryStore = (readOnly: boolean) => {
  const files = Object.fromEntries(
    FILES.map((path) => [path, readFileSync(join(PROJECT, path), 'utf8')]),
  );
  files[NATIVE] = jsonText(JSON.parse(files[MODEL]!));
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
  return { store, write, files };
};

/** The workbench, with the project open and its native file read and checked. */
const opened = async (readOnly: boolean) => {
  const { store, write, files } = memoryStore(readOnly);
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
  await waitFor(() =>
    expect(workbench!.nativeStates.map((state) => state.slot.path)).toEqual([
      NATIVE,
    ]),
  );
  return { workbench: () => workbench!, write, files };
};

/** the model with its first node moved (an edit the language has nothing to say of) */
const MOVED = 123456;
const moved = (text: string) => {
  const model = JSON.parse(text);
  model.actors[0].nodes[0].x = MOVED;
  return jsonText(model);
};

describe('a native file that follows the model', () => {
  afterEach(() => {
    vi.useRealTimers();
    // unmounted before the environment is torn down: else React's
    // scheduler runs a pending render without a window (seen on CI)
    cleanup();
  });

  it('is saved to the project once the model is edited, and not before', async () => {
    const { workbench, write, files } = await opened(false);
    expect(workbench().nativeStates[0]).toMatchObject({
      following: true,
      write: null,
    });
    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(1000));
    expect(write).not.toHaveBeenCalledWith(NATIVE, expect.anything());
    act(() => workbench().setText(moved(workbench().text), 'source'));
    expect(workbench().resourceTexts[NATIVE]).toContain(`"x": ${MOVED}`);
    act(() => vi.advanceTimersByTime(500));
    expect(write).toHaveBeenCalledWith(
      NATIVE,
      expect.stringContaining(`"x": ${MOVED}`),
    );
    expect(files[NATIVE]).toContain(`"x": ${MOVED}`);
    expect(workbench().problems.some((p) => p.source === 'Mirror')).toBe(false);
  });

  it('is kept in memory by a read-only project', async () => {
    const { workbench, write } = await opened(true);
    vi.useFakeTimers();
    act(() => workbench().setText(moved(workbench().text), 'source'));
    act(() => vi.advanceTimersByTime(5000));
    expect(write).not.toHaveBeenCalled();
    expect(workbench().resourceTexts[NATIVE]).toContain(`"x": ${MOVED}`);
  });
});
