/**
 * A `.kaos` file (KAOSTools' textual KAOS, parsed by the goal language's
 * `parseKaos`, `@goal-controller/goal-language/formats`) as a KAOS piStar model for kaosprop (goal-controller#181), each attribute where
 * the layering of #181 puts it:
 *
 * - structure (istar-ts): a declaration's kind (`goal`, `softgoal`,
 *   `obstacle`, `domainproperty`/`domainhypothesis` with its `Kind`,
 *   `agent` by its `type`), `name` its text, `definition` its
 *   `Description`, `formalspec` its `FormalSpec`, `refinedby` a refinement
 *   (a goal's or an obstacle's, one hub each), `obstructedby` an
 *   obstruction, `resolvedby` a resolution, `assignedto` a responsibility
 *   assignment;
 * - vocabulary (the `kaos` dialect): a refinement's pattern its hub's
 *   `Tactic`, a resolution's pattern its `ResolutionType` and its anchor its
 *   `Anchor`, by their canonical names (`case` is `case-driven`,
 *   `mitigation` `obstacle mitigation`; ./vocabulary.ts);
 * - quantities (kaosprop's dialect): `rsr` (`rds`) a goal's `RSR`, `esr`
 *   (`eps`, `probability`) a goal's `ESR` or an obstacle's `Probability`,
 *   a refinee's `[p]` its leg's `Probability`, an obstructor's `[p]` the
 *   obstruction's, each a string as written (`95%`, `.8`);
 * - kaosexpert's (goal-controller#190): an obstacle's or a domain
 *   property's `probability` as a distribution (`beta[2, 3]`, `(2.4%,
 *   2.7%, 3%)`) its `Probability`, an expert's `probability[e1] …` its
 *   `Probability[e1]`, each as written; `declare expert`, `declare
 *   calibration` and `@experts.quantiles` the project resources
 *   `experts.json` and `calibrations.json` (engines/kaosexpert/resources).
 *   A file with any of these opens in kaosexpert's mode, any other in
 *   kaosprop's.
 *
 * Nothing is dropped: what has no place (a per-expert or distribution
 * `esr` on a goal, an `entity`, a custom `$attribute`, an import not
 * given) is kept as written, in file order, in the diagram's
 * `kaosUnsupported` (an attribute of a placed element as an `override` of
 * it), and said. The writer (./write.ts) writes it back. Positions are
 * `layOut`'s (#118): a refinement's children below it, obstacles below the
 * goals they obstruct, a resolving goal below its obstacle, an agent beside
 * its goal.
 */
import { parsePistar, toPistarObject } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import { readDistribution } from '@goal-controller/dialect';
import type { ImportDiagnostic, ImportResult } from '../types';
import {
  CALIBRATIONS_PATH,
  calibrationsText,
  EXPERTS_PATH,
  expertsText,
  type CalibrationEntry,
  type ExpertEntry,
} from '../../engines/kaosexpert/resources';
import { layOut } from '../layout';
import {
  kaosFormulaText as formulaText,
  kaosHeadRangeOf as headRangeOf,
  kaosLanguage,
  kaosRangeOf as rangeOf,
  kaosSourceOf as sourceOf,
  type KaosAtom as Atom,
  type KaosAttribute as Attribute,
  type KaosDeclaration as Declaration,
  type KaosFile,
  type KaosRange,
  type KaosValue as Value,
} from '@goal-controller/goal-language/formats';
import {
  CUSTOM_KEYS,
  KAOS_DECLARATIONS,
  KAOS_TYPES,
  KAOSTOOLS_RESOLUTIONS,
  KAOSTOOLS_TACTICS,
  isKaosDeclaration,
  type KaosDeclarationKind,
} from './vocabulary';

/** The diagram's key that keeps what the model has no place for, as written. */
export const KAOS_UNSUPPORTED_KEY = 'kaosUnsupported';

/** The engine a `.kaos` model is for: its quantities are kaosprop's. */
export const KAOS_ENGINE = 'kaosprop';

/** The engine a `.kaos` model with experts, calibrations or distributions is for (goal-controller#190). */
export const KAOS_EXPERT_ENGINE = 'kaosexpert';

/** A value's text as written, on one line: `(2.4%, 2.7%, 3%)`. */
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

export type KaosReadOptions = {
  /** the model's name when the file has no `@title` */
  modelName?: string;
  /** the files an `import` may name, by path (a project's): matched by path, then by name */
  files?: Readonly<Record<string, string>>;
};

