/**
 * The Notation view's document: the whole model as text, one element line per
 * operand kind element with its properties on the lines under it, and one per
 * declared element with its declaration, indented by depth. The syntax is the
 * goal language's; what a line has (an id, annotations, a declaration) is the
 * definition's.
 *
 * What an edited document changes in the model (`notationEdits`,
 * goal-controller#518) is read from a line diff (`lineDiff`) between the
 * document as last written from the model (`notationDocument`) and the
 * document as edited, by these rules and no others:
 *
 * 1. A line that is unchanged keeps its element: an element line names the
 *    element it named, a property or link line stays its element's,
 *    whatever is typed around it.
 * 2. A new property or link line belongs to the element line above it in
 *    the edited text, by indentation (the nearest one indented less).
 * 3. A property line removed unsets that property on its element; one
 *    changed in place (the diff pairs it with a new line of the same key,
 *    no new element line before it in its hunk) sets it on its element.
 * 4. An element line replaced in place (the diff pairs an old element line
 *    with a new one of the same kind whose id alone, or name alone,
 *    differs) is a rename or a relabel of the same element: its piStar id,
 *    position, links and properties stay. Also when other lines are added
 *    or removed in the same edit. Two ids swapped in place are two renames.
 * 5. A new element line whose id names an element (a line moved) is that
 *    element. One that is only added creates an element (its id the
 *    missing end of orphans when its id is that end's short id, or the id
 *    its author wrote, kept on the orphans: the orphans are repaired); an
 *    element no line names any more is removed, its links kept as orphans.
 *    An unchanged line of a removed element is read as a new line (2).
 * 6. A line that cannot be read yet (being typed) or that is an error (a
 *    second line with one element's id, a word no kind has, another kind's
 *    word on an element's line) produces no edits and changes what no other
 *    line means; the lines its hunk replaces stay as they were (an element
 *    is not removed, a property not unset), and the lines under it are
 *    none's.
 *
 * Diagnostics are the language's (`diagnostics.ts`): these rules say what a
 * text does to the model, not whether it is well written.
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
  WRITTEN_ID_KEY,
  MISSING_END_ID_KEYS,
  extensionKindsRead,
  linkPropertiesOf,
} from '@goal-controller/dialect';
import {
  documentLine,
  elementLine,
  hasWrittenId,
  oneLine,
  shownId,
  propertyLine,
  writeAnnotations,
  writeDeclaration,
  writtenName,
} from '../print.js';
import { keyedKeyOf } from '../parse.js';
import {
  lineIdentities,
  type Identified,
  type LineIdentity,
} from './identity.js';
import { lineDiff } from './lineDiff.js';
import { kindOfId } from './scope.js';
import {
  annotatedProperties,
  readLine,
  type ElementReading,
  type LineReading,
} from './lines.js';
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

/** A document's lines as written from a model: each line's element (null: an actor line, none's) and what it is. */
type WrittenLines = {
  lines: string[];
  owners: (string | null)[];
  /** `element`: the element's own line; else a property line's key, `link` or `actor` */
  roles: string[];
};

/**
 * Depth-first from the roots, each element once (at its first parent), each
 * its kind's word, the id it shows and its text (`documentLine`), with the
 * element each line is or is under, and what the line is.
 */
