/** The workbench's project resources (packages/ui/lib/workbench/projectResources.ts): parsed, in the context, in Problems. */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { goalView } from '@goal-controller/goal-tree';
import { parsePistar } from '../../../../goal-tree/node_modules/@istar-ts/core';
import {
  fileStore,
  openProject,
  resourceSlots,
  withModelSettings,
  withProjectResource,
} from '../../../../ui/lib/project';
import {
  declarationsOf,
  parseResources,
  resourceProblems,
  resourcesContext,
  resourceTabId,
} from '../../../../ui/lib/workbench/projectResources';
import { modelLanguageProblems } from '../../../../ui/lib/workbench/localProblems';
import { ENGINE_DIALECTS } from '../../../../ui/lib/workbench/engineDialects';
import { SOURCE } from '../../../../ui/lib/workbench/types';

const MODEL = withModelSettings(
  readFileSync(
    join(__dirname, '../../../../../examples/mutrose/MedicineDelivery.txt'),
    'utf8',
  ),
  { mode: 'mutrose' },
);
const WORLD = `<world_db>
  <Request><name>r1</name><room>Ward1</room><pending>True</pending></Request>
</world_db>`;

describe('ui project resources', () => {
  it('declares what each engine reads, nothing for the others', () => {
    expect(Object.keys(declarationsOf('mutrose')!)).to.deep.equal([
      'world',
      'hddl',
      'configuration',
    ]);
    expect(Object.keys(declarationsOf('edgev2')!)).to.deep.equal([
      'variables',
      'properties',
    ]);
    expect(declarationsOf('sleec')).to.equal(undefined);
    expect(declarationsOf('pistarext')).to.equal(undefined);
    expect(declarationsOf(null)).to.equal(undefined);
    expect(resourceTabId('knowledge/world_db.xml')).to.equal(
      'resource:knowledge/world_db.xml',
    );
  });

  it('parses a project’s resources with its engine’s parsers, and gives the language their symbols and data', async () => {
    const project = await openProject(fileStore('ward.txt', MODEL), {
      projectResources: declarationsOf,
    });
    const { project: added } = withProjectResource(project, 'world', {
      name: 'w.xml',
      text: WORLD,
    });
    const slots = resourceSlots(
      added.manifest,
      added.files,
      declarationsOf('mutrose')!,
    );
    const parsed = parseResources('mutrose', slots, {
      'knowledge/world_db.xml': WORLD,
    });
    expect(Object.keys(parsed)).to.deep.equal(['world']);
    const context = resourcesContext(parsed);
    expect(context.world!.symbols.classes!.map((c) => c.name)).to.deep.equal([
      'Request',
    ]);
    expect(context.world!.data).to.deep.equal(parsed.world!.data);
    // an engine without resources parses nothing
    expect(parseResources('sleec', slots, {})).to.deep.equal({});
  });

  it('reports what is wrong in a resource in the Model group, by its label, at its line', () => {
    const declarations = declarationsOf('mutrose')!;
    const text = '<world_db>\n  <Request><name>r</nme></Request>\n</world_db>';
    const parsed = parseResources(
      'mutrose',
      resourceSlots(
        {
          version: 1,
          models: [],
          projectResources: { world: 'w.xml' },
          outputs: [],
        },
        ['w.xml'],
        declarations,
      ),
      { 'w.xml': text },
    );
    const [problem] = resourceProblems(parsed, declarations, { 'w.xml': text });
    expect(problem).to.deep.include({
      severity: 'error',
      source: 'World knowledge',
      line: 2,
      column: 19,
      message: 'w.xml:2:19: </nme> closes <name>',
    });
    expect(problem).not.to.have.property('elementId');
  });

  it('reads the example projects’ resources without a problem, and their models check clean against them', () => {
    const root = join(__dirname, '../../../../../examples/projects');
    for (const [folder, engine] of [
      ['medicine-delivery', 'mutrose'],
      ['tas3-edgev2', 'edgev2'],
    ] as const) {
      const manifest = JSON.parse(
        readFileSync(join(root, folder, 'project.json'), 'utf8'),
      );
      const paths = Object.values(
        manifest.projectResources as Record<string, string | string[]>,
      ).flat();
      const texts = Object.fromEntries(
        paths.map((path) => [
          path,
          readFileSync(join(root, folder, path), 'utf8'),
        ]),
      );
      const declarations = declarationsOf(engine)!;
      const slots = resourceSlots(manifest, paths, declarations);
      expect(
        slots.every((slot) => !slot.missing),
        folder,
      ).to.equal(true);
      const parsed = parseResources(engine, slots, texts);
      expect(Object.keys(parsed).sort(), folder).to.deep.equal(
        Object.keys(declarations).sort(),
      );
      expect(
        resourceProblems(parsed, declarations, texts),
        folder,
      ).to.deep.equal([]);
      if (engine === 'mutrose') {
        const model = readFileSync(
          join(root, folder, manifest.models[0].path),
          'utf8',
        );
        const tree = goalView(parsePistar(model), ENGINE_DIALECTS.mutrose);
        expect(
          modelLanguageProblems('mutrose', tree, [], resourcesContext(parsed)),
          folder,
        ).to.deep.equal(modelLanguageProblems('mutrose', tree, []));
      }
    }
  });

  it("runs the engine's checks with the world: a type it has no class for is the check's problem, on its element", () => {
    const tree = goalView(parsePistar(MODEL), ENGINE_DIALECTS.mutrose);
    const parsed = parseResources(
      'mutrose',
      resourceSlots(
        {
          version: 1,
          models: [],
          projectResources: { world: 'w.xml' },
          outputs: [],
        },
        ['w.xml'],
        declarationsOf('mutrose')!,
      ),
      { 'w.xml': WORLD },
    );
    const withWorld = modelLanguageProblems(
      'mutrose',
      tree,
      [],
      resourcesContext(parsed),
    );
    const without = modelLanguageProblems('mutrose', tree, []);
    const found = withWorld.filter(
      (p) => !without.some((q) => q.message === p.message),
    );
    expect(found.length).to.be.greaterThan(0);
    expect(
      found.every(
        (p) =>
          p.elementId &&
          p.source === ENGINE_DIALECTS.mutrose.name &&
          /Location is not a class of the world knowledge \(it has Request\)/.test(
            p.message,
          ),
      ),
      JSON.stringify(found),
    ).to.equal(true);
    expect(found.some((p) => p.source === SOURCE.settings)).to.equal(false);
  });
});