/** A reference to an element: its identifier, or (ADS's older files) its quoted name. */
type Ref = { id?: string; name?: string };

type Element = {
  /** its key while reading: its identifier, or `#n` while it has none (anonymous) */
  key: string;
  id: string | null;
  word: KaosDeclarationKind;
  name: string | null;
  /** its properties as read, in the order they were (Description, FormalSpec, RSR, …) */
  props: Map<string, string>;
  environment: boolean;
  refinements: {
    tactic: string | null;
    refinees: { ref: Ref; probability?: string }[];
  }[];
  obstructions: { ref: Ref; probability?: string }[];
  resolutions: { ref: Ref; type: string; anchor: string }[];
  assignments: Ref[];
  /** its attributes kept as written */
  raw: string[];
  declared: boolean;
};

/** A string atom's text as written (`"…"`, `@"…"`) as its content: `""` is a quote. */
const unquote = (text: string) =>
  text.replace(/^@/, '').slice(1, -1).replace(/""/g, '"');

/** A text as a KAOSTools identifier: lower case, `_` between words, a letter first. */
export const identifierOf = (text: string, fallback: string) => {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return !slug ? fallback : /^[a-z]/.test(slug) ? slug : `${fallback}_${slug}`;
};

const isGoal = (word: KaosDeclarationKind) =>
  word === 'goal' || word === 'softgoal';
const isDomain = (word: KaosDeclarationKind) =>
  word === 'domainproperty' || word === 'domainhypothesis';

/** What each kind's properties are, in the `kaos` dialect's order, `''` unset (as DSM3 creates them). */
const defaultsOf = (type: string): [string, string][] => {
  switch (type) {
    case KAOS_TYPES.goal:
    case KAOS_TYPES.softgoal:
      return [
        ['Type', type === KAOS_TYPES.softgoal ? 'softgoal' : ''],
        ['Category', ''],
        ['Source', ''],
        ['Priority', ''],
        ['Issue', ''],
        ['FormalSpec', ''],
        ['FitCriterion', ''],
        ['Stability', ''],
        ['Description', ''],
      ];
    case KAOS_TYPES.obstacle:
      return [
        ['Description', ''],
        ['FormalSpec', ''],
        ['Category', ''],
      ];
    case KAOS_TYPES.domainProperty:
      return [
        ['Kind', ''],
        ['Description', ''],
      ];
    default:
      return [['Description', '']];
  }
};

/** The value of a single-valued, unparameterised attribute. */
const single = (attribute: Attribute): Value | null =>
  attribute.params.length === 0 &&
  attribute.values.length === 1 &&
  !attribute.values[0]!.bracket.length &&
  !attribute.values[0]!.op
    ? attribute.values[0]!
    : null;

/** An atom as a reference: an identifier, or a quoted name. */
const refOf = (atom: Atom): Ref | null =>
  atom.$type === 'NameAtom'
    ? { id: atom.value }
    : atom.$type === 'StringAtom'
      ? { name: unquote(sourceOf(atom)) }
      : null;

/** `[ .8 ]`: a value's one number in brackets, or null when it has none; undefined when its decoration is another. */
const probabilityOf = (value: Value): string | null | undefined => {
  if (value.op) return undefined;
  if (!value.bracket.length) return null;
  const [p] = value.bracket;
  return value.bracket.length === 1 &&
    p!.atom.$type === 'NumberAtom' &&
    !p!.bracket.length &&
    !p!.op
    ? p!.atom.value
    : undefined;
};

/**
 * A `.kaos` text as a KAOS model (kaosprop's quantities typed), laid out;
 * no model, with errors, when it isn't KAOSTools' syntax.
 */
