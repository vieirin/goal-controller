/**
 * MutRoSe's values read with its grammar (./mutrose.langium), into plain
 * data: the names they hold, with their ranges from the CST. Offsets are in
 * the text read, plus the `offset` given (where the text starts in its
 * value), the errors' too.
 */
import {
  syntaxErrorsOf,
  type GoalSyntaxError,
  type Parsed,
} from '@goal-controller/goal-language';
import { GrammarUtils, type AstNode, type CstNode } from 'langium';
import type {
  CreationCondition,
  ForAllShape,
  Names,
  OclExpr,
  OclExpression,
  OclPath as OclPathNode,
  OclVariable as OclVariableNode,
  OclVariables,
  RobotNumber,
  SelectShape,
  VariableType,
} from './generated/ast';
import type { MutroseStart } from './lexer';
import { parseWith } from './module';

export type { Parsed };

/** A name and its range. */
export type OclName = { name: string; from: number; to: number };

/** `a.b.c`: a variable, then its attributes. */
export type OclPath = { head: OclName; attributes: OclName[] };

export type OclReading = {
  /** every path, a select's or forAll's source too; not `world_db`, nor a keyword */
  paths: OclPath[];
  /** `->select(v:Type | …)`: the query's variable, its type, and what it reads (null: `world_db`) */
  selects: { variable: OclName; type: OclName; source: OclPath | null }[];
  /** `coll->forAll(it | …)`: what it iterates over, and with which variable */
  forAlls: { iterated: OclPath | null; iteration: OclName }[];
};

export type OclVariable = {
  name: OclName;
  /** the type as written (`Sequence(Room)`), or empty */
  type: string;
  /** its class: `Room` in `Room` and in `Sequence(Room)` */
  typeName?: OclName;
};

const read = <T>(start: MutroseStart, text: string, offset: number) => {
  const result = parseWith(start, text);
  return {
    root: result.value as T,
    errors: syntaxErrorsOf(result, text.length).map((error) => ({
      ...error,
      offset: error.offset + offset,
    })),
  };
};

/** A node's property, with its range (none: the text has none, or an error left it out). */
const nameOf = (
  node: AstNode,
  property: string,
  offset: number,
  index?: number,
): OclName | null => {
  const cst = GrammarUtils.findNodeForProperty(node.$cstNode, property, index);
  return cst
    ? { name: cst.text, from: offset + cst.offset, to: offset + cst.end }
    : null;
};

/** The world: no variable. */
const WORLD = 'world_db';

/** Words OCL reads itself, written as a name: no variable. */
const KEYWORDS = new Set(['implies', 'null', 'self']);

/**
 * The references an OCL expression makes (a query, a condition): its paths,
 * and the variables and types its `select`s and `forAll`s introduce.
 */
export const readOclExpression = (
  text: string,
  offset = 0,
): Parsed<OclReading> => {
  const { root, errors } = read<OclExpression>('expression', text, offset);
  const reading: OclReading = { paths: [], selects: [], forAlls: [] };
  /** a path, unless it is the world or a keyword: what an operation reads from */
  const visitPath = (node: OclPathNode): OclPath | null => {
    const head = nameOf(node, 'head', offset);
    if (!head || head.name === WORLD) return null;
    const attributes = node.attributes.flatMap(
      (_, index) => nameOf(node, 'attributes', offset, index) ?? [],
    );
    if (!attributes.length && KEYWORDS.has(head.name)) return null;
    const path = { head, attributes };
    reading.paths.push(path);
    return path;
  };
  const visit = (expr: OclExpr | undefined): void => {
    switch (expr?.$type) {
      case 'OclBinary':
      case 'OclCompare':
        visit(expr.left);
        visit(expr.right);
        return;
      case 'OclNot':
      case 'OclParen':
        visit(expr.expr);
        return;
      case 'OclPath':
        visitPath(expr);
        return;
      case 'OclCall': {
        // a chain's later operation reads the one before: no path
        const source: OclExpr | undefined = expr.source;
        const path =
          source?.$type === 'OclPath'
            ? visitPath(source)
            : (visit(source), null);
        const variable = nameOf(expr, 'variable', offset);
        if (variable && expr.operation === 'select') {
          const type = expr.type && nameOf(expr.type, 'name', offset);
          if (type) reading.selects.push({ variable, type, source: path });
        }
        if (variable && expr.operation === 'forAll')
          reading.forAlls.push({ iterated: path, iteration: variable });
        visit(expr.body);
        return;
      }
      default:
        return;
    }
  };
  visit(root.expr);
  return { value: reading, errors };
};

/** A part of the text read, as written, and its range. */
export type OclSpan = { text: string; from: number; to: number };

/**
 * A comma-separated list's items in order (the grammar's `first` and
 * `next`), each with its comma (none: the first). An empty item has no node;
 * its comma keeps its place.
 */
