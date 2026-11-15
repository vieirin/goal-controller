/**
 * A model written from its text alone (goal-controller#518): in every
 * framework, a committed example's Notation document, its lines without the
 * ids an author need not write, applied to an empty model, creates the
 * example's elements (their kinds, names as stored and custom properties;
 * links and refinements are the diagram's). Removing an element's line
 * removes it and keeps its links: an `orphan` error, and no engine
 * generates from the model. Two elements showing the same short id are an
 * error; a kind's word completes; an imported `.kaos` model's document is
 * clean (#390).
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { shortId, type AnyDialect } from '@goal-controller/dialect';
import { goalView } from '@goal-controller/goal-tree';
import {
  completionsAt,
  contextFromView,
  documentDiagnostics,
  notationDocument,
  notationEdits,
  readHead,
  readLine,
  type NotationEdit,
} from '@goal-controller/goal-language';
import {
  edgeV2,
  edgeV2Engine,
  goda,
  kaos,
  kaosdocEngine,
  nfr,
  orphanLinks,
  refuseOnPropertyErrors,
} from '../../src';
import { kaosNativeFile } from '../../src/importers/kaos';
import {
  DIALECT_DEFINITIONS,
  dialectTree,
  parseModel,
} from '../../../ui/lib/workbench/dialects';
import { emptyModelText } from '../../../ui/lib/workbench/frameworks';
import { applyNotationEdits } from '../../../ui/lib/workbench/notationDocument';
import { writeModelMode } from '../../../ui/lib/workbench/pistar';
import { ROOT } from './support/models';

type Framework = 'istar-2.0' | 'kaos' | 'nfr';
type AnyModel = ReturnType<typeof parseModel>;

const example = (file: string) => readFileSync(join(ROOT, file), 'utf8');

/** Each framework's case: a dialect, its mode, and a committed example. */
const CASES: {
  name: string;
  dialect: AnyDialect;
  mode: string;
  framework: Framework;
  file: string;
  /** the workbench's tree of a dialect without an engine; goalView's else */
  dialectTree?: true;
}[] = [
  {
    name: 'edgeV2 (an iStar engine dialect)',
    dialect: edgeV2 as AnyDialect,
    mode: 'edgev2',
    framework: 'istar-2.0',
    file: 'examples/edgeV2/deltaIoT/deltaIoT.txt',
  },
  {
    name: 'GODA (scoped task ids)',
    dialect: goda as AnyDialect,
    mode: 'goda',
    framework: 'istar-2.0',
    file: 'examples/goda/LabResults.txt',
  },
  {
    name: 'KAOS',
    dialect: kaos as unknown as AnyDialect,
    mode: 'kaos',
    framework: 'kaos',
    file: 'examples/kaos/kaos-welcome.txt',
  },
  {
    name: 'NFR',
    dialect: nfr as unknown as AnyDialect,
    mode: 'nfr',
    framework: 'nfr',
    file: 'examples/nfr/nfr-welcome.txt',
  },
  {
    name: 'piStar-ext (iStar4RationalAgents, no engine)',
    dialect: DIALECT_DEFINITIONS.pistarext,
    mode: 'pistarext',
    framework: 'istar-2.0',
    file: 'examples/pistar-ext/stereotypes-and-tags.txt',
    dialectTree: true,
  },
];

const treeOf = (
  { dialect, dialectTree: own }: (typeof CASES)[number],
  model: AnyModel,
) => (own ? dialectTree(model) : goalView(model as never, dialect));

const EMPTY = { nodes: new Map(), roots: [] };

/**
 * A document as its author would write it: each line of an element without
 * an id of its own writes none (the editor shows its short id).
 */
const withoutShortIds = (
  dialect: AnyDialect,
  doc: string,
  shown: ReadonlySet<string>,
): string =>
  doc
    .split('\n')
    .map((line) => {
      const head = readHead(dialect, line);
      if (!head?.kind || !head.idSpan || !shown.has(head.id ?? '')) return line;
      return (
        line.slice(0, head.idSpan.from) +
        line.slice(head.idSpan.to).replace(/^\s*:\s*/, '')
      );
    })
    .join('\n');

