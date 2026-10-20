/**
 * Adding a model file to the open project (goal-controller#329): a project
 * may hold models of several frameworks. The added model keeps its own
 * framework, by its content, recorded in its manifest entry only when it
 * isn't the project's; the workbench opens each model in its own framework
 * (its mode, so its palette); a model is refused only when it isn't in the
 * framework it declares. Plain Open is as it was (frameworkOpen.test.tsx).
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
// the browser's private file system, in memory: a file opened is read-only,
// so adding to it makes a browser copy (the lib tests' fake folder)
import {
  fakeDirectory,
  type Tree,
} from '../../../lib/test/dialect/project/support';
import ModelDiagram from '@/components/workbench/engines/ModelDiagram';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import {
  fileStore,
  memoryStore,
  openProject,
  parseManifest,
  PROJECT_FILE,
  saveProject,
  serializeManifest,
  withModel,
  withModelSettings,
} from '@/lib/project';
import {
  addingMismatch,
  frameworkOfEntry,
  inItsFramework,
} from '@/lib/workbench/frameworkOpen';

const ROOT = join(__dirname, '../../../..');
const KAOS_WELCOME = readFileSync(
  join(__dirname, 'fixtures/kaos-welcome.txt'),
  'utf8',
);
const NFR_WELCOME = readFileSync(
  join(ROOT, 'examples/nfr/nfr-welcome.txt'),
  'utf8',
);
const ISTAR = readFileSync(
  join(ROOT, 'examples/edge/simpleChoice.txt'),
  'utf8',
);

// what React Flow needs that jsdom lacks (istar-ts's react test setup)
beforeAll(() => {
  class ResizeObserverMock {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: { width: 800, height: 600 },
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  class DOMMatrixReadOnlyMock {
    m22 = 1;
  }
  Object.assign(globalThis, {
    ResizeObserver: ResizeObserverMock,
    DOMMatrixReadOnly: DOMMatrixReadOnlyMock,
  });
  (
    globalThis.SVGElement.prototype as unknown as { getBBox: () => DOMRect }
  ).getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
});

afterEach(() => cleanup());

const workbench = () => {
  let wb: Workbench | null = null;
  const Probe = () => {
    wb = useWorkbench();
    return null;
  };
  const view = render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
      <ModelDiagram />
    </WorkbenchProvider>,
  );
  return { wb: () => wb!, container: view.container };
};

/** The palette's entries, as the canvas shows them. */
const paletteOf = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[title]')]
    .map((element) => element.getAttribute('title') ?? '')
    .filter(Boolean);

/** A one-model project of a model file, as Open makes it (in its framework). */
const opened = (name: string, text: string) =>
  openProject(fileStore(name, inItsFramework(text)));

describe('a model added to a project (#329, lib/project)', () => {
  it('lists a KAOS model in an NFR project with its framework and mode', async () => {
    const nfr = await opened('nfr-welcome.txt', NFR_WELCOME);
    expect(nfr.manifest).toMatchObject({ dialect: 'nfr', framework: 'nfr' });
    const { project, changes } = withModel(
      nfr,
      { name: 'kaos-welcome.txt', text: inItsFramework(KAOS_WELCOME) },
      'kaos',
    );
    expect(project.form).toBe('file');
    expect(project.manifest.models).toEqual([
      { path: 'nfr-welcome.txt' },
      { path: 'kaos-welcome.txt', dialect: 'kaos', framework: 'kaos' },
    ]);
    expect(project.models.map((m) => m.settings)).toEqual([
      { mode: 'nfr', framework: 'nfr', options: {} },
      { mode: 'kaos', framework: 'kaos', options: {} },
    ]);
    expect(Object.keys(changes).sort()).toEqual([
      'kaos-welcome.txt',
      PROJECT_FILE,
    ]);
    expect(parseManifest(JSON.parse(changes[PROJECT_FILE]!))).toEqual(
      project.manifest,
    );
  });

  it('writes no framework for a model of the project’s own framework', async () => {
    const istar = await opened('simpleChoice.txt', ISTAR);
    const { project, changes } = withModel(
      istar,
      { name: 'simpleChoice.txt', text: ISTAR },
      'istar-2.0',
    );
    // a free path beside the model of that name
    expect(project.manifest.models).toEqual([
      { path: 'simpleChoice.txt' },
      { path: 'simpleChoice-2.txt' },
    ]);
    expect(changes[PROJECT_FILE]).not.toContain('framework');
    expect(project.models.map((m) => m.settings.framework)).toEqual([
      'istar-2.0',
      'istar-2.0',
    ]);
  });

  it('keeps an existing project.json byte for byte, but for the added entry', async () => {
    const manifest = `${JSON.stringify(
      {
        version: 1,
        dialect: 'kaos',
        framework: 'kaos',
        models: [{ path: 'a.txt' }],
        projectResources: {},
        outputs: [],
      },
      null,
      2,
    )}\n`;
    const files = {
      [PROJECT_FILE]: manifest,
      'a.txt': inItsFramework(KAOS_WELCOME),
    };
    const store = memoryStore(files, { kind: 'file', name: 'lab' });
    const kaos = await openProject(store);
    // its own framework's model: nothing but its path
    const same = withModel(
      kaos,
      { name: 'b.txt', text: inItsFramework(KAOS_WELCOME) },
      'kaos',
    );
    expect(same.changes[PROJECT_FILE]).toBe(
      manifest.replace(
        '"models": [\n    {\n      "path": "a.txt"\n    }\n  ]',
        '"models": [\n    {\n      "path": "a.txt"\n    },\n    {\n      "path": "b.txt"\n    }\n  ]',
      ),
    );
    // another framework's: saved and opened again, each model in its own
    const { project, changes } = withModel(
      kaos,
      { name: 'nfr.txt', text: inItsFramework(NFR_WELCOME) },
      'nfr',
    );
    await saveProject(project, changes, project.manifest);
    const reopened = await openProject(store);
    expect(reopened.manifest).toEqual(project.manifest);
    expect(serializeManifest(reopened.manifest)).toBe(changes[PROJECT_FILE]);
    expect(reopened.models.map((m) => m.settings)).toEqual([
      { mode: 'kaos', framework: 'kaos', options: {} },
      { mode: 'nfr', framework: 'nfr', options: {} },
    ]);
    expect(
      reopened.models.map((m) =>
        frameworkOfEntry(reopened.manifest, m.path, m.text),
      ),
    ).toEqual(['kaos', 'nfr']);
  });

  it('refuses only a model that isn’t in the framework it declares', () => {
    expect(addingMismatch(inItsFramework(KAOS_WELCOME))).toBeNull();
    expect(addingMismatch(inItsFramework(NFR_WELCOME))).toBeNull();
    expect(addingMismatch(ISTAR)).toBeNull();
    // an iStar model that records KAOS
    expect(
      addingMismatch(withModelSettings(ISTAR, { framework: 'kaos' })),
    ).toBe(
      'The model is in iStar 2.0, and it records KAOS: nothing converts a model between frameworks',
    );
  });
});

