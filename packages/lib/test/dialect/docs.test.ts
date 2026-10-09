/**
 * The goal language's documents (packages/goal-language/docs) can't lie: every
 * fenced example whose info string names a check is run through the parser,
 * the reader or the validator, and must give what the block states.
 *
 * - `goal accept|reject`: each line is one element line (`parseElementLine`)
 * - `goal-document accept|reject` (`-plain`: lines without ids): the block is a document
 * - `goal-value <type> accept|reject`: each line is one value of the type
 * - `goal-rt`: each line is `notation ⇒ grouping` (the tree, operators parenthesised)
 * - `goal-reads <dialect>`: each line is `goal text ⇒ type(ids) modifier{operand:n}` or `⇒ none`
 * - `goal-check <dialect>`: the block is a document, validated; `%%` lines are
 *   directives: `%% <severity> [<span>] <message>` (the expected diagnostics,
 *   all of them), `%% only <ids>` (the diagram's elements),
 *   `%% children <id>: <ids>`, `%% relation <id>: and|or`,
 *   `%% construct <id>: <name>`, `%% variables <names>` (the workbench's);
 *   a dialect without ids (`rationalAgents`)
 *   checks against `%% model <name> | <name> | …` (its elements, in order)
 *
 * Dialects: edge, edgeV2, and edgeV2 / edge with iStar4RationalAgents'
 * annotations (`edgeV2+rationalAgents`, `edge+rationalAgents`).
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  dialectDefinition,
  withExtension,
  type AnyDialect,
  type DefinitionContext,
  type DefinitionContextElement,
  type Relation,
} from '@goal-controller/dialect';
import {
  documentDiagnostics,
  goalNameParserFor,
  parseDocument,
  parseElementLine,
  parseValue,
  readLine,
  type RtTree,
} from '@goal-controller/goal-language';
import {
  createGoalLspServices,
  serverDiagnostics,
} from '@goal-controller/goal-language/lsp';
import { edge, edgeV2, istar4RationalAgents } from '../../src';

const DOCS = join(__dirname, '../../../goal-language/docs');
const FILES = ['reference.md', 'api.md', 'diagnostics.md', 'examples.md'];

const DIALECTS: Record<string, AnyDialect> = {
  edge: edge as AnyDialect,
  edgeV2: edgeV2 as AnyDialect,
  'edge+rationalAgents': withExtension(
    edge as AnyDialect,
    istar4RationalAgents,
  ),
  rationalAgents: dialectDefinition(istar4RationalAgents) as AnyDialect,
  'edgeV2+rationalAgents': withExtension(
    edgeV2 as AnyDialect,
    istar4RationalAgents,
  ),
};

type Block = { file: string; line: number; info: string[]; body: string };

const blocks = (): Block[] =>
  FILES.flatMap((file) => {
    const text = readFileSync(join(DOCS, file), 'utf8');
    const found: Block[] = [];
    const fence = /^```(goal[\w-]*)([^\n]*)\n([\s\S]*?)^```$/gm;
    for (const m of text.matchAll(fence))
      found.push({
        file,
        line: text.slice(0, m.index).split('\n').length,
        info: [m[1]!, ...m[2]!.trim().split(/\s+/).filter(Boolean)],
        body: m[3]!.replace(/\n$/, ''),
      });
    return found;
  });

const lines = (body: string) =>
  body.split('\n').filter((line) => line.trim() !== '');

/** A notation with its operators parenthesised: `(G2;G3)->G4`. */
const grouped = (tree: RtTree | null): string => {
  switch (tree?.kind) {
    case 'binary':
      return `(${grouped(tree.left)}${tree.operator}${grouped(tree.right)})`;
    case 'postfix':
      return `${grouped(tree.expr)}${tree.operator}${tree.argument}`;
    case 'prefix':
      return `${tree.operator}${grouped(tree.expr)}`;
    case 'group':
      return `${tree.open}${grouped(tree.expr)}${tree.open === '[' ? ']' : ')'}`;
    case 'ref':
      return tree.id;
    case 'skip':
      return 'skip';
    case 'standalone':
      return tree.symbol;
    default:
      return '?';
  }
};

