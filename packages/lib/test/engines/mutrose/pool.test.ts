/**
 * MutRoSe's definition pool (goal-controller#59) on examples/projects/
 * medicine-delivery: nothing reported as it is, each cross-file check on a
 * copy broken for it (the cases goal-controller#61's oracle names), and
 * go-to-definition and rename across the four files.
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { goalView } from '@goal-controller/goal-tree';
import { parsePistar } from '../../../../goal-tree/node_modules/@istar-ts/core';
import {
  createPool,
  definitionAt,
  hoverAt,
  completionsAt,
  renameEdits,
  type PoolDiagnostic,
  type PoolEdit,
  type PoolLocation,
} from '../../../src/engines/definitionPool';
import { mutrose } from '../../../src/engines/mutrose/definition';
import { modelField, mutrosePool } from '../../../src/engines/mutrose/pool';

const PROJECT = join(
  __dirname,
  '../../../../../examples/projects/medicine-delivery',
);
const PATHS = {
  model: 'gm/MedicineDelivery.txt',
  world: 'knowledge/world_db.xml',
  hddl: 'hddl/domain.hddl',
  configuration: 'configuration/configuration.json',
} as const;
type Files = Record<keyof typeof PATHS, string>;
const EXAMPLE = Object.fromEntries(
  Object.entries(PATHS).map(([kind, path]) => [
    kind,
    readFileSync(join(PROJECT, path), 'utf8'),
  ]),
) as Files;

const indexOf = (files: Files) =>
  createPool(mutrosePool).update([
    {
      id: 'model',
      kind: 'model',
      value: goalView(parsePistar(files.model), mutrose),
    },
    { id: PATHS.world, kind: 'world', text: files.world },
    { id: PATHS.hddl, kind: 'hddl', text: files.hddl },
    {
      id: PATHS.configuration,
      kind: 'configuration',
      text: files.configuration,
    },
  ]);

/** The model's piStar nodes, by their id (`AT1`). */
const pistarNode = (model: unknown, element: string) =>
  (
    model as {
      actors: {
        nodes: { text: string; customProperties?: Record<string, string> }[];
      }[];
    }
  ).actors
    .flatMap((actor) => actor.nodes)
    .find((node) => node.text.startsWith(`${element}:`))!;

/** The text a location covers: a resource's, or a model field's. */
const textAt = (files: Files, location: PoolLocation): string => {
  const field = modelField(location.document);
  if (!field)
    return files[
      (Object.keys(PATHS) as (keyof Files)[]).find(
        (kind) => PATHS[kind] === location.document,
      )!
    ].slice(location.from, location.to);
  const node = pistarNode(JSON.parse(files.model), field.element);
  const value =
    field.field === 'name'
      ? node.text.slice(field.element.length + 2)
      : field.field === 'id'
        ? field.element
        : node.customProperties![field.field]!;
  return value.slice(location.from, location.to);
};

/** Edits applied: to a resource's text, or to a model element's name or property. */
const applied = (files: Files, edits: readonly PoolEdit[]): Files => {
  const next = { ...files };
  const model = JSON.parse(files.model);
  // from the end, so earlier offsets hold
  for (const edit of [...edits].sort((a, b) => b.from - a.from)) {
    const field = modelField(edit.document);
    if (field) {
      const node = pistarNode(model, field.element);
      const prefix = `${field.element}: `;
      const value =
        field.field === 'name'
          ? node.text.slice(prefix.length)
          : node.customProperties![field.field]!;
      const changed =
        value.slice(0, edit.from) + edit.text + value.slice(edit.to);
      if (field.field === 'name') node.text = prefix + changed;
      else node.customProperties![field.field] = changed;
      continue;
    }
    const kind = (Object.keys(PATHS) as (keyof Files)[]).find(
      (k) => PATHS[k] === edit.document,
    )!;
    next[kind] =
      next[kind].slice(0, edit.from) + edit.text + next[kind].slice(edit.to);
  }
  next.model = JSON.stringify(model);
  return next;
};

/**
 * What a broken copy reports: severity, check, where (the file or model
 * field), the text underlined. (In what order isn't the pool's to promise:
 * a case with several compares them as members.)
 */
const reported = (files: Files) =>
  indexOf(files).diagnostics.map((d: PoolDiagnostic) => [
    d.severity,
    d.check,
    d.document,
    textAt(files, d),
  ]);