export const readKaos = (
  text: string,
  { modelName = 'model', files = {} }: KaosReadOptions = {},
): ImportResult => {
  const diagnostics: ImportDiagnostic[] = [];
  const parsed = kaosLanguage.parse(text);
  if (parsed.diagnostics.some((d) => d.severity === 'error'))
    return {
      model: null,
      dialectRecord: null,
      diagnostics: parsed.diagnostics,
    };

  const elements = new Map<string, Element>();
  const byId = new Map<string, Element>();
  /** what is kept as written, in file order: texts, or an element's attributes */
  const raw: (string | Element)[] = [];
  let title: string | null = null;
  let anonymous = 0;
  // kaosexpert's: the experts, the calibration variables, the quantile levels
  const experts: ExpertEntry[] = [];
  const calibrations: CalibrationEntry[] = [];
  let quantiles: string | null = null;
  let expertForms = false;

  // diagnostics: where in the file read first; an imported file's are named by it
  type Where = { file: string | null };
  type At = KaosRange | undefined;
  const at = rangeOf;
  const say = (
    where: Where,
    severity: ImportDiagnostic['severity'],
    message: string,
    range?: At,
  ) =>
    diagnostics.push(
      where.file !== null
        ? { severity, message: `${where.file}: ${message}` }
        : { severity, message, ...range },
    );
  const headOf = (declaration: Declaration) =>
    `${declaration.keyword} ${declaration.kind}${declaration.id ? ` [ ${declaration.id} ]` : ''}`;
  const headAt = headRangeOf;

  const keepRaw = (
    element: Element,
    attribute: Attribute,
    where: Where,
    why: string,
  ) => {
    if (!element.raw.length) raw.push(element);
    element.raw.push(sourceOf(attribute));
    say(
      where,
      'warning',
      `${attribute.name} of ${element.id ?? element.name ?? 'an anonymous ' + element.word}: kept as written, not read (${why})`,
      at(attribute),
    );
  };

  /** A declaration read into the model: its element's key; null when its kind has no place (kept as written). */
  const declare = (declaration: Declaration, where: Where): string | null => {
    if (!declaration.closed && declaration.$container.$type === 'KaosFile')
      say(
        where,
        'warning',
        `${headOf(declaration)} has no "end": it ends where the next declaration starts`,
        headAt(declaration),
      );
    const word = declaration.kind;
    if (word === 'expert' || word === 'calibration') {
      resource(declaration, where);
      return null;
    }
    if (!isKaosDeclaration(word)) {
      raw.push(sourceOf(declaration));
      say(
        where,
        'warning',
        `${headOf(declaration)}: kept as written, not read (KAOS's ${word}s have no place in the model)`,
        headAt(declaration),
      );
      return null;
    }
    const idAttribute = declaration.attributes.find((a) => a.name === 'id');
    const idValue = idAttribute && single(idAttribute);
    const id =
      declaration.id ??
      (idValue?.atom.$type === 'NameAtom' ? idValue.atom.value : null);
    let element = id !== null ? byId.get(id) : undefined;
    if (element) {
      if (element.word !== word && !(isDomain(element.word) && isDomain(word)))
        say(
          where,
          'warning',
          `${headOf(declaration)}: ${id} is a ${element.word}, read as one`,
          headAt(declaration),
        );
      if (declaration.keyword === 'declare' && element.declared)
        say(
          where,
          'info',
          `${headOf(declaration)}: declared before, its attributes added`,
          headAt(declaration),
        );
    } else {
      element = {
        key: id ?? `#${++anonymous}`,
        id,
        word,
        name: null,
        props: new Map(),
        environment: false,
        refinements: [],
        obstructions: [],
        resolutions: [],
        assignments: [],
        raw: [],
        declared: false,
      };
      elements.set(element.key, element);
      if (id !== null) byId.set(id, element);
    }
    if (declaration.keyword === 'declare') element.declared = true;
    for (const attribute of declaration.attributes)
      if (attribute !== idAttribute || !idValue)
        read(element, attribute, where);
    return element.key;
  };

  /** An attribute read into its element, or kept as written. */
  const read = (element: Element, attribute: Attribute, where: Where) => {
    const name = attribute.name.startsWith('$')
      ? attribute.name
      : attribute.name.toLowerCase();
    const value = single(attribute);
    const { word } = element;
    const type = KAOS_DECLARATIONS[word];
    switch (name) {
      case 'name':
        if (value?.atom.$type === 'StringAtom') {
          element.name = unquote(sourceOf(value.atom));
          return;
        }
        break;
      case 'definition':
        if (value?.atom.$type === 'StringAtom') {
          element.props.set('Description', unquote(sourceOf(value.atom)));
          return;
        }
        break;
      case 'formalspec':
        if (word === 'agent') break;
        if (value?.atom.$type === 'FormulaAtom') {
          element.props.set('FormalSpec', formulaText(value.atom));
          return;
        }
        // what the writer writes for a FormalSpec that is no formula
        if (value?.atom.$type === 'StringAtom') {
          element.props.set('FormalSpec', unquote(sourceOf(value.atom)));
          return;
        }
        break;
      case 'type':
        if (word === 'agent' && value?.atom.$type === 'NameAtom') {
          const agentType = value.atom.value;
          if (agentType === 'software' || agentType === 'environment') {
            element.environment = agentType === 'environment';
            return;
          }
          if (agentType === 'malicious') {
            element.environment = false;
            say(
              where,
              'info',
              `${element.key}: a malicious agent, read as an agent (KAOS's anti-models have no kind of their own)`,
              at(attribute),
            );
            return;
          }
        }
        break;
      case 'refinedby':
        if (isGoal(word) || word === 'obstacle')
          if (refinement(element, attribute, where)) return;
        break;
      case 'obstructedby':
        if (isGoal(word) || isDomain(word)) {
          const obstructions = refs(attribute, true);
          if (obstructions) {
            element.obstructions.push(...obstructions);
            return;
          }
        }
        break;
      case 'resolvedby':
        if (word === 'obstacle' && resolution(element, attribute)) return;
        break;
      case 'assignedto':
        if (isGoal(word)) {
          const agents = refs(attribute, false);
          if (agents) {
            element.assignments.push(...agents.map((a) => a.ref));
            return;
          }
        }
        break;
      case 'rsr':
      case 'rds':
        if (isGoal(word) && value?.atom.$type === 'NumberAtom') {
          element.props.set('RSR', value.atom.value);
          return;
        }
        break;
      case 'esr':
      case 'eps':
      case 'probability':
        if (
          (isGoal(word) || word === 'obstacle') &&
          value?.atom.$type === 'NumberAtom'
        ) {
          element.props.set(
            isGoal(word) ? 'ESR' : 'Probability',
            value.atom.value,
          );
          return;
        }
        // kaosexpert's: an obstacle's or a domain property's estimate, a
        // distribution or an expert's (`probability[e1] (…)`)
        if (word === 'obstacle' || isDomain(word)) {
          const estimate = estimateOf(attribute);
          if (estimate) {
            element.props.set(estimate.key, estimate.text);
            // only kaosexpert reads these (kaosprop: a point on an obstacle)
            if (
              estimate.key !== 'Probability' ||
              estimate.distribution ||
              isDomain(word)
            )
              expertForms = true;
            return;
          }
        }
        break;
      default:
        if (
          name.startsWith('$') &&
          CUSTOM_KEYS[type]?.includes(name.slice(1)) &&
          value?.atom.$type === 'StringAtom'
        ) {
          element.props.set(name.slice(1), unquote(sourceOf(value.atom)));
          return;
        }
    }
    keepRaw(element, attribute, where, whyRaw(name, attribute, word));
  };

  const whyRaw = (name: string, attribute: Attribute, word: string) =>
    ['esr', 'eps', 'probability', 'rsr', 'rds'].includes(name) &&
    attribute.params.length
      ? 'a per-expert estimate'
      : ['esr', 'eps', 'probability', 'rsr', 'rds'].includes(name) &&
          attribute.values.some(
            (v) => v.atom.$type !== 'NumberAtom' || v.bracket.length,
          )
        ? 'a distribution'
        : name.startsWith('$')
          ? 'a custom attribute'
          : [
                'name',
                'definition',
                'formalspec',
                'type',
                'refinedby',
                'obstructedby',
                'resolvedby',
                'assignedto',
                'rsr',
                'rds',
                'esr',
                'eps',
                'probability',
              ].includes(name)
            ? `not in this form on a ${word}`
            : `no place in the model for ${name}`;

  /**
   * `probability X` (a value or a distribution) or `probability[e1] X` as
   * kaosexpert's key and the value as written; null in any other form.
   */
  const estimateOf = (
    attribute: Attribute,
  ): { key: string; text: string; distribution: boolean } | null => {
    if (attribute.values.length !== 1 || attribute.params.length > 1)
      return null;
    const [param] = attribute.params;
    if (
      param &&
      (param.atom.$type !== 'NameAtom' || param.op || param.bracket.length)
    )
      return null;
    const value = attribute.values[0]!;
    const text = oneLine(sourceOf(value));
    const read = readDistribution(text, { point: true });
    // a distribution's form with a wrong value (ADS's (30%, 10%, 50%)) is
    // read as written too: the dialect reports it, as any value outside its type
    const shaped =
      !value.op &&
      (value.atom.$type === 'TupleAtom'
        ? !value.bracket.length
        : value.atom.$type === 'NameAtom' && value.bracket.length > 0);
    if ('error' in read && !shaped) return null;
    const key = param
      ? `Probability[${(param.atom as { value: string }).value}]`
      : 'Probability';
    return {
      key,
      text,
      distribution:
        !('distribution' in read) || read.distribution.kind !== 'point',
    };
  };

  /** `declare expert`, `declare calibration`: an entry of kaosexpert's project resources. */
  const resource = (declaration: Declaration, where: Where) => {
    expertForms = true;
    const kept: string[] = [];
    let name: string | undefined;
    let value: string | undefined;
    const estimates: Record<string, string> = {};
    for (const attribute of declaration.attributes) {
      const single1 = single(attribute);
      const lower = attribute.name.toLowerCase();
      if (lower === 'name' && single1?.atom.$type === 'StringAtom') {
        name = unquote(sourceOf(single1.atom));
        continue;
      }
      if (
        declaration.kind === 'calibration' &&
        (lower === 'probability' || lower === 'esr')
      ) {
        const estimate = estimateOf(attribute);
        if (estimate && estimate.key !== 'Probability') {
          estimates[estimate.key.slice('Probability['.length, -1)] =
            estimate.text;
          continue;
        }
        if (estimate && !estimate.distribution) {
          value = estimate.text;
          continue;
        }
      }
      kept.push(oneLine(sourceOf(attribute)));
      say(
        where,
        'warning',
        `${attribute.name} of ${declaration.kind} ${declaration.id ?? name ?? ''}: kept as written, not read`.replace(
          /  +/g,
          ' ',
        ),
        at(attribute),
      );
    }
    if (declaration.kind === 'expert') {
      if (!declaration.id) {
        raw.push(sourceOf(declaration));
        say(
          where,
          'warning',
          `${headOf(declaration)}: an expert without an identifier, kept as written (an estimate names its expert by it)`,
          headAt(declaration),
        );
        return;
      }
      experts.push({
        id: declaration.id,
        ...(name !== undefined && { name }),
        ...(kept.length && { kept }),
      });
      return;
    }
    calibrations.push({
      ...(declaration.id && { id: declaration.id }),
      ...(name !== undefined && { name }),
      ...(value !== undefined && { value }),
      estimates,
      ...(kept.length && { kept }),
    });
  };

  /** A list of references, each with a `[p]` when `decorated` allows one; null when it is another list. */
  const refs = (attribute: Attribute, decorated: boolean) => {
    if (attribute.params.length) return null;
    const found: { ref: Ref; probability?: string }[] = [];
    for (const value of attribute.values) {
      const ref = refOf(value.atom);
      const probability = probabilityOf(value);
      if (!ref || probability === undefined || (probability && !decorated))
        return null;
      found.push({ ref, ...(probability !== null && { probability }) });
    }
    return found;
  };

  /** `refinedby [pattern] a [p], b`: one refinement; false (nothing read) when it is in another form. */
  const refinement = (
    element: Element,
    attribute: Attribute,
    where: Where,
  ): boolean => {
    let tactic: string | null = null;
    for (const param of attribute.params) {
      // `[case]`, `[pattern=case]`; a context (`[context=c]`) has no place
      const atom =
        param.op === '=' &&
        param.atom.$type === 'NameAtom' &&
        param.atom.value === 'pattern'
          ? param.right
          : !param.op && !param.bracket.length
            ? param.atom
            : null;
      if (atom?.$type === 'NameAtom')
        tactic = KAOSTOOLS_TACTICS[atom.value] ?? atom.value;
      else if (atom?.$type === 'StringAtom') tactic = unquote(sourceOf(atom));
      else return false;
    }
    // every refinee's form first: a nested declaration is read only if all are
    for (const value of attribute.values) {
      if (probabilityOf(value) === undefined) return false;
      const { atom } = value;
      if (atom.$type === 'DeclarationAtom') {
        if (!isKaosDeclaration(atom.declaration.kind)) return false;
      } else if (!refOf(atom)) return false;
    }
    const refinees = attribute.values.map((value) => {
      const probability = probabilityOf(value);
      const { atom } = value;
      const ref: Ref =
        atom.$type === 'DeclarationAtom'
          ? { id: `\u0000${declare(atom.declaration, where)}` }
          : refOf(atom)!;
      return { ref, ...(probability && { probability }) };
    });
    element.refinements.push({ tactic, refinees });
    return true;
  };

  /** `resolvedby [pattern:anchor] g`, `resolvedby(pattern[anchor]) g`, `resolvedby g`. */
  const resolution = (element: Element, attribute: Attribute): boolean => {
    let type = '';
    let anchor = '';
    if (attribute.params.length > 1) return false;
    const [param] = attribute.params;
    if (param) {
      if (param.atom.$type !== 'NameAtom' && param.atom.$type !== 'StringAtom')
        return false;
      const pattern =
        param.atom.$type === 'NameAtom'
          ? param.atom.value
          : unquote(sourceOf(param.atom));
      type =
        param.atom.$type === 'NameAtom'
          ? (KAOSTOOLS_RESOLUTIONS[pattern] ?? pattern)
          : pattern;
      const anchored =
        param.op === ':'
          ? param.right
          : param.bracket.length === 1 &&
              !param.bracket[0]!.op &&
              !param.bracket[0]!.bracket.length
            ? param.bracket[0]!.atom
            : param.bracket.length || param.op
              ? undefined
              : null;
      if (anchored === undefined) return false;
      if (anchored) {
        if (anchored.$type !== 'NameAtom') return false;
        anchor = anchored.value;
      }
    }
    const goals = refs({ ...attribute, params: [] } as Attribute, false);
    if (!goals) return false;
    for (const { ref } of goals)
      element.resolutions.push({ ref, type, anchor });
    return true;
  };

  const visited = new Set<string>();
  const readFile = (file: KaosFile, where: Where) => {
    for (const item of file.items) {
      if (item.$type === 'ModelAttribute') {
        if (item.name === '@title')
          title = unquote(sourceOf(item).slice(item.name.length).trim());
        else if (item.name === '@experts.quantiles') {
          quantiles = unquote(sourceOf(item).slice(item.name.length).trim());
          expertForms = true;
        } else {
          raw.push(sourceOf(item));
          say(
            where,
            'info',
            `${item.name}: kept as written (the model has no place for it)`,
            at(item),
          );
        }
      } else if (item.$type === 'Import') {
        const name = unquote(sourceOf(item).slice('import'.length).trim());
        const path =
          files[name] !== undefined
            ? name
            : Object.keys(files).find(
                (p) => p.split('/').pop() === name.split('/').pop(),
              );
        if (path === undefined) {
          raw.push(sourceOf(item));
          say(
            where,
            'warning',
            `import "${name}": no such file here, kept as written (not read)`,
            at(item),
          );
        } else if (!visited.has(path)) {
          visited.add(path);
          const imported = kaosLanguage.parse(files[path]!);
          const errors = imported.diagnostics.filter(
            (d) => d.severity === 'error',
          );
          if (errors.length) {
            for (const error of errors)
              say({ file: path }, 'error', error.message);
            continue;
          }
          readFile(imported.ast, { file: path });
        }
      } else declare(item, where);
    }
  };
  readFile(parsed.ast, { file: null });
  if (diagnostics.some((d) => d.severity === 'error'))
    return { model: null, dialectRecord: null, diagnostics };

  // references: by identifier, by name; what nothing declares is made, and said
  const byName = new Map<string, Element>();
  for (const element of elements.values())
    if (element.name !== null && !byName.has(element.name))
      byName.set(element.name, element);
  const implicit = (ref: Ref, word: KaosDeclarationKind): Element => {
    const element: Element = {
      key: ref.id ?? `#${++anonymous}`,
      id: ref.id ?? null,
      word,
      name: ref.name ?? null,
      props: new Map(),
      environment: false,
      refinements: [],
      obstructions: [],
      resolutions: [],
      assignments: [],
      raw: [],
      declared: false,
    };
    elements.set(element.key, element);
    if (ref.id !== undefined) byId.set(ref.id, element);
    else byName.set(ref.name!, element);
    diagnostics.push({
      severity: 'warning',
      message: `${ref.id ?? `"${ref.name}"`} is not declared: read as a${word === 'obstacle' || word === 'agent' ? 'n' : ''} ${word}`,
    });
    return element;
  };
  const resolve = (ref: Ref, word: KaosDeclarationKind): Element => {
    if (ref.id?.startsWith('\u0000')) return elements.get(ref.id.slice(1))!;
    return (
      (ref.id !== undefined ? byId.get(ref.id) : byName.get(ref.name!)) ??
      implicit(ref, word)
    );
  };
  const links: {
    refinements: {
      parent: Element;
      tactic: string | null;
      refinees: { element: Element; probability?: string }[];
    }[];
    obstructions: {
      obstacle: Element;
      target: Element;
      probability?: string;
    }[];
    resolutions: {
      goal: Element;
      obstacle: Element;
      type: string;
      anchor: string;
    }[];
    assignments: { agent: Element; goal: Element }[];
  } = { refinements: [], obstructions: [], resolutions: [], assignments: [] };
  for (const element of elements.values()) {
    for (const r of element.refinements)
      links.refinements.push({
        parent: element,
        tactic: r.tactic,
        refinees: r.refinees.map(({ ref, probability }) => ({
          element: resolve(
            ref,
            element.word === 'obstacle' ? 'obstacle' : 'goal',
          ),
          ...(probability && { probability }),
        })),
      });
    for (const { ref, probability } of element.obstructions)
      links.obstructions.push({
        obstacle: resolve(ref, 'obstacle'),
        target: element,
        ...(probability && { probability }),
      });
    for (const { ref, type, anchor } of element.resolutions)
      links.resolutions.push({
        goal: resolve(ref, 'goal'),
        obstacle: element,
        type,
        anchor,
      });
    for (const ref of element.assignments)
      links.assignments.push({ agent: resolve(ref, 'agent'), goal: element });
  }

  // identifiers for the anonymous: their name's, unique
  const taken = new Set(
    [...elements.values()].flatMap((e) => (e.id !== null ? [e.id] : [])),
  );
  for (const element of elements.values())
    if (element.id === null) {
      const base = identifierOf(element.name ?? '', element.word);
      let id = base;
      for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
      taken.add(id);
      element.id = id;
    }

  // the model
  const typeOf = (element: Element) =>
    element.word === 'agent' && element.environment
      ? KAOS_TYPES.environmentAgent
      : KAOS_DECLARATIONS[element.word];
  const nodes = [...elements.values()].map((element) => {
    const type = typeOf(element);
    const props = new Map(defaultsOf(type));
    if (isDomain(element.word))
      props.set(
        'Kind',
        element.word === 'domainhypothesis' ? 'hypothesis' : 'invariant',
      );
    for (const [key, value] of element.props) props.set(key, value);
    return {
      id: element.id!,
      text: element.name ?? element.id!,
      type,
      customProperties: Object.fromEntries(props),
    } as Record<string, unknown> & { id: string; x?: number; y?: number };
  });
  const nodeOf = new Map(nodes.map((node) => [node.id, node]));

  const linkIds = new Set<string>();
  const linkId = (base: string) => {
    let id = base;
    for (let n = 2; linkIds.has(id); n++) id = `${base}-${n}`;
    linkIds.add(id);
    return id;
  };
  const hubs: {
    hub: Record<string, unknown>;
    parent: string;
    children: string[];
  }[] = [];
  const pistarLinks: Record<string, unknown>[] = [];
  const counts = new Map<string, number>();
  for (const { parent, tactic, refinees } of links.refinements) {
    const obstacle = parent.word === 'obstacle';
    const n = (counts.get(parent.id!) ?? 0) + 1;
    counts.set(parent.id!, n);
    const hubId = linkId(`${parent.id}-refinement-${n}`);
    const hub: Record<string, unknown> = {
      id: hubId,
      type: obstacle
        ? KAOS_TYPES.obstacleRefinementHub
        : KAOS_TYPES.refinementHub,
      ...(!obstacle && {
        customProperties: { SysRef: '', Status: '', Tactic: tactic ?? '' },
      }),
    };
    hubs.push({
      hub,
      parent: parent.id!,
      children: refinees.map((r) => r.element.id!),
    });
    pistarLinks.push({
      hub,
      starts: refinees.map(({ element, probability }, i) => ({
        id: linkId(`${hubId}-${i + 1}`),
        type: obstacle
          ? KAOS_TYPES.obstacleRefinementLeg
          : KAOS_TYPES.refinementLeg,
        source: element.id,
        target: hubId,
        ...(probability && { customProperties: { Probability: probability } }),
      })),
      end: {
        id: linkId(`${hubId}-end`),
        type: obstacle
          ? KAOS_TYPES.obstacleRefinementEnd
          : KAOS_TYPES.refinementEnd,
        source: hubId,
        target: parent.id,
      },
    });
    if (obstacle && tactic !== null)
      diagnostics.push({
        severity: 'info',
        message: `${parent.id}: an obstacle refinement's pattern (${tactic}) has no place in the model, not read`,
      });
  }
  for (const { obstacle, target, probability } of links.obstructions)
    pistarLinks.push({
      id: linkId(`${obstacle.id}-obstructs-${target.id}`),
      type: KAOS_TYPES.obstruction,
      source: obstacle.id,
      target: target.id,
      ...(probability && { customProperties: { Probability: probability } }),
    });
  for (const { goal, obstacle, type, anchor } of links.resolutions)
    pistarLinks.push({
      id: linkId(`${goal.id}-resolves-${obstacle.id}`),
      type: KAOS_TYPES.resolution,
      source: goal.id,
      target: obstacle.id,
      customProperties: { ResolutionType: type, Anchor: anchor },
    });
  for (const { agent, goal } of links.assignments)
    pistarLinks.push({
      id: linkId(`${agent.id}-assigned-${goal.id}`),
      type: KAOS_TYPES.assignment,
      source: agent.id,
      target: goal.id,
    });

  // positions: a refinement's children below it, an obstacle below what it
  // obstructs, a resolving goal below its obstacle, an agent beside its goal
  const BELOW = 'below';
  const extent = layOut(
    {
      orphans: nodes,
      links: [
        ...hubs.flatMap(({ parent, children }) =>
          children.map((child) => ({
            type: BELOW,
            source: child,
            target: parent,
          })),
        ),
        ...links.obstructions.map((o) => ({
          type: BELOW,
          source: o.obstacle.id,
          target: o.target.id,
        })),
        ...links.resolutions.map((r) => ({
          type: BELOW,
          source: r.goal.id,
          target: r.obstacle.id,
        })),
        ...links.assignments.map((a) => ({
          type: 'beside',
          source: a.agent.id,
          target: a.goal.id,
        })),
      ],
    },
    undefined,
    new Set([BELOW]),
  );
  // a hub between its goal and its children (DSM3's node is 135 × 36, a hub 20 × 20)
  for (const { hub, parent, children } of hubs) {
    const top = nodeOf.get(parent)!;
    const below = children.map((c) => nodeOf.get(c)!);
    const x = below.reduce((sum, n) => sum + n.x!, 0) / below.length;
    const y = Math.min(...below.map((n) => n.y!));
    hub.x = Math.round((top.x! + x) / 2 + 135 / 2 - 10);
    hub.y = Math.round((top.y! + 36 + y) / 2 - 10);
  }

  const kept = raw.map((entry) =>
    typeof entry === 'string'
      ? entry
      : `override ${entry.word} [ ${entry.id} ]\n  ${entry.raw.join('\n  ')}\nend`,
  );
  const json = {
    actors: [],
    orphans: nodes,
    dependencies: [],
    links: pistarLinks,
    display: {},
    tool: 'dsm3-goals',
    metamodelVersion: '1.0',
    diagram: {
      width: Math.max(extent?.right ?? 0, 400) + 135,
      height: Math.max(extent?.bottom ?? 0, 300) + 36,
      name: title ?? modelName,
      // no mode or framework recorded: the project's manifest says kaosprop
      // (the native file's dialect), its kinds that it is KAOS (as DSM3's)
      customProperties: {
        Description: '',
        ...(kept.length && { [KAOS_UNSUPPORTED_KEY]: kept.join('\n\n') }),
      },
    },
  };
  // in istar-ts's form, as the workbench writes a KAOS model
  const model = toPistarObject(
    parsePistar(json, { metamodel: KAOS_OBSTACLES }),
  ) as unknown as Record<string, unknown>;
  // kaosexpert's resources, when the file declares any
  const projectResources: Record<string, Record<string, string>> = {};
  if (experts.length || quantiles !== null)
    projectResources.expert = {
      [EXPERTS_PATH]: expertsText({
        ...(quantiles !== null && { quantiles }),
        experts,
      }),
    };
  if (calibrations.length)
    projectResources.calibration = {
      [CALIBRATIONS_PATH]: calibrationsText({ calibrations }),
    };
  return {
    model,
    dialectRecord: {
      engine: expertForms ? KAOS_EXPERT_ENGINE : KAOS_ENGINE,
      projectResources,
    },
    diagnostics,
  };
};
