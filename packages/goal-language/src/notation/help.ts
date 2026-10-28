/**
 * The goal language's notation for one dialect, as data (goal-controller#415):
 * what a writer (the agent's `notation-help`) needs to write lines the
 * dialect reads. Its element line, the bracket's operators it enables (the
 * catalog's, each with what it means in the dialect), its property, link and
 * actor lines, and the assertion and expression languages where its
 * properties take them. Every example is written by the printer the
 * Notation view writes with; every operator and symbol is the catalog's or
 * the dialect's own: nothing here is prose of its own.
 */
import {
  ISTAR_ACTOR_KINDS,
  linkLinesOf,
  type AnyDialect,
  type PropertyDefinition,
  type ValueConfig,
} from '@goal-controller/dialect';
import {
  ASSERTION,
  EXPRESSION,
  OPERATORS,
  SKIP,
  type OperatorForm,
} from '../catalog.js';
import { elementLine, propertyLine } from '../print.js';
import { actorLine } from './actorLine.js';
import { linkLine } from './linkLine.js';

/** One operator the dialect enables, with what it means there. */
export type NotationOperatorHelp = {
  symbol: string;
  form: OperatorForm;
  /** the catalog's: 1 binds tightest (0: an operand of its own) */
  precedence: number;
  example: string;
  /** the construct's (or postfix modifier's) name, label and help */
  meaning: string;
  label: string;
  help: string;
};

export type NotationHelp = {
  dialect: string;
  /** an element line, written (`G1: Name [G2;G3]`), and the id prefix of each kind it lists */
  elementLine: {
    example: string;
    prefixes: readonly { kind: string; prefix: string }[];
  };
  /** what a bracket after an element's name holds: null, the dialect has no notation */
  refinement: {
    operandKinds: readonly string[];
    /** the keyword an operand may be instead of an id, when the dialect allows it */
    skip: string | null;
    operators: readonly NotationOperatorHelp[];
  } | null;
  /** a property line under its element, and the keys a dialect without ids reads as property lines' */
  propertyLine: { example: string; keys: readonly string[] } | null;
  /** a link's properties, as a line under its source */
  linkLine: { example: string } | null;
  /** an actor's properties, as a line of its own */
  actorLine: { example: string } | null;
  /** the assertion language, where a property takes a condition */
  assertion:
    | (Pick<typeof ASSERTION, 'infix' | 'prefix' | 'comparators' | 'bool'> & {
        prefixes: readonly string[];
      })
    | null;
  /** the expression language, where a property takes one */
  expression: Pick<typeof EXPRESSION, 'infix' | 'prefix' | 'member'> | null;
};

const VALUE = '<value>';

/** A property's value configs: its own, or both of a conditional one's. */
const valuesOf = (property: PropertyDefinition): ValueConfig[] =>
  'when' in property.value
    ? [property.value.matching, property.value.otherwise]
    : [property.value];

const propertiesOf = (dialect: AnyDialect): PropertyDefinition[] => [
  ...Object.values(dialect.properties).flat(),
  ...Object.values(dialect.links ?? {}).flat(),
  ...(dialect.actors ?? []),
];

const operatorsOf = (dialect: AnyDialect): NotationOperatorHelp[] => {
  if (!dialect.notation) return [];
  const {
    operators,
    standalone = {},
    constructs,
    modifiers = {},
  } = dialect.notation;
  const help = (
    symbol: string,
    meaning: string,
    standing: boolean,
  ): NotationOperatorHelp[] => {
    const entry = OPERATORS.find(
      (o) => o.symbol === symbol && (o.form === 'standalone') === standing,
    );
    const means = constructs[meaning] ?? modifiers[meaning];
    return entry && means
      ? [
          {
            symbol,
            form: entry.form,
            precedence: entry.precedence,
            example: entry.example,
            meaning,
            label: means.label,
            help: means.help,
          },
        ]
      : [];
  };
  return [
    ...Object.entries(operators)
      .flatMap(([symbol, meaning]) => help(symbol, meaning, false))
      .sort((a, b) => a.precedence - b.precedence),
    ...Object.entries(standalone).flatMap(([symbol, meaning]) =>
      help(symbol, meaning, true),
    ),
  ];
};

