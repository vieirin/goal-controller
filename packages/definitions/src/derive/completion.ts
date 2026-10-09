/**
 * What may be typed at a position, from the definition and the model's
 * context: inside a notation, the element's children and the operand
 * keywords; on a line under an element, the keys its kind reads (not yet
 * set); in a field, the ids or names its value config refers to.
 */
import type {
  DefinitionContext,
  AnyDefinition,
  WithNotation,
  ValueConfig,
} from '../schema';
import { lineId, readPropertyLine } from './lines';
import { constructDefinition } from './operators';

export type Completion = {
  label: string;
  type: 'variable' | 'keyword' | 'property';
  detail?: string;
};

export type CompletionResult = { from: number; options: Completion[] };

type Definition = Pick<
  AnyDefinition,
  | 'elements'
  | 'notation'
  | 'properties'
  | 'propertyLine'
  | 'propertyLineOrder'
  | 'languages'
>;

const WORD = /[A-Za-z0-9_.]*$/;

/** Completions in a Notation view document at `pos`, if any apply there. */
export const completionsAt = (
  definition: Definition,
  doc: string,
  pos: number,
  context: DefinitionContext,
): CompletionResult | null => {
  const lines = doc.split('\n');
  let start = 0;
  let index = 0;
  while (index < lines.length - 1 && start + lines[index]!.length < pos) {
    start += lines[index]!.length + 1;
    index++;
  }
  const text = lines[index] ?? '';
  const before = text.slice(0, pos - start);
  const word = WORD.exec(before)?.[0] ?? '';
  const from = pos - word.length;
  const id = lineId(definition, text);
  if (id) {
    if (!definition.notation) return null;
    const [open, close] = definition.notation.delimiters;
    const opened = before.lastIndexOf(open);
    if (opened < 0 || before.lastIndexOf(close) > opened) return null;
    const element = context.elements[id];
    return {
      from,
      options: [
        ...(element?.children ?? []).map((child) => ({
          label: child,
          type: 'variable' as const,
          detail: context.elements[child]?.kind,
        })),
        ...definition.notation.operand.keywords.map((keyword) => ({
          label: keyword,
          type: 'keyword' as const,
        })),
      ],
    };
  }
  // a key: only the first word of a line under an element
  if (before.trim() !== word) return null;
  let above = index - 1;
  let owner: string | null = null;
  const set = new Set<string>();
  for (; above >= 0; above--) {
    owner = lineId(definition, lines[above]!);
    if (owner) break;
    const property = readPropertyLine(definition, lines[above]!);
    if (property) set.add(property.key);
  }
  for (const next of lines.slice(index + 1)) {
    if (lineId(definition, next)) break;
    const property = readPropertyLine(definition, next);
    if (property) set.add(property.key);
  }
  const element = owner ? context.elements[owner] : undefined;
  const owned = element && definition.elements[element.kind];
  if (!element || !owned || owned.declaration) return null;
  return {
    from,
    options: (definition.properties[element.kind] ?? [])
      .filter((p) => p.inspector !== false && !set.has(p.key))
      .map((p) => ({
        label: p.key,
        type: 'property' as const,
        detail: p.help,
      })),
  };
};

/** Completions in a property field's value at `pos`. */
export const fieldCompletionsAt = (
  definition: Definition,
  value: ValueConfig,
  text: string,
  pos: number,
  context: DefinitionContext,
): CompletionResult | null => {
  const word = WORD.exec(text.slice(0, pos))?.[0] ?? '';
  const from = pos - word.length;
  const ids = (kinds: readonly string[]) =>
    Object.entries(context.elements)
      .filter(([, element]) => kinds.includes(element.kind))
      .map(([id, element]) => ({
        label: id,
        type: 'variable' as const,
        detail: element.kind,
      }));
  if (value.type === 'refList') return { from, options: ids([value.kind]) };
  if (value.type === 'expression') {
    const language = definition.languages[value.language];
    if (!language) return null;
    const elements = ids(
      language.resolves.filter((kind) => kind !== 'variable'),
    );
    const named = new Set(elements.map((option) => option.label));
    return {
      from,
      options: [
        ...elements,
        ...(language.resolves.includes('variable')
          ? context.variables
              .filter((name) => !named.has(name))
              .map((name) => ({
                label: name,
                type: 'variable' as const,
                detail: 'variable',
              }))
          : []),
        ...language.keywords.map((keyword) => ({
          label: keyword,
          type: 'keyword' as const,
        })),
      ],
    };
  }
  return null;
};

/** A construct's hover text: `Sequence — does every child, one after another`. */
export const constructHint = (
  definition: WithNotation,
  construct: string,
): string | null => {
  const found = constructDefinition(definition, construct);
  return found ? `${found.label} — ${found.help}` : null;
};
