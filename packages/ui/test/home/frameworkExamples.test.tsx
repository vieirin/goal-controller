/**
 * The KAOS and NFR seeds on the start screen (goal-controller#171): a
 * section per framework, after the engines', each holding DSM3-goals'
 * welcome model with a card that draws it; opened from there, the model is
 * for its framework's mode, with the framework recorded beside it, and
 * reads clean. KAOS's section also holds the KAOS stress test's projects
 * (goal-controller#181): KAOSTools' and ADS's London Ambulance models and
 * REJ'13's carpooling, each with its `.kaos` source, cited, opening in
 * kaosprop's mode. The examples are read from examples/ on disk, as GitHub
 * would serve them.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home from '@/components/workbench/home/Home';
import { ExampleRoute } from '@/components/workbench/home/exampleRoute';
import {
  useWorkbench,
  WorkbenchProvider,
  type Workbench,
} from '@/components/workbench/WorkbenchContext';
import manifest from '@/lib/examples-manifest.json';
import { modelTabsFor } from '@/components/workbench/modelTabs';
import { modelSettingsOf } from '@/lib/project';
import { writeModelMode } from '@/lib/workbench/pistar';
import { previewOf } from '@/scripts/examplePreview.mjs';
import { location } from './support/navigation';

vi.mock('next/navigation', () => import('./support/navigation'));

const ROOT = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const PREVIEWS = Object.fromEntries(
  manifest.map((entry) => [
    entry.path,
    previewOf(read(`examples/${entry.root}/${entry.models[0]}`)),
  ]),
);

vi.mock('@/services/examples', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/examples')>();
  return {
    ...actual,
    listExamplePreviews: async () => PREVIEWS,
    // the repository's files at the URLs the store asks for
    openExample: (entry: Parameters<typeof actual.openExample>[0]) =>
      actual.openExample(entry, async (url) => {
        const path = url.replace(/^https:\/\/[^/]+\/[^/]+\/[^/]+\/[^/]+\//, '');
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => read(decodeURI(path)),
        };
      }),
  };
});

afterEach(() => {
  cleanup();
  location.set('/');
});

/** Home, with the workbench it opens examples in. */
const home = () => {
  let wb: Workbench | null = null;
  const Probe = () => {
    wb = useWorkbench();
    return null;
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkbenchProvider lockedEngine={null}>
        <ExampleRoute>
          <Probe />
          <Home onNewModel={() => {}} />
        </ExampleRoute>
      </WorkbenchProvider>
    </QueryClientProvider>,
  );
  return () => wb!;
};

const section = async (folder: string) =>
  (await screen.findByText(`${folder}/`)).closest('section')!;