/**
 * An element as compared: its kind, its name as stored, its custom
 * properties (but piStar's empty Description, which its tool writes on
 * every element and no line does).
 */
const described = (element: {
  kind: string;
  name: string;
  customProperties?: Readonly<Record<string, unknown>>;
}) => {
  const { Description, ...properties } = element.customProperties ?? {};
  return {
    kind: element.kind,
    name: element.name,
    properties:
      Description === '' || Description === undefined
        ? properties
        : { ...properties, Description },
  };
};

const byKindAndName = (
  a: ReturnType<typeof described>,
  b: ReturnType<typeof described>,
) => `${a.kind} ${a.name}`.localeCompare(`${b.kind} ${b.name}`);

const ids = () => {
  let n = 0;
  return () =>
    `${(n += 1).toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
};

describe("a model's elements written from its text alone (#518)", () => {
  for (const one of CASES)
    it(`${one.name}: ${one.file}`, () => {
      const text = example(one.file);
      const model = parseModel(text, one.mode as never, one.framework);
      const tree = treeOf(one, model);
      const document = notationDocument(one.dialect, tree);
      // the elements the document lists, each its line's
      const listed = [...new Set(document.ids)]
        .map((key) => tree.nodes.get(key))
        .filter((node) => node !== undefined);
      expect(listed.length, 'elements listed').to.be.greaterThan(3);
      const shown = new Set(
        listed
          .filter((node) => !(node.hasId ?? node.id !== node.iStarId))
          .map((node) => shortId(node.iStarId)),
      );
      const doc = withoutShortIds(one.dialect, document.text, shown);

      // every edit against an empty model creates an element
      const edits = notationEdits(one.dialect, doc, EMPTY, { newId: ids() });
      expect(edits.every((edit) => 'create' in edit)).to.equal(true);
      expect(edits).to.have.length(listed.length);

      const empty = writeModelMode(
        emptyModelText(one.framework),
        one.mode as never,
      );
      const next = parseModel(
        applyNotationEdits(empty, edits),
        one.mode as never,
        one.framework,
      );
      const created = [...next.elements.values()].map(described);
      const expected = listed.map((node) =>
        described(model.elements.get(node.iStarId)!),
      );
      expect(created.sort(byKindAndName)).to.deep.equal(
        expected.sort(byKindAndName),
      );
      // and the new model reads back as the text that made it, but its ids
      const again = treeOf(one, next);
      expect(
        notationEdits(
          one.dialect,
          notationDocument(one.dialect, again).text,
          again,
        ),
      ).to.deep.equal([]);
    });

  it('creates nothing while a line under no element is being typed (a whole edgeV2 document replaced)', () => {
    const model = parseModel(
      example('examples/edgeV2/deltaIoT/deltaIoT.txt'),
      'edgev2' as never,
    );
    const tree = goalView(model as never, edgeV2);
    expect(notationEdits(edgeV2, 'ZZ: Nothing', tree)).to.deep.equal([]);
  });
});

describe('an element removed from the text keeps its links: orphans (#518)', () => {
  const removed = (
    dialect: AnyDialect,
    text: string,
    mode: string,
    framework: Framework,
    line: RegExp,
  ) => {
    const model = parseModel(text, mode as never, framework);
    const tree = goalView(model as never, dialect);
    const { text: doc } = notationDocument(dialect, tree);
    const lines = doc.split('\n');
    const at = lines.findIndex((l) => line.test(l));
    expect(at, String(line)).to.be.greaterThan(-1);
    // the element's line and the lines under it
    const depth = (l: string) => l.length - l.trimStart().length;
    let end = at + 1;
    while (end < lines.length && depth(lines[end]!) > depth(lines[at]!)) end++;
    const edits = notationEdits(
      dialect,
      [...lines.slice(0, at), ...lines.slice(end)].join('\n'),
      tree,
    );
    const next = parseModel(
      applyNotationEdits(text, edits, tree),
      mode as never,
      framework,
    );
    return { model, tree, edits, next };
  };

  it('edgeV2: a task’s line removed is a remove edit; its refinement stays, an orphan Problems and generation refuse', () => {
    const { model, tree, edits, next } = removed(
      edgeV2 as AnyDialect,
      example('examples/edgeV2/deltaIoT/deltaIoT.txt'),
      'edgev2',
      'istar-2.0',
      /^\s*task T5: /,
    );
    const t5 = tree.nodes.get('T5')!.iStarId;
    expect(edits).to.deep.equal([{ remove: t5 } satisfies NotationEdit]);
    expect(next.elements.has(t5)).to.equal(false);
    // its links stay, one end gone
    const lost = [...model.links.values()].filter(
      (link) => link.source === t5 || link.target === t5,
    );
    expect(lost.length).to.be.greaterThan(0);
    for (const link of lost) expect(next.links.has(link.id)).to.equal(true);
    expect(orphanLinks(next).map((o) => o.missing)).to.deep.equal(
      lost.map(() => [t5]),
    );
    // an orphan error in the Notation view, on the line of the end that remains
    const view = goalView(next as never, edgeV2);
    const doc = notationDocument(edgeV2, view).text;
    const orphans = documentDiagnostics(
      edgeV2,
      doc,
      contextFromView(edgeV2, view, []),
    ).filter((d) => d.code === 'orphan');
    expect(orphans).to.have.length(lost.length);
    expect(orphans.every((d) => d.severity === 'error')).to.equal(true);
    expect(orphans[0]!.message).to.include(`has lost its end ${shortId(t5)}`);
    // and no engine generates from it, naming the link and the missing end
    expect(() => refuseOnPropertyErrors(edgeV2Engine, next)).to.throw(
      new RegExp(
        `does not generate from a model with a link that lost an end: \\w+ ${shortId(lost[0]!.id)} has lost its end ${shortId(t5)}`,
      ),
    );
    // the model before it generates
    expect(() => refuseOnPropertyErrors(edgeV2Engine, model)).not.to.throw();
  });

  it('KAOS: the gate holds for a framework engine too (its property errors are not read)', () => {
    const { edits, next } = removed(
      kaos as unknown as AnyDialect,
      example('examples/kaos/kaos-welcome.txt'),
      'kaos',
      'kaos',
      /^\s*domain_property \w+: Internet connection available/,
    );
    expect(edits).to.have.length(1);
    expect(edits[0]).to.have.property('remove');
    expect(orphanLinks(next)).to.not.deep.equal([]);
    expect(() => refuseOnPropertyErrors(kaosdocEngine, next)).to.throw(
      /KAOS.* does not generate from a model with a link that lost an end/,
    );
  });
});

describe('ids shown on element lines (#518)', () => {
  it('a KAOS line writes its id or none, its name’s brackets its own either way', () => {
    const dialect = kaos as unknown as AnyDialect;
    for (const [line, id] of [
      ['  behavioral_goal Achieve [Manual Backup]', null],
      ['  behavioral_goal 7857cb00: Achieve [Manual Backup]', '7857cb00'],
      ['  behavioral_goal G5: Achieve [Manual Backup]', 'G5'],
    ] as const) {
      const read = readLine(dialect, line);
      expect(
        read.kind === 'element' && {
          id: read.id,
          name: read.name,
          errors: read.errors,
        },
        line,
      ).to.deep.equal({ id, name: 'Achieve [Manual Backup]', errors: [] });
    }
  });

  it('two elements whose piStar ids share their first 8 characters are an error', () => {
    const text = example('examples/kaos/kaos-welcome.txt');
    const json = JSON.parse(text);
    // a second goal whose piStar id starts as Reliability's does
    const reliability = json.orphans.find(
      (o: { text: string }) => o.text === 'Reliability',
    );
    json.orphans.push({
      ...reliability,
      id: `${reliability.id.slice(0, 8)}-ffff-4fff-8fff-ffffffffffff`,
      text: 'Availability',
      x: reliability.x + 300,
    });
    const model = parseModel(JSON.stringify(json), 'kaos' as never, 'kaos');
    const dialect = kaos as unknown as AnyDialect;
    const view = goalView(model as never, dialect);
    const doc = notationDocument(dialect, view).text;
    const short = shortId(reliability.id);
    expect(
      documentDiagnostics(dialect, doc, contextFromView(dialect, view, []))
        .filter((d) => d.severity === 'error')
        .map((d) => [doc.slice(d.from, d.to), d.message]),
    ).to.deep.equal([
      [short, `2 elements show the id ${short}: give each its own`],
      [short, `2 elements show the id ${short}: give each its own`],
    ]);
  });
});

describe('a kind’s word completes at a line’s head (#518)', () => {
  const context = { elements: {}, variables: [] };
  const labels = (dialect: AnyDialect, doc: string) =>
    completionsAt(dialect, doc, doc.length, context)?.options.map(
      (o) => o.label,
    ) ?? [];

  it('KAOS: its kinds’ words', () => {
    expect(labels(kaos as unknown as AnyDialect, 'beh')).to.include(
      'behavioral_goal',
    );
    expect(
      labels(kaos as unknown as AnyDialect, 'goal G1: Go\n  dom'),
    ).to.include('domain_property');
  });

  it('edgeV2, NFR, piStar-ext: theirs', () => {
    expect(labels(edgeV2 as AnyDialect, 'ta')).to.include('task');
    expect(labels(nfr as unknown as AnyDialect, 'oper')).to.include(
      'operationalization',
    );
    expect(
      labels(DIALECT_DEFINITIONS.pistarext, '<<action>> pla'),
    ).to.include.members(['planning', 'plan']);
  });
});

describe('an imported .kaos model’s Notation document has no diagnostics (#390)', () => {
  // flood.kaos writes `dustyEnvironment()` and declares `DustyEnvironment`: a
  // defect of the seed itself, not of its import
  const SEED_DEFECTS = ['dustyEnvironment is not a declared predicate'];
  for (const seed of ['ambulance', 'elevator', 'mooring', 'las', 'flood'])
    it(`examples/kaos/${seed}/${seed}.kaos`, () => {
      const { model: json, diagnostics } = kaosNativeFile.read(
        example(`examples/kaos/${seed}/${seed}.kaos`),
        { modelName: seed },
      );
      expect(diagnostics.filter((d) => d.severity === 'error')).to.deep.equal(
        [],
      );
      const model = parseModel(JSON.stringify(json), 'kaos' as never, 'kaos');
      const dialect = kaos as unknown as AnyDialect;
      const view = goalView(model as never, dialect);
      const doc = notationDocument(dialect, view).text;
      // its elements show their UUIDs' first characters, none an identifier
      expect(doc).to.match(/^\w+ [0-9a-f]{8}: /m);
      expect(
        documentDiagnostics(
          dialect,
          doc,
          contextFromView(dialect, view, []),
        ).filter((d) => !SEED_DEFECTS.includes(d.message)),
      ).to.deep.equal([]);
      // what the document writes reads back as the model it was written from:
      // a description over several lines, a goal without a name
      expect(notationEdits(dialect, doc, view)).to.deep.equal([]);
    });

  it('keeps a description over several lines when another line is edited', () => {
    const { model: json } = kaosNativeFile.read(
      example('examples/kaos/las/las.kaos'),
      { modelName: 'las' },
    );
    const model = parseModel(JSON.stringify(json), 'kaos' as never, 'kaos');
    const dialect = kaos as unknown as AnyDialect;
    const view = goalView(model as never, dialect);
    const doc = notationDocument(dialect, view).text;
    const lines = doc.split('\n');
    // the despatcher's description is one line of the document
    const at = lines.findIndex((l) => l.includes('with urgent calls'));
    expect(at).to.be.greaterThan(0);
    expect(lines[at]).to.contain('dealing with urgent calls');
    // a line typed after it, and a name changed elsewhere: only that edit
    const typed = [
      ...lines.slice(0, at + 1),
      '  behavioral_g',
      ...lines.slice(at + 1),
    ];
    expect(notationEdits(dialect, typed.join('\n'), view)).to.deep.equal([]);
    const first = lines.findIndex((l) => l.startsWith('behavioral_goal'));
    const renamed = lines.map((l, i) => (i === first ? `${l} too` : l));
    const edits = notationEdits(dialect, renamed.join('\n'), view);
    expect(edits).to.have.length(1);
    expect(edits[0]).to.have.property('text');
  });
});
