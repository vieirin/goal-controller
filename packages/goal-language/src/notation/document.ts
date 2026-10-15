/**
 * The Notation view's document: the whole model as text, one element line per
 * operand kind element with its properties on the lines under it, and one per
 * declared element with its declaration, indented by depth (presentation
 * only: structure stays in the diagram). Text edits map back to element texts
 * and properties. The syntax is the goal language's; what a line has (an id,
 * annotations, a declaration) is the definition's.
 */
import { lineScope } from './scope.js';
import {
  ANNOTATION_KEYS,
  DECLARATION_KEYS,
  hasIds,
  type AnyDialect,
  type DefinitionContext,
  type DocumentNode,
  type DocumentTree,
  linkLinesOf,
  linkPropertiesOf,
} from '@goal-controller/dialect';
import {
  elementLine,
  propertyLine,
  writeAnnotations,
  writeDeclaration,
} from '../print.js';
import { parseValue } from '../parse.js';
import { annotatedProperties, readLine } from './lines.js';
import {
  LINK_LINE_KEY,
  hasLinkLine,
  linkLine,
  linkOfLine,
  readLinkLine,
  takesPosition,
  targetKey,
  writtenTarget,
  type LinkLineReading,
} from './linkLine.js';

type Document = Pick<
  AnyDialect,
  'elements' | 'notation' | 'propertyLineOrder' | 'indent'
> &
  Partial<Pick<AnyDialect, 'idScope' | 'links' | 'linkLines' | 'actors'>>;

/**
 * Whether a node has lines of its own, with property lines and its children
 * under them: a kind the definition has, that declares nothing on its line
 * (one that does writes its properties there, and has no children). In a
 * definition with ids and `idlessElements: 'unlisted'` (GODA), its text must
 * write one: an element without (the view names it by its piStar id; TAS
 * draws Resources so) can't be named on a line.
 */
export const isListed = (
  definition: Pick<AnyDialect, 'elements' | 'idlessElements'>,
  node: DocumentNode | undefined,
): node is DocumentNode => {
  const element = node && definition.elements[node.kind];
  return (
    !!element &&
    !element.declares &&
    (node.id !== node.iStarId ||
      definition.idlessElements !== 'unlisted' ||
      !hasIds(definition))
  );
};

/** An element's line without its declaration. */
export const nodeLine = (
  definition: Pick<AnyDialect, 'elements'>,
  node: Pick<DocumentNode, 'id' | 'name' | 'notation'>,
): string => elementLine(definition, node);

