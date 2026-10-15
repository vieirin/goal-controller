/**
 * The start screen (components/workbench/home/Home.tsx): the examples in a
 * section per engine, each a card that draws its model; an example with files
 * beside its model a project card listing them; a search narrowing them; a
 * card opening its example.
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
import { WorkbenchProvider } from '@/components/workbench/WorkbenchContext';
import manifest from '@/lib/examples-manifest.json';
import { declarationsOf } from '@/lib/workbench/projectResources';
import { SECTION_REFERENCES } from '@/components/workbench/home/references';
import { previewOf } from '@/scripts/examplePreview.mjs';
import { location, router } from './support/navigation';

vi.mock('next/navigation', () => import('./support/navigation'));

const EXAMPLES = join(__dirname, '../../../../examples');
const PREVIEWS = Object.fromEntries(
  manifest.map((entry) => [
    entry.path,
    previewOf(
      readFileSync(join(EXAMPLES, entry.root, entry.models[0]!), 'utf8'),
    ),
  ]),
);

const opened = vi.hoisted(() => vi.fn());
vi.mock('@/services/examples', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/examples')>();
  return {
    ...actual,
    listExamplePreviews: async () => PREVIEWS,
    openExample: async (...args: Parameters<typeof actual.openExample>) => {
      opened(args[0]);
      return new Promise(() => {});
    },
  };
});

const home = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkbenchProvider lockedEngine={null}>
        <ExampleRoute>
          <Home onNewModel={() => {}} />
        </ExampleRoute>
      </WorkbenchProvider>
    </QueryClientProvider>,
  );

const card = async (name: RegExp) =>
  (await screen.findByRole('button', { name })).closest('li')!;

afterEach(() => {
  cleanup();
  location.set('/');
});

describe('Home', () => {
  it('shows a section per engine, EDGEv2 first, each holding its folder’s examples', async () => {
    home();
    const sections = await screen.findAllByRole('region', {
      name: (name) => name !== 'Open a goal model',
    });
    const groups = new Map<string, number>();
    for (const entry of manifest)
      groups.set(entry.group, (groups.get(entry.group) ?? 0) + 1);
    expect(sections).toHaveLength(groups.size);
    expect(
      within(within(sections[0]!).getByRole('heading', { level: 2 })).getByText(
        'edgeV2/',
      ),
    ).toBeTruthy();
    for (const section of sections) {
      const heading = within(section).getByRole('heading', { level: 2 });
      const folder = within(heading).getByText(/\/$/).textContent!.slice(0, -1);
      expect(
        within(section).getAllByRole('button', {
          name: /^Open the .* example/,
        }),
        folder,
      ).toHaveLength(groups.get(folder)!);
    }
  });

  it('draws each example’s model on its card', async () => {
    home();
    await waitFor(() =>
      expect(
        document
          .querySelector('li:has(button[aria-label*="medicine-delivery"])')!
          .querySelectorAll('svg rect, svg polygon').length,
      ).toBeGreaterThan(5),
    );
  });

  it('shows an example with files beside its model as a project, with them', async () => {
    home();
    const project = await card(/lab-sample-logistics, a project/);
    const entry = manifest.find(
      (e) => e.path === 'mutrose/lab-sample-logistics',
    )!;
    expect(within(project).getByText('Project')).toBeTruthy();
    expect(
      within(project).getByText(`${entry.files.length} files`),
    ).toBeTruthy();
    const declarations = declarationsOf('mutrose')!;
    for (const kind of ['world', 'hddl', 'configuration'])
      expect(within(project).getByText(declarations[kind]!.label)).toBeTruthy();
    // an experiment: its properties, and the results to compare with
    const experiment = await card(
      /edge example experiments\/1-minimal, a project/,
    );
    expect(
      within(experiment).getByText(declarationsOf('edge')!.properties!.label),
    ).toBeTruthy();
    expect(within(experiment).getByText('reference')).toBeTruthy();
    // a model alone is no project
    expect(
      within(await card(/edge example simpleChoice\.txt$/)).queryByText(
        'Project',
      ),
    ).toBeNull();
  });

  it('narrows the examples to a search, and says when nothing matches', async () => {
    home();
    await card(/medicine-delivery/);
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'medicine' } });
    expect(
      screen.getAllByRole('button', { name: /^Open the .* example/ }),
    ).toHaveLength(1);
    fireEvent.change(search, { target: { value: 'no such model' } });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it('opens the example of a card clicked on a page of its own, showing it busy until it opens', async () => {
    home();
    const button = await screen.findByRole('button', {
      name: /medicine-delivery, a project/,
    });
    fireEvent.click(button);
    expect(router.push).toHaveBeenCalledWith(
      '/?example=mutrose/medicine-delivery',
    );
    await waitFor(() =>
      expect(opened).toHaveBeenCalledWith(
        manifest.find((e) => e.path === 'mutrose/medicine-delivery'),
      ),
    );
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('ends each engine’s section with its references, each example source one there is', async () => {
    home();
    const paths = new Set(manifest.map((entry) => entry.path));
    for (const [group, references] of Object.entries(SECTION_REFERENCES)) {
      for (const reference of references)
        for (const path of reference.examples ?? [])
          expect(paths.has(path), `${group}: ${path}`).toBe(true);
      if (!manifest.some((entry) => entry.group === group)) continue;
      const section = (await screen.findByText(`${group}/`)).closest(
        'section',
      )!;
      const links = within(section).getAllByRole('link');
      expect(links.map((link) => link.getAttribute('href'))).toEqual(
        references.flatMap((reference) => reference.url ?? []),
      );
    }
  });
});
