/**
 * `.kaos` in the workbench (goal-controller#181): KAOSTools' textual KAOS
 * is kaosprop's native file, so the Open dialog takes it and opening one
 * makes its project, in kaosprop's mode (the KAOS framework); a `.kaos`
 * while a model of another framework is open waits for the switch to be
 * confirmed (#171). Analyse on ADS's London Ambulance System (the
 * `ambulance` seed) badges `Achieve [Incident Resolved]` with its EPS
 * against its 95%.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import ModelDiagram from '@/components/workbench/engines/ModelDiagram';
import { OPEN_ACCEPT, openUpload } from '@/components/workbench/TopBar';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { frameworkOfModel } from '@/lib/workbench/frameworks';
import {
  analysisDiagnostics,
  shownCase,
  shownStep,
} from '@/lib/workbench/analysis';
import { nativeFileOf } from '@/lib/workbench/nativeFiles';

const ROOT = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const LAS = read('examples/kaos/las/las.kaos');
const AMBULANCE = read('examples/kaos/ambulance/ambulance.kaos');
const ISTAR = read('examples/edge/simpleChoice.txt');

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

const workbench = (diagram = false) => {
  let wb: Workbench | null = null;
  const Probe = () => {
    wb = useWorkbench();
    return null;
  };
  const view = render(
    <WorkbenchProvider lockedEngine={null}>
      <Probe />
      {diagram && <ModelDiagram />}
    </WorkbenchProvider>,
  );
  return { wb: () => wb!, container: view.container };
};

describe('a .kaos file in the workbench (#181)', () => {
  it('is kaosprop’s native file, which the Open dialog takes', () => {
    expect(OPEN_ACCEPT.split(',')).toContain('.kaos');
    expect(nativeFileOf('las.kaos')).toMatchObject({
      dialect: 'kaosprop',
      id: 'kaos',
      baseName: 'las',
    });
  });

  it('opens as its project, in kaosprop’s mode, the file beside its model', async () => {
    const { wb } = workbench();
    await act(() => openUpload(wb(), new File([LAS], 'las.kaos')));
    await waitFor(() => expect(wb().fileName).toBe('las.txt'));
    // its mode is the project's (its manifest: the native file's dialect), its framework its kinds'
    expect(wb().mode).toBe('kaosprop');
    expect(frameworkOfModel(wb().text)).toBe('kaos');
    const model = JSON.parse(wb().text);
    expect(
      model.orphans.filter((n: { type: string }) => n.type === 'kaos.Obstacle'),
    ).toHaveLength(6);
    // the .kaos file is the project's, in sync with the model
    await waitFor(() =>
      expect(wb().nativeStates.map((s) => s.slot.path)).toEqual(['las.kaos']),
    );
    expect(wb().nativeStates[0]!.text).toBe(LAS);
    expect(wb().problems).toEqual([]);
  });

  it('waits for the switch to be confirmed while an iStar model is open', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await waitFor(() => expect(wb().fileName).toBe('simpleChoice.txt'));
    await act(() => openUpload(wb(), new File([LAS], 'las.kaos')));
    expect(wb().fileName).toBe('simpleChoice.txt');
    expect(wb().frameworkSwitch).toMatchObject({
      fileName: 'las.kaos',
      framework: 'kaos',
      project: 'istar-2.0',
      message:
        'The model is in KAOS, and the project in iStar 2.0: nothing converts a model between frameworks',
    });
    act(() => wb().cancelFrameworkSwitch());
    expect(wb().fileName).toBe('simpleChoice.txt');
    await act(() => openUpload(wb(), new File([LAS], 'las.kaos')));
    await act(() => wb().confirmFrameworkSwitch());
    await waitFor(() => expect(wb().fileName).toBe('las.txt'));
    expect(wb().mode).toBe('kaosprop');
  });

  it('Analyse on ADS’s London Ambulance System badges Achieve [Incident Resolved] (PR G’s test)', async () => {
    const { wb, container } = workbench(true);
    await act(() => openUpload(wb(), new File([AMBULANCE], 'ambulance.kaos')));
    await waitFor(() => expect(wb().fileName).toBe('ambulance.txt'));
    expect(Object.keys(wb().analyses ?? {})).toContain('probabilities');
    act(() => wb().runAnalysis('probabilities'));
    await waitFor(() => expect(wb().analysisRun).not.toBeNull());
    expect(
      shownCase(wb().analysisRun)?.values['achieve_incident_resolved'],
    ).toEqual({ value: 1, label: 'EPS 100.00% · SV -5.00%' });
    // its step is the last (the root's): stepped to, its badge is the canvas's
    act(() => wb().stepAnalysis(10_000));
    const run = wb().analysisRun;
    const badges = analysisDiagnostics(shownCase(run), shownStep(run)?.index);
    expect(
      badges.find((b) => b.elementId === 'achieve_incident_resolved'),
    ).toMatchObject({
      message: expect.stringContaining('EPS 100.00% · SV -5.00%'),
    });
    // drawn on its node
    await waitFor(() =>
      expect(
        container.querySelector(
          '[data-id="achieve_incident_resolved"] .istar-issues-badge',
        ),
      ).not.toBeNull(),
    );
  });
});