const changed = (kind: keyof Files, from: string, to: string): Files => {
  expect(EXAMPLE[kind]).to.include(from);
  return { ...EXAMPLE, [kind]: EXAMPLE[kind].replace(from, to) };
};

/** A position on the nth `word` of a resource, or in a model field. */
const on = (kind: keyof Files, word: string, nth = 0) => {
  let from = -1;
  for (let i = 0; i <= nth; i += 1)
    from = EXAMPLE[kind].indexOf(word, from + 1);
  return {
    document: PATHS[kind as Exclude<keyof Files, 'model'>],
    offset: from + 1,
  };
};
const inModel = (element: string, field: string, word: string) => {
  const node = pistarNode(JSON.parse(EXAMPLE.model), element);
  const value =
    field === 'name'
      ? node.text.slice(element.length + 2)
      : node.customProperties![field]!;
  return {
    document: `model:${element}:${field}`,
    offset: value.indexOf(word) + 1,
  };
};

describe('MutRoSe’s definition pool on medicine-delivery', () => {
  it('reports nothing on the example, and resolves every reference', () => {
    const index = indexOf(EXAMPLE);
    expect(index.diagnostics).to.deep.equal([]);
    expect(index.references().filter((r) => !index.target(r))).to.deep.equal(
      [],
    );
  });

  describe('each cross-file check, on a copy broken for it', () => {
    it('unknown-hddl-task: a task whose first word the domain has no task for', () => {
      expect(
        reported(changed('model', 'AT1: NavigateTo', 'AT1: Fly')),
      ).to.deep.equal([
        ['error', 'unknown-hddl-task', 'model:AT1:name', 'Fly'],
        // and the domain's task no model task stands for any more
        ['warning', 'unused-hddl-task', PATHS.hddl, 'navigateto'],
      ]);
    });

    it('unbound-param: a task’s Params its var_mapping doesn’t bind', () => {
      expect(
        reported(
          changed(
            'configuration',
            ',\n    { "task_id": "AT2", "map": [{ "gm_var": "current_request", "hddl_var": "?r" }] }',
            '',
          ),
        ),
      ).to.deep.equal([
        ['error', 'unbound-param', 'model:AT2:Params', 'current_request'],
      ]);
    });

    it('hddl-var-not-param: a bound hddl_var that isn’t the HDDL task’s parameter', () => {
      expect(
        reported(
          changed('configuration', '"hddl_var": "?l"', '"hddl_var": "?x"'),
        ),
      ).to.deep.equal([
        ['error', 'hddl-var-not-param', PATHS.configuration, '?x'],
      ]);
    });

    it('unknown-mapping-task: a var_mapping for a task the model doesn’t have', () => {
      expect(
        reported(
          changed('configuration', '"task_id": "AT3"', '"task_id": "AT9"'),
        ),
      ).to.have.deep.members([
        // and AT3's Params are bound by nothing now
        ['error', 'unbound-param', 'model:AT3:Params', 'current_request'],
        ['error', 'unknown-mapping-task', PATHS.configuration, 'AT9'],
      ]);
    });

    it('unknown-mapping-variable: a gm_var the model doesn’t declare', () => {
      expect(
        reported(
          changed('configuration', '"gm_var": "room"', '"gm_var": "rooom"'),
        ),
      ).to.have.deep.members([
        ['error', 'unbound-param', 'model:AT1:Params', 'room'],
        ['error', 'unknown-mapping-variable', PATHS.configuration, 'rooom'],
      ]);
    });

    it('unknown-mapping-class: a type_mapping to a class the world doesn’t have', () => {
      expect(
        reported(
          changed(
            'configuration',
            '"ocl_type": "Request"',
            '"ocl_type": "Order"',
          ),
        ),
      ).to.deep.equal([
        ['error', 'unknown-mapping-class', PATHS.configuration, 'Order'],
      ]);
    });

    it('unknown-mapping-type: a type_mapping to a type the domain doesn’t have', () => {
      expect(
        reported(
          changed(
            'configuration',
            '"hddl_type": "location"',
            '"hddl_type": "place"',
          ),
        ),
      ).to.deep.equal([
        ['error', 'unknown-mapping-type', PATHS.configuration, 'place'],
      ]);
    });

    it('unused-hddl-task: an HDDL task no model task stands for (a warning)', () => {
      expect(
        reported(
          changed(
            'hddl',
            '(:task notifynurse',
            '(:task cleanup :parameters (?l - location))\n  (:task notifynurse',
          ),
        ),
      ).to.deep.equal([['warning', 'unused-hddl-task', PATHS.hddl, 'cleanup']]);
    });

    it('no-instances: a select or a forAll over a class the world has no instance of (a warning)', () => {
      const files = {
        ...EXAMPLE,
        world: EXAMPLE.world
          .replace('<name>req1</name>', '')
          .replace('<name>req2</name>', ''),
      };
      expect(reported(files)).to.deep.equal([
        ['warning', 'no-instances', 'model:G2:QueriedProperty', 'Request'],
        ['warning', 'no-instances', 'model:G3:AchieveCondition', 'requests'],
      ]);
    });
  });

  it('reports a name nothing defines, as any provider’s: an attribute the class doesn’t have (a warning)', () => {
    expect(
      reported(
        changed('model', 'current_request.served', 'current_request.serve'),
      ),
    ).to.deep.equal([
      ['warning', 'unresolved-reference', 'model:G3:AchieveCondition', 'serve'],
    ]);
  });

  describe('go-to-definition across the four files', () => {
    const index = indexOf(EXAMPLE);
    const definition = (position: { document: string; offset: number }) => {
      const location = definitionAt(index, position);
      return location && [location.document, textAt(EXAMPLE, location)];
    };

    it('from the model: a task’s HDDL task, a type’s world class, an attribute’s tag', () => {
      expect(definition(inModel('AT1', 'name', 'NavigateTo'))).to.deep.equal([
        PATHS.hddl,
        'navigateto',
      ]);
      expect(definition(inModel('G2', 'Controls', 'Request'))).to.deep.equal([
        PATHS.world,
        'Request',
      ]);
      expect(
        definition(inModel('G3', 'AchieveCondition', 'served')),
      ).to.deep.equal([PATHS.world, 'served']);
      // a Params variable: where a goal's Controls declares it
      expect(definition(inModel('AT1', 'Params', 'room'))).to.deep.equal([
        'model:G4:Controls',
        'room',
      ]);
    });

    it('from the configuration: the model’s task and variable, the domain’s parameter and type, the world’s class', () => {
      expect(definition(on('configuration', '"AT1"'))).to.deep.equal([
        'model:AT1:id',
        'AT1',
      ]);
      expect(definition(on('configuration', '"room"'))).to.deep.equal([
        'model:G4:Controls',
        'room',
      ]);
      // ?l of the task AT1 stands for, not its method's
      const l = definitionAt(index, on('configuration', '?l'))!;
      expect(l.from).to.equal(EXAMPLE.hddl.indexOf('(?l - location)') + 1);
      expect(definition(on('configuration', '"Location"'))).to.deep.equal([
        PATHS.world,
        'Location',
      ]);
      expect(definition(on('configuration', '"location"'))).to.deep.equal([
        PATHS.hddl,
        'location',
      ]);
    });

    it('within the world and the domain: a later tag, a method’s task', () => {
      expect(definitionAt(index, on('world', 'Location', 1))!.from).to.equal(
        EXAMPLE.world.indexOf('Location'),
      );
      expect(definition(on('hddl', 'navigateto ?l'))).to.deep.equal([
        PATHS.hddl,
        'navigateto',
      ]);
    });
  });

  describe('rename across the four files, leaving nothing broken', () => {
    const renamed = (
      position: { document: string; offset: number },
      name: string,
    ) => {
      const edits = renameEdits(indexOf(EXAMPLE), position, name);
      expect(edits).to.be.an('array');
      const files = applied(EXAMPLE, edits as PoolEdit[]);
      const index = indexOf(files);
      expect(index.diagnostics).to.deep.equal([]);
      expect(index.references().filter((r) => !index.target(r))).to.deep.equal(
        [],
      );
      return { edits: edits as PoolEdit[], files };
    };

    it('a world class: its tags, the model’s types, the configuration’s mapping', () => {
      const { edits, files } = renamed(on('world', 'Request'), 'Order');
      expect([...new Set(edits.map((e) => e.document))].sort()).to.deep.equal(
        [
          PATHS.configuration,
          PATHS.world,
          'model:G2:Controls',
          'model:G2:QueriedProperty',
          'model:G3:Controls',
        ].sort(),
      );
      expect(files.world).not.to.include('Request');
      expect(files.configuration).to.include('"ocl_type": "Order"');
    });

    it('an HDDL task: its definition, its method’s :task, the model task that stands for it', () => {
      const { edits, files } = renamed(
        inModel('AT1', 'name', 'NavigateTo'),
        'goto',
      );
      expect(edits.map((e) => e.document).sort()).to.deep.equal([
        PATHS.hddl,
        PATHS.hddl,
        'model:AT1:name',
      ]);
      expect(pistarNode(JSON.parse(files.model), 'AT1').text).to.equal(
        'AT1: goto',
      );
    });

    it('a model variable: its declaration, its uses in the model, the configuration’s gm_var', () => {
      const { edits, files } = renamed(
        inModel('AT2', 'Params', 'current_request'),
        'req',
      );
      expect(
        edits.filter((e) => e.document === PATHS.configuration),
      ).to.have.length(2);
      expect(
        pistarNode(JSON.parse(files.model), 'G3').customProperties!
          .AchieveCondition,
      ).to.equal('requests->forAll(req | req.served)');
    });

    it('an HDDL parameter: the task’s, and the configuration’s hddl_var (its `?` kept)', () => {
      const { edits, files } = renamed(on('configuration', '?l'), 'place');
      expect(edits.map((e) => [e.document, e.text])).to.deep.equal([
        [PATHS.hddl, '?place'],
        [PATHS.configuration, '?place'],
      ]);
      // the method's ?l is its own
      expect(files.hddl).to.include(':parameters (?b - robot ?l - location)');
    });

    it('not an id, which the diagram and the runtime annotation hold', () => {
      expect(
        renameEdits(indexOf(EXAMPLE), on('configuration', '"AT1"'), 'AT7'),
      ).to.be.a('string');
    });
  });

  describe('hover and completion', () => {
    const index = indexOf(EXAMPLE);

    it('hovers with the kind, the type and the owner', () => {
      const hover = hoverAt(
        index,
        inModel('G3', 'AchieveCondition', 'served'),
      )!;
      expect(hover.label).to.equal('World attribute');
      expect(hover.definition).to.include({ name: 'served', type: 'Boolean' });
      expect(hover.owner?.name).to.equal('Request');
      // types for #58: a variable's, an attribute naming instances' class
      expect(index.find(['gm.variable'], 'requests')?.type).to.equal(
        'Sequence(Request)',
      );
      expect(
        index.find(['world.attribute'], 'room', 'world.class:Request')?.type,
      ).to.equal('Location');
    });

    it('completes a mapping from the files it maps', () => {
      const labels = (text: string, offset: number) =>
        completionsAt(
          createPool(mutrosePool).update([
            {
              id: 'model',
              kind: 'model',
              value: goalView(parsePistar(EXAMPLE.model), mutrose),
            },
            { id: PATHS.hddl, kind: 'hddl', text: EXAMPLE.hddl },
            { id: PATHS.world, kind: 'world', text: EXAMPLE.world },
            { id: PATHS.configuration, kind: 'configuration', text },
          ]),
          { document: PATHS.configuration, offset },
        ).map((c) => c.label);
      const config = (insert: string) => {
        const text = EXAMPLE.configuration.replace(
          '"location_types": ["Location"]',
          insert,
        );
        return [text, text.indexOf('§')] as const;
      };
      expect(
        labels(
          ...(config('"location_types": ["§"]').map((v, i) =>
            i === 0 ? (v as string).replace('§', '') : v,
          ) as [string, number]),
        ),
      ).to.deep.equal(['Location', 'Request']);
      // AT2's hddl_var being typed: the file ends at the cursor (a mapping
      // completes where the configuration's schema says it is, in var_mapping)
      const typing = EXAMPLE.configuration.slice(
        0,
        EXAMPLE.configuration.indexOf('"hddl_var": "?r"') +
          '"hddl_var": "'.length,
      );
      expect(labels(typing, typing.length)).to.deep.equal(['?r']);
      expect(
        completionsAt(index, inModel('AT1', 'name', 'NavigateTo')).map(
          (c) => c.label,
        ),
      ).to.deep.equal(['navigateto', 'handover', 'notifynurse']);
    });
  });
});