describe('Add to project in the workbench (#329)', () => {
  let opfs: Tree;
  beforeEach(() => {
    opfs = {};
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: { getDirectory: async () => fakeDirectory('', opfs) },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adds a KAOS file to an open NFR project: both models open, each with its own palette', async () => {
    const { wb, container } = workbench();
    await act(() => wb().openModelFile('nfr-welcome.txt', NFR_WELCOME));
    await waitFor(() => expect(wb().mode).toBe('nfr'));
    const nfrPalette = paletteOf(container);
    expect(
      nfrPalette.some((t) => t.startsWith('Adding Operationalization')),
    ).toBe(true);
    await act(() => wb().addModelFile('kaos-welcome.txt', KAOS_WELCOME));
    // no switch asked: it is added, and opened in KAOS
    expect(wb().frameworkSwitch).toBeNull();
    await waitFor(() => expect(wb().fileName).toBe('kaos-welcome.txt'));
    expect(wb().mode).toBe('kaos');
    expect(wb().modelPath).toBe('kaos-welcome.txt');
    expect(wb().project!.manifest).toMatchObject({
      dialect: 'nfr',
      framework: 'nfr',
      models: [
        { path: 'nfr-welcome.txt' },
        { path: 'kaos-welcome.txt', dialect: 'kaos', framework: 'kaos' },
      ],
    });
    // a file opened is read-only: the project is now a browser copy
    expect(wb().project!.store.readOnly).toBe(false);
    await waitFor(() =>
      expect(
        paletteOf(container).some((t) =>
          t.startsWith('Adding Behavioral Goal'),
        ),
      ).toBe(true),
    );
    const kaosPalette = paletteOf(container);
    expect(
      kaosPalette.some((t) => t.startsWith('Adding Operationalization')),
    ).toBe(false);
    // back to the NFR model, in its framework again
    act(() => wb().openProjectModel('nfr-welcome.txt'));
    await waitFor(() => expect(wb().fileName).toBe('nfr-welcome.txt'));
    expect(wb().mode).toBe('nfr');
    expect(wb().problems).toEqual([]);
    await waitFor(() => expect(paletteOf(container)).toEqual(nfrPalette));
    act(() => wb().openProjectModel('kaos-welcome.txt'));
    await waitFor(() => expect(wb().mode).toBe('kaos'));
    await waitFor(() => expect(paletteOf(container)).toEqual(kaosPalette));
  });

  it('adds an iStar file to an iStar project with no framework written', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await waitFor(() => expect(wb().fileName).toBe('simpleChoice.txt'));
    await act(() => wb().addModelFile('twin.txt', ISTAR));
    await waitFor(() => expect(wb().fileName).toBe('twin.txt'));
    const project = wb().project!;
    expect(project.manifest.models).toEqual([
      { path: 'simpleChoice.txt' },
      { path: 'twin.txt' },
    ]);
    expect(await project.store.read(PROJECT_FILE)).not.toContain('framework');
    expect(wb().text).toBe(ISTAR);
  });

  it('refuses a model that isn’t in the framework it records; nothing is added', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('kaos-welcome.txt', KAOS_WELCOME));
    await waitFor(() => expect(wb().mode).toBe('kaos'));
    const before = wb().project;
    await expect(
      wb().addModelFile(
        'odd.txt',
        withModelSettings(ISTAR, { framework: 'nfr' }),
      ),
    ).rejects.toThrow(
      'odd.txt: The model is in iStar 2.0, and it records NFR Framework: nothing converts a model between frameworks',
    );
    expect(wb().project).toBe(before);
    expect(wb().fileName).toBe('kaos-welcome.txt');
  });

  it('keeps the left model’s edits in the project when another is opened', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await waitFor(() => expect(wb().fileName).toBe('simpleChoice.txt'));
    await act(() => wb().addModelFile('kaos.txt', KAOS_WELCOME));
    await waitFor(() => expect(wb().mode).toBe('kaos'));
    const edited = wb().text.replace('Reliability', 'Availability');
    act(() => wb().setText(edited, 'source'));
    act(() => wb().openProjectModel('simpleChoice.txt'));
    await waitFor(() => expect(wb().fileName).toBe('simpleChoice.txt'));
    expect(wb().mode).toBe('pistar');
    act(() => wb().openProjectModel('kaos.txt'));
    await waitFor(() => expect(wb().fileName).toBe('kaos.txt'));
    expect(wb().text).toBe(edited);
    expect(wb().dirty).toBe(true);
  });
});
