/**
 * The mode lists by framework (goal-controller#171): a new model's framework
 * is chosen in its setup, which gives it the framework's empty model in the
 * framework's mode; a KAOS model is offered KAOS's engine and mode only, and
 * no piStar or iStar engine; the Convert dialog lists the model's
 * framework's targets only.
 * iStar's lists are as they were.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import ConvertDialog from '@/components/workbench/ConvertDialog';
import ModelSettingsModal from '@/components/workbench/ModelSettingsModal';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import { ENGINES, isFrameworkEngine } from '@/lib/workbench/engineDialects';
import { emptyModelText, frameworkOfModel } from '@/lib/workbench/frameworks';
import { EMPTY_PISTAR_MODEL, writeModelMode } from '@/lib/workbench/pistar';

const ROOT = join(__dirname, '../../../..');
const KAOS_WELCOME = readFileSync(
  join(ROOT, 'examples/kaos/kaos-welcome.txt'),
  'utf8',
);
const ISTAR = readFileSync(
  join(ROOT, 'examples/edge/simpleChoice.txt'),
  'utf8',
);

// the settings dialog asks whether it's on a phone (jsdom has no media queries)
beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => cleanup());

/** The workbench with its settings dialog and conversion dialog, as Workbench shows them. */
const workbench = () => {
  let wb: Workbench | null = null;
  const Shell = () => {
    wb = useWorkbench();
    return (
      <>
        {wb.settingsDialog && wb.hasModel && <ModelSettingsModal />}
        {wb.conversion && wb.hasModel && (
          <ConvertDialog target={wb.conversion.target} />
        )}
      </>
    );
  };
  render(
    <WorkbenchProvider lockedEngine={null}>
      <Shell />
    </WorkbenchProvider>,
  );
  return () => wb!;
};

const cards = () =>
  within(screen.getByRole('dialog'))
    .getAllByRole('radio', { hidden: true })
    .filter((radio) => radio.getAttribute('name') === 'engine')
    .map((radio) => radio.getAttribute('value'));

describe('the mode lists by framework (#171)', () => {
  it('sets a new model up in the framework chosen: its empty model, in its mode', async () => {
    const wb = workbench();
    await act(() =>
      wb().openFile('untitled.txt', EMPTY_PISTAR_MODEL, { setup: true }),
    );
    await screen.findByRole('dialog');
    // iStar 2.0 first: its engines, its dialects and piStar, as before
    expect(cards()).toEqual([
      ...ENGINES.filter((engine) => !isFrameworkEngine(engine.id)).map(
        (engine) => engine.id,
      ),
      'pistarext',
      'pistar',
    ]);
    // KAOS: its engines (PR D, #181), then its modelling mode
    fireEvent.click(screen.getByRole('radio', { name: 'KAOS' }));
    expect(cards()).toEqual(['kaosdoc', 'kaosprop', 'kaosexpert', 'kaos']);
    // no conformity for the empty iStar model the KAOS one replaces
    expect(screen.queryByText(/has problems|accepts the model/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start working' }));
    await waitFor(() => expect(wb().mode).toBe('kaos'));
    expect(wb().text).toBe(writeModelMode(emptyModelText('kaos'), 'kaos'));
    expect(frameworkOfModel(wb().text)).toBe('kaos');
  });

  it('offers a KAOS model KAOS’s engines and mode only, its framework fixed', async () => {
    const wb = workbench();
    await act(() =>
      wb().openFile('kaos-welcome.txt', writeModelMode(KAOS_WELCOME, 'kaos'), {
        setup: true,
      }),
    );
    await screen.findByRole('dialog');
    expect(cards()).toEqual(['kaosdoc', 'kaosprop', 'kaosexpert', 'kaos']);
    // not a choice: the model has elements
    expect(screen.queryByRole('radiogroup', { name: 'Framework' })).toBeNull();
    expect(
      within(screen.getByRole('dialog')).getByText('KAOS', {
        selector: 'span.font-medium',
      }),
    ).toBeTruthy();
  });

  it('converts an iStar model to iStar’s modes only', async () => {
    const wb = workbench();
    await act(() => wb().openFile('simpleChoice.txt', ISTAR));
    await waitFor(() => expect(wb().hasModel).toBe(true));
    act(() => wb().openConversion('edge'));
    const dialog = await screen.findByRole('dialog');
    const targets = within(dialog)
      .getAllByRole('radio', { hidden: true })
      .map((radio) => radio.getAttribute('value'));
    expect(targets).toContain('edge');
    expect(targets).toContain('pistarext');
    expect(targets).not.toContain('kaos');
    expect(targets).not.toContain('nfr');
    expect(targets).not.toContain('kaosdoc');
    expect(targets).not.toContain('nfrprop');
  });
});