const KIND: Record<string, string> = { G: 'goal', T: 'task', R: 'resource' };

/** A model of named elements, in order, for a dialect without ids (`%% model`). */
const plainContext = (directive: string): DefinitionContext => {
  const names = directive
    .slice('model '.length)
    .split('|')
    .map((name) => name.trim());
  const keys = names.map((_, i) => `e${i + 1}`);
  const named: Record<string, string> = {};
  names.forEach((name, i) => {
    const id = parseValue('annotatedName', name).value?.id;
    if (id) named[id] = keys[i]!;
  });
  return {
    elements: Object.fromEntries(
      keys.map((key) => [
        key,
        { kind: 'istar.Goal', children: [], properties: {} },
      ]),
    ),
    variables: [],
    order: keys,
    named,
  };
};

/** The model a checked document stands for: its lines' elements, as directed. */
const contextOf = (doc: string, directives: string[]): DefinitionContext => {
  const model = directives.find((d) => d.startsWith('model '));
  if (model) return plainContext(model);
  const elements: Record<string, DefinitionContextElement> = {};
  for (const written of doc.split('\n')) {
    const read = readLine(
      { elements: { goal: { prefix: 'G', fill: '' } } },
      written,
    );
    if (read.kind !== 'element' || !read.id) continue;
    elements[read.id] = {
      kind: KIND[read.id[0]!] ?? 'goal',
      children: (read.notation?.refs ?? []).map((ref) => ref.id),
      properties: {},
    };
  }
  const only = directives.find((d) => d.startsWith('only '));
  if (only) {
    const keep = only
      .slice(5)
      .trim()
      .split(/[\s,]+/);
    for (const id of Object.keys(elements))
      if (!keep.includes(id)) delete elements[id];
  }
  for (const directive of directives) {
    const m = /^(children|relation|construct) (\S+): ?(.*)$/.exec(directive);
    if (!m) continue;
    const element = elements[m[2]!];
    if (!element) throw new Error(`no element ${m[2]} for ${directive}`);
    const value = m[3]!.trim();
    elements[m[2]!] =
      m[1] === 'children'
        ? { ...element, children: value ? value.split(/[\s,]+/) : [] }
        : m[1] === 'relation'
          ? { ...element, relation: value as Relation }
          : { ...element, construct: value };
  }
  const variables = directives.find((d) => d.startsWith('variables '));
  return {
    elements,
    variables: variables
      ? variables
          .slice(10)
          .trim()
          .split(/[\s,]+/)
      : [],
  };
};

const readsAs = (dialect: AnyDialect, text: string): string => {
  const { executionDetail: d } = goalNameParserFor(dialect)({
    goalText: text,
    onSyntaxError: () => undefined,
  });
  if (!d) return 'none';
  const modifiers = Object.entries(d.modifiers)
    .map(
      ([name, args]) =>
        ` ${name}{${Object.entries(args ?? {})
          .map(([operand, n]) => `${operand}:${n}`)
          .join(',')}}`,
    )
    .join('');
  return `${d.type}(${d.ids.join(', ')})${modifiers}`;
};

/** A `goal-check` block: its dialect, its document and its directives. */
const checked = (args: string[], body: string) => {
  const dialect = DIALECTS[args[0]!];
  if (!dialect) throw new Error(`unknown dialect ${args[0]}`);
  const all = body.split('\n');
  const directives = all
    .filter((line) => line.startsWith('%%'))
    .map((line) => line.slice(2).trim());
  const doc = all.filter((line) => !line.startsWith('%%')).join('\n');
  return { dialect, doc, directives };
};

/** The diagnostics a block expects, as `severity [span] message`. */
const expectedOf = (directives: string[]) =>
  directives
    .map((d) => /^(error|warning|info) \[(.*?)\] (.*)$/.exec(d))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => `${m[1]} [${m[2]}] ${m[3]}`)
    .sort();

