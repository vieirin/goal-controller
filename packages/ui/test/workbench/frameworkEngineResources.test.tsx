/**
 * A framework engine's project resources, through the real workbench
 * pipeline (goal-controller#334): nfrprop's `strategies` (goal-controller#328)
 * is the first of these, and was inert from the live workbench until this
 * fix — `declarationsOf`/`parseResources` used to gate on `isDialectEngine`,
 * which is false for every framework engine (nfrprop's, kaosdoc's,
 * kaosprop's dialect is kept apart in `FRAMEWORK_ENGINE_DIALECTS`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { openProject, type ProjectStore } from '@/lib/project';
import {
  declarationsOf,
  parseResources,
} from '@/lib/workbench/projectResources';
import { resourceSlots } from '@/lib/project';

const ROOT = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const NFR_WELCOME = read('examples/nfr/nfr-welcome.txt');
const RSA_260_ONLY = read('examples/nfr/strategies/rsa-260-only.json');
const BOTH = read('examples/nfr/strategies/both.json');
const BAD_LABEL = JSON.stringify({
  name: 'Bad',
  labels: { 'Encrypt with RSA 128 bits': 'fine' },
});

const PROJECT = {
  'project.json': JSON.stringify({
    version: 1,
    dialect: 'nfrprop',
    framework: 'nfr',
    models: [{ path: 'nfr-welcome.txt' }],
    outputs: [],
  }),
  'nfr-welcome.txt': NFR_WELCOME,
  'strategies/rsa-260-only.json': RSA_260_ONLY,
  'strategies/both.json': BOTH,
  'strategies/bad.json': BAD_LABEL,
};

/** A fake store serving `PROJECT`'s files, as `setResourceText.test.tsx`'s does. */
const memoryStore = (): ProjectStore => {
  const files: Record<string, string> = { ...PROJECT };
  return {
    source: { kind: 'opfs', name: 'nfr-strategies' },
    readOnly: false,
    list: async () => Object.keys(files),
    read: async (path) => {
      const text = files[path];
      if (text === undefined) throw new Error(`no ${path}`);
      return text;
    },
    write: async (path, text) => {
      files[path] = text;
    },
  };
};

describe("a framework engine's project resources, in the workbench (#334)", () => {
  afterEach(() => cleanup());

  it('declarationsOf lists nfrprop’s strategies (a framework engine, not an iStar dialect one)', () => {
    expect(Object.keys(declarationsOf('nfrprop') ?? {})).toEqual([
      'strategies',
    ]);
  });

  it('parseResources parses a framework engine’s resource (GRL’s pipeline, widened)', () => {
    const slots = resourceSlots(
      { version: 1, models: [], projectResources: {}, outputs: [] },
      Object.keys(PROJECT),
      declarationsOf('nfrprop') ?? {},
    );
    const parsed = parseResources('nfrprop', slots, PROJECT);
    expect(Object.keys(parsed)).toEqual(['strategies']);
    // `under()` (lib/project/slots.ts) sorts a `many` kind's files by path
    expect(
      parsed.strategies!.data as { strategies: { name: string }[] },
    ).toMatchObject({
      strategies: [{ name: 'Bad' }, { name: 'both' }, { name: 'RSA 260 only' }],
    });
  });

  it('opens an NFR project with strategies/*.json, runs the analysis, and lists every case (the picker’s)', async () => {
    let workbench: Workbench | null = null;
    const Probe = () => {
      workbench = useWorkbench();
      return null;
    };
    render(
      <WorkbenchProvider lockedEngine='nfrprop'>
        <Probe />
      </WorkbenchProvider>,
    );
    const project = await openProject(memoryStore(), {
      projectResources: declarationsOf,
    });
    await act(async () => workbench!.openProject(project));
    await waitFor(() => {
      expect(
        workbench!.resourceSlots.find((s) => s.kind === 'strategies'),
      ).toMatchObject({
        paths: [
          'strategies/bad.json',
          'strategies/both.json',
          'strategies/rsa-260-only.json',
        ],
        missing: false,
      });
    });
    // the Problems panel, from the bad label alone: the other two parse clean
    expect(
      workbench!.problems
        .map((p) => p.message)
        .filter((m) => m.includes('bad.json')),
    ).toEqual([
      expect.stringContaining(
        "element Encrypt with RSA 128 bits's label is one of",
      ),
    ]);
    act(() => workbench!.runAnalysis('nfrLabels'));
    await waitFor(() => expect(workbench!.analysisRun).not.toBeNull());
    const run = workbench!.analysisRun!;
    expect('result' in run).toBe(true);
    const labels = 'result' in run ? run.result.cases.map((c) => c.label) : [];
    // "Model labels" first, then one case per strategy in file order (sorted paths)
    expect(labels).toEqual(['Model labels', 'Bad', 'both', 'RSA 260 only']);
  });
});
