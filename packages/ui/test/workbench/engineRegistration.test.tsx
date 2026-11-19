/**
 * The goal of the engine registry (goal-controller#124's follow-up): adding an
 * engine to the workbench is one registration. A made-up engine, a minimal
 * lib engine object defined here, is registered the way the registry
 * registers one (`workbench(madeUpEngine)`, no view of its own) and nothing
 * else is edited: it shows wherever the workbench lists engines, the services
 * dispatch to it, and it gets the default diagram and inspector.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const ID = 'madeup';

vi.mock('@goal-controller/lib', async (importOriginal) => {
  const lib = await importOriginal<typeof import('@goal-controller/lib')>();
  const madeUpEngine = lib.defineEngine({
    id: 'madeup',
    label: 'Made-up',
    help: 'An engine made up for this test',
    dialect: lib.goda,
    checks: lib.godaCheckRegistry,
    mapper: lib.godaEngineMapper,
    output: { label: 'Count', extension: 'count', language: 'text' },
    outputs: [{ id: 'count', language: 'text' }],
    run: lib.onTree(lib.godaEngineMapper, {
      generate: (tree, { modelName }) => ({
        files: [
          {
            id: 'count',
            fileName: `${modelName}.count`,
            text: `${tree.length} nodes`,
            primary: true,
          },
        ],
      }),
      problems: () => [{ severity: 'warning', message: 'made up' }],
    }),
  });
  return {
    ...lib,
    // the registry's list with one more registration at its end
    registerEngines: (...engines: Parameters<typeof lib.registerEngines>) =>
      lib.registerEngines(...engines, { ...madeUpEngine, view: {} } as never),
  };
});

// the default diagram and inspector, drawn as what they are given
vi.mock('@/components/workbench/engines/shared/WorkbenchCanvas', () => ({
  default: ({ extensions }: { extensions: readonly unknown[] }) => (
    <div data-testid='canvas'>{extensions.length} extensions</div>
  ),
}));
vi.mock(
  '@/components/workbench/engines/definition/DefinitionInspector',
  () => ({
    default: ({ engine }: { engine: string }) => (
      <div data-testid='inspector'>{engine}</div>
    ),
  }),
);

const ROOT = join(__dirname, '..', '..', '..', '..');
const MODEL = readFileSync(join(ROOT, 'examples/goda/LabResults.txt'), 'utf8');

describe('an engine registered once', async () => {
  const registry = await import('@/lib/workbench/engineDialects');
  const { isTransformEngine, normalizeEngineMode } =
    await import('@/lib/types');

  it('is one of the engines, last, with its label and output', () => {
    expect(registry.ENGINE_IDS.at(-1)).toBe(ID);
    expect(isTransformEngine(ID)).toBe(true);
    expect(normalizeEngineMode(ID)).toBe(ID);
    expect(registry.ENGINES.at(-1)).toMatchObject({
      id: ID,
      label: 'Made-up',
      output: 'Count',
      extension: 'count',
    });
    expect(registry.ENGINE_LABEL[ID as never]).toBe('Made-up');
    expect(registry.generatesFiles(ID as never)).toBe(true);
  });

  it('has its dialect, checks, options and keys in every map', async () => {
    const lib = await import('@goal-controller/lib');
    const { KNOWN_PROPERTIES } = await import('@/lib/models/knownProperties');
    const { PROPERTY_SPECS } = await import('@/lib/workbench/edgeProperties');
    expect(registry.ENGINE_DIALECTS[ID as never]).toBe(lib.goda);
    expect(registry.dialectOf(ID as never)).toBe(lib.goda);
    expect(registry.ENGINE_CHECKS[ID as never]).toBe(lib.godaCheckRegistry);
    expect(registry.ENGINE_OPTIONS[ID as never]).toEqual([]);
    expect(registry.ENGINE_AGENT_CONTEXTS[ID as never]).toBeDefined();
    expect(KNOWN_PROPERTIES[ID as never]).toEqual(KNOWN_PROPERTIES.goda);
    expect(PROPERTY_SPECS[ID as never]).toBeDefined();
  });

  it('is a mode, opens its examples, and has no rules of its own', async () => {
    const { isEngineMode, isMode } = await import('@/lib/workbench/pistar');
    const { guardsForMode } = await import('@/lib/workbench/modeGuards');
    const { exampleMode } = await import('@/services/examples');
    expect(isMode(ID)).toBe(true);
    expect(isEngineMode(ID as never)).toBe(true);
    expect(
      exampleMode({ group: ID } as Parameters<typeof exampleMode>[0]),
    ).toBe(ID);
    expect(guardsForMode(ID as never).postGuards).toEqual([]);
  });

  it('generates through its engine object', async () => {
    const { transform } = await import('@/services/transform');
    const { files } = transform({
      modelJson: MODEL,
      engine: ID as never,
      fileName: 'lab.txt',
    });
    expect(files).toEqual([
      expect.objectContaining({ id: 'count', fileName: 'lab.txt.count' }),
    ]);
    expect(files[0]!.text).toMatch(/^\d+ nodes$/);
  });

  it('is analysed through its engine object: its problems, its keys', async () => {
    const { analyze } = await import('@/services/analyze');
    const response = analyze(MODEL, ID as never);
    expect(response.problems).toContainEqual({
      severity: 'warning',
      source: 'Made-up',
      message: 'made up',
    });
    expect(response.variables).toEqual([]);
  });

  it('gets the default diagram and inspector, and piStar mode its palette', async () => {
    const { EngineDiagram, EngineInspector } =
      await import('@/components/workbench/engines/engineViews');
    const { hasModelInspector } =
      await import('@/components/workbench/engines/ModelInspector');
    expect(hasModelInspector(ID as never)).toBe(true);
    expect(registry.hasPistarPalette(ID as never)).toBe(true);
    render(
      <>
        <EngineDiagram engine={ID as never} />
        <EngineInspector engine={ID as never} />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('canvas').textContent).toBe('0 extensions'),
    );
    expect(screen.getByTestId('inspector').textContent).toBe(ID);
  });
});
