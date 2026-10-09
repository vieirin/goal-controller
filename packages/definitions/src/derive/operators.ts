import type {
  AnyDefinition,
  ConstructDefinition,
  ConstructOf,
  Operator,
  Relation,
  WithNotation,
} from '../schema';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type Notation = Pick<AnyDefinition, 'name' | 'elements'> & WithNotation;

/** A button writing a construct's notation over the goal's children. */
export type ConstructButton = {
  symbol: string;
  construct: string;
  label: string;
  title: string;
  /** the notation it writes */
  write: (children: readonly string[]) => string;
};

/** A button adding a postfix operator with its argument's default. */
export type ArgumentButton = {
  symbol: string;
  /** what it writes: the symbol and the default */
  text: string;
  label: string;
  title: string;
  /** the constructs it is offered in */
  appliesTo: readonly string[];
  /** whether the notation has it already */
  present: (notation: string) => boolean;
  write: (notation: string) => string;
};

type ConstructOperator = Exclude<Operator, { form: 'postfix' }>;

const constructOrder = (definition: Notation) =>
  Object.keys(definition.notation.constructs) as string[];

/**
 * The inspector's operator buttons: one per construct operator, in the
 * constructs' order (standalone forms last), then the postfix ones.
 */
export const operatorsFor = (
  definition: Notation,
): { constructs: ConstructButton[]; arguments: ArgumentButton[] } => {
  const { constructs: table, operators } = definition.notation;
  const order = constructOrder(definition);
  const rank = (op: ConstructOperator) =>
    (op.form === 'standalone' ? order.length : 0) + order.indexOf(op.construct);
  const operand = new RegExp(`^(${operandPattern(definition)})`);
  return {
    constructs: operators
      .filter((op): op is ConstructOperator => op.form !== 'postfix')
      .sort((a, b) => rank(a) - rank(b))
      .map((op) => {
        // defineEngine checked every operator's construct is declared
        const { label, help } = table[op.construct]!;
        return {
          symbol: op.symbol,
          construct: op.construct,
          label,
          title:
            op.form === 'standalone'
              ? `${label} (${definition.name} notation: a standalone ${op.symbol})`
              : `${label}: ${help}`,
          write: (children) =>
            op.form === 'standalone' ? op.symbol : children.join(op.symbol),
        };
      }),
    arguments: operators.flatMap((op) =>
      op.form === 'postfix'
        ? [
            {
              symbol: op.symbol,
              text: `${op.symbol}${op.argument.default}`,
              label: op.argument.name,
              title: op.action.replace(
                `{${op.argument.name}}`,
                String(op.argument.default),
              ),
              appliesTo: op.appliesTo,
              present: (notation: string) => notation.includes(op.symbol),
              write: (notation: string) =>
                notation.replace(
                  operand,
                  `$1${op.symbol}${op.argument.default}`,
                ),
            },
          ]
        : [],
    ),
  };
};

/** An operand's id (any operand kind): the regex source. */
export const operandPattern = (
  definition: Pick<Notation, 'notation' | 'elements'>,
) =>
  definition.notation.operand.kinds
    .map((kind) => (definition.elements as AnyDefinition['elements'])[kind])
    .filter((element) => element !== undefined)
    .map((element) => `${escape(element.prefix ?? '')}${element.idPattern}`)
    .join('|');

/** The construct an operator symbol writes, if it writes one. */
export const constructOf = (
  definition: WithNotation,
  symbol: string,
): string | null => {
  const op = definition.notation.operators.find((o) => o.symbol === symbol);
  return op && op.form !== 'postfix' ? op.construct : null;
};

/** Why a goal's notation contradicts its refinement links, if it does. */
export const relationMismatch = (
  definition: WithNotation & Pick<AnyDefinition, 'problems'>,
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
