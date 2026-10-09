import type {
  AnyDialect,
  ConstructDefinition,
  ConstructOf,
  Relation,
  WithNotation,
} from '../schema';

/** The construct an operator symbol writes (binary, or standalone), if it writes one. */
export const constructOf = (
  definition: WithNotation,
  symbol: string,
): string | null => {
  const { operators, standalone = {} } = definition.notation;
  const meaning = operators[symbol] ?? standalone[symbol];
  return meaning !== undefined && meaning in definition.notation.constructs
    ? meaning
    : null;
};

/** Why a goal's notation contradicts its refinement links, if it does. */
export const relationMismatch = (
  definition: WithNotation & Pick<AnyDialect, 'problems'>,
  construct: string | null | undefined,
  relation: Relation | null | undefined,
): string | null => {
  if (!construct || !relation) return null;
  const known = definition.notation.constructs[construct];
  if (!known) return null;
  const { label, relation: needs } = known;
  if (!needs || needs === relation) return null;
  return definition.problems.relationMismatch.message
    .replace('{construct}', label)
    .replace('{needs}', needs.toUpperCase())
    .replace('{relation}', relation.toUpperCase());
};

/** The constructs needing a relation's links. */
export const constructsWith = <D extends WithNotation>(
  definition: D,
  relation: Relation,
): ConstructOf<D>[] =>
  (Object.keys(definition.notation.constructs) as ConstructOf<D>[]).filter(
    (c) => definition.notation.constructs[c]?.relation === relation,
  );

/** A construct's label, help and relation, by name (undefined if not declared). */
export const constructDefinition = (
  definition: WithNotation,
  construct: string,
): ConstructDefinition | undefined =>
  (definition.notation.constructs as WithNotation['notation']['constructs'])[
    construct
  ];
