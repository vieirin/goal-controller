/**
 * An iStar-DT model as iStarDT-X (goal-controller#144 item 2): the
 * importer's inverse (importers/istardt), cmg-york/istardt's XML at
 * `649c9be`, which dtx2dtg's validator (the XSD, then the Schematron,
 * `docker/dtx2dtg`) accepts. The model is read as the DT-Golog writer reads
 * it (`readIstardtModel`, over the file's piStar, `pistarAnalysisModel`):
 * each kind in its ids' order, a goal's children goals first, a task's
 * effects in its group's order, the actor's sets.
 *
 * - An element's name is its identifier, its description its name (the
 *   text after its id).
 * - A quality's formula is its `formula` (an `expression`), or its utility
 *   links' weighted sum (`weight × quality`, or `weight × the predicate the
 *   effect turns true`); a condition's its `formula` (an `assertion`).
 *   Formulas are written from the goal language's trees: a chain of `+`,
 *   `*`, `&` or `|` read left to right is one element with its operands.
 * - `pre` and `npr`: the element their link comes from, or, for a condition
 *   the importer made of a formula (`<holder>Pre`, `<holder>Npr`, with no
 *   name of its own), that formula, inline, as the file had it.
 * - The header from the diagram's properties, the options from the
 *   project's (`continuous`, `infeasibleActionPenalty`), else the engine's
 *   defaults.
 * - No positions: the format has none (`ISTARDTX_LOSSY`).
 */
import type {
  NativeDiagnostic,
  NativeFileContext,
  NativeWriteResult,
  PistarJson,
} from '@goal-controller/dialect';
import {
  readAssertion,
  readExpression,
  type AssertionReading,
  type ExpressionTree,
} from '@goal-controller/goal-language';
import {
  readXml,
  writeXmlTree,
  type XmlElement,
  type XmlTree,
} from '@goal-controller/goal-language/formats';
import { pistarAnalysisModel } from '../analysis';
import { pairItems } from '../elementText';
import {
  readIstardtModel,
  type IstardtElement,
  type IstardtModel,
} from './model';
import { DEFAULT_INFEASIBLE_PENALTY } from './options';
import type { IstardtKind } from './vocabulary';

/**
 * What iStarDT-X can't carry, as piStar paths: positions (the format has
 * none: the importer lays the model out), the display and the diagram's
 * extent.
 */
export const ISTARDTX_LOSSY = [
  'actors.*.x',
  'actors.*.y',
  'actors.*.nodes.*.x',
  'actors.*.nodes.*.y',
  'display',
  'diagram.width',
  'diagram.height',
];

/** The file's namespace (cmg-york/istardt's XSD). */
const NAMESPACE = 'https://example.org/istar-dt-x';

/** The tag an element is named by in a formula. */
const TAG_OF_KIND: Readonly<Record<IstardtKind, string>> = {
  goal: 'goalID',
  task: 'taskID',
  quality: 'qualID',
  effect: 'effectID',
  condition: 'conditionID',
  predicate: 'predicateID',
  variable: 'variableID',
};
const COMPARISON: Readonly<Record<string, string>> = {
  '>': 'gt',
  '>=': 'gte',
  '<': 'lt',
  '<=': 'lte',
  '=': 'eq',
  '!=': 'neq',
};

type Attribute = readonly [string, string];
const element = (
  name: string,
  attributes: (Attribute | false | undefined)[] = [],
  children: XmlTree[] = [],
  text?: string,
): XmlTree => ({
  name,
  attributes: attributes.filter((a): a is Attribute => !!a),
  children,
  ...(text !== undefined && { text }),
});

/** A formula that can't be written, and why. */
class Unwritable extends Error {}

/**
 * A model as an iStarDT-X file, with what couldn't be written; no text,
 * with an error, when the model can't be read as iStar-DT.
 */
