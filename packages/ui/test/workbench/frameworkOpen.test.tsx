/**
 * Opening a model file in its framework (goal-controller#171): DSM3's KAOS
 * welcome model, which records no framework, is detected by its content and
 * opens in KAOS's mode, its canvas drawing its 4 refinement hubs; an iStar
 * file while a KAOS model is open is refused with conformity's message
 * until the switch is confirmed; iStar files open as before.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import ModelDiagram from '@/components/workbench/engines/ModelDiagram';
import FrameworkNotationView from '@/components/workbench/engines/framework/FrameworkNotationView';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { modelSettingsOf } from '@/lib/project';
import { inItsFramework, openingMismatch } from '@/lib/workbench/frameworkOpen';
import { frameworkOfModel } from '@/lib/workbench/frameworks';

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
  // what CodeMirror measures text with (the Notation tab)
  Object.assign(Range.prototype, {
    getClientRects: () => [],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  });
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

describe('a model file in its framework (#171)', () => {
  it('records a DSM3 file’s framework mode; an iStar or recorded file stays as it is', () => {
    expect(frameworkOfModel(KAOS_WELCOME)).toBe('kaos');
    expect(modelSettingsOf(inItsFramework(KAOS_WELCOME))).toMatchObject({
      mode: 'kaos',
      framework: 'kaos',
    });
    expect(modelSettingsOf(inItsFramework(NFR_WELCOME))).toMatchObject({
      mode: 'nfr',
      framework: 'nfr',
    });
    const opened = inItsFramework(KAOS_WELCOME);
    expect(inItsFramework(opened)).toBe(opened);
    expect(inItsFramework(ISTAR)).toBe(ISTAR);
    expect(inItsFramework('not json')).toBe('not json');
  });

  it('says why a model of another framework can’t open in the project', () => {
    expect(openingMismatch(ISTAR, undefined)).toBeNull();
    expect(openingMismatch(ISTAR, 'istar-2.0')).toBeNull();
    expect(openingMismatch(KAOS_WELCOME, 'kaos')).toBeNull();
    expect(openingMismatch(ISTAR, 'kaos')).toBe(
      'The model is in iStar 2.0, and the project in KAOS: nothing converts a model between frameworks',
    );
  });

  it('opens DSM3’s KAOS file as KAOS, its canvas drawing its 4 hubs', async () => {
    const { wb, container } = workbench(true);
    await act(() => wb().openModelFile('kaos-welcome.txt', KAOS_WELCOME));
    await waitFor(() => expect(wb().fileName).toBe('kaos-welcome.txt'));
    expect(wb().mode).toBe('kaos');
    expect(modelSettingsOf(wb().text).framework).toBe('kaos');
    expect(wb().problems).toEqual([]);
    await waitFor(() =>
      expect(container.querySelectorAll('.istar-hub')).toHaveLength(4),
    );
  });

  it('refuses an iStar file in a KAOS project with conformity’s message, until the switch is confirmed', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('kaos-welcome.txt', KAOS_WELCOME));
    await waitFor(() => expect(wb().mode).toBe('kaos'));
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    expect(wb().fileName).toBe('kaos-welcome.txt');
    expect(wb().frameworkSwitch).toMatchObject({
      fileName: 'simpleChoice.txt',
      framework: 'istar-2.0',
      project: 'kaos',
      message:
        'The model is in iStar 2.0, and the project in KAOS: nothing converts a model between frameworks',
    });
    // kept: nothing opened
    act(() => wb().cancelFrameworkSwitch());
    expect(wb().frameworkSwitch).toBeNull();
    expect(wb().fileName).toBe('kaos-welcome.txt');
    // confirmed: the iStar file opens, as it would have
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await act(() => wb().confirmFrameworkSwitch());
    await waitFor(() => expect(wb().fileName).toBe('simpleChoice.txt'));
    expect(wb().text).toBe(ISTAR);
    // an iStar model with no engine recorded: piStar mode, its engine chosen in setup
    expect(wb().mode).toBe('pistar');
    expect(wb().settingsDialog).toBe('setup');
  });

  it('opens an iStar file as before: its text as it is, nothing to confirm', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await waitFor(() => expect(wb().fileName).toBe('simpleChoice.txt'));
    expect(wb().frameworkSwitch).toBeNull();
    expect(wb().text).toBe(ISTAR);
    await act(() => wb().openModelFile('again.txt', ISTAR));
    await waitFor(() => expect(wb().fileName).toBe('again.txt'));
    expect(wb().frameworkSwitch).toBeNull();
  });
});

describe('a framework model’s Notation tab (#171)', () => {
  it('shows a KAOS model as KAOS’s lines: a hub an AND, brackets the name’s', async () => {
    const json = JSON.parse(KAOS_WELCOME);
    const count = new Map<string, number>();
    const prefix: Record<string, string> = {
      'kaos.BehavioralGoal': 'G',
      'kaos.Softgoal': 'G',
      'kaos.Agent': 'A',
      'kaos.EnvironmentAgent': 'A',
      'kaos.DomainProperty': 'DP',
    };
    for (const element of json.orphans) {
      const p = prefix[element.type]!;
      count.set(p, (count.get(p) ?? 0) + 1);
      element.text = `${p}${count.get(p)}: ${element.text}`;
    }
    const withIds = `${JSON.stringify(json, null, 2)}\n`;
    let wb: Workbench | null = null;
    const Probe = () => {
      wb = useWorkbench();
      return null;
    };
    const { container } = render(
      <WorkbenchProvider lockedEngine={null}>
        <Probe />
        <FrameworkNotationView mode='kaos' />
      </WorkbenchProvider>,
    );
    await act(() => wb!.openModelFile('kaos-ids.txt', withIds));
    await waitFor(() =>
      expect(container.textContent).toContain('G5: Achieve [Manual Backup]'),
    );
    const lines = [...container.querySelectorAll('.cm-line')].map(
      (line) => line.textContent,
    );
    expect(lines).toContain('  G3: Achieve [Problem Notified if Problem]');
    expect(lines).toContain('      DP1: Internet connection available');
  });
});