const run = ({ info, body }: Block) => {
  const [kind, ...args] = info;
  const verdict = args.at(-1);
  switch (kind) {
    case 'goal':
      for (const line of lines(body))
        expect(
          parseElementLine(line).errors.length === 0,
          `${verdict}: ${line}`,
        ).to.equal(verdict === 'accept');
      return 1;
    case 'goal-document':
    case 'goal-document-plain':
      expect(
        parseDocument(body, { ids: kind === 'goal-document' }).errors.length ===
          0,
        `${verdict}: ${body}`,
      ).to.equal(verdict === 'accept');
      return 1;
    case 'goal-value': {
      const type = args[0] as Parameters<typeof parseValue>[0];
      for (const line of lines(body))
        expect(
          parseValue(type, line).errors.length === 0,
          `${type} ${verdict}: ${line}`,
        ).to.equal(verdict === 'accept');
      return 1;
    }
    case 'goal-rt':
      for (const line of lines(body)) {
        const [notation, expected] = line.split('⇒').map((s) => s.trim());
        const read = parseElementLine(`G1: A [${notation}]`);
        expect(read.errors, notation).to.deep.equal([]);
        expect(grouped(read.value!.notation), notation).to.equal(expected);
      }
      return 1;
    case 'goal-reads': {
      const dialect = DIALECTS[args[0]!];
      if (!dialect) throw new Error(`unknown dialect ${args[0]}`);
      for (const line of lines(body)) {
        const [text, expected] = line.split('⇒').map((s) => s.trim());
        expect(readsAs(dialect, text!), text).to.equal(expected);
      }
      return 1;
    }
    case 'goal-check': {
      const { dialect, doc, directives } = checked(args, body);
      const expected = expectedOf(directives);
      const got = documentDiagnostics(
        dialect,
        doc,
        contextOf(doc, directives),
      ).map((d) => `${d.severity} [${doc.slice(d.from, d.to)}] ${d.message}`);
      expect([...got].sort(), doc).to.deep.equal(expected);
      return 1;
    }
    default:
      throw new Error(`unknown example kind ${kind}`);
  }
};

describe('the goal language docs: every example as stated', () => {
  const found = blocks();

  it('has examples to run in each document', () => {
    for (const file of FILES)
      expect(
        found.filter((b) => b.file === file).length,
        file,
      ).to.be.greaterThan(0);
  });

  for (const block of found)
    it(`${block.file}:${block.line} ${block.info.join(' ')}`, () => {
      run(block);
    });
});

describe('the goal language docs: every checked example through the language server', () => {
  // one server for every example, as a client's: each example a document,
  // its dialect and model sent as the `goal/context` of that document
  const { shared, store } = createGoalLspServices();
  const checks = blocks().filter((block) => block.info[0] === 'goal-check');

  it('has checked examples', () => {
    expect(checks.length).to.be.greaterThan(20);
  });

  for (const block of checks)
    it(`${block.file}:${block.line} ${block.info.join(' ')}`, async () => {
      const { dialect, doc, directives } = checked(
        block.info.slice(1),
        block.body,
      );
      const uri = `file:///docs/${block.file}/${block.line}.goal`;
      store.set({ uri, dialect, context: contextOf(doc, directives) });
      const got = (await serverDiagnostics(shared, uri, doc)).map(
        (d) => `${d.severity} [${doc.slice(d.from, d.to)}] ${d.message}`,
      );
      expect(got.sort(), doc).to.deep.equal(expectedOf(directives));
    });
});

describe('the goal language docs: every document example through the language server, without a dialect', () => {
  // syntax only: a document the server has no context for
  const { shared } = createGoalLspServices();
  for (const block of blocks().filter((b) => b.info[0] === 'goal-document'))
    it(`${block.file}:${block.line} ${block.info.join(' ')}`, async () => {
      const found = await serverDiagnostics(
        shared,
        `file:///docs/${block.file}/${block.line}.goal`,
        block.body,
      );
      expect(found.length === 0, block.body).to.equal(
        block.info.at(-1) === 'accept',
      );
    });
});
