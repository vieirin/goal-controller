/**
 * The definition pool's documents in the workbench (goal-controller#59):
 * where a pool location is in the Notation view's text and back (a model
 * field is `model:<key>:<field>`), and what applying a rename's edits does
 * to the project's resources and to the model. React-free.
 */
import type { AnyDialect, DocumentTree } from '@goal-controller/dialect';
import {
  modelField,
  type PoolDocument,
  type PoolEdit,
  type PoolLocation,
} from '@goal-controller/lib';
import {
  applyNotationEdits,
  lineKeys,
  type NotationEdit,
} from './notationDocument';

/** What the pool is built from: the open model, and the project's resources. */
export type PoolWorkspace = {
  /** the open model's view (goal-tree's GoalView) */
  tree: DocumentTree | null;
  /** the project's resources: each file, by its kind and path */
  resources: readonly { kind: string; path: string; text: string }[];
};

/** The pool's documents of a workspace. */
export const poolDocuments = (workspace: PoolWorkspace): PoolDocument[] => [
  ...(workspace.tree
    ? [{ id: 'model', kind: 'model', value: workspace.tree }]
    : []),
  ...workspace.resources.map(({ kind, path, text }) => ({
    id: path,
    kind,
    text,
  })),
];

const PROPERTY_LINE = /^(\s+)([A-Za-z][A-Za-z0-9_]*)([ \t]+)/;

type NotationLine = {
  /** the line's element (its own, or the element line's above it) */
  element: string;
  /** `id`, `name`, `notation` (inside the brackets) or a property key */
  fields: { field: string; from: number }[];
  from: number;
};

/** Each line of a Notation document: its element, and where its fields start. */
const notationLines = (
  definition: AnyDialect,
  tree: DocumentTree,
  text: string,
): (NotationLine | null)[] => {
  const lines = text.split('\n');
  const keys = lineKeys(definition, lines, (key) => tree.nodes.has(key));
  let element: string | null = null;
  let from = 0;
  return lines.map((line, i) => {
    const start = from;
    from += line.length + 1;
    const key = keys[i];
    if (key) {
      element = key;
      const node = tree.nodes.get(key);
      const indent = line.length - line.trimStart().length;
      const id = node?.id ?? key;
      const name = line.indexOf(': ', indent + id.length - 1);
      // the notation, as the view has it (trimmed), after the name
      const afterName =
        name >= 0 ? name + 2 + (node?.name.length ?? 0) : indent + id.length;
      const notation = node?.notation
        ? line.indexOf(node.notation, line.indexOf('[', afterName) + 1)
        : -1;
      return {
        element: key,
        from: start,
        fields: [
          { field: 'id', from: start + indent },
          ...(name >= 0 ? [{ field: 'name', from: start + name + 2 }] : []),
          ...(notation > 0
            ? [{ field: 'notation', from: start + notation }]
            : []),
        ],
      };
    }
    const property = PROPERTY_LINE.exec(line);
    return element && property
      ? {
          element,
          from: start,
          fields: [{ field: property[2]!, from: start + property[0].length }],
        }
      : null;
  });
};

/** The pool position of an offset in a Notation document (null: no element's field there). */
export const notationPosition = (
  definition: AnyDialect,
  tree: DocumentTree,
  text: string,
  offset: number,
): { document: string; offset: number } | null => {
  const lineIndex = text.slice(0, offset).split('\n').length - 1;
  const line = notationLines(definition, tree, text)[lineIndex];
  const field = line?.fields.filter((f) => f.from <= offset).at(-1);
  return line && field
    ? {
        document: `model:${line.element}:${field.field}`,
        offset: offset - field.from,
      }
    : null;
};

/** Where a pool location of the model is in a Notation document (null: not shown there). */
export const notationRange = (
  definition: AnyDialect,
  tree: DocumentTree,
  text: string,
  location: PoolLocation,
): { from: number; to: number } | null => {
  const target = modelField(location.document);
  if (!target) return null;
  for (const line of notationLines(definition, tree, text)) {
    if (line?.element !== target.element) continue;
    const field = line.fields.find((f) => f.field === target.field);
    if (field)
      return { from: field.from + location.from, to: field.from + location.to };
  }
  return null;
};

/** The view nodes' texts (goal-tree's GoalView has them; a DocumentTree may not). */
type WithText = { text?: string };

/**
 * A rename's edits applied: each resource's new text (only those changed),
 * and the model's new text (null: unchanged). A model edit changes an
 * element's name (within its text) or a property's value; ids, and the
 * notation's (the children's), aren't renamed here.
 */
export const appliedPoolEdits = (
  edits: readonly PoolEdit[],
  {
    resources,
    tree,
    modelText,
  }: {
    resources: Readonly<Record<string, string>>;
    tree: DocumentTree | null;
    modelText: string;
  },
): { resources: Record<string, string>; modelText: string | null } => {
  const changed: Record<string, string> = {};
  // a field's edits, from the end, so earlier offsets hold
  const apply = (text: string, own: readonly PoolEdit[]) =>
    [...own]
      .sort((a, b) => b.from - a.from)
      .reduce((t, e) => t.slice(0, e.from) + e.text + t.slice(e.to), text);
  const byDocument = new Map<string, PoolEdit[]>();
  for (const edit of edits)
    byDocument.set(edit.document, [
      ...(byDocument.get(edit.document) ?? []),
      edit,
    ]);
  const notation: NotationEdit[] = [];
  for (const [document, own] of byDocument) {
    const field = modelField(document);
    if (!field) {
      const text = resources[document];
      if (text !== undefined) changed[document] = apply(text, own);
      continue;
    }
    const node = tree?.nodes.get(field.element);
    if (!node) continue;
    if (field.field === 'name') {
      const text = (node as WithText).text ?? `${node.id}: ${node.name}`;
      const at = text.indexOf(node.name, node.id.length);
      if (at < 0) continue;
      notation.push({
        iStarId: node.iStarId,
        text:
          text.slice(0, at) +
          apply(node.name, own) +
          text.slice(at + node.name.length),
      });
    } else if (field.field !== 'id' && field.field !== 'notation')
      notation.push({
        iStarId: node.iStarId,
        key: field.field,
        value: apply(node.properties[field.field] ?? '', own),
      });
  }
  return {
    resources: changed,
    modelText: notation.length ? applyNotationEdits(modelText, notation) : null,
  };
};