describe('Home: the KAOS and NFR seeds (#171)', () => {
  it('lists a section per framework, after the engines’ listed ones, each with its welcome model', async () => {
    home();
    const sections = await screen.findAllByRole('region', {
      name: (name) => name !== 'Open a goal model',
    });
    const folders = sections.map(
      (s) =>
        within(within(s).getByRole('heading', { level: 2 })).getByText(/\/$/)
          .textContent,
    );
    // after the engines' listed sections (piStar-ext's the last of them)
    const after = folders.indexOf('pistar-ext/');
    expect(folders.slice(after + 1, after + 3)).toEqual(['kaos/', 'nfr/']);
    for (const [folder, names] of [
      ['kaos', ['ambulance', 'carpooling', 'kaos-welcome.txt', 'las']],
      ['nfr', ['nfr-welcome.txt']],
    ] as const) {
      const buttons = within(await section(folder)).getAllByRole('button', {
        name: /^Open the .* example/,
      });
      expect(buttons, folder).toHaveLength(names.length);
      names.forEach((name, i) =>
        expect(buttons[i]!.getAttribute('aria-label'), folder).toContain(name),
      );
    }
  });

  it('draws each seed on its card', async () => {
    home();
    for (const folder of ['kaos', 'nfr'])
      await waitFor(async () =>
        expect(
          (await section(folder)).querySelectorAll('svg rect, svg polygon')
            .length,
          folder,
        ).toBeGreaterThan(3),
      );
  });

  it('cites DSM3-goals as the seeds’ source, under each framework', async () => {
    home();
    for (const folder of ['kaos', 'nfr'])
      expect(
        within(await section(folder))
          .getAllByRole('link')
          .map((link) => link.getAttribute('href')),
        folder,
      ).toContain('https://www.cin.ufpe.br/~jhcp/dsm3goals/');
  });

  it('finds them by their framework’s name', async () => {
    home();
    await section('kaos');
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'KAOS' },
    });
    expect(
      screen
        .getAllByRole('button', { name: /^Open the .* example/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      expect.stringContaining('ambulance'),
      expect.stringContaining('carpooling'),
      expect.stringContaining('kaos-welcome.txt'),
      expect.stringContaining('las'),
    ]);
  });

  it('cites the KAOS stress test’s sources under KAOS: RE’12, REJ’13, RE’15, SEAMS’17 and the two repositories (#181)', async () => {
    home();
    const links = within(await section('kaos'))
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    for (const url of [
      'https://doi.org/10.1109/RE.2012.6345805',
      'https://doi.org/10.1007/s00766-013-0168-5',
      'https://doi.org/10.1109/RE.2015.7320413',
      'https://doi.org/10.1109/SEAMS.2017.5',
      'https://github.com/ancailliau/KAOSTools',
      'https://github.com/ancailliau/ADS',
    ])
      expect(links).toContain(url);
  });

  it('opens a KAOS stress-test seed as its project, in kaosprop’s mode, its .kaos beside its model (#181)', async () => {
    const wb = home();
    fireEvent.click(
      await screen.findByRole('button', { name: /Open the .*carpooling/ }),
    );
    await waitFor(() => expect(wb().fileName).toBe('carpooling.txt'));
    expect(wb().mode).toBe('kaosprop');
    expect(modelSettingsOf(wb().text)).toMatchObject({
      mode: 'kaosprop',
      framework: 'kaos',
    });
    // the model is the example's, byte for byte, its mode recorded as every
    // example's is when it opens; its native file in sync
    expect(wb().text).toBe(
      writeModelMode(
        read('examples/kaos/carpooling/carpooling.txt'),
        'kaosprop',
      ),
    );
    await waitFor(() =>
      expect(wb().nativeStates.map((s) => s.slot.path)).toEqual([
        'carpooling.kaos',
      ]),
    );
    expect(wb().nativeStates[0]!.sync).toBeNull();
  });

  it('opens the KAOS seed for its framework’s mode, clean', async () => {
    const wb = home();
    fireEvent.click(
      await screen.findByRole('button', { name: /kaos-welcome\.txt/ }),
    );
    await waitFor(() => expect(wb().fileName).toBe('kaos-welcome.txt'));
    expect(wb().mode).toBe('kaos');
    // its framework's Notation, no engine's
    expect(modelTabsFor(wb().mode, wb().engine).map((t) => t.id)).toEqual([
      'diagram',
      'notation',
      'source',
    ]);
    expect(modelSettingsOf(wb().text)).toMatchObject({
      mode: 'kaos',
      framework: 'kaos',
    });
    expect(wb().problems).toEqual([]);
  });

  it('opens the NFR seed for its framework’s mode, clean', async () => {
    const wb = home();
    fireEvent.click(
      await screen.findByRole('button', { name: /nfr-welcome\.txt/ }),
    );
    await waitFor(() => expect(wb().fileName).toBe('nfr-welcome.txt'));
    expect(wb().mode).toBe('nfr');
    expect(modelSettingsOf(wb().text).framework).toBe('nfr');
    expect(wb().problems).toEqual([]);
  });
});
