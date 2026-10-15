/**
 * Native files (goal-controller#143): the XMI writer beside the reader, the
 * JSON reader and writer, `defineLanguage` over Langium, which native file
 * a name is, models compared but for what a format can't carry, and the
 * toy dialect's two formats (./support/native) round-tripping through the
 * contract every dialect runs (../support/nativeRoundTrip.ts).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { expect } from 'chai';
import {
  modelDifference,
  nativeExtensions,
  nativeFileFor,
  sharedNativeExtensions,
  withoutLossy,
  type PistarJson,
} from '@goal-controller/dialect';
import { goalServices, readAssertion } from '@goal-controller/goal-language';
import { canonicalJson, readJson, writeJson } from '../../src/formats/json';
import { modelRoundTrip, textRoundTrip } from '../../src/importers/native';
import {
  canonicalXml,
  readXmi,
  writeXmi,
  type XmiWriteNode,
} from '../../src/importers/xmi';
import { describeNativeRoundTrips } from '../support/nativeRoundTrip';
import {
  choresDialect,
  choresLanguage,
  readBoard,
  readChores,
  writeBoard,
  writeChores,
} from './support/native/toy';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', 'native', name), 'utf8');

describe('the EMF XMI writer (#143)', () => {
  const root = (): XmiWriteNode => {
    const greet: XmiWriteNode = {
      feature: 'goals',
      id: 'g2',
      attributes: { name: 'Greet' },
    };
    const bill: XmiWriteNode = {
      feature: 'goals',
      type: 'shop:Chore',
      attributes: { name: 'Bill <& "pay">\n\tnow', weight: 0.5, done: false },
      hrefs: { subgoals: ['other.xmi#g1'] },
    };
    const serve: XmiWriteNode = {
      feature: 'goals',
      id: 'g1',
      attributes: { name: 'Serve', skipped: null, unset: undefined },
      references: { subgoals: [greet, bill] },
    };
    return {
      feature: 'shop:Model',
      attributes: { name: 'Shop' },
      children: [
        {
          feature: 'actors',
          id: 'a1',
          attributes: { name: 'Clerk' },
          children: [serve, greet, bill],
        },
        { feature: 'till', id: 't1', attributes: { name: 'Till' } },
      ],
    };
  };

  it('writes EMF’s forms: xmi:version, namespaces, xsi:type, ids, id and path references, hrefs, escapes', () => {
    const { text, diagnostics } = writeXmi(root(), {
      namespaces: { shop: 'http://example.org/shop' },
    });
    expect(diagnostics).to.deep.equal([]);
    expect(text).to.equal(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<shop:Model xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:shop="http://example.org/shop" name="Shop">',
        '  <actors xmi:id="a1" name="Clerk">',
        '    <goals xmi:id="g1" name="Serve" subgoals="g2 //@actors.0/@goals.2"/>',
        '    <goals xmi:id="g2" name="Greet"/>',
        '    <goals xsi:type="shop:Chore" name="Bill &lt;&amp; &quot;pay&quot;&gt;&#xA;&#x9;now" weight="0.5" done="false">',
        '      <subgoals href="other.xmi#g1"/>',
        '    </goals>',
        '  </actors>',
        '  <till xmi:id="t1" name="Till"/>',
        '</shop:Model>',
        '',
      ].join('\n'),
    );
  });

  it('is what the reader reads: the same nodes, attributes and references', () => {
    const { text } = writeXmi(root(), {
      namespaces: { shop: 'http://example.org/shop' },
    });
    const { reader } = readXmi(text, { fileName: 'shop.xmi' });
    const serve = reader!.document.byId.get('g1')!;
    expect(
      reader!.references(serve, 'subgoals').map((n) => n.attributes.name),
    ).to.deep.equal(['Greet', 'Bill <& "pay">\n\tnow']);
    const bill = reader!.document.byPath.get('//@actors.0/@goals.2')!;
    expect(bill).to.include({ type: 'shop:Chore', id: null });
    expect(reader!.references(bill, 'subgoals')).to.deep.equal([]);
    expect(reader!.diagnostics.map((d) => d.message)).to.deep.equal([
      '<goals>: subgoals names other.xmi#g1, in another file; left out',
    ]);
  });

  it('orders attributes as told, keys by another id attribute, writes plain XML, and escapes what the encoding can’t carry', () => {
    const node: XmiWriteNode = {
      feature: 'item',
      id: '7',
      attributes: { b: 'ü€', a: '1' },
      children: [{ feature: 'note', text: 'a < b & "c"' }],
    };
    const { text } = writeXmi(node, {
      idAttribute: 'id',
      xmiVersion: null,
      order: ['a', 'id'],
      encoding: 'ISO-8859-1',
      indent: '\t',
    });
    expect(text).to.equal(
      [
        '<?xml version="1.0" encoding="ISO-8859-1"?>',
        '<item a="1" id="7" b="ü&#8364;">',
        '\t<note>a &lt; b &amp; "c"</note>',
        '</item>',
        '',
      ].join('\n'),
    );
    expect(writeXmi(node, { encoding: 'ASCII' }).text).to.contain(
      'b="&#252;&#8364;"',
    );
  });

  it('leaves out, as an error, a reference to a node not in the document', () => {
    const stray: XmiWriteNode = { feature: 'goals', id: 'g9' };
    const { text, diagnostics } = writeXmi({
      feature: 'm',
      children: [
        { feature: 'goals', id: 'g1', references: { parts: [stray] } },
      ],
    });
    expect(text).to.contain('<goals xmi:id="g1"/>');
    expect(diagnostics).to.deep.equal([
      {
        severity: 'error',
        message:
          '<goals id="g1">: parts names a node not in the document; left out',
      },
    ]);
  });

  it('gives XML a canonical form: attributes in order then by name, EMF’s indents, comments out', () => {
    const a =
      '<?xml version="1.0" encoding="ASCII"?>\n<m z="1" a="2"><!-- x --><n  b="ü" a="1"/>\n\n</m>';
    const b =
      '<?xml version="1.0" encoding="ASCII"?>\n<m a="2" z="1">\n  <n a="1" b="&#252;"></n>\n</m>\n';
    expect(canonicalXml(a)).to.equal(canonicalXml(b));
    expect(canonicalXml(a)).to.equal(
      '<?xml version="1.0" encoding="ASCII"?>\n<m a="2" z="1">\n  <n a="1" b="&#252;"/>\n</m>\n',
    );
    expect(canonicalXml(a, { order: ['z'] })).to.contain('<m z="1" a="2">');
    expect(canonicalXml('<a><b></a>')).to.equal('<a><b></a>');
  });
});

describe('the JSON reader and writer (#143)', () => {
  it('reads a value, or says where the text stops being JSON', () => {
    expect(readJson('{"a": [1, true]}')).to.deep.equal({
      value: { a: [1, true] },
      diagnostics: [],
    });
    expect(readJson('{"a": }').diagnostics).to.deep.equal([
      {
        severity: 'error',
        message: 'Not JSON: unexpected "}"',
        from: 6,
        to: 7,
      },
    ]);
    expect(readJson('[1, 2').diagnostics[0]).to.include({
      message: 'Not JSON: the text ends too soon',
      from: 5,
    });
  });

  it('writes two-space JSON, and compares with keys sorted', () => {
    expect(writeJson({ b: 1, a: [2] })).to.equal(
      '{\n  "b": 1,\n  "a": [\n    2\n  ]\n}\n',
    );
    expect(canonicalJson('{"b":1,"a":{"d":1,"c":2}}')).to.equal(
      canonicalJson('{ "a": { "c": 2, "d": 1 }, "b": 1 }'),
    );
    expect(canonicalJson('nope')).to.equal('nope');
  });
});

describe('defineLanguage: a dialect’s Langium grammar (#143)', () => {
  const house = fixture('house.chores');

  it('parses into Langium’s AST, with the syntax errors as diagnostics', () => {
    const { ast, diagnostics } = choresLanguage.parse(house);
    expect(diagnostics).to.deep.equal([]);
    expect(ast.title).to.equal('House');
    expect(ast.items.map((item) => [item.$type, item.name])).to.deep.equal([
      ['Goal', 'G1'],
      ['Goal', 'G2'],
      ['Task', 'T1'],
      ['Task', 'T2'],
      ['Task', 'T3'],
    ]);
    const broken = choresLanguage.parse('chores "x" goal G1 needs all');
    expect(broken.diagnostics.length).to.be.greaterThan(0);
    expect(broken.diagnostics[0]).to.include({ severity: 'error' });
    expect(choresLanguage.parse('chores "x" $').diagnostics[0]).to.include({
      from: 11,
      to: 12,
    });
  });

  it('highlights from the grammar: keywords, punctuation, definitions, references, strings, numbers, comments', () => {
    const text =
      '// mine\nchores "H" goal G1 "G" needs all T1, T2 task T1 "t" cost 2';
    const kinds = choresLanguage
      .highlight(text)
      .map(({ from, to, kind }) => [text.slice(from, to), kind]);
    expect(kinds).to.deep.equal([
      ['// mine', 'comment'],
      ['chores', 'keyword'],
      ['"H"', 'string'],
      ['goal', 'keyword'],
      ['G1', 'definition'],
      ['"G"', 'string'],
      ['needs', 'keyword'],
      ['all', 'keyword'],
      ['T1', 'reference'],
      [',', 'punctuation'],
      ['T2', 'reference'],
      ['task', 'keyword'],
      ['T1', 'definition'],
      ['"t"', 'string'],
      ['cost', 'keyword'],
      ['2', 'number'],
    ]);
    // what doesn't parse is still highlighted, token by token
    expect(
      choresLanguage.highlight('goal goal').map(({ kind }) => kind),
    ).to.deep.equal(['keyword', 'keyword']);
  });

  it('completes the grammar’s keywords and the names the text defines', () => {
    const text = 'chores "H" goal G1 "G" needs all T task T1 "t" task T2 "u"';
    const at = text.indexOf(' task');
    expect(choresLanguage.complete!(text, at)).to.deep.equal([
      { label: 'T1', kind: 'name' },
      { label: 'T2', kind: 'name' },
    ]);
    expect(
      choresLanguage.complete!('chores "H" g', 12).map((c) => c.label),
    ).to.deep.equal(['goal']);
  });

  it('has services of its own, apart from the goal language’s', () => {
    expect(readAssertion('x > 1')).not.to.equal(null);
    const chores = choresLanguage.services();
    const goal = goalServices();
    expect(chores).not.to.equal(goal);
    expect(chores.shared).not.to.equal(goal.shared);
    expect(chores.Grammar.name).to.equal('Chores');
    expect(chores.shared.ServiceRegistry.all).to.deep.equal([chores]);
    expect(
      goal.shared.ServiceRegistry.all.map((s) => s.LanguageMetaData.languageId),
    ).not.to.include('chores');
    // both parse, each its own language, in either order
    expect(choresLanguage.parse('chores "x"').diagnostics).to.deep.equal([]);
    expect(readAssertion('x > 1')).not.to.equal(null);
  });
});

describe('native files as data (#143)', () => {
  const other = {
    id: 'other',
    nativeFiles: {
      both: { ...choresDialect.nativeFiles.board, extensions: ['.xmi'] },
    },
  };
  const dialects = [choresDialect, other];

  it('finds the native file a name is, by its longest extension', () => {
    expect(nativeExtensions(dialects)).to.deep.equal([
      '.chores',
      '.board',
      '.board.xmi',
      '.xmi',
    ]);
    expect(nativeFileFor(dialects, 'Home.BOARD.xmi')).to.include({
      dialect: 'chores',
      id: 'board',
      extension: '.board.xmi',
      baseName: 'Home',
    });
    expect(nativeFileFor(dialects, 'Home.xmi')).to.include({
      dialect: 'other',
      baseName: 'Home',
    });
    expect(nativeFileFor(dialects, 'Home.json')).to.equal(null);
    expect(nativeFileFor(dialects, '.chores')).to.equal(null);
    expect(sharedNativeExtensions(dialects)).to.deep.equal([]);
    expect(
      sharedNativeExtensions([
        ...dialects,
        { id: 'third', nativeFiles: { x: other.nativeFiles.both } },
      ]),
    ).to.deep.equal([{ extension: '.xmi', dialects: ['other', 'third'] }]);
  });

  it('compares models but for the lossy paths, in id order, keys sorted', () => {
    const model = {
      actors: [
        { id: 'b', x: 1, nodes: [{ id: 'T1', x: 5, text: 't' }] },
        { id: 'a', x: 2, nodes: [] },
      ],
      display: { T1: {} },
    };
    expect(withoutLossy(model, ['actors.*.x', 'display'])).to.deep.equal({
      actors: [
        { id: 'b', nodes: [{ id: 'T1', x: 5, text: 't' }] },
        { id: 'a', nodes: [] },
      ],
    });
    const moved = {
      display: {},
      actors: [
        { nodes: [], x: 9, id: 'a' },
        { id: 'b', x: 7, nodes: [{ text: 't', id: 'T1', x: 6 }] },
      ],
    };
    const lossy = ['actors.*.x', 'actors.*.nodes.*.x', 'display'];
    expect(modelDifference(model, moved, lossy)).to.equal(null);
    expect(modelDifference(model, moved, ['display'])).to.deep.equal({
      path: 'actors.a.x',
      a: '2',
      b: '9',
    });
    const renamed = structuredClone(moved);
    renamed.actors[1]!.nodes[0]!.text = 'u';
    expect(modelDifference(model, renamed, lossy)).to.deep.equal({
      path: 'actors.b.nodes.T1.text',
      a: '"t"',
      b: '"u"',
    });
  });
});

describe('the toy dialect’s native files (#143)', () => {
  it('reads a chore list into the model, its needs as refinements, with what it leaves out', () => {
    const { model, dialectRecord, diagnostics } = readChores(
      fixture('house.chores'),
    );
    expect(diagnostics).to.deep.equal([]);
    expect(dialectRecord).to.deep.equal({
      engine: 'chores',
      projectResources: {},
    });
    const actor = (model!.actors as any[])[0];
    expect(actor.nodes.map((n: any) => [n.id, n.type, n.text])).to.deep.equal([
      ['G1', 'istar.Goal', 'Clean the house'],
      ['G2', 'istar.Goal', 'Floors done'],
      ['T1', 'istar.Task', 'Sweep'],
      ['T2', 'istar.Task', 'Mop'],
      ['T3', 'istar.Task', 'Dust'],
    ]);
    expect(actor.nodes[3].customProperties).to.deep.equal({ cost: '3.5' });
    expect(
      (model!.links as any[]).map((l) => [l.source, l.type, l.target]),
    ).to.deep.equal([
      ['G2', 'istar.AndRefinementLink', 'G1'],
      ['T3', 'istar.AndRefinementLink', 'G1'],
      ['T1', 'istar.OrRefinementLink', 'G2'],
      ['T2', 'istar.OrRefinementLink', 'G2'],
    ]);
    const stray = readChores('chores "x" goal G1 "g" needs all T9');
    expect(stray.diagnostics).to.deep.equal([
      {
        severity: 'warning',
        message: "G1 needs T9, which the list doesn't have; left out",
        from: 33,
        to: 35,
      },
    ]);
  });

  it('reads the board XMI into the same model, lane by lane', () => {
    const board = readBoard(fixture('house.board'));
    const chores = readChores(fixture('house.chores'));
    expect(board.diagnostics).to.deep.equal([]);
    const [ann, bob] = board.model!.actors as any[];
    expect(ann.nodes.map((n: any) => n.text)).to.deep.equal([
      'Clean the house',
      'Floors done',
      'Sweep',
      'Mop & rinse',
      'Dust',
    ]);
    expect(bob.nodes[0].text).to.equal('Dinner\nat seven');
    expect(readBoard('<x/>').diagnostics.at(-1)!.message).to.equal(
      '<x> is no board',
    );
    // the chore list's model, written as a board, is the chore list
    const written = writeBoard(chores.model!);
    expect(written.diagnostics).to.deep.equal([]);
    expect(
      modelDifference(
        chores.model!,
        readBoard(written.text!).model!,
        choresDialect.nativeFiles.board.lossy,
      ),
    ).to.equal(null);
  });

  it('writes the board as it was written (byte for byte), and says why a model can’t be a chore list', () => {
    const text = fixture('house.board');
    expect(writeBoard(readBoard(text).model!).text).to.equal(text);
    const two = writeChores(readBoard(text).model!);
    expect(two.text).to.equal(null);
    expect(two.diagnostics.map((d) => d.message)).to.deep.equal([
      "a chore list is one actor's, not 2",
    ]);
    const quality = structuredClone(readChores(fixture('house.chores')).model!);
    ((quality.actors as any[])[0].nodes as any[])[0].type = 'istar.Quality';
    expect(writeChores(quality).diagnostics[0]!.message).to.equal(
      'G1: a istar.Quality is no card',
    );
  });

  it('round-trips a model and a text through the core’s contract, and says where they differ', () => {
    const { chores } = choresDialect.nativeFiles;
    const { model } = readChores(fixture('house.chores'));
    const context = { modelName: 'house' };
    expect(modelRoundTrip(chores, model!, context)).to.include({
      ok: true,
      problem: null,
    });
    // a property the format doesn't carry: not lossy, so the trip says so
    const extra = structuredClone(model!) as PistarJson;
    ((extra.actors as any[])[0].nodes as any[])[2].customProperties.colour =
      'red';
    expect(modelRoundTrip(chores, extra, context).problem).to.equal(
      'read back, actors.chores.nodes.T1.customProperties.colour is nothing, not "red"',
    );
    expect(textRoundTrip(chores, fixture('messy.chores'), context)).to.include({
      ok: true,
      written: fixture('house.chores'),
    });
    const { board } = choresDialect.nativeFiles;
    const reordered = fixture('house.board').replace(
      'xmi:id="T1" name="Sweep" cost="2"',
      'cost="2" name="Sweep"   xmi:id="T1"',
    );
    expect(textRoundTrip(board, reordered, context).ok).to.equal(true);
    expect(
      textRoundTrip(
        board,
        reordered.replace('cost="2"', 'cost="2" colour="red"'),
        context,
      ).problem,
    ).to.match(/^line 6 is .*, not .*colour=\\"red\\"/);
  });
});

describeNativeRoundTrips(choresDialect, [
  {
    name: 'house.chores',
    file: 'chores',
    text: fixture('house.chores'),
    lossless: true,
  },
  {
    name: 'messy.chores',
    file: 'chores',
    text: fixture('messy.chores'),
    lossless: true,
  },
  {
    name: 'house.board',
    file: 'board',
    text: fixture('house.board'),
    lossless: true,
  },
]);
