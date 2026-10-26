/**
 * Typed inspector fields for a framework engine's own properties
 * (goal-controller#327): nfrprop's diagram types `initialLabel` as a
 * select, writing `customProperties.initialLabel`, which Analyse then
 * reads (the lib case "starts from the initial labels",
 * packages/lib/test/engines/nfrprop/nfrprop.test.ts).
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import ModelDiagram from '@/components/workbench/engines/ModelDiagram';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { parseModel } from '@/lib/workbench/dialects';
import { ENGINE_ANALYSES } from '@/lib/workbench/engineDialects';
import { writeModelMode } from '@/lib/workbench/pistar';
import { mockReactFlowDom } from './reactFlowDom';

const ROOT = join(__dirname, '../../../..');
const NFR_WELCOME = readFileSync(
  join(ROOT, 'examples/nfr/nfr-welcome.txt'),
  'utf8',
);

beforeAll(mockReactFlowDom);

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

describe('nfrprop types initialLabel in the inspector (#327)', () => {
  it('shows a select; choosing "denied" writes customProperties.initialLabel', async () => {
    const { wb } = workbench();
    await act(() =>
      wb().openFile('nfr-welcome.txt', writeModelMode(NFR_WELCOME, 'nfrprop')),
    );
    await waitFor(() => expect(wb().mode).toBe('nfrprop'));

    fireEvent.click(screen.getByText('Encrypt with RSA 260 bits'));
    const select = await waitFor(
      () => screen.getByLabelText('initialLabel') as HTMLSelectElement,
    );
    expect(select.tagName).toBe('SELECT');

    fireEvent.change(select, { target: { value: 'denied' } });
    await waitFor(() => {
      const element = JSON.parse(wb().text).orphans.find(
        (o: { id: string }) => o.id === '1f16044e-7b7a-49c3-b8ac-8b3bb2410b3c',
      );
      expect(element.customProperties.initialLabel).toBe('denied');
    });

    // Analyse then starts the softgoal it feeds from this label (Chung et al.)
    const engine = ENGINE_ANALYSES.nfrprop!;
    const model = engine.model(parseModel(wb().text) as never);
    const labels = engine.analyses.nfrLabels!.run(model).cases[0]!.values;
    expect(labels['cdfac142-9e92-403f-a3c9-b1858a5e6e77']?.value).toBe(
      'weakly-denied',
    );
  });
});
