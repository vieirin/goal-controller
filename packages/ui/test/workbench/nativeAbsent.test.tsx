/**
 * A native file a project ships without (goal-controller#143 follow-up):
 * through a WorkbenchProvider, a project whose model's dialect declares a
 * native file (a toy format: the piStar JSON under its own extension) and
 * that has none. With a writer, it is written from the model as the project
 * opens, listed under the model, given its tab and saved where the project
 * can be written; without one, nothing is made and nothing is said.
 */
import { act, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonText, type NativeFileDefinition } from '@goal-controller/dialect';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { modelTabsFor } from '@/components/workbench/modelTabs';
import { openProject, type ProjectStore } from '@/lib/project';
import { declarationsOf } from '@/lib/workbench/projectResources';

/** the toy format: the model's JSON, under `.mirror`; `writes`: whether its dialect writes it */
const declared = vi.hoisted(() => ({ writes: true }));
const mirror = (writes: boolean): NativeFileDefinition => ({
  label: 'Mirror',
  extensions: ['.mirror'],
  format: 'json',
  read: (text) => ({
    model: JSON.parse(text) as Record<string, unknown>,
    dialectRecord: { engine: 'mutrose', projectResources: {} },
    diagnostics: [],
  }),
  ...(writes && {
    write: (model: Record<string, unknown>) => ({
      text: jsonText(model),
      diagnostics: [],
    }),
  }),
});

// MutRoSe's dialect declares the toy format, for these tests only
vi.mock('@/lib/workbench/nativeFiles', async (original) => ({
  ...(await original<typeof import('@/lib/workbench/nativeFiles')>()),
  nativeDeclarationsOf: (mode: string | null) =>
    mode === 'mutrose' ? { mirror: mirror(declared.writes) } : undefined,
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

/** medicine-delivery in memory, no native file: what it is asked to write */
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
  return { store, write, files };
};

/** The workbench, with the project open and its resources read. */
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
    expect(workbench!.resourceTexts['knowledge/world_db.xml']).toBeDefined(),
  );
  return { workbench: () => workbench!, write, files };
};

describe('a native file a project ships without', () => {
  afterEach(() => {
    vi.useRealTimers();
    declared.writes = true;
  });

  it('is written from the model as the project opens, listed under it, given its tab and saved', async () => {
    const { workbench, write, files } = await opened(false);
    await waitFor(() =>
      expect(workbench().nativeStates.map((s) => s.slot.path)).toEqual([
        NATIVE,
      ]),
    );
    const expected = jsonText(JSON.parse(files[MODEL]!));
    expect(workbench().resourceTexts[NATIVE]).toBe(expected);
    expect(workbench().nativeStates[0]).toMatchObject({
      following: true,
      write: null,
      text: expected,
    });
    expect(workbench().project!.files).toContain(NATIVE);
    expect(workbench().listing).toContainEqual({
      path: NATIVE,
      role: 'native',
      kind: 'mirror',
    });
    expect(
      modelTabsFor(
        workbench().mode,
        workbench().engine,
        workbench().resourceSlots,
        workbench().openedFiles,
        workbench().nativeSlots,
      ).map(({ id }) => id),
    ).toContain(`resource:${NATIVE}`);
    await waitFor(() => expect(write).toHaveBeenCalledWith(NATIVE, expected));
    expect(workbench().problems.some((p) => p.source === 'Mirror')).toBe(false);
  });

  it('is kept in memory by a read-only project', async () => {
    const { workbench, write } = await opened(true);
    await waitFor(() =>
      expect(workbench().resourceTexts[NATIVE]).toBeDefined(),
    );
    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(5000));
    expect(write).not.toHaveBeenCalled();
    expect(workbench().listing.map((file) => file.path)).toContain(NATIVE);
  });

  it('is not made when its dialect only reads it, and nothing is said', async () => {
    declared.writes = false;
    const { workbench, write } = await opened(false);
    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(5000));
    expect(workbench().nativeStates).toEqual([]);
    expect(workbench().resourceTexts[NATIVE]).toBeUndefined();
    expect(workbench().listing.map((file) => file.path)).not.toContain(NATIVE);
    expect(write).not.toHaveBeenCalled();
    expect(workbench().problems.some((p) => p.source === 'Mirror')).toBe(false);
  });
});
