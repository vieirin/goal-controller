/**
 * The toy dialect of goal-controller#143, no engine's: one actor's goals and
 * tasks in two native files of formats nobody else has, both read and
 * written through the core's helpers only.
 * - `chores` (`.chores`): a text in ./chores.langium, read with
 *   `defineLanguage` (an item's name is its piStar id; `needs all` ANDs,
 *   `needs any` ORs; a task's cost is its `cost`);
 * - `board` (`.board`): EMF XMI of an invented metamodel, `board:Board`
 *   with `lanes` (actors) of `cards` (`board:Goal`, `board:Task`), a goal's
 *   `parts` the cards it refines into, read with `readXmi` and written with
 *   `writeXmi`.
 * Positions are what neither carries: read, a model is laid out in a row.
 */
import {
  defineDialect,
  element,
  property,
  type NativeDiagnostic,
  type NativeFileDefinition,
  type NativeReadResult,
  type NativeWriteResult,
  type PistarJson,
} from '@goal-controller/dialect';
import { defineLanguage } from '../../../../src/formats/language';
import {
  canonicalXml,
  readXmi,
  writeXmi,
  type XmiWriteNode,
} from '../../../../src/importers/xmi';
import type { ChoreList, Item } from './generated/ast';
import * as generated from './generated/module';

export const choresLanguage = defineLanguage<ChoreList>(generated);

/** What both formats read: one actor's goals and tasks, a goal's refinement and children. */
type Card = {
  id: string;
  kind: 'goal' | 'task';
  text: string;
  cost?: string;
  refinement?: 'and' | 'or';
  parts: string[];
};
type Lane = { id: string; name: string; cards: Card[] };

const TYPE = { goal: 'istar.Goal', task: 'istar.Task' } as const;
const LINK = {
  and: 'istar.AndRefinementLink',
  or: 'istar.OrRefinementLink',
} as const;

/** What neither format carries: where things are drawn, and the diagram's size. */
export const TOY_LOSSY = [
  'actors.*.x',
  'actors.*.y',
  'actors.*.nodes.*.x',
  'actors.*.nodes.*.y',
  'diagram.width',
  'diagram.height',
  'display',
] as const;

/** Lanes as a piStar model, its cards in a row under their actor. */
const toPistar = (name: string, lanes: readonly Lane[]): PistarJson => ({
  actors: lanes.map((lane, l) => ({
    id: lane.id,
    text: lane.name,
    type: 'istar.Actor',
    x: 40,
    y: 40 + 300 * l,
    customProperties: {},
    nodes: lane.cards.map((card, c) => ({
      id: card.id,
      text: card.text,
      type: TYPE[card.kind],
      x: 80 + 160 * c,
      y: 80 + 300 * l,
      customProperties: {
        ...(card.cost !== undefined && { cost: card.cost }),
      },
    })),
  })),
  orphans: [],
  dependencies: [],
  links: lanes.flatMap((lane) =>
    lane.cards.flatMap((card) =>
      card.parts.map((part) => ({
        id: `${part}-${card.id}`,
        type: LINK[card.refinement ?? 'and'],
        source: part,
        target: card.id,
      })),
    ),
  ),
  display: {},
  tool: 'pistar.2.1.0',
  istar: '2.0',
  diagram: {
    width: 2000,
    height: 300 * Math.max(1, lanes.length),
    name,
    customProperties: {},
  },
});