const listOf = <T extends AstNode>(
  first: T | undefined,
  next: readonly (AstNode & { item?: T })[],
): { node: T | undefined; comma: CstNode | undefined }[] => [
  { node: first, comma: undefined },
  ...next.map((entry) => ({
    node: entry.item,
    comma: GrammarUtils.findNodeForKeyword(entry.$cstNode, ','),
  })),
];

/** An item's text and range (its CST's); an empty one is just after its comma. */
const spanOf = (
  node: AstNode | undefined,
  comma: CstNode | undefined,
  offset: number,
): OclSpan => {
  const cst = node?.$cstNode;
  if (cst)
    return { text: cst.text, from: offset + cst.offset, to: offset + cst.end };
  const at = offset + (comma?.end ?? 0);
  return { text: '', from: at, to: at };
};

/** An error at an item (its CST's range), or just after its comma when it is empty. */
const itemError = (
  node: AstNode | undefined,
  comma: CstNode | undefined,
  offset: number,
  message: string,
): GoalSyntaxError => {
  const cst = node?.$cstNode;
  const { line, character } = cst
    ? cst.range.start
    : (comma?.range.end ?? { line: 0, character: 0 });
  return {
    line: line + 1,
    column: character,
    offset: offset + (cst?.offset ?? comma?.end ?? 0),
    length: cst?.length ?? 0,
    message,
  };
};

export type VariableItem = {
  /** the item as written, between its commas */
  item: OclSpan;
  /** its first word before a colon (none: it has none) */
  name: OclName | null;
  /** the first word after the colon (`Sequence(Room)` one), or empty */
  type: string;
  /** the type's class: `Room` in `Room` and in `Sequence(Room)` */
  typeName: OclName | null;
};

const variableItem = (
  node: OclVariableNode | undefined,
  comma: CstNode | undefined,
  offset: number,
): VariableItem => {
  const type = node?.type;
  return {
    item: spanOf(node, comma, offset),
    name: node ? nameOf(node, 'name', offset) : null,
    type: type ? type.name + (type.element ? `(${type.element})` : '') : '',
    typeName: type
      ? nameOf(type, type.element ? 'element' : 'name', offset)
      : null,
  };
};

/**
 * A variable list as `parse_vars` reads it, item by item: lenient as it is
 * (it takes an item's first word, and ignores the rest), so an item may have
 * no name, which the decomposer rejects.
 */
export const readVariableItems = (text: string, offset = 0): VariableItem[] => {
  const { root } = read<OclVariables>('variables', text, offset);
  return listOf(root.first, root.next).map(({ node, comma }) =>
    variableItem(node, comma, offset),
  );
};

/**
 * A list of variables, `a : T, b : Sequence(T), c` (Controls, Monitors):
 * each name, its type as written, and its class. An item without a name is
 * an error; an empty text is no list.
 */
export const readOclVariables = (
  text: string,
  offset = 0,
): Parsed<OclVariable[]> => {
  if (!text.trim()) return { value: [], errors: [] };
  const { root } = read<OclVariables>('variables', text, offset);
  const errors: GoalSyntaxError[] = [];
  const value = listOf(root.first, root.next).flatMap(
    ({ node, comma }): OclVariable[] => {
      const { item, name, type, typeName } = variableItem(node, comma, offset);
      if (name) return [{ name, type, ...(typeName && { typeName }) }];
      errors.push(
        itemError(
          node,
          comma,
          offset,
          `no variable name in '${item.text.trim()}'`,
        ),
      );
      return [];
    },
  );
  return { value, errors };
};

export type NameItem = {
  /** the item as written, without the spaces around it */
  item: OclSpan;
  /** the item, when it is one name */
  name: OclName | null;
};

/**
 * Names, comma-separated (Params; Location is one): each item, and its name
 * when it is one (`[A-Za-z][A-Za-z0-9_]*`, spaces around it aside). An item
 * that is not one is an error.
 */
export const readNames = (text: string, offset = 0): Parsed<NameItem[]> => {
  if (!text.trim()) return { value: [], errors: [] };
  const { root, errors } = read<Names>('names', text, offset);
  const value = listOf(root.first, root.next).map(
    ({ node, comma }): NameItem => {
      const item = spanOf(node, comma, offset);
      const name =
        node && !node.others.length ? nameOf(node, 'name', offset) : null;
      if (!name)
        errors.push(
          itemError(
            node,
            comma,
            offset,
            item.text ? `'${item.text}' is not one name` : 'an empty name',
          ),
        );
      return { item, name };
    },
  );
  return { value, errors };
};

/** A type, `Room` or `Sequence(Room)`: its word, and the class in its parentheses. */
export type VariableTypeReading = { name: OclName; element: OclName | null };