/** The notation `dialect` reads, as data: what an agent is told it may write. */
export const notationHelpOf = (dialect: AnyDialect): NotationHelp => {
  const prefixes = Object.entries(dialect.elements).flatMap(
    ([kind, element]) =>
      element?.prefix !== undefined ? [{ kind, prefix: element.prefix }] : [],
  );
  const operators = operatorsOf(dialect);
  const operand = dialect.notation?.operand.kinds
    .map((kind) => dialect.elements[kind]?.prefix)
    .find((prefix) => prefix !== undefined);
  const joining = operators.find((o) => o.form === 'infix');
  const first = prefixes[0]?.prefix ?? '';
  const element = (id: number) => `${operand ?? first}${id}`;
  const listed = Object.entries(dialect.properties).find(
    ([kind, list]) => kind in dialect.elements && list.length > 0,
  )?.[1][0];
  const link = Object.entries(dialect.links ?? {}).find(
    ([, list]) => list.length > 0,
  );
  const actor = dialect.actors?.[0];
  const values = propertiesOf(dialect).flatMap(valuesOf);
  const assertions = values.filter(
    (value): value is Extract<ValueConfig, { type: 'assertion' }> =>
      value.type === 'assertion',
  );
  return {
    dialect: dialect.name,
    elementLine: {
      example: elementLine(dialect, {
        id: `${first}1`,
        name: 'Name',
        notation: joining
          ? [element(2), element(3)].join(joining.symbol)
          : null,
      }),
      prefixes,
    },
    refinement: dialect.notation
      ? {
          operandKinds: dialect.notation.operand.kinds,
          skip: dialect.notation.operand.skip ? SKIP : null,
          operators,
        }
      : null,
    propertyLine: listed
      ? {
          example: propertyLine(listed.key, VALUE),
          keys: dialect.propertyLineOrder,
        }
      : null,
    linkLine:
      link && linkLinesOf(dialect)
        ? {
            example: linkLine(
              dialect,
              { kind: link[0], properties: { [link[1][0]!.key]: VALUE } },
              element(2),
            ),
          }
        : null,
    actorLine: actor
      ? {
          example: actorLine(
            dialect,
            {
              iStarId: 'actor',
              kind: actor.kinds?.[0] ?? ISTAR_ACTOR_KINDS[0],
              name: 'Name',
              properties: { [actor.key]: VALUE },
            },
            {},
          ),
        }
      : null,
    assertion:
      assertions.length > 0
        ? {
            infix: ASSERTION.infix,
            prefix: ASSERTION.prefix,
            comparators: ASSERTION.comparators,
            bool: ASSERTION.bool,
            prefixes: [...new Set(assertions.flatMap((a) => a.prefixes ?? []))],
          }
        : null,
    expression: values.some(
      (value) =>
        value.type === 'expression' ||
        (value.type === 'assertion' && value.functions !== undefined),
    )
      ? {
          infix: EXPRESSION.infix,
          prefix: EXPRESSION.prefix,
          member: EXPRESSION.member,
        }
      : null,
  };
};

/** The same, as plain text: a system prompt's section. */
export const notationHelpText = (help: NotationHelp): string =>
  [
    `element line: ${help.elementLine.example}`,
    help.elementLine.prefixes.length > 0 &&
      `  id prefixes: ${help.elementLine.prefixes.map((p) => `${p.prefix} (${p.kind})`).join(', ')}`,
    help.refinement &&
      [
        `bracket operands: ids of ${help.refinement.operandKinds.join(', ')}${help.refinement.skip ? `, or ${help.refinement.skip}` : ''}`,
        `bracket operators (only these), tightest first:`,
        ...help.refinement.operators.map(
          (o) =>
            `  ${o.symbol}  ${o.label}${o.help.includes(o.example) ? '' : ` (${o.example})`}: ${o.help}`,
        ),
      ].join('\n'),
    help.propertyLine &&
      `property line, under its element: ${help.propertyLine.example}${help.propertyLine.keys.length > 0 ? `\n  keys, in order: ${help.propertyLine.keys.join(', ')}` : ''}`,
    help.linkLine && `link line, under its source: ${help.linkLine.example}`,
    help.actorLine && `actor line: ${help.actorLine.example}`,
    help.assertion &&
      `assertion: compare with ${help.assertion.comparators.join(' ')}; combine with ${help.assertion.infix.join(' ')}; negate with ${help.assertion.prefix.join(' ')}; ${help.assertion.bool.join(', ')}${help.assertion.prefixes.length > 0 ? `; starts with ${help.assertion.prefixes.join(' or ')}` : ''}`,
    help.expression &&
      `expression: ${help.expression.infix.map((level) => level.join(' ')).join(', then ')}; negate with ${help.expression.prefix.join(' ')}; a member with ${help.expression.member}`,
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
