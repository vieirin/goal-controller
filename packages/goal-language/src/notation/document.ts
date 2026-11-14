/**
 * The Notation view's document: the whole model as text, one element line per
 * operand kind element with its properties on the lines under it, and one per
 * declared element with its declaration, indented by depth (presentation
 * only: structure stays in the diagram). Text edits map back to element texts
 * and properties. The syntax is the goal language's; what a line has (an id,
 * annotations, a declaration) is the definition's.
 */
import {
  ANNOTATION_KEYS,
  DECLARATION_KEYS,
  hasIds,
  type AnyDialect,
  type DefinitionContext,
  type DocumentNode,
  type DocumentTree,
  type PropertyDefinition,
  linkLinesOf,
  actorPropertiesOf,
  istarKindOf,
  shortId,
  extensionKindsRead,
  linkPropertiesOf,
} from '@goal-controller/dialect';
import {
  documentLine,
  elementLine,
  hasWrittenId,
  propertyLine,
  writeAnnotations,
  writeDeclaration,
  writtenName,
} from '../print.js';
import { keyedKeyOf } from '../parse.js';
import { lineIdentities, type Identified } from './identity.js';
import { kindOfId } from './scope.js';
import { annotatedProperties, readLine } from './lines.js';
import {
  ACTOR_LINE_KEY,
  actorLine,
  actorNames,
  hasActorLine,
  readActorLine,
  type ActorLineReading,
} from './actorLine.js';
import {
  isWritableLinkValue,
  LINK_LINE_KEY,
  hasLinkLine,
  linkLine,
  linkOfLine,
  readLinkLine,
  targetKey,
  writtenTarget,
  type LinkLineReading,
} from './linkLine.js';

type Document = Pick<
  AnyDialect,
  'elements' | 'notation' | 'propertyLineOrder' | 'indent'
> &
  Partial<
    Pick<
      AnyDialect,
      'idScope' | 'links' | 'linkLines' | 'actors' | 'properties'
    >
  >;

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
    ((node.hasId ?? node.id !== node.iStarId) ||
      definition.idlessElements !== 'unlisted' ||
      !hasIds(definition))
  );
};

/**
 * A node's keys a property line is written with: the keys `propertyLineOrder`
 * lists, each followed by its keyed keys the node has (`Probability[e1]`,
 * goal-controller#354), in the order stored, in any document (one without
 * ids reads a keyed key after a declared key, goal-controller#518).
 */
const lineKeysOf = (
  definition: Document,
  node: Pick<DocumentNode, 'kind' | 'properties'>,
): string[] =>
  definition.propertyLineOrder.flatMap((key) => [
    key,
    ...(isKeyedLineKey(definition, node.kind, key)
      ? Object.keys(node.properties).filter(
          (stored) => keyedKeyOf(stored)?.key === key,
        )
      : []),
  ]);

/** Whether a kind's property `key` is keyed, and so has keyed lines. */
const isKeyedLineKey = (definition: Document, kind: string, key: string) =>
  !!definition.properties?.[kind]?.some(
    (p) => p.key === key && p.keyed !== undefined,
  );

/** Whether a line's key is one a kind's property lines are written with: a listed key, or one of its keyed keys. */
const isLineKey = (
  definition: Document,
  kind: string,
  read: { key: string; keyed?: { key: string } },
): boolean =>
  read.keyed
    ? definition.propertyLineOrder.includes(read.keyed.key) &&
      isKeyedLineKey(definition, kind, read.keyed.key)
    : definition.propertyLineOrder.includes(read.key);