export const writeIstardtx = (
  pistar: PistarJson,
  { options = {} }: Pick<NativeFileContext, 'options'> = {},
): NativeWriteResult => {
  const diagnostics: NativeDiagnostic[] = [];
  const warn = (message: string) =>
    diagnostics.push({ severity: 'warning', message });
  let model: IstardtModel;
  try {
    model = readIstardtModel(pistarAnalysisModel(pistar));
  } catch (error) {
    return {
      text: null,
      diagnostics: [
        {
          severity: 'error',
          message: `Not an iStar-DT model: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
  const json = pistar as Record<string, any>;
  const actor = (json.actors ?? [])[0] ?? {};
  if ((json.actors ?? []).length > 1)
    warn(
      `iStarDT-X has one actor: ${json.actors.length - 1} more are not written`,
    );

  const resolve = (name: string) =>
    model.byIdentifier.get(name) ?? model.byPistarId.get(name);
  const atom = (name: string, what: string): XmlTree => {
    const named = resolve(name);
    if (!named) throw new Unwritable(`${what} names ${name}, no element`);
    return element(TAG_OF_KIND[named.kind], [], [], named.identifier);
  };
  const previous = (tree: ExpressionTree, what: string): XmlTree => {
    if (
      tree.kind !== 'call' ||
      tree.name !== 'previous' ||
      tree.args.length !== 1
    )
      throw new Unwritable(`${what}: iStar-DT has one function, previous/1`);
    const arg = tree.args[0]!;
    if (arg.kind !== 'var' && arg.kind !== 'ref')
      throw new Unwritable(`${what}: previous takes an element's name`);
    return element(
      'previous',
      [],
      [atom(arg.kind === 'var' ? arg.name : arg.id, what)],
    );
  };

  /** A left-nested chain of one operator: its operands, in order. */
  const chain = <T>(tree: T, same: (t: T) => [T, T] | null): T[] => {
    const sides = same(tree);
    return sides ? [...chain(sides[0], same), sides[1]] : [tree];
  };

  const numeric = (tree: ExpressionTree, what: string): XmlTree => {
    switch (tree.kind) {
      case 'number':
        return element('numConst', [], [], tree.value);
      case 'var':
        return atom(tree.name, what);
      case 'ref':
        return atom(tree.id, what);
      case 'member':
        throw new Unwritable(`${what}: iStar-DT reads no members`);
      case 'call':
        return previous(tree, what);
      case 'unary':
        return tree.expr.kind === 'number'
          ? element('numConst', [], [], `-${tree.expr.value}`)
          : element('negate', [], [numeric(tree.expr, what)]);
      case 'binary': {
        const op = tree.operator;
        if (op === '+' || op === '*')
          return element(
            op === '+' ? 'add' : 'multiply',
            [],
            chain(tree as ExpressionTree, (t) =>
              t.kind === 'binary' && t.operator === op
                ? [t.left, t.right]
                : null,
            ).map((t) => numeric(t, what)),
          );
        return element(
          op === '-' ? 'subtract' : 'divide',
          [],
          [
            element('left', [], [numeric(tree.left, what)]),
            element('right', [], [numeric(tree.right, what)]),
          ],
        );
      }
    }
  };
  const unwrap = (tree: AssertionReading | null): AssertionReading | null =>
    tree?.kind === 'paren' ? unwrap(tree.expr) : tree;
  const boolean = (reading: AssertionReading | null, what: string): XmlTree => {
    const tree = unwrap(reading);
    if (!tree) throw new Unwritable(`${what}: an empty formula`);
    switch (tree.kind) {
      case 'and':
      case 'or': {
        const kind = tree.kind;
        return element(
          kind,
          [],
          chain<AssertionReading | null>(tree, (t) => {
            const inner = unwrap(t);
            return inner?.kind === kind ? [inner.left, inner.right] : null;
          }).map((t) => boolean(t, what)),
        );
      }
      case 'not':
        return element('not', [], [boolean(tree.expr, what)]);
      case 'bool':
        return element('boolConst', [], [], String(tree.value));
      case 'var':
        return atom(tree.variable, what);
      case 'call':
        return previous(tree, what);
      case 'comparison': {
        const tag = COMPARISON[tree.operator];
        if (!tag)
          throw new Unwritable(`${what}: no comparison ${tree.operator}`);
        return element(
          tag,
          [],
          [
            element('left', [], [numeric(tree.left, what)]),
            element('right', [], [numeric(tree.right, what)]),
          ],
        );
      }
      case 'member':
        throw new Unwritable(`${what}: iStar-DT reads no members`);
      default:
        throw new Unwritable(
          `${what}: ${tree.kind === 'assign' ? `${tree.variable} = ${tree.value}` : tree.kind} is not a formula iStarDT-X has`,
        );
    }
  };
  /** A formula's element, or none (and a warning) when it can't be written. */
  const formula = (
    text: string | undefined,
    kind: 'expression' | 'assertion',
    what: string,
  ): XmlTree | null => {
    if (!text?.trim()) return null;
    try {
      if (kind === 'expression') {
        const tree = readExpression(text);
        if (!tree) throw new Unwritable(`${what}: "${text}" is no expression`);
        return numeric(tree, what);
      }
      const tree = readAssertion(text);
      if (!tree) throw new Unwritable(`${what}: "${text}" is no condition`);
      return boolean(tree, what);
    } catch (error) {
      if (!(error instanceof Unwritable)) throw error;
      warn(`${error.message}: its formula is not written`);
      return null;
    }
  };

  // a condition the importer made of a holder's `pre` or `npr` formula:
  // written back inline (and not as a condition box)
  const inlined = new Set<IstardtElement>();
  const precedences = (holder: IstardtElement): XmlTree[] =>
    (['pre', 'npr'] as const).flatMap((which) => {
      const sources = model[which](holder);
      if (!sources.length) return [];
      if (sources.length > 1)
        warn(
          `${holder.identifier} has ${sources.length} ${which} links: iStarDT-X has one; the first is written`,
        );
      const source = sources[0]!;
      const made =
        source.kind === 'condition' &&
        source.identifier ===
          `${holder.identifier}${which === 'pre' ? 'Pre' : 'Npr'}` &&
        source.name === source.identifier;
      if (made) {
        const written = formula(
          source.properties.formula,
          'assertion',
          `${holder.identifier}'s ${which}`,
        );
        if (!written) return [];
        inlined.add(source);
        return [element(which, [], [written])];
      }
      return [
        element(
          which,
          [],
          [element(TAG_OF_KIND[source.kind], [], [], source.identifier)],
        ),
      ];
    });

  // a description always (the Schematron warns of none): its name
  const named = (e: IstardtElement): Attribute[] => [
    ['name', e.identifier],
    ['description', e.name || e.identifier],
  ];

  const goals = model.ofKind('goal').map((goal) => {
    const { relation, children } = model.refinement(goal);
    const root = goal.properties.root === 'true';
    if (children.length && !relation)
      warn(
        `goal ${goal.identifier}'s refinement is neither AND nor OR: written as OR`,
      );
    return element(
      'goal',
      [
        ...named(goal),
        root && ['root', 'true'],
        goal.properties.terminal === 'true' && ['terminal', 'true'],
        // every goal's, as the Schematron requires (a root's is read)
        ['episodeLength', (root && goal.properties.episodeLength) || '1'],
      ],
      [
        ...(children.length
          ? [
              element(
                'refinement',
                [['type', relation ?? 'OR']],
                children.map((child) =>
                  element(child.kind === 'goal' ? 'childGoal' : 'childTask', [
                    ['ref', child.identifier],
                  ]),
                ),
              ),
            ]
          : []),
        ...precedences(goal),
      ],
    );
  });

  const writtenEffects = new Set<IstardtElement>();
  const tasks = model.ofKind('task').map((task) => {
    const effects = model.effectsOf(task);
    return element('task', named(task), [
      ...precedences(task),
      ...(effects.length
        ? [
            element(
              'effectGroup',
              [],
              effects.map((effect) => {
                writtenEffects.add(effect);
                return element(
                  'effect',
                  [
                    ...named(effect),
                    effect.properties.satisfying === 'false' && [
                      'satisfying',
                      'false',
                    ],
                    ['probability', model.probabilityOf(effect) ?? '1.0'],
                  ],
                  [
                    ...model
                      .turnsTrue(effect)
                      .map((p) => element('turnsTrue', [], [], p)),
                    ...model
                      .turnsFalse(effect)
                      .map((p) => element('turnsFalse', [], [], p)),
                    ...pairItems(effect.properties.set).map(
                      ([variable, value]) =>
                        element(
                          'set',
                          [],
                          [
                            element('variableID', [], [], variable),
                            element('numConst', [], [], value),
                          ],
                        ),
                    ),
                    ...precedences(effect),
                  ],
                );
              }),
            ),
          ]
        : []),
    ]);
  });
  for (const effect of model.ofKind('effect'))
    if (!writtenEffects.has(effect))
      warn(`effect ${effect.identifier} is in no task's group: not written`);

  const qualities = model.ofKind('quality').flatMap((quality) => {
    const utilities = model.utilities(quality);
    const terms = utilities.flatMap(({ source, weight }) => {
      const target =
        source.kind === 'effect'
          ? model.turnsTrue(source)[0]
          : source.identifier;
      if (!target) {
        warn(
          `${quality.identifier}'s utility from ${source.identifier}: the effect turns nothing true; left out`,
        );
        return [];
      }
      return [
        element(
          'multiply',
          [],
          [
            element('numConst', [], [], weight),
            element(
              source.kind === 'effect'
                ? 'predicateID'
                : TAG_OF_KIND[source.kind],
              [],
              [],
              target,
            ),
          ],
        ),
      ];
    });
    const written = quality.properties.formula
      ? formula(quality.properties.formula, 'expression', quality.identifier)
      : terms.length > 1
        ? element('add', [], terms)
        : (terms[0] ?? null);
    if (!written) {
      warn(`quality ${quality.identifier} has no formula: not written`);
      return [];
    }
    return [
      element(
        'quality',
        [
          ...named(quality),
          quality.properties.root === 'true' && ['root', 'true'],
        ],
        [written],
      ),
    ];
  });

  const conditions = model.ofKind('condition').flatMap((condition) => {
    if (inlined.has(condition)) return [];
    const written = formula(
      condition.properties.formula,
      'assertion',
      condition.identifier,
    );
    if (!written) {
      warn(`condition ${condition.identifier} has no formula: not written`);
      return [];
    }
    return [element('condBox', named(condition), [written])];
  });

  const tagOf = (name: string) => {
    const named = resolve(name);
    return named ? TAG_OF_KIND[named.kind] : 'predicateID';
  };
  const declared = (kind: 'predicate' | 'variable') =>
    model
      .ofKind(kind)
      .map((e) =>
        element(
          kind,
          [['description', e.name !== e.identifier ? e.name : '']],
          [],
          e.identifier,
        ),
      );

  const custom = json.diagram?.customProperties ?? {};
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  // the project's options, else the engine's defaults (./options)
  const continuous = options.continuous ?? true;
  const penalty = options.infeasibleActionPenalty ?? DEFAULT_INFEASIBLE_PENALTY;
  const root = element(
    'iStarDT',
    [['xmlns', NAMESPACE]],
    [
      element('header', [
        ['title', text(custom.title)],
        ['author', text(custom.author)],
        ['source', text(custom.source)],
        ['lastUpdated', text(custom.lastUpdated)],
      ]),
      element('options', [
        ['continuous', String(continuous)],
        ['infeasibleActionPenalty', String(penalty)],
      ]),
      element(
        'actors',
        [],
        [
          element(
            'actor',
            [
              ['name', text(actor.text) || 'default'],
              ['description', text(actor.customProperties?.Description)],
            ],
            [
              element('goals', [], goals),
              element('tasks', [], tasks),
              element('qualities', [], qualities),
              element('condBoxes', [], conditions),
              element(
                'initializations',
                [],
                model.initializations.map(([ref, value]) =>
                  element('initialization', [['element', ref]], [], value),
                ),
              ),
              element(
                'crossRuns',
                [],
                model.crossRun.map((ref) =>
                  element('crossRun', [], [element(tagOf(ref), [], [], ref)]),
                ),
              ),
              element(
                'exportedSet',
                [],
                model.exported.map((ref) => {
                  const e = resolve(ref);
                  const min = e?.properties.exportMin;
                  const max = e?.properties.exportMax;
                  const isContinuous = min !== undefined || max !== undefined;
                  return element(
                    'export',
                    [
                      ['continuous', String(isContinuous)],
                      isContinuous && ['minVal', min ?? '0'],
                      isContinuous && ['maxVal', max ?? '0'],
                    ],
                    [element(tagOf(ref), [], [], ref)],
                  );
                }),
              ),
              element('predicates', [], declared('predicate')),
              element('variables', [], declared('variable')),
            ],
          ),
        ],
      ),
    ],
  );
  return { text: writeXmlTree(root), diagnostics };
};

const PARTS = ['refinement', 'pre', 'npr', 'effectGroup'];
const partRank = (name: string) => PARTS.indexOf(name);

/** The attributes the XSD defaults, and their defaults: an attribute so is as if not written. */
const DEFAULTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  goal: { root: 'false', terminal: 'false', episodeLength: '1' },
  quality: { root: 'false' },
  effect: { satisfying: 'true' },
};

/**
 * An iStarDT-X text as two are compared: what the importer reads of it.
 * Comments, the schema location and empty sections left out; attributes by
 * name, those at their defaults (and an empty or name-repeating
 * description, a non-root goal's episode length, a discrete export's
 * bounds) left out; a goal's and a task's parts in one order (the XSD
 * takes any); numbers and booleans as written. The text as it was
 * when it isn't XML.
 */
export const canonicalIstardtx = (text: string): string => {
  const { root, problems } = readXml(text);
  if (!root || problems.length) return text;
  const local = (name: string) => name.slice(name.indexOf(':') + 1);
  const SECTIONS = new Set([
    'goals',
    'tasks',
    'qualities',
    'condBoxes',
    'initializations',
    'crossRuns',
    'exportedSet',
    'predicates',
    'variables',
  ]);
  const tree = (e: XmlElement): XmlTree | null => {
    const name = local(e.name);
    const children = e.children
      .map(tree)
      .filter((c): c is XmlTree => c !== null);
    // a goal's and a task's parts are an xsd:all: in any order
    if (name === 'goal' || name === 'task')
      children.sort((a, b) => partRank(a.name) - partRank(b.name));
    if (SECTIONS.has(name) && !children.length) return null;
    const attributes = Object.entries(e.attributes)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([key, value]) => {
        if (key.startsWith('xmlns') || key === 'xsi:schemaLocation')
          return false;
        if (key === 'description')
          return value !== '' && value !== e.attributes.name?.trim();
        if (DEFAULTS[name]?.[key] === value) return false;
        if (name === 'goal' && key === 'episodeLength')
          return e.attributes.root?.trim() === 'true';
        if (name === 'export' && (key === 'minVal' || key === 'maxVal'))
          return e.attributes.continuous?.trim() === 'true';
        return true;
      })
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return {
      name,
      attributes,
      children,
      ...(e.text && { text: e.text }),
    };
  };
  const written = tree(root);
  return written ? writeXmlTree(written) : text;
};
