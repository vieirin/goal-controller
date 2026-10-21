/**
 * `.kaos` in the workbench (goal-controller#181): KAOSTools' textual KAOS
 * is kaosprop's native file, so the Open dialog takes it and opening one
 * makes its project, in kaosprop's mode (the KAOS framework); a `.kaos`
 * while a model of another framework is open waits for the switch to be
 * confirmed (#171); a `.kaos` with resolutions opens in kaosres's mode
 * (#191). Analyse on ADS's London Ambulance System (the `ambulance` seed)
 * badges `Achieve [Incident Resolved]` with its EPS against its 95%; on the
 * flood seed, the countermeasure selection draws the chosen one.
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
  selectionStyle,
  shownCase,
  shownStep,
} from '@/lib/workbench/analysis';
import { nativeFileOf } from '@/lib/workbench/nativeFiles';

const ROOT = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const LAS = read('examples/kaos/las/las.kaos');
const AMBULANCE = read('examples/kaos/ambulance/ambulance.kaos');
const FLOOD = read('examples/kaos/flood/flood.kaos');
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

  it('opens as its project, in kaosres’s mode (KAOSTools’ LAS has a resolution, #191), the file beside its model', async () => {
    const { wb } = workbench();
    await act(() => openUpload(wb(), new File([LAS], 'las.kaos')));
    await waitFor(() => expect(wb().fileName).toBe('las.txt'));
    // its mode is the project's (its manifest: the native file's dialect), its framework its kinds'
    expect(wb().mode).toBe('kaosres');
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
    expect(wb().mode).toBe('kaosres');
  });

  it(
    'opens ADS’s ambulance.kaos in kaosexpert’s mode, its experts and calibrations its resources; Analyse badges Achieve [Incident Resolved] with its VU and US (#190)',
    async () => {
      const { wb, container } = workbench(true);
      await act(() =>
        openUpload(wb(), new File([AMBULANCE], 'ambulance.kaos')),
      );
      await waitFor(() => expect(wb().fileName).toBe('ambulance.txt'));
      expect(wb().mode).toBe('kaosexpert');
      expect(wb().resourceSlots.map((slot) => [slot.kind, slot.paths])).toEqual(
        [
          ['expert', ['experts.json']],
          ['calibration', ['calibrations.json']],
          ['evidence', []],
        ],
      );
      expect(Object.keys(wb().analyses ?? {})).toEqual([
        'uncertainty',
        'criticalObstacles',
      ]);
      // its five experts' 47 leaves: 2000 samples, the engine's option, keep it quick
      act(() => wb().setOptions({ samples: 2000 }));
      act(() => wb().runAnalysis('uncertainty'));
      await waitFor(() => expect(wb().analysisRun).not.toBeNull());
      const value = shownCase(wb().analysisRun)?.values[
        'achieve_incident_resolved'
      ];
      // ADS's five experts (#198): violated for certain, as RE'15
      expect(value?.label).toMatch(/^P [0-9.]+% · VU 1 · US 0\.94[0-9]*$/);
      expect(value?.distribution?.samples).toBe(2000);
      // its report's last step (the goals') is the canvas's once stepped to
      act(() => wb().stepAnalysis(10_000));
      await waitFor(() =>
        expect(
          container.querySelector(
            '[data-id="achieve_incident_resolved"] .istar-issues-badge',
          ),
        ).not.toBeNull(),
      );
    },
    // a 117-element model opened, laid out and analysed: near 5 s in the full
    // suite on a loaded machine, on main already
    15_000,
  );

  it('Analyse on ADS’s London Ambulance System badges Achieve [Incident Resolved] (PR G’s test, in kaosprop’s mode)', async () => {
    const { wb, container } = workbench(true);
    await act(() => openUpload(wb(), new File([AMBULANCE], 'ambulance.kaos')));
    await waitFor(() => expect(wb().fileName).toBe('ambulance.txt'));
    // kaosprop reads the same file: its estimates are per expert, which it doesn't combine
    act(() => wb().setEngine('kaosprop'));
    await waitFor(() => expect(wb().mode).toBe('kaosprop'));
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

  it('opens the flood seed in kaosres’s mode; the countermeasure selection draws the chosen one, the rest dimmed (#191)', async () => {
    const { wb } = workbench();
    await act(() => openUpload(wb(), new File([FLOOD], 'flood.kaos')));
    await waitFor(() => expect(wb().fileName).toBe('flood.txt'));
    expect(wb().mode).toBe('kaosres');
    expect(Object.keys(wb().analyses ?? {})).toEqual([
      'selection',
      'probabilities',
      'criticalCombinations',
    ]);
    act(() => wb().runAnalysis('selection'));
    await waitFor(() => expect(wb().analysisRun).not.toBeNull());
    const chosen = shownCase(wb().analysisRun);
    expect(chosen?.label).toBe(
      'Chosen: Achieve [SpeedAcquiredEvery5SecondsByCamera] + Maintain [CameraSpeedAccurate] + Achieve [LocalsWarnedBySMSWhenLevelsCritical]',
    );
    expect(chosen?.values['locals_warned_when_risk_imminent']).toEqual({
      value: 0.76,
      label: 'EPS 76.00% · SV -11.00%',
    });
    // the phone warning it substitutes is dimmed, the SMS warning kept
    const style = selectionStyle(chosen)!;
    expect(style).toContain('[data-id="locals_warned_by_sms"]');
    expect(style).not.toContain('[data-id="locals_warned"]');
  });
});