/** An element's text, as its name stores it (`elementLine`): its written id's, its name and notation. */
export const nodeLine = (
  definition: Pick<AnyDialect, 'elements'>,
  node: Pick<DocumentNode, 'id' | 'name' | 'notation'> &
    Partial<Pick<DocumentNode, 'iStarId' | 'hasId'>>,
): string =>
  elementLine(definition, {
    ...node,
    hasId:
      node.iStarId === undefined
        ? node.hasId
        : hasWrittenId({ ...node, iStarId: node.iStarId }),
  });

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
 * Depth-first from the roots, each element once (at its first parent), each
 * its kind's word, the id it shows and its text (`documentLine`). `ids`: the
 * element each line is or is under (an actor line, at the top, is none's).
 */
export const notationDocument = (
  definition: Document,
  tree: DocumentTree,
): { text: string; ids: string[] } => {
  const lines: string[] = [];
  const ids: string[] = [];
  const names = lineNames(definition, tree);
  // its actors with properties (goal-controller#109), at the top: each an
  // `actor` line, which is no element's
  if (definition.actors) {
    const actors = tree.actors ?? [];
    const byName = actorNames(actors);
    for (const actor of actors)
      if (hasActorLine(definition, actor))
        lines.push(actorLine(definition, actor, byName));
  }
  for (const { id, node: listed, depth } of lineOrder(definition, tree)) {
    // a name that would read as a property line is quoted (goal-controller#138)
    const node = { ...listed, name: writtenName(definition, listed.name) };
    const element = definition.elements[node.kind];
    const annotations = element?.annotated
      ? writeAnnotations(node.properties)
      : null;
    if (element?.declares) {
      lines.push(
        definition.indent.repeat(depth) +
          documentLine(
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
        documentLine(definition, node, null, annotations),
    );
    ids.push(id);
    for (const key of lineKeysOf(definition, node)) {
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
        ids.push(id);
      }
  }
  return { text: lines.join('\n'), ids };
};

/** The elements of a tree a document's lines name (`lineIdentities`): its nodes, by key. */
const identifiedOf = (tree: DocumentTree): Identified[] =>
  [...tree.nodes].map(([key, node]) => ({
    key,
    id: node.id,
    iStarId: node.iStarId,
    ...(node.hasId !== undefined && { hasId: node.hasId }),
  }));

/** An element a line creates (goal-controller#518). */
export type CreatedElement = {
  /** its new piStar id */
  iStarId: string;
  /** its iStar kind (`istarKindOf`: an engine's `task` is `istar.Task`) */
  kind: string;
  /** its text, as its name stores it (`G1: Deliver [G2;G3]`, `net_up: …`, `Achieve [Manual Backup]`) */
  text: string;
  /** its custom properties: its line's annotations or declaration, and the property lines under it */
  properties: Readonly<Record<string, string>>;
  /** the key of the element whose line is the nearest above it (null: none): it goes in that one's container */
  after: string | null;
  /** its line's index in the document (from 0) */
  line: number;
  /** the id the editor writes on its line, which had none (`shortId` of `iStarId`); null: the line has one */
  writeId: string | null;
};

export type NotationEdit =
  | { iStarId: string; text: string }
  | { iStarId: string; key: string; value: string | null }
  /** a link's property (goal-controller#107), by the link's piStar id */
  | { link: string; key: string; value: string | null }
  /** an actor's property (goal-controller#109), by the actor's piStar id */
  | { actor: string; key: string; value: string | null }
  /** an element a line adds (goal-controller#518) */
  | { create: CreatedElement }
  /** an element whose line is gone, by piStar id (its links stay: orphans) */
  | { remove: string };

export type NotationEditsOptions = {
  /** a new element's piStar id (default: a random UUID) */
  newId?: () => string;
};

/**
 * What a notation document changes in the model: element texts that differ,
 * and properties added, changed or removed under an element's line; an
 * element line naming no element (by its id: never its position) creates
 * one, an element no line names any more is removed (goal-controller#518).
 * While any element line can't be read, starts with no word or with no
 * kind's, or a line is none of the element above's property or link lines
 * (or has no element above), the text creates and removes nothing (being
 * typed); while a line under an element cannot be read, that element's
 * properties are not cleared. A line whose word is another kind than its element's changes
 * nothing.
 */
export const notationEdits = (
  definition: Document,
  doc: string,
  tree: DocumentTree,
  { newId = () => globalThis.crypto.randomUUID() }: NotationEditsOptions = {},
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
  /** an element a line creates, with the property lines under it */
  type Created = {
    kind: string;
    text: string;
    properties: Record<string, string>;
    lineProperties: Map<string, string>;
    after: string | null;
    line: number;
    writeId: boolean;
  };
  const blocks: Block[] = [];
  const created: Created[] = [];
  let current: Block | Created | null = null;
  // the actor lines, wherever they are (goal-controller#109)
  const actorLines: ActorLineReading[] = [];
  let actorsUnreadable = false;
  // an element line being typed: nothing is created or removed
  let typing = false;
  const named = new Set<string>();
  const createdIds = new Set<string>();
  let above: string | null = null;
  const identities = lineIdentities(definition, identifiedOf(tree));
  const lines = doc.split('\n');
  for (const [index, written] of lines.entries()) {
    const read = readLine(definition, written);
    const indent = written.length - written.trimStart().length;
    if (
      read.kind === 'element' &&
      (read.word || read.id !== null || !hasIds(definition))
    ) {
      current = null;
      const word = read.word;
      if (!word || word.kind === null || read.errors.length) typing = true;
      const identity = identities.resolve(indent, read.id);
      if (identity && 'ambiguous' in identity) {
        identity.ambiguous.forEach((key) => named.add(key));
        continue;
      }
      if (!identity) {
        if (!word?.kind) continue;
        // a runtime id says its kind (`T1` a task's): another than the word's is no element yet
        if (
          hasIds(definition) &&
          (read.id === null || kindOfId(definition, read.id) !== word.kind)
        ) {
          typing = true;
          continue;
        }
        if (read.id !== null) {
          if (createdIds.has(read.id)) typing = true;
          createdIds.add(read.id);
        }
        const element = definition.elements[word.kind];
        const properties: Record<string, string> = {};
        const set = (from: Readonly<Record<string, string | undefined>>) => {
          for (const [key, value] of Object.entries(from))
            if (value !== undefined) properties[key] = value;
        };
        if (element?.annotated) set(annotatedProperties(read));
        if (element?.declares && read.declaration)
          set(read.declaration.properties);
        const create: Created = {
          kind: word.kind,
          text: read.text,
          properties,
          lineProperties: new Map(),
          after: above,
          line: index,
          writeId: read.id === null,
        };
        created.push(create);
        if (!element?.declares) current = create;
        continue;
      }
      const id = identity.key;
      named.add(id);
      const node = tree.nodes.get(id);
      if (!node) continue;
      above = id;
      // its word says another kind: the line is no edit of it
      if (word?.kind && word.kind !== node.kind) continue;
      // its short id is shown, never stored
      const text =
        !hasWrittenId(node) && read.id === shortId(node.iStarId)
          ? read.text.slice(read.id.length).replace(/^\s*:\s*/, '')
          : read.text;
      const element = definition.elements[node.kind];
      const errorBefore = (to: number) =>
        read.errors.some((error) => error.offset < to);
      // an unreadable annotation (being typed) changes none of them yet
      if (element?.annotated && !errorBefore(read.textSpan.from))
        setKeys(node, ANNOTATION_KEYS, annotatedProperties(read));
      if (element?.declares) {
        if (text !== nodeLine(definition, node))
          edits.push({ iStarId: node.iStarId, text });
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
      if (text !== nodeLine(definition, node))
        edits.push({ iStarId: node.iStarId, text });
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
    // a line with neither a word nor an id (`[G2]`): being typed
    if (read.kind === 'element') typing = true;
    if (
      definition.actors &&
      read.kind === 'property' &&
      !read.errors.length &&
      read.key === ACTOR_LINE_KEY
    ) {
      const actor = readActorLine(read.value);
      if ('value' in actor) actorLines.push(actor.value);
      else actorsUnreadable = true;
      continue;
    }
    if (!written.trim()) continue;
    // a line under no element (`ZZ: Nothing` heading a document): being typed
    if (!current) {
      typing = true;
      continue;
    }
    // a line that is none of its element's property or link lines: being typed
    const ownLine =
      read.kind === 'property' &&
      ((linkLinesOf(definition) && read.key === LINK_LINE_KEY) ||
        isLineKey(
          definition,
          'lineProperties' in current ? current.kind : current.node.kind,
          read,
        ));
    if (!ownLine) typing = true;
    if ('lineProperties' in current) {
      // a new element's property lines (its links are the diagram's to draw)
      if (
        read.kind === 'property' &&
        !read.errors.length &&
        read.key !== LINK_LINE_KEY &&
        isLineKey(definition, current.kind, read)
      )
        current.lineProperties.set(read.key, read.value);
      continue;
    }
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
      isLineKey(definition, current.node.kind, read)
    )
      current.properties.set(read.key, read.value);
    else current.unreadable = true;
  }
  if (definition.actors)
    edits.push(
      ...actorEdits(
        definition,
        tree.actors ?? [],
        actorLines,
        actorsUnreadable,
      ),
    );
  // a dialect that doesn't write link lines leaves its links' properties be
  if (linkLinesOf(definition)) {
    const names = lineNames(definition, tree);
    for (const block of blocks)
      edits.push(...linkEdits(definition, tree, names, block));
  }
  for (const { node, properties, unreadable } of blocks) {
    // its keys, and the keyed keys its lines add
    const keys = new Set([
      ...lineKeysOf(definition, node),
      ...[...properties.keys()].filter((key) => keyedKeyOf(key) !== null),
    ]);
    for (const key of keys) {
      const value = properties.get(key);
      const stored = node.properties[key];
      if (value !== undefined && value !== stored) {
        edits.push({ iStarId: node.iStarId, key, value });
      } else if (value === undefined && stored !== undefined && !unreadable) {
        edits.push({ iStarId: node.iStarId, key, value: null });
      }
    }
  }
  if (typing) return edits;
  for (const create of created) {
    const iStarId = newId();
    edits.push({
      create: {
        iStarId,
        kind: istarKindOf(create.kind),
        text: create.text,
        properties: {
          ...create.properties,
          ...Object.fromEntries(create.lineProperties),
        },
        after: create.after,
        line: create.line,
        writeId: create.writeId ? shortId(iStarId) : null,
      },
    });
  }
  for (const { id, node } of lineOrder(definition, tree))
    if (!named.has(id)) edits.push({ remove: node.iStarId });
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
 * What the actor lines change in the actors: each actor whose kind has
 * properties takes the properties its line writes (none written: removed).
 * An actor two lines name changes nothing; while a line can't be read, or
 * names no actor (being typed), an actor without one keeps its properties.
 */
const actorEdits = (
  definition: Pick<AnyDialect, 'actors'>,
  actors: NonNullable<DocumentTree['actors']>,
  lines: readonly ActorLineReading[],
  linesUnreadable: boolean,
): NotationEdit[] => {
  const edits: NotationEdit[] = [];
  const names = actorNames(actors);
  const named = lines.map((line) => targetKey(names, line.target, 'actor'));
  const unreadable = linesUnreadable || named.some((n) => 'error' in n);
  for (const actor of actors) {
    const declared = actorPropertiesOf(definition, actor.kind);
    if (!declared.length) continue;
    const own = lines.filter((_, i) => {
      const n = named[i]!;
      return 'key' in n && n.key === actor.iStarId;
    });
    if (own.length > 1 || (!own.length && unreadable)) continue;
    const written = new Map(
      (own[0]?.properties ?? []).map(({ key, value }) => [key, value]),
    );
    for (const { key } of declared) {
      const stored = actor.properties[key];
      // a value a line can't carry (a brace) stays, unless the line sets another
      if (
        !written.has(key) &&
        stored !== undefined &&
        !isWritableLinkValue(stored)
      )
        continue;
      const value = written.get(key) ?? null;
      if (value !== (stored ?? null))
        edits.push({ actor: actor.iStarId, key, value });
    }
  }
  return edits;
};

/**
 * What the text is checked against: the elements the definition has (kind,
 * operand children, links, construct, custom properties, the id each line
 * shows) and the workbench's variables, and the links missing an end
 * (`orphans`). The shape a language server's context notification takes.
 */
export const contextFromView = (
  definition: Document,
  tree: DocumentTree,
  variables: readonly string[],
): DefinitionContext => {
  const names = lineNames(definition, tree);
  // the kinds it lists, and its extension's it reads (goal-controller#132:
  // given properties, or named by a reference); an iStar kind it gives
  // properties without listing it too; and whatever a link line names, a
  // quality or a dependum (goal-controller#152)
  const read = new Set(extensionKindsRead(definition));
  const properties = definition.properties as Readonly<
    Partial<Record<string, readonly unknown[]>>
  >;
  const linked = new Set(
    linkLinesOf(definition)
      ? (tree.links ?? [])
          .filter((link) => linkPropertiesOf(definition, link.kind).length > 0)
          .map((link) => link.target)
      : [],
  );
  return {
    elements: Object.fromEntries(
      [
        ...tree.nodes,
        ...[...(tree.dependums ?? [])].filter(
          ([key]) => linked.has(key) && !tree.nodes.has(key),
        ),
      ]
        .filter(
          ([key, node]) =>
            definition.elements[node.kind] !== undefined ||
            read.has(node.kind) ||
            (properties[node.kind]?.length ?? 0) > 0 ||
            linked.has(key),
        )
        .map(([key, node]) => [
          key,
          {
            kind: node.kind,
            ...(key !== node.id && { id: node.id }),
            ...(node.name && { name: node.name }),
            children: node.children.filter((id) =>
              (
                (definition.notation?.operand.kinds ?? []) as readonly string[]
              ).includes(tree.nodes.get(id)?.kind ?? ''),
            ),
            relation: node.relation,
            construct: node.construct,
            ...(node.x !== undefined && { x: node.x }),
            iStarId: node.iStarId,
            hasId: hasWrittenId(node),
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
    ...(names && { names }),
    ...(tree.orphans?.length && {
      orphans: tree.orphans.map((orphan) => ({
        ...orphan,
        missing: [...orphan.missing],
      })),
    }),
    // a dialect whose values reference elements (goal-controller#181): a
    // reference may name one by its piStar id, as an imported model does, or
    // by its alias (an imported KAOS element's KAOSTools identifier,
    // goal-controller#518); a piStar id wins over another's alias
    ...((hasReferences(definition) ||
      [...tree.nodes.values()].some((node) => node.alias)) && {
      iStarIds: Object.fromEntries([
        ...[...tree.nodes].flatMap(([key, node]) =>
          node.alias ? [[node.alias, key] as const] : [],
        ),
        ...[...tree.nodes].map(([key, node]) => [node.iStarId, key] as const),
      ]),
    }),
  };
};

/** Whether a dialect has a `reference` value: an element's, a link's or an actor's. */
const hasReferences = (definition: Document): boolean =>
  [
    ...Object.values(definition.properties ?? {}),
    ...Object.values(definition.links ?? {}),
    definition.actors ?? [],
  ].some((list) =>
    (list as readonly PropertyDefinition[]).some(({ value }) =>
      ('when' in value ? [value.matching, value.otherwise] : [value]).some(
        (config) => config.type === 'reference',
      ),
    ),
  );
