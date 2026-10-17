/**
 * The frameworks' engines in the workbench (goal-controller#171): kaosdoc
 * (KAOS's requirements document) and nfrprop (NFR's label propagation),
 * each in its framework's editor, read in its framework, generating or
 * analysing as lib's tests say, across the workbench's ESM core and
 * goal-tree's CommonJS one.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { kaos, nfrprop } from '@goal-controller/lib';
import { recordedFramework, recordedMode } from '@/lib/project';
import { parseModel } from '@/lib/workbench/dialects';
import { ENGINE_ANALYSES } from '@/lib/workbench/engineDialects';
import { frameworkEditorOf } from '@/lib/workbench/frameworkModes';
import {
  frameworkOfMode,
  planConversion,
  writeModelMode,
} from '@/lib/workbench/pistar';
import { modelTabsFor } from '@/components/workbench/modelTabs';
import { analyze, transform, treeView } from '@/services';

const ROOT = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const KAOS_WELCOME = read('examples/kaos/kaos-welcome.txt');
const NFR_WELCOME = read('examples/nfr/nfr-welcome.txt');
const ISTAR = read('examples/edge/simpleChoice.txt');

describe("the frameworks' engines (#171)", () => {
  it("edit in their framework's editor, their lines their dialect's", () => {
    expect(frameworkEditorOf('kaosdoc')).toEqual({
      mode: 'kaos',
      definition: kaos,
    });
    expect(frameworkEditorOf('nfrprop')).toEqual({
      mode: 'nfr',
      definition: nfrprop,
    });
    expect(frameworkEditorOf('edgev2')).toBe(null);
    expect(frameworkOfMode('kaosdoc')).toBe('kaos');
    expect(frameworkOfMode('nfrprop')).toBe('nfr');
    expect(modelTabsFor('kaosdoc', 'kaosdoc').map((t) => t.id)).toEqual([
      'diagram',
      'notation',
      'source',
    ]);
  });

  it('record their framework beside their mode, and convert from their framework only', () => {
    const recorded = writeModelMode(KAOS_WELCOME, 'kaosdoc');
    expect(recordedMode(recorded)).toBe('kaosdoc');
    expect(recordedFramework(recorded)).toBe('kaos');
    const plan = planConversion(
      writeModelMode(KAOS_WELCOME, 'kaos'),
      'kaosdoc',
    );
    expect(plan.blockers).toEqual([]);
    expect(recordedMode(plan.text)).toBe('kaosdoc');
    expect(() => planConversion(ISTAR, 'kaosdoc')).toThrow(
      /KAOS document reads KAOS models, and the model is in iStar 2\.0/,
    );
  });

  it("read the model in their framework: the view's trees on the paper", () => {
    const view = treeView(KAOS_WELCOME, 'kaosdoc');
    // every element no refinement reaches, the agent too (its lines' roots)
    expect(view.roots.map((key) => view.nodes.get(key)?.name)).toEqual([
      'Reliability',
      'Save Bandwidth',
      'User',
    ]);
    expect(analyze(KAOS_WELCOME, 'kaosdoc').problems).toEqual([]);
    expect(analyze(NFR_WELCOME, 'nfrprop').problems).toEqual([]);
  });

  it('kaosdoc generates the document committed next to the seed', () => {
    const { files } = transform({
      modelJson: KAOS_WELCOME,
      engine: 'kaosdoc',
      fileName: 'kaos-welcome',
    });
    expect(files.map((f) => f.fileName)).toEqual(['kaos-welcome.md']);
    expect(files[0]!.text).toBe(read('examples/kaos/kaos-welcome.expected.md'));
  });

  it('nfrprop labels the seed as its oracle says', () => {
    const engine = ENGINE_ANALYSES.nfrprop!;
    const result = engine.analyses.nfrLabels!.run(
      engine.model(parseModel(NFR_WELCOME) as never),
    );
    // the oracle's rows: `id,element,label,derivation`
    const rows = read('examples/nfr/nfr-welcome.labels.csv')
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => ({
        id: line.split(',')[0]!,
        label:
          /,(satisficed|weakly-satisficed|undecided|weakly-denied|denied|conflict),/.exec(
            line,
          )![1],
      }));
    expect(rows).toHaveLength(9);
    for (const { id, label } of rows)
      expect(result.cases[0]!.values[id]?.value, id).toBe(label);
  });
});