const writtenLines = (
  definition: Document,
  tree: DocumentTree,
): WrittenLines => {
  const lines: string[] = [];
  const owners: (string | null)[] = [];
  const roles: string[] = [];
  const push = (line: string, owner: string | null, role: string) => {
    lines.push(line);
    owners.push(owner);
    roles.push(role);
  };
  const names = lineNames(definition, tree);
  // its actors with properties (goal-controller#109), at the top: each an
  // `actor` line, which is no element's
  if (definition.actors) {
    const actors = tree.actors ?? [];
    const byName = actorNames(actors);
    for (const actor of actors)
      if (hasActorLine(definition, actor))
        push(actorLine(definition, actor, byName), null, ACTOR_LINE_KEY);
  }
  for (const { id, node: listed, depth } of lineOrder(definition, tree)) {
    // a name that would read as a property line is quoted (goal-controller#138)
    const node = { ...listed, name: writtenName(definition, listed.name) };
    const element = definition.elements[node.kind];
    const annotations = element?.annotated
      ? writeAnnotations(node.properties)
      : null;
    if (element?.declares) {
      push(
        definition.indent.repeat(depth) +
          documentLine(
            definition,
            node,
            writeDeclaration(node.properties),
            annotations,
          ),
        id,
        ELEMENT_ROLE,
      );
      continue;
    }
    push(
      definition.indent.repeat(depth) +
        documentLine(definition, node, null, annotations),
      id,
      ELEMENT_ROLE,
    );
    for (const key of lineKeysOf(definition, node)) {
      const value = node.properties[key];
      if (value !== undefined)
        push(
          definition.indent.repeat(depth + 1) + propertyLine(key, value),
          id,
          key,
        );
    }
    // its links with properties (goal-controller#107), each a `link` line
    for (const link of tree.links ?? [])
      if (link.source === id && link.target && hasLinkLine(definition, link))
        push(
          definition.indent.repeat(depth + 1) +
            linkLine(definition, link, writtenTarget(names, link.target)),
          id,
          LINK_LINE_KEY,
        );
  }
  return { lines, owners, roles };
};

/** A base's role of an element's own line (`DocumentBase`). */
export const ELEMENT_ROLE = '#element';

/**
 * Depth-first from the roots, each element once (at its first parent), each
 * its kind's word, the id it shows and its text (`documentLine`). `ids`: the
 * element each line is or is under (an actor line, at the top, is none's).
 */