/** The elements with lines (their keys), depth-first from the roots, each once (at its first parent), with their depth. */
const lineOrder = (
  definition: Document,
  tree: DocumentTree,
): { id: string; node: DocumentNode; depth: number }[] => {
  const order: { id: string; node: DocumentNode; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (id: string, depth: number) => {
    const node = tree.nodes.get(id);
    if (!node || seen.has(id)) return;
    if (definition.elements[node.kind]?.declares) {
      seen.add(id);
      order.push({ id, node, depth });
      return;
    }
    if (!isListed(definition, node)) return;
    seen.add(id);
    order.push({ id, node, depth });
    for (const child of node.children) visit(child, depth + 1);
  };
  for (const root of tree.roots) visit(root, 0);
  // elements no root reaches still get a line
  for (const id of tree.nodes.keys()) visit(id, 0);
  return order;
};

/**
 * In a definition without ids that writes link lines: the elements' keys by
 * their lines' text, each list in the document's order (what a link line
 * names its target by). Undefined in any other.
 */
export const lineNames = (
  definition: Document,
  tree: DocumentTree,
): Record<string, string[]> | undefined => {
  if (hasIds(definition) || !linkLinesOf(definition)) return undefined;
  // no inherited keys: an element's text may be `constructor`
  const names: Record<string, string[]> = Object.create(null);
  for (const { id, node } of lineOrder(definition, tree))
    (names[nodeLine(definition, node)] ??= []).push(id);
  return names;
};

/**
 * Depth-first from the roots, each element once (at its first parent). `ids`:
 * the element each line is, but a link line without ids (`takesPosition`).
 */
export const notationDocument = (
  definition: Document,
  tree: DocumentTree,
): { text: string; ids: string[] } => {
  const lines: string[] = [];
  const ids: string[] = [];
  const names = lineNames(definition, tree);
  for (const { id, node, depth } of lineOrder(definition, tree)) {
    const element = definition.elements[node.kind];
    const annotations = element?.annotated
      ? writeAnnotations(node.properties)
      : null;
    if (element?.declares) {
      lines.push(
        definition.indent.repeat(depth) +
          elementLine(
            definition,
            node,
            writeDeclaration(node.properties),
            annotations,
          ),
      );
      ids.push(id);
      continue;
    }
    lines.push(
      definition.indent.repeat(depth) +
        elementLine(definition, node, null, annotations),
    );
    ids.push(id);
    for (const key of definition.propertyLineOrder) {
      const value = node.properties[key];
      if (value !== undefined) {
        lines.push(
          definition.indent.repeat(depth + 1) + propertyLine(key, value),
        );
        ids.push(id);
      }
    }
    // its links with properties (goal-controller#107), each a `link` line
    for (const link of tree.links ?? [])
      if (link.source === id && link.target && hasLinkLine(definition, link)) {
        lines.push(
          definition.indent.repeat(depth + 1) +
            linkLine(definition, link, writtenTarget(names, link.target)),
        );
        if (hasIds(definition)) ids.push(id);
      }
  }
  return { text: lines.join('\n'), ids };
};

export type NotationEdit =
  | { iStarId: string; text: string }
  | { iStarId: string; key: string; value: string | null }
  /** a link's property (goal-controller#107), by the link's piStar id */
  | { link: string; key: string; value: string | null };

/**
 * What a notation document changes in the model: element texts that differ,
 * and properties added, changed or removed under an element's line. Lines with
 * other ids change nothing (the editor asks to add them in the diagram); while
 * a line under an element cannot be read (being typed), that element's
 * properties are not cleared.
 */
export const notationEdits = (
  definition: Document,
  doc: string,
  tree: DocumentTree,
): NotationEdit[] => {
  const edits: NotationEdit[] = [];
  // what an element line sets: each key changed, added, or removed (unset)
  const setKeys = (
    node: DocumentNode,
    keys: readonly string[],
    read: Readonly<Record<string, string | undefined>>,
  ) => {
    for (const key of keys) {
      const value = read[key] ?? null;
      if (value !== (node.properties[key] ?? null))
        edits.push({ iStarId: node.iStarId, key, value });
    }
  };
  type Block = {
    key: string;
    node: DocumentNode;
    properties: Map<string, string>;
    unreadable: boolean;
    /** its `link` lines, read; `linksUnreadable`: one isn't (being typed) */
    links: LinkLineReading[];
    linksUnreadable: boolean;
  };
  const blocks: Block[] = [];
  let current: Block | null = null;
  // lines that name no element are their elements' in order: while lines are
  // added or removed (elements are, in the diagram), nothing changes; link
  // lines take no position (adding or removing one sets its link's properties)
  const order = hasIds(definition)
    ? null
    : notationDocument(definition, tree).ids;
  const lines = doc.split('\n');
  if (
    order &&
    lines.filter((line) => takesPosition(definition, line)).length !==
      order.length
  )
    return [];
  // a line with an id names its element (the id its name starts with)
  const named = order ? writtenIds(tree) : {};
  let index = 0;
  // a repeated scoped id names the element under the goal above it
  const scope = lineScope(definition);
  for (const written of lines) {
    const read = readLine(definition, written);
    const writtenId = read.kind === 'element' ? read.id : null;
    const position =
      order && takesPosition(definition, written) ? order[index++]! : null;
    const indent = written.length - written.trimStart().length;
    const id = order
      ? writtenId
        ? (named[writtenId] ?? null)
        : position
      : writtenId &&
        scope.keyOf(scope.enter(indent, writtenId), writtenId, (key) =>
          tree.nodes.has(key),
        );
    if (id && read.kind === 'element') {
      const node = tree.nodes.get(id);
      current = null;
      if (!node) continue;
      const element = definition.elements[node.kind];
      const errorBefore = (to: number) =>
        read.errors.some((error) => error.offset < to);
      // an unreadable annotation (being typed) changes none of them yet
      if (element?.annotated && !errorBefore(read.textSpan.from))
        setKeys(node, ANNOTATION_KEYS, annotatedProperties(read));
      if (element?.declares) {
        if (read.text !== nodeLine(definition, node))
          edits.push({ iStarId: node.iStarId, text: read.text });
        // an unreadable declaration (being typed) changes nothing yet
        const declaration = read.declaration;
        if (
          declaration
            ? !read.errors.some((e) => e.offset >= declaration.span.from)
            : !written.slice(read.textSpan.from).includes('{')
        )
          setKeys(node, DECLARATION_KEYS, declaration?.properties ?? {});
        continue;
      }
      if (!isListed(definition, node)) continue;
      if (read.text !== nodeLine(definition, node)) {
        edits.push({ iStarId: node.iStarId, text: read.text });
      }
      current = {
        key: id,
        node,
        properties: new Map(),
        unreadable: false,
        links: [],
        linksUnreadable: false,
      };
      blocks.push(current);
      continue;
    }
    if (!current || !written.trim()) continue;
    if (
      linkLinesOf(definition) &&
      read.kind === 'property' &&
      !read.errors.length &&
      read.key === LINK_LINE_KEY
    ) {
      const link = readLinkLine(read.value);
      if ('value' in link) current.links.push(link.value);
      else current.linksUnreadable = true;
      continue;
    }
    if (
      read.kind === 'property' &&
      !read.errors.length &&
      definition.propertyLineOrder.includes(read.key)
    )
      current.properties.set(read.key, read.value);
    else current.unreadable = true;
  }
  // a dialect that doesn't write link lines leaves its links' properties be
  if (linkLinesOf(definition)) {
    const names = lineNames(definition, tree);
    for (const block of blocks)
      edits.push(...linkEdits(definition, tree, names, block));
  }
  for (const { node, properties, unreadable } of blocks) {
    for (const key of definition.propertyLineOrder) {
      const value = properties.get(key);
      const stored = node.properties[key];
      if (value !== undefined && value !== stored) {
        edits.push({ iStarId: node.iStarId, key, value });
      } else if (value === undefined && stored !== undefined && !unreadable) {
        edits.push({ iStarId: node.iStarId, key, value: null });
      }
    }
  }
  return edits;
};

/**
 * What a block's `link` lines change in its element's links: each link
 * from it whose kind has properties takes the properties its line writes
 * (none written: removed). A target two such links share (ambiguous), or two
 * lines name, changes nothing; while a line can't be read, or names no
 * element (being typed), a link without one keeps its properties. `names`:
 * a dialect without ids' targets, by their text (`lineNames`).
 */
const linkEdits = (
  definition: Pick<AnyDialect, 'links'>,
  tree: DocumentTree,
  names: Readonly<Record<string, readonly string[]>> | undefined,
  block: { key: string; links: LinkLineReading[]; linksUnreadable: boolean },
): NotationEdit[] => {
  const edits: NotationEdit[] = [];
  const links = tree.links ?? [];
  const targets = block.links.map((line) => targetKey(names, line.target));
  const unreadable =
    block.linksUnreadable || targets.some((target) => 'error' in target);
  for (const link of links) {
    if (link.source !== block.key || !link.target) continue;
    const declared = linkPropertiesOf(definition, link.kind);
    if (!declared.length) continue;
    if (linkOfLine(definition, links, block.key, link.target).length > 1)
      continue;
    const lines = block.links.filter((_, i) => {
      const target = targets[i]!;
      return 'key' in target && target.key === link.target;
    });
    if (lines.length > 1 || (!lines.length && unreadable)) continue;
    const written = new Map(
      (lines[0]?.properties ?? []).map(({ key, value }) => [key, value]),
    );
    for (const { key } of declared) {
      const value = written.get(key) ?? null;
      if (value !== (link.properties[key] ?? null))
        edits.push({ link: link.iStarId, key, value });
    }
  }
  return edits;
};

/**
 * What the text is checked against: the elements the definition has (kind,
 * operand children, links, construct, custom properties) and the workbench's
 * variables. The shape a language server's context notification takes.
 */
/**
 * The elements of a tree whose names start with an id (`G1: Deliver`), by
 * that id: what a line without ids' definition names with one.
 */
export const writtenIds = (tree: DocumentTree): Record<string, string> => {
  const named: Record<string, string> = {};
  for (const [key, node] of tree.nodes) {
    const id = parseValue('annotatedName', node.name).value?.id;
    if (id && !(id in named)) named[id] = key;
  }
  return named;
};

export const contextFromView = (
  definition: Document,
  tree: DocumentTree,
  variables: readonly string[],
): DefinitionContext => {
  const names = lineNames(definition, tree);
  return {
    elements: Object.fromEntries(
      [...tree.nodes]
        .filter(([, node]) => definition.elements[node.kind] !== undefined)
        .map(([key, node]) => [
          key,
          {
            kind: node.kind,
            ...(key !== node.id && { id: node.id }),
            children: node.children.filter((id) =>
              (
                (definition.notation?.operand.kinds ?? []) as readonly string[]
              ).includes(tree.nodes.get(id)?.kind ?? ''),
            ),
            relation: node.relation,
            construct: node.construct,
            ...(node.x !== undefined && { x: node.x }),
            properties: Object.fromEntries(
              Object.entries(node.properties).filter(
                (entry): entry is [string, string] =>
                  typeof entry[1] === 'string',
              ),
            ),
          },
        ]),
    ),
    variables: [...variables],
    // a dialect with properties on links or actors (goal-controller#107): what
    // its checks read with readLink and readActor
    ...(definition.links && {
      links: Object.fromEntries(
        (tree.links ?? []).map((link) => [
          link.iStarId,
          {
            kind: link.kind,
            source: link.source,
            target: link.target,
            ...(link.label !== undefined && { label: link.label }),
            properties: { ...link.properties },
            ...(link.ends && { ends: link.ends }),
          },
        ]),
      ),
    }),
    ...(definition.actors && {
      actors: Object.fromEntries(
        (tree.actors ?? []).map((actor) => [
          actor.iStarId,
          {
            kind: actor.kind,
            name: actor.name,
            properties: { ...actor.properties },
            elements: [...actor.elements],
          },
        ]),
      ),
    }),
    ...(hasIds(definition)
      ? {}
      : {
          order: notationDocument(definition, tree).ids,
          named: writtenIds(tree),
        }),
    ...(names && { names }),
  };
};