/** A type as a variable list has it (`Sequence(Room)`). Not one: null. */
export const readVariableType = (
  text: string,
  offset = 0,
): Parsed<VariableTypeReading | null> => {
  const { root, errors } = read<VariableType>('type', text, offset);
  if (errors.length) return { value: null, errors };
  return {
    value: {
      name: nameOf(root, 'name', offset)!,
      element: nameOf(root, 'element', offset),
    },
    errors,
  };
};

/** OCL's own types: no world class */
export const BASIC_TYPES: ReadonlySet<string> = new Set([
  'Integer',
  'Real',
  'Boolean',
  'String',
]);

/**
 * The world class a type names: `Room` in `Room` and in `Sequence(Room)`;
 * none for OCL's own types (or what isn't a type).
 */
export const classOfType = (type: string): string | null => {
  const read = readVariableType(type).value;
  const name =
    read?.name.name === 'Sequence' && read.element ? read.element.name : type;
  return name && !BASIC_TYPES.has(name) ? name : null;
};

/** `parse_robot_number`: `N` or `[lo,hi]`, no spaces (empty: none). */
export const readRobotNumber = (
  text: string,
): Parsed<number | [number, number] | null> => {
  const { root, errors } = read<RobotNumber>('robotNumber', text, 0);
  if (errors.length) return { value: null, errors };
  if (root.count !== undefined) return { value: Number(root.count), errors };
  return {
    value:
      root.lower !== undefined && root.upper !== undefined
        ? [Number(root.lower), Number(root.upper)]
        : null,
    errors,
  };
};

/** A STRING's inside, without its quotes. */
const quoted = (node: AstNode, property: string, offset: number): OclSpan => {
  const string = nameOf(node, property, offset)!;
  return {
    text: string.name.slice(1, -1),
    from: string.from + 1,
    to: string.to - 1,
  };
};

export type CreationConditionReading = {
  kind: 'condition' | 'trigger';
  /** what its quotes hold: an expression, or an event */
  value: OclSpan;
  /** a condition's expression, read */
  reading: OclReading | null;
};

/**
 * `assertion condition "expr"` or `assertion trigger "Event"` (the words in
 * any case): which, and the quoted text, a condition's read as an expression
 * (its errors too). Not one of them: null.
 */
export const readCreationCondition = (
  text: string,
  offset = 0,
): Parsed<CreationConditionReading | null> => {
  const { root, errors } = read<CreationCondition>(
    'creationCondition',
    text,
    offset,
  );
  if (errors.length) return { value: null, errors };
  const kind = root.kind.toLowerCase() as 'condition' | 'trigger';
  const value = quoted(root, 'value', offset);
  if (kind === 'trigger')
    return { value: { kind, value, reading: null }, errors };
  const expression = readOclExpression(value.text, value.from);
  return {
    value: { kind, value, reading: expression.value },
    errors: expression.errors,
  };
};

/** A shape's condition: its BODY, or an empty one at its closing parenthesis. */
const conditionOf = (
  node: ForAllShape | SelectShape,
  offset: number,
): OclSpan => {
  const body = nameOf(node, 'condition', offset);
  if (body) return { text: body.name, from: body.from, to: body.to };
  const close =
    offset + GrammarUtils.findNodeForKeyword(node.$cstNode, ')')!.offset;
  return { text: '', from: close, to: close };
};

export type ForAllReading = {
  iterated: OclName;
  iteration: OclName;
  condition: OclSpan;
};

/**
 * `coll->forAll(it | condition)`, as the decomposer matches it: what it
 * iterates over, with which variable, and its condition (any text, as
 * written). Not of that shape: null.
 */
export const readForAll = (
  text: string,
  offset = 0,
): Parsed<ForAllReading | null> => {
  const { root, errors } = read<ForAllShape>('forAll', text, offset);
  if (errors.length) return { value: null, errors };
  return {
    value: {
      iterated: nameOf(root, 'iterated', offset)!,
      iteration: nameOf(root, 'iteration', offset)!,
      condition: conditionOf(root, offset),
    },
    errors,
  };
};

export type SelectReading = {
  source: OclName;
  variable: OclName;
  type: OclName;
  condition: OclSpan;
};

/**
 * `source->select(v:Type | condition)`, as the decomposer matches it: what
 * it reads, its variable and type, and its condition (any text, as
 * written). Not of that shape: null.
 */
export const readSelect = (
  text: string,
  offset = 0,
): Parsed<SelectReading | null> => {
  const { root, errors } = read<SelectShape>('select', text, offset);
  if (errors.length) return { value: null, errors };
  return {
    value: {
      source: nameOf(root, 'source', offset)!,
      variable: nameOf(root, 'variable', offset)!,
      type: nameOf(root, 'type', offset)!,
      condition: conditionOf(root, offset),
    },
    errors,
  };
};