export const notationDocument = (
  definition: Document,
  tree: DocumentTree,
): { text: string; ids: string[] } => {
  const { lines, owners } = writtenLines(definition, tree);
  return {
    text: lines.join('\n'),
    ids: owners.filter((owner): owner is string => owner !== null),
  };
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
  /**
   * an element whose line is gone, by piStar id (its links stay: orphans);
   * `writtenId`: the id its author wrote, which its orphans keep
   * (`MISSING_END_ID_KEYS`) so that writing its line again repairs them
   */
  | { remove: string; writtenId?: string };

export type NotationEditsOptions = {
  /** a new element's piStar id (default: a random UUID) */
  newId?: () => string;
  /**
   * the text the model has, line by line, that `doc` was edited from
   * (default: the document written from `tree`, `documentBase`): an editor
   * that keeps what is typed while its edits reach the model reads the
   * next text against the `base` the last reading gave, so that a line
   * keeps the element it had there
   */
  base?: DocumentBase;
};

/**
 * A text the model has (goal-controller#518): its lines, the element each
 * is or is under (its piStar id; null: none) and what each is. What an
 * edited text is read against (`notationReading`).
 */
export type DocumentBase = {
  lines: readonly string[];
  owners: readonly (string | null)[];
  /** an element line (`ELEMENT_ROLE`), a property line's key, `link`, `actor`, or '' (a blank line) */
  roles: readonly string[];
};

/** The document written from a tree (`notationDocument`) as a base. */
export const documentBase = (
  definition: Document,
  tree: DocumentTree,
): DocumentBase => {
  const { lines, owners, roles } = writtenLines(definition, tree);
  return {
    lines,
    owners: owners.map((key) =>
      key === null ? null : (tree.nodes.get(key)?.iStarId ?? null),
    ),
    roles,
  };
};

/** What an element line of the edited text is (`notationEdits`). */
type ElementState =
  /** unchanged (`kept`), changed in place (`paired`), or named by its id elsewhere (`resolved`) */
  | { state: 'kept' | 'paired' | 'resolved'; key: string }
  /** an element it creates */
  | { state: 'new' }
  /** being typed, or an error: it edits nothing; `keys`: the elements it names, which stay */
  | { state: 'error'; keys: readonly string[] };

/** The line a property or link line is under: an element of the model's, one a line creates (by its line), or none. */
type Owner = { key: string } | { create: number } | null;

/** A property line an element has in the edited text (`value` null: a line held, as it was). */
type OwnedProperty = {
  key: string;
  value: string | null;
  /** typed (not a line of the text it was edited from) */
  changed: boolean;
  /** its line in the edited text (-1: a line held) */
  at: number;
};

/**
 * What a notation document changes in the model (goal-controller#518), read
 * from a line diff between `base` (the document as written from `tree`, or
 * the text the last reading left the model with) and `doc`, by the rules in
 * this module's header, and compared with `tree`.
 */
export const notationEdits = (
  definition: Document,
  doc: string,
  tree: DocumentTree,
  options: NotationEditsOptions = {},
): NotationEdit[] => notationReading(definition, doc, tree, options).edits;

/**
 * `notationEdits`, and the text the model has once they are made (`base`):
 * the edited text without its lines being typed or in error, with the lines
 * those hold, each line's element by piStar id (a created element's
 * included). An editor reads its next text against it.
 */
export const notationReading = (
  definition: Document,
  doc: string,
  tree: DocumentTree,
  {
    newId = () => globalThis.crypto.randomUUID(),
    base,
  }: NotationEditsOptions = {},
): { edits: NotationEdit[]; base: DocumentBase } => {
  const ids = hasIds(definition);
  const before = base ?? documentBase(definition, tree);
  // each line's element now, by key (null: none, or no longer in the model)
  const keyByIStarId = new Map(
    [...tree.nodes].map(([key, node]) => [node.iStarId, key]),
  );
  const ownerOf = (j: number): string | null => {
    const iStarId = before.owners[j] ?? null;
    return iStarId === null ? null : (keyByIStarId.get(iStarId) ?? null);
  };
  const isElementRole = (j: number) => before.roles[j] === ELEMENT_ROLE;
  const lines = doc.split('\n');
  const diff = lineDiff(before.lines, lines);
  const reads = lines.map((line) => readLine(definition, line));
  const indents = lines.map((line) => line.length - line.trimStart().length);
  const elementAt = (i: number): ElementReading | null => {
    const read = reads[i]!;
    return read.kind === 'element' &&
      (read.word !== null || read.id !== null || !ids)
      ? read
      : null;
  };
  const nodeOf = (key: string) => tree.nodes.get(key)!;

  // what each element line's id names, read in order (a scoped id under its goal)
  const identities = lineIdentities(definition, identifiedOf(tree));
  const named = new Map<number, LineIdentity>();
  const scopes = new Map<number, string | null>();
  for (const i of lines.keys()) {
    const read = elementAt(i);
    if (!read) continue;
    named.set(i, identities.resolve(indents[i]!, read.id));
    scopes.set(i, identities.goal());
  }
  /** a complete element line: a kind's word, no error, an id where ids are runtime ids (of the word's kind) */
  const readable = (i: number): boolean => {
    const read = elementAt(i);
    const kind = read?.word?.kind;
    if (!read || !kind || read.errors.length) return false;
    // a declaration being typed (`{` and no declaration read)
    if (
      definition.elements[kind]?.declares &&
      !read.declaration &&
      lines[i]!.slice(read.textSpan.from).includes('{')
    )
      return false;
    return !ids || (read.id !== null && kindOfId(definition, read.id) === kind);
  };

  // 1. element lines: unchanged (rule 1), changed in place (4), named by
  // their id (5), new (5), or neither (6)
  const states = new Map<number, ElementState>();
  for (const i of lines.keys()) {
    const old = diff.matched[i]!;
    const key = old >= 0 && isElementRole(old) ? ownerOf(old) : null;
    if (elementAt(i) && key !== null) states.set(i, { state: 'kept', key });
  }
  // an old element line and a new one in one hunk, of one kind, with the
  // same id or the same name: the same element, renamed or relabelled
  const pairedWith = new Map<number, number>(); // old element line → new
  for (const hunk of diff.hunks) {
    const added = hunk.added.filter((i) => !states.has(i) && readable(i));
    let from = 0;
    for (const j of hunk.removed) {
      const key = isElementRole(j) ? ownerOf(j) : null;
      if (key === null) continue;
      const old = readLine(definition, before.lines[j]!);
      if (old.kind !== 'element') continue;
      for (let at = from; at < added.length; at++) {
        const i = added[at]!;
        const read = elementAt(i)!;
        if (
          read.word?.kind === nodeOf(key).kind &&
          ((read.id !== null && read.id === old.id) ||
            bareText(read) === bareText(old))
        ) {
          states.set(i, { state: 'paired', key });
          pairedWith.set(j, i);
          from = at + 1;
          break;
        }
      }
    }
  }
  for (const i of lines.keys()) {
    const read = elementAt(i);
    if (!read || states.has(i)) continue;
    const identity = named.get(i) ?? null;
    const keys =
      identity === null
        ? []
        : 'key' in identity
          ? [identity.key]
          : [...identity.ambiguous];
    if (identity && 'key' in identity && read.word?.kind) {
      // its word says another kind: the line is no edit of it
      states.set(
        i,
        !read.errors.length && read.word.kind === nodeOf(identity.key).kind
          ? { state: 'resolved', key: identity.key }
          : { state: 'error', keys },
      );
      continue;
    }
    states.set(
      i,
      identity === null && readable(i)
        ? { state: 'new' }
        : { state: 'error', keys },
    );
  }
  // two lines naming one element, or showing one id: the ones not
  // unchanged are errors (a copied line)
  const groups = new Map<string, number[]>();
  const group = (name: string, i: number) =>
    groups.set(name, [...(groups.get(name) ?? []), i]);
  for (const [i, state] of states) {
    if (state.state === 'error') continue;
    if (state.state !== 'new') group(`key\0${state.key}`, i);
    const id = elementAt(i)!.id;
    if (id !== null) group(`id\0${scopes.get(i) ?? ''}\0${id}`, i);
  }
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    for (const i of members) {
      const state = states.get(i)!;
      if (state.state === 'kept' || state.state === 'error') continue;
      states.set(i, {
        state: 'error',
        keys: state.state === 'new' ? [] : [state.key],
      });
    }
  }

  // 2. the other lines' elements
  const isActorLine = (read: LineReading) =>
    !!definition.actors &&
    read.kind === 'property' &&
    read.key === ACTOR_LINE_KEY;
  const isLinkLine = (read: LineReading) =>
    linkLinesOf(definition) &&
    read.kind === 'property' &&
    read.key === LINK_LINE_KEY;
  // a new line's: the element line's above it, by indentation (rule 2)
  const ownerAbove = (i: number): Owner => {
    for (let a = i - 1; a >= 0; a--) {
      const state = states.get(a);
      if (!state || indents[a]! >= indents[i]!) continue;
      return state.state === 'new'
        ? { create: a }
        : state.state === 'error'
          ? null
          : { key: state.key };
    }
    return null;
  };
  const kindOfOwner = (owner: Owner): string | null => {
    if (owner === null) return null;
    const kind =
      'key' in owner
        ? isListed(definition, nodeOf(owner.key))
          ? nodeOf(owner.key).kind
          : null
        : elementAt(owner.create)!.word!.kind!;
    return kind && !definition.elements[kind]?.declares ? kind : null;
  };
  /** whether a line reads as one of its owner's property or link lines */
  const fits = (read: LineReading, owner: Owner): boolean => {
    const kind = kindOfOwner(owner);
    return (
      kind !== null &&
      read.kind === 'property' &&
      !read.errors.length &&
      (isLinkLine(read) || isLineKey(definition, kind, read))
    );
  };
  // a line changed in place (rule 3): the diff pairs it with a removed line
  // of the same key between the same lines that stay: under the hunk's
  // first line (both texts' lines before any element line of the hunk),
  // under a renamed element's line, or over the line after the hunk (both
  // texts' lines after the hunk's last element line)
  const owners = new Map<number, Owner>();
  const pairedLines = new Set<number>(); // old property and link lines
  const unreadable = new Set<number>(); // hunks with a line being typed
  for (const [h, hunk] of diff.hunks.entries()) {
    // a side's lines, cut at its element lines: each run, and the element line it is under
    const sections = (list: number[], isElement: (n: number) => boolean) => {
      const result: { head: number | null; lines: number[] }[] = [
        { head: null, lines: [] },
      ];
      for (const n of list)
        if (isElement(n)) result.push({ head: n, lines: [] });
        else result.at(-1)!.lines.push(n);
      return result;
    };
    const removed = sections(hunk.removed, isElementRole);
    const added = sections(hunk.added, (i) => states.has(i));
    const keyOfNew = (i: number) => {
      const read = reads[i]!;
      return read.kind === 'property' && !read.errors.length ? read.key : null;
    };
    const pair = (from: number[], to: number[], order: 'top' | 'bottom') => {
      const lines = order === 'top' ? to : [...to].reverse();
      const old = order === 'top' ? from : [...from].reverse();
      for (const i of lines) {
        const key = keyOfNew(i);
        if (key === null || owners.has(i)) continue;
        const j = old.find(
          (j) => !pairedLines.has(j) && before.roles[j] === key,
        );
        const owner = j === undefined ? null : ownerOf(j);
        if (j === undefined || owner === null) continue;
        pairedLines.add(j);
        owners.set(i, { key: owner });
      }
    };
    pair(removed[0]!.lines, added[0]!.lines, 'top');
    for (const section of removed.slice(1)) {
      const to = pairedWith.get(section.head!);
      const into = added.find((s) => s.head === to);
      if (to !== undefined && into) pair(section.lines, into.lines, 'top');
    }
    pair(removed.at(-1)!.lines, added.at(-1)!.lines, 'bottom');
    for (const i of hunk.added) {
      const state = states.get(i);
      if (state) {
        if (state.state === 'error') unreadable.add(h);
        continue;
      }
      const read = reads[i]!;
      if (!lines[i]!.trim() || isActorLine(read)) continue;
      const owner = owners.get(i) ?? ownerAbove(i);
      if (fits(read, owner)) owners.set(i, owner);
      else {
        owners.delete(i);
        unreadable.add(h);
      }
    }
  }
  // a hunk with a line being typed, or an error, holds the lines it replaces (rule 6)
  const held = new Set<number>();
  for (const h of unreadable)
    for (const j of diff.hunks[h]!.removed)
      if (!pairedWith.has(j) && !pairedLines.has(j)) held.add(j);

  // 3. the elements no line names any more (none held) are removed (rule 5)
  const kept = new Set<string>();
  for (const state of states.values())
    if (state.state === 'error') state.keys.forEach((key) => kept.add(key));
    else if (state.state !== 'new') kept.add(state.key);
  for (const j of held) {
    const key = isElementRole(j) ? ownerOf(j) : null;
    if (key !== null) kept.add(key);
  }
  const removed = lineOrder(definition, tree).filter(({ id }) => !kept.has(id));
  const gone = new Set(removed.map(({ id }) => id));
  // an unchanged line keeps its element (rule 1); one of an element gone is
  // read as a new line
  for (const i of lines.keys()) {
    const old = diff.matched[i]!;
    if (states.has(i) || old < 0 || (before.owners[old] ?? null) === null)
      continue;
    const owner = ownerOf(old);
    if (owner !== null && !gone.has(owner)) owners.set(i, { key: owner });
    else if (fits(reads[i]!, ownerAbove(i))) owners.set(i, ownerAbove(i));
  }
  for (const [i, owner] of owners)
    if (owner && 'key' in owner && gone.has(owner.key)) {
      const above = ownerAbove(i);
      if (fits(reads[i]!, above)) owners.set(i, above);
      else owners.delete(i);
    }

  // 4. each element's lines
  const properties = new Map<string, OwnedProperty[]>();
  const created = new Map<number, OwnedProperty[]>();
  const links = new Map<string, LinkLineReading[]>();
  const linksUnreadable = new Set<string>();
  const own = <V>(
    map: Map<V, OwnedProperty[]>,
    owner: V,
    line: OwnedProperty,
  ) => map.set(owner, [...(map.get(owner) ?? []), line]);
  const ownLink = (key: string, value: string) => {
    const link = readLinkLine(value);
    if ('value' in link)
      links.set(key, [...(links.get(key) ?? []), link.value]);
    else linksUnreadable.add(key);
  };
  for (const j of held) {
    const key = ownerOf(j);
    const role = before.roles[j]!;
    if (key === null || isElementRole(j) || gone.has(key)) continue;
    const read = readLine(definition, before.lines[j]!);
    if (role === LINK_LINE_KEY) {
      if (read.kind === 'property') ownLink(key, read.value);
      else linksUnreadable.add(key);
    } else if (role !== ACTOR_LINE_KEY)
      own(properties, key, { key: role, value: null, changed: false, at: -1 });
  }
  for (const [i, owner] of [...owners].sort(([a], [b]) => a - b)) {
    const read = reads[i]!;
    if (owner === null || read.kind !== 'property') continue;
    const line = {
      key: read.key,
      value: read.value,
      changed: diff.matched[i]! < 0,
      at: i,
    };
    if ('create' in owner) {
      // a new element's links are the diagram's to draw
      if (!isLinkLine(read)) own(created, owner.create, line);
    } else if (isLinkLine(read)) ownLink(owner.key, read.value);
    else own(properties, owner.key, line);
  }

  // 5. the edits: the element lines' own, the actors', the links', the
  // properties', then the elements created and removed
  const edits: NotationEdit[] = [];
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
  const blocks: string[] = [];
  for (const [i, state] of [...states].sort(([a], [b]) => a - b)) {
    if (state.state === 'new' || state.state === 'error') continue;
    const node = nodeOf(state.key);
    const declares = !!definition.elements[node.kind]?.declares;
    if (!declares && !isListed(definition, node)) continue;
    if (!declares) blocks.push(state.key);
    // an unchanged line edits nothing, unless the model changed since it was written
    if (state.state === 'kept' && (base === undefined || !readable(i)))
      continue;
    const read = elementAt(i)!;
    const element = definition.elements[node.kind];
    // a line without an id, in place of one: the element shows its short id
    const id =
      read.id ??
      (!ids && state.state === 'paired' ? shortId(node.iStarId) : null);
    const { text, line, rename } = elementText(definition, node, {
      id,
      text: read.text,
      name: bareText(read),
    });
    if (element?.annotated)
      setKeys(node, ANNOTATION_KEYS, annotatedProperties(read));
    if (text !== line) edits.push({ iStarId: node.iStarId, text });
    if (rename !== undefined)
      edits.push({ iStarId: node.iStarId, key: WRITTEN_ID_KEY, value: rename });
    if (declares)
      setKeys(node, DECLARATION_KEYS, read.declaration?.properties ?? {});
  }
  if (definition.actors) {
    const actorLines: ActorLineReading[] = [];
    let actorsUnreadable = false;
    for (const read of reads) {
      if (!isActorLine(read) || read.kind !== 'property') continue;
      const actor = read.errors.length ? null : readActorLine(read.value);
      if (actor && 'value' in actor) actorLines.push(actor.value);
      else actorsUnreadable = true;
    }
    edits.push(
      ...actorEdits(
        definition,
        tree.actors ?? [],
        actorLines,
        actorsUnreadable,
      ),
    );
  }
  // a dialect that doesn't write link lines leaves its links' properties be
  if (linkLinesOf(definition)) {
    const names = lineNames(definition, tree);
    for (const key of blocks)
      edits.push(
        ...linkEdits(definition, tree, names, {
          key,
          links: links.get(key) ?? [],
          linksUnreadable: linksUnreadable.has(key),
        }),
      );
  }
  for (const key of blocks) {
    const node = nodeOf(key);
    const lines = properties.get(key) ?? [];
    // its keys, and the keyed keys its lines add
    const keys = new Set([
      ...lineKeysOf(definition, node),
      ...lines
        .filter((line) => line.changed && keyedKeyOf(line.key) !== null)
        .map((line) => line.key),
    ]);
    for (const k of keys) {
      // the last line of a key is its value (a held one: as it was)
      const last = lines
        .filter((line) => line.key === k)
        .sort((a, b) => a.at - b.at)
        .at(-1);
      const stored = node.properties[k];
      if (last === undefined) {
        if (stored !== undefined)
          edits.push({ iStarId: node.iStarId, key: k, value: null });
      } else if (
        last.value !== null &&
        // a value over several lines is written as one
        last.value !== (stored === undefined ? stored : oneLine(stored))
      )
        edits.push({ iStarId: node.iStarId, key: k, value: last.value });
    }
  }
  // the orphans' missing ends, by the ids a line may name one by: its short
  // id, and the id its author wrote (kept on its orphans)
  const missingBy = new Map<string, Set<string>>();
  const recorded = new Map<string, { link: string; key: string }[]>();
  for (const orphan of tree.orphans ?? []) {
    const link = tree.links?.find((l) => l.iStarId === orphan.iStarId);
    for (const end of orphan.missing) {
      missingBy.set(
        shortId(end),
        (missingBy.get(shortId(end)) ?? new Set()).add(end),
      );
      for (const side of ['source', 'target'] as const) {
        const key = MISSING_END_ID_KEYS[side];
        const id = link?.properties[key];
        if (link?.ends?.[side].iStarId !== end || !id) continue;
        missingBy.set(id, (missingBy.get(id) ?? new Set()).add(end));
        recorded.set(end, [
          ...(recorded.get(end) ?? []),
          { link: link.iStarId, key },
        ]);
      }
    }
  }
  const repaired = new Set<string>();
  const cleared: NotationEdit[] = [];
  const createdIds = new Map<number, string>();
  for (const [i, state] of [...states].sort(([a], [b]) => a - b)) {
    if (state.state !== 'new') continue;
    const read = elementAt(i)!;
    const kind = read.word!.kind!;
    const element = definition.elements[kind];
    const props: Record<string, string> = {};
    const set = (from: Readonly<Record<string, string | undefined>>) => {
      for (const [key, value] of Object.entries(from))
        if (value !== undefined) props[key] = value;
    };
    if (element?.annotated) set(annotatedProperties(read));
    if (element?.declares && read.declaration) set(read.declaration.properties);
    // a line with the id of one missing end (its short id, or its
    // author's): that element again; of several, none
    const ends = read.id === null ? [] : [...(missingBy.get(read.id) ?? [])];
    const again =
      ends.length === 1 && !repaired.has(ends[0]!) ? ends[0]! : undefined;
    if (again !== undefined) {
      repaired.add(again);
      for (const { link, key } of recorded.get(again) ?? [])
        cleared.push({ link, key, value: null });
    }
    if (
      read.id !== null &&
      !ids &&
      (again === undefined || read.id !== shortId(again))
    )
      props[WRITTEN_ID_KEY] = read.id;
    for (const line of (created.get(i) ?? []).sort((a, b) => a.at - b.at))
      if (line.value !== null) props[line.key] = line.value;
    const iStarId = again ?? newId();
    createdIds.set(i, iStarId);
    let after: string | null = null;
    for (let a = i - 1; a >= 0 && after === null; a--) {
      const above = states.get(a);
      if (above && above.state !== 'new' && above.state !== 'error')
        after = above.key;
    }
    edits.push({
      create: {
        iStarId,
        kind: istarKindOf(kind),
        text: ids ? read.text : bareText(read),
        properties: props,
        after,
        line: i,
        writeId: read.id === null ? shortId(iStarId) : null,
      },
    });
  }
  edits.push(...cleared);
  for (const { node } of removed)
    edits.push({
      remove: node.iStarId,
      ...(hasWrittenId(node) && { writtenId: shownId(node) }),
    });

  // the text the model has once the edits are made
  const next = {
    lines: [] as string[],
    owners: [] as (string | null)[],
    roles: [] as string[],
  };
  const push = (line: string, owner: string | null, role: string) => {
    next.lines.push(line);
    next.owners.push(owner);
    next.roles.push(role);
  };
  const iStarIdOf = (owner: Owner): string | null =>
    owner === null
      ? null
      : 'key' in owner
        ? nodeOf(owner.key).iStarId
        : (createdIds.get(owner.create) ?? null);
  for (const i of lines.keys()) {
    const h = diff.hunkOf[i]!;
    if (h >= 0 && diff.hunks[h]!.added[0] === i)
      for (const j of diff.hunks[h]!.removed)
        if (held.has(j))
          push(before.lines[j]!, before.owners[j] ?? null, before.roles[j]!);
    const state = states.get(i);
    const read = reads[i]!;
    if (state) {
      if (state.state === 'new')
        push(lines[i]!, createdIds.get(i) ?? null, ELEMENT_ROLE);
      else if (state.state !== 'error')
        push(lines[i]!, nodeOf(state.key).iStarId, ELEMENT_ROLE);
    } else if (!lines[i]!.trim()) push(lines[i]!, null, '');
    else if (isActorLine(read)) push(lines[i]!, null, ACTOR_LINE_KEY);
    else {
      const owner = iStarIdOf(owners.get(i) ?? null);
      if (owner !== null && read.kind === 'property')
        push(lines[i]!, owner, read.key);
    }
  }
  return { edits, base: next };
};