/** A piStar model as lanes; null, with why, when it holds what the formats can't. */
const fromPistar = (
  model: PistarJson,
): { name: string; lanes: Lane[] | null; diagnostics: NativeDiagnostic[] } => {
  const diagnostics: NativeDiagnostic[] = [];
  const cant = (message: string) =>
    diagnostics.push({ severity: 'error', message });
  type Node = {
    id: string;
    text: string;
    type: string;
    customProperties?: Record<string, string>;
  };
  type Actor = Node & { nodes: Node[] };
  type Link = { type: string; source: string; target: string };
  const actors = (model.actors ?? []) as Actor[];
  const links = (model.links ?? []) as Link[];
  const name = String((model.diagram as { name?: string })?.name ?? '');
  const lanes = actors.map((actor) => ({
    id: actor.id,
    name: actor.text,
    cards: actor.nodes.flatMap((node): Card[] => {
      const kind =
        node.type === TYPE.goal
          ? 'goal'
          : node.type === TYPE.task
            ? 'task'
            : null;
      if (!kind) {
        cant(`${node.id}: a ${node.type} is no card`);
        return [];
      }
      const refining = links.filter((link) => link.target === node.id);
      const kinds = new Set(refining.map((link) => link.type));
      if (kinds.size > 1) cant(`${node.id}: refined both ways`);
      return [
        {
          id: node.id,
          kind,
          text: node.text,
          ...(node.customProperties?.cost !== undefined && {
            cost: node.customProperties.cost,
          }),
          ...(refining.length && {
            refinement: kinds.has(LINK.or) ? 'or' : 'and',
          }),
          parts: refining.map((link) => link.source),
        },
      ];
    }),
  }));
  return {
    name,
    lanes: diagnostics.length ? null : lanes,
    diagnostics,
  };
};

const record = { engine: 'chores', projectResources: {} };

// ---------------------------------------------------------------- .chores

export const readChores = (text: string): NativeReadResult => {
  const { ast, diagnostics } = choresLanguage.parse(text);
  if (diagnostics.length)
    return { model: null, dialectRecord: null, diagnostics };
  const names = new Set(ast.items.map((item) => item.name));
  const cards = ast.items.map((item: Item): Card =>
    item.$type === 'Goal'
      ? {
          id: item.name,
          kind: 'goal',
          text: item.label,
          ...(item.needs.length && {
            refinement: item.all ? 'and' : 'or',
          }),
          parts: item.needs.flatMap((need) => {
            if (names.has(need.$refText)) return [need.$refText];
            diagnostics.push({
              severity: 'warning',
              message: `${item.name} needs ${need.$refText}, which the list doesn't have; left out`,
              from: need.$refNode?.offset,
              to: need.$refNode?.end,
            });
            return [];
          }),
        }
      : {
          id: item.name,
          kind: 'task',
          text: item.label,
          ...(item.cost !== undefined && { cost: String(item.cost) }),
          parts: [],
        },
  );
  return {
    model: toPistar(ast.title, [{ id: 'chores', name: ast.title, cards }]),
    dialectRecord: record,
    diagnostics,
  };
};

export const writeChores = (model: PistarJson): NativeWriteResult => {
  const { name, lanes, diagnostics } = fromPistar(model);
  if (lanes && lanes.length !== 1)
    diagnostics.push({
      severity: 'error',
      message: `a chore list is one actor's, not ${lanes.length}`,
    });
  const quoted = (text: string) => {
    if (text.includes('"'))
      diagnostics.push({ severity: 'error', message: `${text}: has a "` });
    return `"${text}"`;
  };
  if (!lanes || diagnostics.length) return { text: null, diagnostics };
  const lines = [`chores ${quoted(name)}`];
  for (const card of lanes[0]!.cards)
    lines.push(
      card.kind === 'goal'
        ? `goal ${card.id} ${quoted(card.text)}${card.parts.length ? ` needs ${card.refinement === 'or' ? 'any' : 'all'} ${card.parts.join(', ')}` : ''}`
        : `task ${card.id} ${quoted(card.text)}${card.cost !== undefined ? ` cost ${card.cost}` : ''}`,
    );
  return diagnostics.length
    ? { text: null, diagnostics }
    : { text: `${lines.join('\n')}\n`, diagnostics };
};

/** A chore list as compared: its comments out, one item a line, its words a space apart, `,` after a word. */
export const canonicalChores = (text: string): string => {
  const words = (text.match(/"[^"]*"|\/\/[^\n\r]*|,|[^\s,"]+/g) ?? []).filter(
    (word) => !word.startsWith('//'),
  );
  return `${words
    .map((word, i) =>
      i === 0 || word === ','
        ? word
        : `${word === 'goal' || word === 'task' ? '\n' : ' '}${word}`,
    )
    .join('')}\n`;
};

// ---------------------------------------------------------------- .board

/** a card's features, in the order its class declares them */
const BOARD_ORDER = ['xmi:id', 'name', 'cost', 'parts', 'decomposition'];

