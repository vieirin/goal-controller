/**
 * A dialect as data (ExtensionDefinition), checked against what reads it:
 * `@istar-ts/core` 0.8.0's extensible metamodel (parse, rules, write) and
 * goal-tree's view, which an engine's editors are built on.
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ACTOR_KINDS,
  ISTAR_2_0,
  LINK_KINDS,
  NODE_KINDS,
  PistarParseError,
  canLink,
  defineMetamodelExtension,
  extendMetamodel,
  metamodelOf,
  parsePistar,
  toPistar,
  validateModel,
} from '../../../goal-tree/node_modules/@istar-ts/core';
import { goalView } from '@goal-controller/goal-tree';
import {
  ISTAR_ACTOR_KINDS,
  ISTAR_KIND_OF,
  ISTAR_LINK_KINDS,
  ISTAR_NODE_KINDS,
  defineDialect,
  defineExtension,
  dialectDefinition,
  extensionCatalog,
  hasIds,
  metamodelExtensionOf,
  profileOf,
  profileProperties,
  specsFromDefinition,
  type AnyDialect,
  type DocumentNode,
  type DocumentTree,
  type ExtensionDefinition,
} from '@goal-controller/dialect';
import {
  completionsAt,
  contextFromView,
  documentDiagnostics,
  lineId,
  notationDocument,
  notationEdits,
} from '@goal-controller/goal-language';
import { istar4RationalAgents } from '../../src';

const MODEL = readFileSync(
  join(__dirname, '../../../../examples/pistar-ext/iStar4RationalAgents.txt'),
  'utf8',
);

const metamodelOfDialect = (extension: ExtensionDefinition) =>
  extendMetamodel(
    ISTAR_2_0,
    defineMetamodelExtension(metamodelExtensionOf(extension)),
  );
const RATIONAL_AGENTS = metamodelOfDialect(istar4RationalAgents);

describe('extensions', () => {
  it("names iStar 2.0's kinds as @istar-ts/core does", () => {
    expect(ISTAR_ACTOR_KINDS).to.deep.equal(ACTOR_KINDS);
    expect(ISTAR_NODE_KINDS).to.deep.equal(NODE_KINDS);
    expect(ISTAR_LINK_KINDS).to.have.members([...LINK_KINDS]);
    expect(Object.values(ISTAR_KIND_OF)).to.have.members([...NODE_KINDS]);
  });

  describe('defineExtension', () => {
    const bad = (change: Partial<ExtensionDefinition>) => () =>
      defineExtension({
        ...(structuredClone(istar4RationalAgents) as ExtensionDefinition),
        ...change,
      });

    it('freezes the dialect', () => {
      expect(Object.isFrozen(istar4RationalAgents.elements[0])).to.equal(true);
    });

    it('rejects kinds outside its namespace', () => {
      expect(
        bad({ elements: [{ kind: 'other.Plan', category: 'node' }] }),
      ).to.throw(/other.Plan is not in the rationalAgents namespace/);
    });

    it('rejects names it does not declare', () => {
      expect(
        bad({
          elements: [
            { kind: 'rationalAgents.Plan', behavesLike: 'istar.Nope' },
          ],
        }),
      ).to.throw(/behaves like unknown istar.Nope/);
      expect(bad({ elements: [{ kind: 'rationalAgents.Plan' }] })).to.throw(
        /needs a category/,
      );
      expect(
        bad({
          links: [
            {
              kind: 'rationalAgents.L',
              rules: { sources: ['rationalAgents.Nope'], targets: ['*'] },
            },
          ],
        }),
      ).to.throw(/joins unknown rationalAgents.Nope/);
      expect(bad({ links: [{ kind: 'rationalAgents.L' }] })).to.throw(
        /needs rules or a kind it behaves like/,
      );
      expect(bad({ groupers: { g: ['istar.Nope'] } })).to.throw(
        /grouper g names unknown istar.Nope/,
      );
      expect(
        bad({ stereotypes: [{ name: 's', appliesTo: ['nope'] }] }),
      ).to.throw(/s applies to unknown nope/);
    });
  });

  describe('the metamodel extension', () => {
    it('is the dialect without its presentation', () => {
      expect(metamodelExtensionOf(istar4RationalAgents)).to.deep.equal({
        name: 'rationalAgents',
        elements: [
          {
            kind: 'rationalAgents.Planning',
            behavesLike: 'istar.Task',
            pistarType: 'istar.Planning',
            size: { width: 90, height: 55 },
          },
          { kind: 'rationalAgents.Plan', category: 'node' },
        ],
        links: [],
      });
      expect(RATIONAL_AGENTS.name).to.equal('istar-2.0+rationalAgents');
    });

    it("reads a piStar-ext file with the dialect's kinds", () => {
      expect(() => parsePistar(MODEL)).to.throw(PistarParseError);
      const model = parsePistar(MODEL, { metamodel: RATIONAL_AGENTS });
      expect(metamodelOf(model)).to.equal(RATIONAL_AGENTS);
      expect(model.elements.get('p1')?.kind).to.equal(
        'rationalAgents.Planning',
      );
      expect(model.elements.get('x1')?.kind).to.equal('rationalAgents.Plan');
      // the Planning refines the goal as a task would
      expect(validateModel(model)).to.deep.equal([]);
    });

    it('writes it back as it was read', () => {
      const model = parsePistar(MODEL, { metamodel: RATIONAL_AGENTS });
      const written = JSON.parse(toPistar(model));
      const types = written.actors[0].nodes.map(
        (n: { type: string }) => n.type,
      );
      expect(types).to.deep.equal([
        'istar.Goal',
        'istar.Planning',
        'rationalAgents.Plan',
        'istar.Task',
      ]);
      // piStar-ext's own blocks are kept, unread
      expect(written.actors[0].extension.stereotype).to.equal('goal-based');
      expect(written.extension.stereotype_list).to.have.length(1);
    });

    it('checks new links with their rules', () => {
      const generates = defineExtension({
        ...(istar4RationalAgents as ExtensionDefinition),
        links: [
          {
            kind: 'rationalAgents.GeneratesLink',
            label: 'Generates',
            rules: {
              sources: ['rationalAgents.Planning'],
              targets: ['rationalAgents.Plan'],
            },
            line: { dash: 'dotted' },
          },
          {
            kind: 'rationalAgents.AlternativeLink',
            behavesLike: 'istar.OrRefinementLink',
          },
        ],
      }) as ExtensionDefinition;
      const model = parsePistar(MODEL, {
        metamodel: metamodelOfDialect(generates),
      });
      expect(
        canLink(model, 'p1', 'x1', 'rationalAgents.GeneratesLink'),
      ).to.deep.equal({ ok: true });
      expect(
        canLink(model, 'x1', 'p1', 'rationalAgents.GeneratesLink').ok,
      ).to.equal(false);
      // an alternative takes OR-refinement's rules: a Plan behaves like no
      // kind, so only links naming it accept it
      expect(
        canLink(model, 'x1', 'g1', 'rationalAgents.AlternativeLink'),
      ).to.include({ ok: false, code: 'invalid-source' });
    });
  });

  describe('profiles', () => {
    it('resolves stereotypes through groupers', () => {
      const rational = [
        'simple-reflex',
        'model-based reflex',
        'goal-based',
        'utility-based',
      ];
      for (const kind of ['istar.Actor', 'istar.Agent', 'istar.Role'])
        expect(profileOf(istar4RationalAgents, kind).stereotypes).to.deep.equal(
          rational,
        );
      expect(profileOf(istar4RationalAgents, 'istar.Task')).to.deep.equal({
        stereotypes: ['action'],
        tags: [
          'Id',
          'Reference to',
          'Status',
          'Logic',
          { name: 'type', values: ['duty', 'right'] },
        ],
      });
      expect(profileOf(istar4RationalAgents, 'istar.Goal')).to.deep.equal({
        stereotypes: [],
        tags: ['Id', 'Reference to', 'Status', 'Logic'],
      });
      // by kind name: a Planning behaves like a task, but is not one
      expect(
        profileOf(istar4RationalAgents, 'rationalAgents.Planning').stereotypes,
      ).to.deep.equal([]);
    });
  });

  describe("an engine's view", () => {
    it("reads the elements it knows, and leaves the dialect's", () => {
      const tree = goalView(
        parsePistar(MODEL, { metamodel: RATIONAL_AGENTS }),
        'edgeV2',
      );
      // the dialect's names carry no RT ids: the view keys them by piStar id
      expect([...tree.nodes.keys()]).to.deep.equal(['g1', 't1']);
      expect(tree.nodes.get('g1')?.children).to.deep.equal(['t1']);
      expect(tree.nodes.get('t1')?.properties).to.include({
        stereotype: 'action',
        tag: 'type',
        tagValue: 'duty',
      });
    });
  });
});

describe('a dialect of its own (no engine)', () => {
  const definition = dialectDefinition(istar4RationalAgents);
  const node = (
    id: string,
    kind: string,
    name: string,
    properties: Record<string, string> = {},
    children: string[] = [],
  ): DocumentNode => ({
    iStarId: id,
    id,
    kind,
    name,
    notation: null,
    properties,
    children,
  });
  const tree: DocumentTree = {
    roots: ['a1'],
    nodes: new Map([
      [
        'a1',
        node('a1', 'istar.Agent', 'Robot', { stereotype: 'goal-based' }, [
          'g1',
          'p1',
        ]),
      ],
      [
        'g1',
        node('g1', 'istar.Goal', 'Deliver sample', {
          tag: 'Id',
          tagValue: 'G1',
        }),
      ],
      ['p1', node('p1', 'rationalAgents.Planning', 'Plan delivery')],
    ]),
  };
  const doc =
    '<<goal-based>> Robot\n  {Id = G1} Deliver sample\n  Plan delivery';

  it('has every iStar kind and its own, lines without ids, no notation', () => {
    expect(definition.id).to.equal('rationalAgents');
    expect(definition.notation).to.equal(undefined);
    expect(hasIds(definition)).to.equal(false);
    expect(Object.keys(definition.elements)).to.deep.equal([
      ...ISTAR_ACTOR_KINDS,
      ...ISTAR_NODE_KINDS,
      'rationalAgents.Planning',
      'rationalAgents.Plan',
    ]);
    expect(definition.elements['istar.Agent']?.annotated).to.equal(true);
    // a goal has no declared stereotype, but may carry one (written as typed)
    expect(definition.elements['istar.Goal']?.annotated).to.equal(true);
    expect(definition.propertyLineOrder).to.deep.equal([]);
    expect(
      specsFromDefinition(definition, {})['istar.Role']!.map((s) => s.key),
    ).to.deep.equal(['stereotype', 'tag', 'tagValue']);
  });

  it('rejects lines with ids for some kinds only, and property lines without ids', () => {
    const base = structuredClone(definition) as AnyDialect;
    expect(() =>
      defineDialect({
        ...base,
        elements: {
          ...base.elements,
          'istar.Goal': {
            ...base.elements['istar.Goal']!,
            prefix: 'G',
          },
        },
      }),
    ).to.throw(/either every element has an id prefix/);
    expect(() =>
      defineDialect({
        ...base,
        properties: {
          ...base.properties,
          'istar.Goal': [
            ...base.properties['istar.Goal']!,
            { key: 'note', value: { type: 'text' }, help: '' },
          ],
        },
        propertyLineOrder: ['note'],
      }),
    ).to.throw(/lines without ids write every property on the element line/);
  });

  it('writes its lines, and reads them by position', () => {
    expect(notationDocument(definition, tree).text).to.equal(doc);
    expect(lineId(definition, 'Robot')).to.equal(null);
    expect(
      notationEdits(
        definition,
        doc.replace('{Id = G1} Deliver sample', '{Id = G2} Deliver samples'),
        tree,
      ),
    ).to.deep.equal([
      { iStarId: 'g1', key: 'tagValue', value: 'G2' },
      { iStarId: 'g1', text: 'Deliver samples' },
    ]);
  });

  it('checks its lines against the elements, in order', () => {
    const context = contextFromView(definition, tree, []);
    expect(context.order).to.deep.equal(['a1', 'g1', 'p1']);
    expect(documentDiagnostics(definition, doc, context)).to.deep.equal([]);
    expect(
      documentDiagnostics(definition, `${doc}\n  Extra`, context),
    ).to.deep.equal([
      {
        from: 0,
        to: doc.length + 8,
        severity: 'error',
        message:
          "4 lines for 3 elements: each line is an element's, in order (add or remove elements in the diagram)",
      },
    ]);
    // a group none of the kind's annotations reads
    const unread = documentDiagnostics(
      definition,
      doc.replace('<<goal-based>> Robot', '<<goal-based>> {} Robot'),
      context,
    );
    expect(unread).to.deep.equal([
      {
        from: 15,
        to: 17,
        severity: 'error',
        message: 'This annotation cannot be read',
      },
    ]);
    expect(completionsAt(definition, doc, 3, context)).to.equal(null);
  });
});

describe('profileProperties', () => {
  it('gives links a stereotype and a tagged value too', () => {
    // links: none declared, the default tagged values, both open
    const [linkStereotype, linkTag] = profileProperties(
      istar4RationalAgents,
      'istar.AndRefinementLink',
    );
    expect(linkStereotype).to.deep.include({
      key: 'stereotype',
      value: {
        type: 'enum',
        options: [{ value: '', label: 'none' }],
        open: true,
      },
    });
    expect(linkTag?.value).to.include({ type: 'enum', open: true });
  });
});

describe('extensionCatalog', () => {
  it("lists a dialect's stereotypes, tagged values and groupers, with what they apply to", () => {
    expect(extensionCatalog(istar4RationalAgents)).to.deep.equal([
      {
        id: 'stereotypes',
        label: 'Stereotype',
        entries: [
          { name: 'simple-reflex', appliesTo: ['rational'] },
          { name: 'model-based reflex', appliesTo: ['rational'] },
          { name: 'goal-based', appliesTo: ['rational'] },
          { name: 'utility-based', appliesTo: ['rational'] },
          { name: 'action', appliesTo: ['Task'] },
        ],
      },
      {
        id: 'taggedValues',
        label: 'Tagged Value',
        entries: [{ name: 'type', appliesTo: ['Task'] }],
      },
      {
        id: 'groupers',
        label: 'Grouper',
        entries: [{ name: 'rational', appliesTo: ['Actor', 'Agent', 'Role'] }],
      },
    ]);
  });
});
