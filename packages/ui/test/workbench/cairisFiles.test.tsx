/**
 * A CAIRIS model file in the workbench (goal-controller#192): the Open
 * dialog takes it by its content (its DOCTYPE or `<cairis_model>`), and
 * opening it makes the project of its environments' KAOS models, one each
 * (D2), in kaosprop's mode; the first opens, read with the `cairis`
 * vocabulary profile, so CAIRIS's values are no Problem. A CAIRIS file
 * while an iStar model is open waits for the switch, as a `.kaos` does.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import ModelDiagram from '@/components/workbench/engines/ModelDiagram';
import {
  OPEN_ACCEPT,
  addUpload,
  openUpload,
} from '@/components/workbench/TopBar';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { frameworkOfModel } from '@/lib/workbench/frameworks';
import { mockReactFlowDom } from './reactFlowDom';

const ROOT = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const FIXTURES = 'packages/lib/test/importers/fixtures/cairis';
const NEUROGRID = read(`${FIXTURES}/NeuroGrid.xml`);
const ISTAR = read('examples/edge/simpleChoice.txt');

beforeAll(mockReactFlowDom);

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

describe('a CAIRIS model file in the workbench (#192)', () => {
  it('is taken by the Open dialog', () => {
    expect(OPEN_ACCEPT.split(',')).toContain('.xml');
  });

  it('opens as the project of its environments’ models, the first open, in kaosprop’s mode, clean', async () => {
    const { wb } = workbench(true);
    await act(() => openUpload(wb(), new File([NEUROGRID], 'NeuroGrid.xml')));
    await waitFor(() => expect(wb().fileName).toBe('NeuroGrid-psychosis.txt'));
    expect(wb().mode).toBe('kaosprop');
    expect(frameworkOfModel(wb().text)).toBe('kaos');
    expect(wb().project!.manifest).toMatchObject({
      dialect: 'kaosprop',
      framework: 'kaos',
      // no .kaos is the source's (D4): none is written from the models
      models: [
        { path: 'NeuroGrid-psychosis.txt', native: { kaos: null } },
        { path: 'NeuroGrid-stroke.txt', native: { kaos: null } },
        { path: 'NeuroGrid-core-technology.txt', native: { kaos: null } },
      ],
    });
    expect(wb().nativeStates).toEqual([]);
    // the model is the seed's (the same file, read), but for its name
    const model = JSON.parse(wb().text);
    const seed = JSON.parse(
      read(
        'examples/kaos/cairis-neurogrid-psychosis/cairis-neurogrid-psychosis.txt',
      ),
    );
    expect(model.orphans).toEqual(seed.orphans);
    expect(model.diagram.customProperties.cairisEnvironment).toBe('Psychosis');
    // CAIRIS's values are no Problem; the source's two obstructions of refined goals are
    await waitFor(() =>
      expect(wb().problems.map((p) => p.code)).toEqual([
        'not-a-leaf',
        'not-a-leaf',
      ]),
    );
  });

  it('waits for the switch to be confirmed while an iStar model is open; it is no model to add', async () => {
    const { wb } = workbench();
    await act(() => wb().openModelFile('simpleChoice.txt', ISTAR));
    await waitFor(() => expect(wb().fileName).toBe('simpleChoice.txt'));
    await act(() => openUpload(wb(), new File([NEUROGRID], 'NeuroGrid.xml')));
    expect(wb().fileName).toBe('simpleChoice.txt');
    expect(wb().frameworkSwitch).toMatchObject({
      fileName: 'NeuroGrid.xml',
      framework: 'kaos',
    });
    await act(() => wb().confirmFrameworkSwitch());
    await waitFor(() => expect(wb().fileName).toBe('NeuroGrid-psychosis.txt'));
    await expect(
      addUpload(wb(), new File([NEUROGRID], 'NeuroGrid.xml')),
    ).rejects.toThrow('NeuroGrid.xml is a project of its own: Open it instead');
  });
});
