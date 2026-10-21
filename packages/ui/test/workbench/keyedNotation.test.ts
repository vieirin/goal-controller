/**
 * Keyed properties in the workbench (goal-controller#345, #354) on the
 * `ambulance` seed (kaosexpert: each leaf obstacle's `Probability[e1]` …
 * `Probability[e5]`, one per expert of `experts.json`): the Notation view
 * writes them as property lines and reads them back, and a name that is no
 * expert of the project is a dangling name, in the Notation view and in the
 * model's Problems, as a `reference` naming no element is.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { goalView } from '@goal-controller/goal-tree';
import { documentDiagnostics } from '@goal-controller/goal-language';
import { kaosexpert } from '@goal-controller/lib';
import { describe, expect, it } from 'vitest';
import { parseModel } from '@/lib/workbench/dialects';
import { frameworkProblems } from '@/lib/workbench/frameworkProblems';
import { withFrameworkIds } from '@/lib/workbench/frameworkOpen';
import {
  applyNotationEdits,
  contextFromView,
  notationDocument,
  notationEdits,
} from '@/lib/workbench/notationDocument';
import { FRAMEWORK_ENGINE_PROJECT_RESOURCES } from '@/lib/workbench/engineDialects';
import { resourcesContext } from '@/lib/workbench/projectResources';

const SEED = join(__dirname, '../../../../examples/kaos/ambulance');
const read = (name: string) => readFileSync(join(SEED, name), 'utf8');

// its elements named by id (`O2: Paper Jam`), as the view offers to
const TEXT = withFrameworkIds(read('ambulance.txt'), kaosexpert)!;
const treeOf = (text: string) =>
  goalView(parseModel(text) as never, kaosexpert);
const RESOURCES = resourcesContext({
  expert: FRAMEWORK_ENGINE_PROJECT_RESOURCES.kaosexpert.expert([
    { path: 'experts.json', text: read('experts.json') },
  ]),
});

describe('keyed property lines on the ambulance seed (#345)', () => {
  const tree = treeOf(TEXT);
  const { text: doc } = notationDocument(kaosexpert, tree);

  it('writes each expert’s estimate as a line under its obstacle', () => {
    const lines = doc.split('\n').map((line) => line.trim());
    const at = lines.indexOf('O2: Paper Jam');
    expect(lines.slice(at, at + 9)).toEqual([
      'O2: Paper Jam',
      'Category',
      'FormalSpec',
      'Description',
      'Probability[e1] (13.33%, 20.00%, 33.33%)',
      'Probability[e2] (0.00%, 5.00%, 50.00%)',
      'Probability[e3] (0.00%, 1.00%, 1.00%)',
      'Probability[e4] (20.00%, 20.00%, 40.00%)',
      'Probability[e5] (0.00%, 0.00%, 0.00%)',
    ]);
  });

  it('reads the document back unchanged, and an edited estimate into the model', () => {
    expect(notationEdits(kaosexpert, doc, tree)).toEqual([]);
    const edited = doc
      .replace(
        'Probability[e1] (13.33%, 20.00%, 33.33%)',
        'Probability[e1] (10%, 20%, 30%)',
      )
      .replace('    Probability[e5] (0.00%, 0.00%, 0.00%)\n  O3:', '  O3:');
    const edits = notationEdits(kaosexpert, edited, tree);
    expect(edits).toEqual([
      {
        iStarId: 'paper_jam',
        key: 'Probability[e1]',
        value: '(10%, 20%, 30%)',
      },
      { iStarId: 'paper_jam', key: 'Probability[e5]', value: null },
    ]);
    const model = parseModel(applyNotationEdits(TEXT, edits));
    const properties = model.elements.get('paper_jam')!.customProperties!;
    expect(properties['Probability[e1]']).toBe('(10%, 20%, 30%)');
    expect(properties).not.toHaveProperty('Probability[e5]');
    // and the model read again writes the same document
    expect(
      notationDocument(kaosexpert, treeOf(applyNotationEdits(TEXT, edits)))
        .text,
    ).toBe(edited);
  });

  it('reports a name that is no expert of the project, with the project’s experts read', () => {
    const dangling = doc.replace('Probability[e2]', 'Probability[e9]');
    const context = {
      ...contextFromView(kaosexpert, tree, []),
      projectResources: RESOURCES,
    };
    // the seed's one estimate that isn't one (its README says why)
    expect(
      documentDiagnostics(kaosexpert, doc, context)
        .filter((d) => d.severity === 'error')
        .map((d) => [d.key, d.message]),
    ).toEqual([['Probability[e4]', "Quantiles don't decrease: 0.1 after 0.3"]]);
    expect(
      documentDiagnostics(kaosexpert, dangling, context)
        .filter((d) => d.key === 'Probability[e9]')
        .map((d) => [d.key, d.message]),
    ).toEqual([['Probability[e9]', "e9 is not one of the project's experts"]]);
  });
});

describe('a dangling keyed name in the model’s Problems (#354)', () => {
  const model = parseModel(
    TEXT.replace(
      '"Probability[e2]": "(0.00%, 5.00%, 50.00%)"',
      '"Probability[e9]": "(0.00%, 5.00%, 50.00%)"',
    ),
  );

  it('is a dangling-reference problem, with the project’s experts read', () => {
    const problems = frameworkProblems(model, kaosexpert, RESOURCES).filter(
      (p) => p.code === 'dangling-reference',
    );
    expect(problems).toEqual([
      expect.objectContaining({
        elementId: 'paper_jam',
        key: 'Probability[e9]',
        message: "Probability[e9]: e9 is not one of the project's experts",
      }),
    ]);
  });

  it('is nothing without them: what an expert is can’t be told', () => {
    expect(
      frameworkProblems(model, kaosexpert).filter(
        (p) => p.code === 'dangling-reference',
      ),
    ).toEqual([]);
  });
});