/** A line's text without the id it starts with (`id: name` → `name`): what its element's name stores. */
const bareText = (read: { id: string | null; text: string }): string =>
  read.id === null
    ? read.text
    : read.text.slice(read.id.length).replace(/^\s*:\s*/, '');

/**
 * What an element's line says of its text and id (goal-controller#518).
 * `text`: what its name stores; `line`: what it stores now, to compare it
 * with; `rename`: the written id to keep apart from the name (`WRITTEN_ID_KEY`;
 * null: none any more; undefined: unchanged). An engine's runtime id, and a
 * written id an older model has in its name, stay in the name; a short id is
 * never stored. `read.id`: the id the line shows; `read.name`: what follows it.
 */
const elementText = (
  definition: Document,
  node: DocumentNode,
  read: { id: string | null; text: string; name: string },
): { text: string; line: string; rename?: string | null } => {
  const apart = !!node.properties[WRITTEN_ID_KEY];
  const renamed =
    read.id !== null && read.id !== shownId(node) ? read.id : undefined;
  // an older model's written id in its name moves out of it when it changes
  const moving = renamed !== undefined && hasWrittenId(node) && !apart;
  if (hasIds(definition) || (hasWrittenId(node) && !apart && !moving))
    return {
      text:
        !hasWrittenId(node) &&
        read.id !== null &&
        read.id === shortId(node.iStarId)
          ? read.name
          : read.text,
      line: nodeLine(definition, node),
    };
  const rename =
    renamed === undefined
      ? undefined
      : renamed === shortId(node.iStarId)
        ? apart
          ? null
          : undefined
        : renamed;
  return {
    text: read.name,
    line: moving
      ? nodeLine(definition, node)
      : elementLine({ elements: {} }, { ...node, hasId: false }),
    ...(rename !== undefined && { rename }),
  };
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