export const readBoard = (text: string): NativeReadResult => {
  const { reader, diagnostics } = readXmi(text);
  if (!reader) return { model: null, dialectRecord: null, diagnostics };
  const { root } = reader.document;
  if (root.feature !== 'board:Board')
    return {
      model: null,
      dialectRecord: null,
      diagnostics: [
        ...diagnostics,
        { severity: 'error', message: `<${root.feature}> is no board` },
      ],
    };
  const lanes = reader.children(root, 'lanes').map((lane) => ({
    id: lane.id ?? lane.path,
    name: lane.attributes.name ?? '',
    cards: reader.children(lane, 'cards').flatMap((card): Card[] => {
      const kind =
        card.type === 'board:Goal'
          ? 'goal'
          : card.type === 'board:Task'
            ? 'task'
            : null;
      if (!kind) {
        diagnostics.push({
          severity: 'warning',
          message: `a ${card.type ?? 'card'} is neither a goal nor a task; left out`,
        });
        return [];
      }
      const parts = reader.references(card, 'parts');
      return [
        {
          id: card.id ?? card.path,
          kind,
          text: card.attributes.name ?? '',
          ...(card.attributes.cost !== undefined && {
            cost: card.attributes.cost,
          }),
          ...(parts.length && {
            refinement: card.attributes.decomposition === 'or' ? 'or' : 'and',
          }),
          parts: parts.map((part) => part.id ?? part.path),
        },
      ];
    }),
  }));
  return {
    model: toPistar(root.attributes.name ?? '', lanes),
    dialectRecord: record,
    diagnostics,
  };
};

export const writeBoard = (model: PistarJson): NativeWriteResult => {
  const { name, lanes, diagnostics } = fromPistar(model);
  if (!lanes) return { text: null, diagnostics };
  const nodes = new Map<string, XmiWriteNode>();
  const laneNodes = lanes.map((lane) => ({
    feature: 'lanes',
    id: lane.id,
    attributes: { name: lane.name },
    children: lane.cards.map((card) => {
      const node: XmiWriteNode = {
        feature: 'cards',
        type: card.kind === 'goal' ? 'board:Goal' : 'board:Task',
        id: card.id,
        attributes: {
          name: card.text,
          cost: card.cost,
          decomposition: card.refinement === 'or' ? 'or' : undefined,
        },
      };
      nodes.set(card.id, node);
      return node;
    }),
  }));
  // references once every node is made
  for (const lane of lanes)
    for (const card of lane.cards)
      if (card.parts.length)
        Object.assign(nodes.get(card.id)!, {
          references: { parts: card.parts.map((part) => nodes.get(part)!) },
        });
  const written = writeXmi(
    { feature: 'board:Board', attributes: { name }, children: laneNodes },
    {
      namespaces: { board: 'http://example.org/board' },
      order: BOARD_ORDER,
    },
  );
  return { text: written.text, diagnostics: written.diagnostics };
};

// ---------------------------------------------------------------- the dialect

const chores: NativeFileDefinition = {
  label: 'Chore list',
  extensions: ['.chores'],
  format: 'text',
  schema: { kind: 'langium', path: 'native/chores.langium' },
  read: readChores,
  write: writeChores,
  canonical: canonicalChores,
  lossy: TOY_LOSSY,
  language: choresLanguage,
};

const board: NativeFileDefinition = {
  label: 'Board XMI',
  extensions: ['.board', '.board.xmi'],
  format: 'xmi',
  read: readBoard,
  write: writeBoard,
  canonical: (text) => canonicalXml(text, { order: BOARD_ORDER }),
  lossy: TOY_LOSSY,
};

const fill = '#CDFECD';
const problem = { severity: 'error', message: 'x' } as const;

export const choresDialect = defineDialect({
  id: 'chores',
  name: 'Chores',
  elements: { goal: element('G', { fill }), task: element('T', { fill }) },
  defaultFill: fill,
  properties: {
    goal: [],
    task: [property.number('cost', { help: 'what it costs' })],
  },
  propertyLineOrder: ['cost'],
  indent: '  ',
  problems: {
    notAChild: problem,
    missingFromNotation: problem,
    relationMismatch: problem,
    notInDiagram: problem,
  },
  nativeFiles: { chores, board },
});
