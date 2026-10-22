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
 * - kaosres's (goal-controller#191): a goal's annotation for an obstacle
 *   (`except [o] g` on the anchor, `provided [o] f`, `providednot [o] f`,
 *   `relaxedTo [o] f`, `replaces [o] g` on the countermeasure goal) the
 *   `Form`, `Condition`, `Replaces` and `Anchor` of the resolution it is
 *   about, and `cost [o] n` (`cost n`: every obstacle the goal resolves) its
 *   `Cost`; an annotation no `resolvedby` declares the resolution of makes
 *   it. `cost [x] n` for an x that is no obstacle (KAOSTools' cost variable,
 *   before 2017-03) is kept as written.
 *
 * - kaossim's (goal-controller#193): a goal's quantities (`qualityvariable
 *   [v] Time`, `objective [o] "…"`, …), a refinement's and an assignment's
 *   parameters (`sysref = "…"`, `v = "…"`), and `declare design` the
 *   project resource `designs.json`. A file with any of these opens in
 *   kaossim's mode.
 * - the operation and object models (goal-controller#194), the `kaos`
 *   dialect's `kaosOperations` kinds: KAOSTools' `entity` (`object`),
 *   `association` (`relation`), `predicate` and `type`, each attribute
 *   as KAOSTools' parsers read it (`attribute name : type`, an entity's
 *   `type software`, `link [0, 1] target`, a predicate's `argument a : t`,
 *   `formalspec` and `default`), and our `operation` and `event`
 *   (KAOSTools has neither): an operation's `dompre` and `dompost`,
 *   `performedby a`, `input e`, `output e`, `causedby [delay = "…"] ev`,
 *   `operationalizes g` and its required conditions `reqpre [g] f`,
 *   `reqtrig [g] f`, `reqpost [g] f`; an event's `frequency`; an
 *   object's `initially name : value`, its attribute's initial value
 *   (goal-controller#209, KAOS2LTSA's fluent `initially`); an agent's
 *   `load`, `attribute`s, and `monitors` and `controls`, each an
 *   object's attribute (`sump.highWater`, FSE'02) or a predicate
 *   (KAOSTools'). A model with any declares the kinds in its
 *   `"metamodel"` block.
 *
 * Nothing is dropped: what has no place (a per-expert or distribution
 * `esr` on a goal, an entity's `isa`, a custom `$attribute`, an import not
 * given) is kept as written, in file order, in the diagram's
 * `kaosUnsupported` (an attribute of a placed element as an `override` of
 * it), and said. The writer (./write.ts) writes it back. Positions are
 * `layOut`'s (#118): a refinement's children below it, obstacles below the
 * goals they obstruct, a resolving goal below its obstacle, an agent beside
 * its goal.
 */
import {
  FILE_METAMODEL_KEY,
  parsePistar,
  toPistarObject,
} from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import { readDistribution } from '@goal-controller/dialect';
import type { ImportDiagnostic, ImportResult } from '../types';
import {
  CALIBRATIONS_PATH,
  calibrationsText,
  EVIDENCE_PATH,
  evidenceText,
  EXPERTS_PATH,
  expertsText,
  type CalibrationEntry,
  type EvidenceEntry,
  type ExpertEntry,
} from '../../engines/kaosexpert/resources';
import { LAYOUT_GRID, layOut, type LayoutExtent } from '../layout';
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
import type { CountermeasureForm } from '../../engines/kaosres/definition';
import {
  DESIGNS_PATH,
  designsText,
  type DesignEntry,
} from '../../engines/kaossim/designs';
import {
  CUSTOM_KEYS,
  KAOS_DECLARATIONS,
  KAOS_TYPES,
  KAOSTOOLS_RESOLUTIONS,
  KAOSTOOLS_TACTICS,
  REQUIRED_CONDITIONS,
  isKaosDeclaration,
  isObjectDeclaration,
  type KaosDeclarationKind,
} from './vocabulary';
import { KAOS_OPERATIONS_BLOCK } from '../../dialects/kaos/metamodel';

/** The diagram's key that keeps what the model has no place for, as written. */
export const KAOS_UNSUPPORTED_KEY = 'kaosUnsupported';

/** The engine a `.kaos` model is for: its quantities are kaosprop's. */
export const KAOS_ENGINE = 'kaosprop';

/** The engine a `.kaos` model with experts, calibrations or distributions is for (goal-controller#190). */
export const KAOS_EXPERT_ENGINE = 'kaosexpert';

/** The engine a `.kaos` model with quality variables, objectives, equations or options (and no experts) is for (goal-controller#193). */
export const KAOS_SIM_ENGINE = 'kaossim';

/** The engine a `.kaos` model with resolutions (and no experts) is for: its countermeasures' (goal-controller#191). */
export const KAOS_RESOLUTION_ENGINE = 'kaosres';

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
    /** kaossim's (goal-controller#193): its SysRef, its equations by variable, as written */
    sysRef?: string;
    equations: [string, string][];
  }[];
  obstructions: { ref: Ref; probability?: string }[];
  resolutions: { ref: Ref; type: string; anchor: string }[];
  assignments: { ref: Ref; props: [string, string][] }[];
  /** a goal's annotations for an obstacle (goal-controller#191): a resolution's Form, payload or Cost */
  annotations: Annotation[];
  /** the operation and object models' links from or onto it (goal-controller#194) */
  objects: ObjectLinks;
  /** its attributes kept as written */
  raw: string[];
  declared: boolean;
};

/**
 * A goal's annotation for an obstacle, as KAOSTools writes it since 2017-09
 * (`except [o] g`, `provided [o] f`, `providednot [o] f`, `relaxedTo [o] f`,
 * `replaces [o] g`), and its cost (`cost [o] n`, or `cost n` for every
 * obstacle it resolves): what kaosres puts on the resolution link it is
 * about (goal-controller#191, D1). `goal` is `except`'s countermeasure and
 * `replaces`'s replaced goal.
 */
type Annotation = {
  word:
    | 'except'
    | 'provided'
    | 'providednot'
    | 'relaxedto'
    | 'replaces'
    | 'cost';
  obstacle: Ref | null;
  goal?: Ref;
  text?: string;
  attribute: Attribute;
  file: string | null;
};

/**
 * The operation and object models' links an element's attributes declare
 * (goal-controller#194): an operation's performers, inputs, outputs,
 * causes and the requirements it operationalises (with their required
 * conditions, by key), an agent's monitored and controlled attributes (as
 * written, `sump.highWater`), an association's links.
 */
type ObjectLinks = {
  performers: Ref[];
  inputs: Ref[];
  outputs: Ref[];
  causes: { ref: Ref; delay?: string }[];
  operationalises: { ref: Ref; conditions: Map<string, string> }[];
  monitors: { ref: Ref; written: string }[];
  controls: { ref: Ref; written: string }[];
  links: { ref: Ref; multiplicity?: string; role?: string }[];
};

const noObjectLinks = (): ObjectLinks => ({
  performers: [],
  inputs: [],
  outputs: [],
  causes: [],
  operationalises: [],
  monitors: [],
  controls: [],
  links: [],
});

/** KAOSTools' other names for a declaration (`(entity|object)`, `(association|relation)`) as the one it is. */
const canonicalOf = (word: KaosDeclarationKind): KaosDeclarationKind =>
  word === 'object' ? 'entity' : word === 'relation' ? 'association' : word;

/** An annotation's word and the resolution `Form` it is. */
const FORMS = {
  except: 'except',
  provided: 'provided',
  providednot: 'providedNot',
  relaxedto: 'relaxedTo',
  replaces: 'replaces',
} as const satisfies Record<
  Exclude<Annotation['word'], 'cost'>,
  CountermeasureForm
>;

/**
 * A resolution's kaosres keys as read (goal-controller#191), each as
 * written; `Replaces` an element's key while reading.
 */
type CountermeasureTexts = {
  Cost?: string;
  Form?: CountermeasureForm;
  Condition?: string;
  Replaces?: string;
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

/** The operation and object models' attributes (goal-controller#194), each read on its kinds. */
const OBJECT_ATTRIBUTES = [
  'attribute',
  'initially',
  'argument',
  'default',
  'frequency',
  'load',
  'dompre',
  'dompost',
  'performedby',
  'input',
  'output',
  'causedby',
  'operationalizes',
  'operationalises',
  'reqpre',
  'reqtrig',
  'reqpost',
  'monitors',
  'controls',
  'link',
];

/** The file types of the block's kinds (`kaos.Operation`, `kaos.MonitoringLink`). */
const OPERATION_TYPES: ReadonlySet<unknown> = new Set(
  [...KAOS_OPERATIONS_BLOCK.elements, ...KAOS_OPERATIONS_BLOCK.links].map(
    (kind) => kind.pistarType,
  ),
);

/** Whether a model's nodes or links are of the block's kinds. */
const usesOperationKinds = (
  nodes: readonly Readonly<Record<string, unknown>>[],
  links: readonly Readonly<Record<string, unknown>>[],
) => [...nodes, ...links].some((item) => OPERATION_TYPES.has(item.type));

/**
 * Nodes nothing links, in rows below a laid-out model (as wide as it, a
 * grid's step apart), and how far the model reaches with them.
 */
const placeLoose = (
  loose: readonly { x?: number; y?: number }[],
  extent: LayoutExtent | null,
): LayoutExtent | null => {
  if (!loose.length) return extent;
  // a laid-out extent is a grid cell past its last column and row
  const { dx, dy, padding } = LAYOUT_GRID;
  const columns = Math.max(
    1,
    Math.floor(((extent?.right ?? 0) - padding) / dx),
  );
  const top = extent?.bottom ?? padding;
  loose.forEach((node, i) => {
    node.x = padding + (i % columns) * dx;
    node.y = top + Math.floor(i / columns) * dy;
  });
  return {
    right: Math.max(
      extent?.right ?? 0,
      padding + Math.min(loose.length, columns) * dx,
    ),
    bottom: top + Math.ceil(loose.length / columns) * dy,
  };
};

/** kaossim's attributes (goal-controller#193) and the keys they are, keyed by a name. */
const SIM_KEYS = {
  qualityvariable: 'QualityVariable',
  samplespace: 'SampleSpace',
  qualitydefinition: 'QualityDefinition',
  distribution: 'Distribution',
  objective: 'Objective',
  mean: 'Mean',
  objectivespec: 'ObjectiveSpec',
  modal: 'Modal',
  target: 'Target',
  current: 'Current',
} as const;

const isGoal = (word: KaosDeclarationKind) =>
  word === 'goal' || word === 'softgoal';
const isDomain = (word: KaosDeclarationKind) =>
  word === 'domainproperty' || word === 'domainhypothesis';
/** The objects an `attribute` declares attributes of (FSE'02's agents have them too). */
const hasAttributes = (word: KaosDeclarationKind) =>
  word === 'entity' ||
  word === 'association' ||
  word === 'event' ||
  word === 'agent';

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
    case KAOS_TYPES.agent:
      return [
        ['Type', ''],
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
  // kaosexpert's: the experts, the calibration variables, the quantile
  // levels, the evidence items (goal-controller#199)
  const experts: ExpertEntry[] = [];
  const calibrations: CalibrationEntry[] = [];
  const evidence: EvidenceEntry[] = [];
  let quantiles: string | null = null;
  let expertForms = false;
  // kaossim's quantities (goal-controller#193): a file with any opens in its mode
  let simForms = false;
  const designs: DesignEntry[] = [];
  /** `declare constraint … conflict a, b`: two goals that conflict (goal-controller#191) */
  const conflicts: { a: Ref; b: Ref }[] = [];

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
    const written = declaration.kind;
    if (written === 'expert' || written === 'calibration') {
      resource(declaration, where);
      return null;
    }
    if (written === 'evidence') {
      evidenceItem(declaration, where);
      return null;
    }
    if (written === 'design') {
      designItem(declaration, where);
      return null;
    }
    if (written === 'constraint') {
      const why = conflictOf(declaration, where);
      if (why === null) return null;
      raw.push(sourceOf(declaration));
      say(
        where,
        'warning',
        `${headOf(declaration)}: kept as written, not read (${why})`,
        headAt(declaration),
      );
      return null;
    }
    if (!isKaosDeclaration(written)) {
      raw.push(sourceOf(declaration));
      say(
        where,
        'warning',
        `${headOf(declaration)}: kept as written, not read (KAOS's ${written}s have no place in the model)`,
        headAt(declaration),
      );
      return null;
    }
    const word = canonicalOf(written);
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
        annotations: [],
        objects: noObjectLinks(),
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
        // a predicate's formal definition is its FormalSpec too, as KAOSTools'
        if (
          word === 'agent' ||
          (isObjectDeclaration(word) && word !== 'predicate')
        )
          break;
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
        // an entity's (KAOSTools' EntityTypeAttributeParser.cs)
        if (
          word === 'entity' &&
          value?.atom.$type === 'NameAtom' &&
          ['software', 'environment', 'shared'].includes(value.atom.value)
        ) {
          element.props.set('EntityType', value.atom.value);
          return;
        }
        if (word === 'agent' && value?.atom.$type === 'NameAtom') {
          const agentType = value.atom.value;
          if (agentType === 'software' || agentType === 'environment') {
            element.environment = agentType === 'environment';
            return;
          }
          if (agentType === 'malicious') {
            element.environment = false;
            element.props.set('Type', 'malicious');
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
      // kaosres's (goal-controller#191): a goal's annotation for an
      // obstacle, put on that resolution once every link is read
      case 'except':
      case 'provided':
      case 'providednot':
      case 'relaxedto':
      case 'replaces':
      case 'cost':
        if (isGoal(word)) {
          const annotation = annotationOf(name, attribute, where);
          if (annotation) {
            element.annotations.push(annotation);
            return;
          }
        }
        break;
      case 'assignedto':
        if (isGoal(word) || word === 'obstacle') {
          const agents = refs(attribute, false, true);
          const quantities = quantitiesOf(attribute, false);
          if (
            agents &&
            quantities &&
            (!attribute.params.length || agents.length === 1)
          ) {
            const props: [string, string][] = [
              ...(quantities.sysRef !== undefined
                ? [['SysRef', quantities.sysRef] as [string, string]]
                : []),
              ...quantities.equations.map(([v, text]): [string, string] => [
                `Distribution[${v}]`,
                text,
              ]),
            ];
            if (props.length) simForms = true;
            element.assignments.push(
              ...agents.map((a) => ({ ref: a.ref, props })),
            );
            return;
          }
        }
        break;
      // kaossim's (goal-controller#193, D1): a goal's quality variables,
      // objective functions and estimates, each keyed by its name
      case 'qualityvariable':
      case 'samplespace':
      case 'qualitydefinition':
      case 'distribution':
      case 'objective':
      case 'mean':
      case 'objectivespec':
      case 'modal':
      case 'target':
      case 'current':
        if (isGoal(word)) {
          const quantity = quantityOf(attribute);
          if (quantity) {
            element.props.set(
              `${SIM_KEYS[name]}[${quantity.name}]`,
              quantity.text,
            );
            simForms = true;
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
        // distribution or an expert's (`probability[e1] (…)`); a goal's
        // `esr`/`eps` as a distribution too (goal-controller#199, HASE'11's
        // P(G), no expert form)
        if (word === 'obstacle' || isDomain(word) || isGoal(word)) {
          const estimate = estimateOf(
            attribute,
            isGoal(word) ? 'ESR' : 'Probability',
          );
          if (estimate) {
            element.props.set(estimate.key, estimate.text);
            // only kaosexpert reads these (kaosprop: a point on an obstacle)
            if (
              estimate.key !== 'Probability' ||
              estimate.distribution ||
              isDomain(word) ||
              isGoal(word)
            )
              expertForms = true;
            return;
          }
        }
        break;
      // kaosexpert's β (goal-controller#199, HASE'11): an obstacle's,
      // read only when it has more than one refinement, folded in there
      case 'beta':
        if (word === 'obstacle') {
          const estimate = estimateOf(attribute, 'Beta');
          if (estimate) {
            element.props.set(estimate.key, estimate.text);
            expertForms = true;
            return;
          }
        }
        break;
      // the operation and object models (goal-controller#194)
      case 'attribute':
      case 'initially':
      case 'argument': {
        const pair =
          (name === 'argument' ? word === 'predicate' : hasAttributes(word)) &&
          pairOf(attribute);
        if (pair) {
          const key =
            name === 'attribute'
              ? 'Attributes'
              : name === 'initially'
                ? 'Initially'
                : 'Arguments';
          const before = element.props.get(key);
          element.props.set(key, before ? `${before}, ${pair}` : pair);
          return;
        }
        break;
      }
      case 'default':
        if (
          word === 'predicate' &&
          value?.atom.$type === 'NameAtom' &&
          (value.atom.value === 'true' || value.atom.value === 'false')
        ) {
          element.props.set('Default', value.atom.value);
          return;
        }
        break;
      case 'frequency':
      case 'load': {
        const text = value && wordOf(value.atom);
        if (
          text !== null &&
          (name === 'frequency' ? word === 'event' : word === 'agent')
        ) {
          element.props.set(name === 'frequency' ? 'Frequency' : 'Load', text);
          return;
        }
        break;
      }
      case 'dompre':
      case 'dompost': {
        const formula = word === 'operation' && value && formulaOf(value.atom);
        if (formula) {
          element.props.set(name === 'dompre' ? 'DomPre' : 'DomPost', formula);
          return;
        }
        break;
      }
      case 'performedby':
      case 'input':
      case 'output': {
        const found = word === 'operation' && refs(attribute, false);
        if (found) {
          const list =
            name === 'performedby'
              ? element.objects.performers
              : name === 'input'
                ? element.objects.inputs
                : element.objects.outputs;
          list.push(...found.map((r) => r.ref));
          return;
        }
        break;
      }
      case 'causedby': {
        const delay = attribute.params.length
          ? delayOf(attribute)
          : { delay: undefined };
        const found =
          word === 'operation' && delay && refs(attribute, false, true);
        if (found) {
          element.objects.causes.push(
            ...found.map(({ ref }) => ({
              ref,
              ...(delay.delay !== undefined && { delay: delay.delay }),
            })),
          );
          return;
        }
        break;
      }
      case 'operationalizes':
      case 'operationalises': {
        const found = word === 'operation' && refs(attribute, false);
        if (found) {
          for (const { ref } of found) operationalised(element, ref);
          return;
        }
        break;
      }
      case 'reqpre':
      case 'reqtrig':
      case 'reqpost': {
        const [goal] = attribute.params;
        const ref =
          word === 'operation' &&
          attribute.params.length === 1 &&
          !goal!.bracket.length &&
          !goal!.op &&
          refOf(goal!.atom);
        const formula =
          ref &&
          attribute.values.length === 1 &&
          !attribute.values[0]!.bracket.length &&
          !attribute.values[0]!.op &&
          formulaOf(attribute.values[0]!.atom);
        if (ref && formula) {
          operationalised(element, ref).conditions.set(
            REQUIRED_CONDITIONS[name],
            formula,
          );
          return;
        }
        break;
      }
      case 'monitors':
      case 'controls': {
        const found = word === 'agent' && monitoredOf(attribute);
        if (found) {
          (name === 'monitors'
            ? element.objects.monitors
            : element.objects.controls
          ).push(...found);
          return;
        }
        break;
      }
      case 'link': {
        const found = word === 'association' && associationLinkOf(attribute);
        if (found) {
          element.objects.links.push(found);
          return;
        }
        break;
      }
      default:
        if (
          name.startsWith('$') &&
          CUSTOM_KEYS[type]?.includes(name.slice(1)) &&
          value?.atom.$type === 'StringAtom'
        ) {
          const key = name.slice(1);
          element.props.set(key, unquote(sourceOf(value.atom)));
          // Evidence is kaosexpert's only (goal-controller#199): a model
          // using it needs that dialect even with no elicited quantity set
          if (key === 'Evidence') expertForms = true;
          return;
        }
    }
    keepRaw(element, attribute, where, whyRaw(name, attribute, word));
  };

  const whyRaw = (name: string, attribute: Attribute, word: string) =>
    ['esr', 'eps', 'probability', 'rsr', 'rds', 'beta'].includes(name) &&
    attribute.params.length
      ? 'a per-expert estimate'
      : ['esr', 'eps', 'probability', 'rsr', 'rds', 'beta'].includes(name) &&
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
                'beta',
                ...Object.keys(SIM_KEYS),
                ...OBJECT_ATTRIBUTES,
              ].includes(name)
            ? `not in this form on a${/^[aeiou]/.test(word) ? 'n' : ''} ${word}`
            : `no place in the model for ${name}`;

  /**
   * `probability X` (a value or a distribution) or `probability[e1] X` as
   * kaosexpert's key (`Probability` by default; `ESR`'s and `Beta`'s have
   * no per-expert form, goal-controller#199) and the value as written; null
   * in any other form.
   */
  const estimateOf = (
    attribute: Attribute,
    base: string = 'Probability',
  ): { key: string; text: string; distribution: boolean } | null => {
    if (attribute.values.length !== 1 || attribute.params.length > 1)
      return null;
    const [param] = attribute.params;
    if (param && base !== 'Probability') return null;
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
      ? `${base}[${(param.atom as { value: string }).value}]`
      : base;
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

  /** `declare evidence`: an entry of kaosexpert's evidence resource (goal-controller#199). */
  /**
   * kaossim's design (goal-controller#193, D2): `declare design [ id ] name
   * "…" option "SysRef", "SysRef" set [v] "estimate" source "…" end`, an
   * entry of the project's `designs.json`
   */
  const designItem = (declaration: Declaration, where: Where) => {
    simForms = true;
    if (!declaration.id) {
      raw.push(sourceOf(declaration));
      say(
        where,
        'warning',
        `${headOf(declaration)}: a design without an identifier, kept as written`,
        headAt(declaration),
      );
      return;
    }
    const kept: string[] = [];
    let name: string | undefined;
    let source: string | undefined;
    const options: string[] = [];
    // by variable: the model's names, any it has (DesignEntry's `set`)
    const set: Record<string, string> = {};
    const text = (value: Value) =>
      value.atom.$type === 'StringAtom' && !value.bracket.length && !value.op
        ? unquote(sourceOf(value.atom))
        : null;
    for (const attribute of declaration.attributes) {
      const single1 = single(attribute);
      const lower = attribute.name.toLowerCase();
      const written = single1 ? text(single1) : null;
      if (lower === 'name' && written !== null) {
        name = written;
        continue;
      }
      if (lower === 'source' && written !== null) {
        source = written;
        continue;
      }
      if (lower === 'option' && !attribute.params.length) {
        const picks = attribute.values.map(text);
        if (picks.every((p): p is string => p !== null)) {
          options.push(...picks);
          continue;
        }
      }
      if (lower === 'set') {
        const quantity = quantityOf(attribute);
        if (quantity) {
          set[quantity.name] = quantity.text;
          continue;
        }
      }
      kept.push(oneLine(sourceOf(attribute)));
      say(
        where,
        'warning',
        `${attribute.name} of design ${declaration.id}: kept as written, not read`,
        at(attribute),
      );
    }
    designs.push({
      id: declaration.id,
      ...(name !== undefined && { name }),
      options,
      ...(Object.keys(set).length && { set }),
      ...(source !== undefined && { source }),
      ...(kept.length && { kept }),
    });
  };

  const evidenceItem = (declaration: Declaration, where: Where) => {
    expertForms = true;
    if (!declaration.id) {
      raw.push(sourceOf(declaration));
      say(
        where,
        'warning',
        `${headOf(declaration)}: an evidence item without an identifier, kept as written (an Evidence key names it by it)`,
        headAt(declaration),
      );
      return;
    }
    const kept: string[] = [];
    let name: string | undefined;
    let kind: string | undefined;
    for (const attribute of declaration.attributes) {
      const single1 = single(attribute);
      const lower = attribute.name.toLowerCase();
      if (lower === 'name' && single1?.atom.$type === 'StringAtom') {
        name = unquote(sourceOf(single1.atom));
        continue;
      }
      if (lower === 'kind' && single1?.atom.$type === 'StringAtom') {
        kind = unquote(sourceOf(single1.atom));
        continue;
      }
      kept.push(oneLine(sourceOf(attribute)));
      say(
        where,
        'warning',
        `${attribute.name} of evidence ${declaration.id}: kept as written, not read`,
        at(attribute),
      );
    }
    evidence.push({
      id: declaration.id,
      ...(name !== undefined && { name }),
      ...(kind !== undefined && { kind }),
      ...(kept.length && { kept }),
    });
  };

  /** A list of references, each with a `[p]` when `decorated` allows one; null when it is another list. */
  const refs = (
    attribute: Attribute,
    decorated: boolean,
    parameters = false,
  ) => {
    if (attribute.params.length && !parameters) return null;
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

  // the operation and object models' attributes (goal-controller#194)

  /** An atom as a word: a string's content, a number or a name as written; null for another. */
  const wordOf = (atom: Atom): string | null =>
    atom.$type === 'StringAtom'
      ? unquote(sourceOf(atom))
      : atom.$type === 'NumberAtom' || atom.$type === 'NameAtom'
        ? atom.value
        : null;

  /** A formula's text (`c.PumpSwitch != "On"`), a name as one (`PumpOn`), or a string's content. */
  const formulaOf = (atom: Atom): string | null =>
    atom.$type === 'FormulaAtom'
      ? formulaText(atom)
      : atom.$type === 'NameAtom' || atom.$type === 'StringAtom'
        ? wordOf(atom)
        : null;

  /** `attribute name : type` (`argument a : t`) as a pair, `name:type`; null in another form (an untyped one). */
  const pairOf = (attribute: Attribute): string | null => {
    const [value] = attribute.values;
    if (attribute.params.length || attribute.values.length !== 1) return null;
    if (value!.bracket.length || value!.op !== ':' || !value!.right)
      return null;
    const left = value!.atom.$type === 'NameAtom' ? value!.atom.value : null;
    const right =
      value!.right.$type === 'NameAtom' || value!.right.$type === 'StringAtom'
        ? wordOf(value!.right)
        : null;
    return left !== null && right ? `${left}:${right}` : null;
  };

  /** `causedby [delay = "5 s"] ev`'s delay; null when its parameters are another. */
  const delayOf = (attribute: Attribute): { delay: string } | null => {
    const [param] = attribute.params;
    if (attribute.params.length !== 1 || param!.bracket.length) return null;
    const delay =
      param!.op === '=' &&
      param!.atom.$type === 'NameAtom' &&
      param!.atom.value.toLowerCase() === 'delay' &&
      param!.right
        ? wordOf(param!.right)
        : null;
    return delay === null ? null : { delay };
  };

  /** An operation's operationalisation of a requirement, made when it is first named. */
  const operationalised = (element: Element, ref: Ref) => {
    const same = (other: Ref) =>
      other.id !== undefined ? other.id === ref.id : other.name === ref.name;
    let found = element.objects.operationalises.find((o) => same(o.ref));
    if (!found) {
      found = { ref, conditions: new Map() };
      element.objects.operationalises.push(found);
    }
    return found;
  };

  /**
   * `monitors sump.highWater, pump` (`controls …`): each an object's
   * attribute (FSE'02) or an element as a whole (KAOSTools' predicate); null
   * in another form.
   */
  const monitoredOf = (
    attribute: Attribute,
  ): { ref: Ref; written: string }[] | null => {
    if (attribute.params.length) return null;
    const found: { ref: Ref; written: string }[] = [];
    for (const value of attribute.values) {
      if (value.bracket.length || value.op) return null;
      const { atom } = value;
      const member =
        atom.$type === 'FormulaAtom'
          ? /^([A-Za-z$][A-Za-z0-9_-]*)\.[A-Za-z_][A-Za-z0-9_]*$/.exec(
              formulaText(atom),
            )
          : null;
      if (member) found.push({ ref: { id: member[1]! }, written: member[0] });
      else if (atom.$type === 'NameAtom')
        found.push({ ref: { id: atom.value }, written: atom.value });
      else return null;
    }
    return found;
  };

  /**
   * `link [0, 1] target` (KAOSTools' LinkAttributeParser.cs: one
   * multiplicity, or two as `0..1`), `link [*] role : target` with its role
   * (ours: KAOSTools' Link has a Role its parser doesn't read); null in
   * another form.
   */
  const associationLinkOf = (
    attribute: Attribute,
  ): { ref: Ref; multiplicity?: string; role?: string } | null => {
    const bounds = attribute.params.map((param) =>
      param.bracket.length || param.op
        ? null
        : param.atom.$type === 'StarAtom'
          ? '*'
          : param.atom.$type === 'NumberAtom' || param.atom.$type === 'NameAtom'
            ? param.atom.value
            : null,
    );
    if (bounds.length > 2 || bounds.some((b) => b === null)) return null;
    const [value] = attribute.values;
    if (attribute.values.length !== 1 || value!.bracket.length) return null;
    const role =
      value!.op === ':' && value!.right ? wordOf(value!.atom) : undefined;
    const ref = value!.op
      ? value!.op === ':' && value!.right
        ? refOf(value!.right)
        : null
      : refOf(value!.atom);
    if (!ref || role === null) return null;
    return {
      ref,
      ...(bounds.length && { multiplicity: bounds.join('..') }),
      ...(role !== undefined && { role }),
    };
  };

  /**
   * `declare constraint [ c ] conflict a, b end`: a Conflict link between two
   * goals (KAOS's conflict, `{a, b, Dom} ⊨ false`; KAOSTools' older syntax,
   * the flood model's, goal-controller#191); null when read, else why it is
   * kept as written (a conflict among more than two goals, which no link
   * joins; any other attribute).
   */
  const conflictOf = (
    declaration: Declaration,
    where: Where,
  ): string | null => {
    const conflict = declaration.attributes.filter(
      (a) => a.name.toLowerCase() === 'conflict',
    );
    const other = declaration.attributes.filter(
      (a) => !['conflict', 'id', 'name'].includes(a.name.toLowerCase()),
    );
    if (conflict.length !== 1 || other.length)
      return "KAOS's constraints have no place in the model, but a conflict between two goals";
    const pair = refs(conflict[0]!, false);
    if (!pair) return 'its conflict names no goals';
    if (pair.length !== 2)
      return `a conflict among ${pair.length} goals: a Conflict link joins two`;
    conflicts.push({ a: pair[0]!.ref, b: pair[1]!.ref });
    if (declaration.attributes.some((a) => a.name.toLowerCase() === 'name'))
      say(
        where,
        'info',
        `${headOf(declaration)}: read as a Conflict link, which has no name: its name is not kept`,
        headAt(declaration),
      );
    return null;
  };

  /** `refinedby [pattern] a [p], b`: one refinement; false (nothing read) when it is in another form. */
  const refinement = (
    element: Element,
    attribute: Attribute,
    where: Where,
  ): boolean => {
    let tactic: string | null = null;
    const quantities = quantitiesOf(attribute, true);
    if (!quantities) return false;
    for (const param of quantities.rest) {
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
        const kind = atom.declaration.kind;
        if (!isKaosDeclaration(kind) || isObjectDeclaration(kind)) return false;
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
    if (quantities.sysRef !== undefined || quantities.equations.length)
      simForms = true;
    element.refinements.push({
      tactic,
      refinees,
      ...(quantities.sysRef !== undefined && { sysRef: quantities.sysRef }),
      equations: quantities.equations,
    });
    return true;
  };

  /**
   * kaossim's parameters of a refinement or an assignment (goal-controller#193):
   * `sysref = "1.2"` its option, `v = "text"` an equation (or an estimate)
   * of a variable; the others (`pattern = …`, `[case]`) as they are, in
   * `rest`. Null when one is `sysref` or a variable's in another form, or
   * (an assignment, `others` false) any other parameter.
   */
  const quantitiesOf = (
    attribute: Attribute,
    others: boolean,
  ): {
    sysRef?: string;
    equations: [string, string][];
    rest: Value[];
  } | null => {
    let sysRef: string | undefined;
    const equations: [string, string][] = [];
    const rest: Value[] = [];
    if (attribute.parenthesised && attribute.params.length) return null;
    for (const param of attribute.params) {
      const name =
        param.op === '=' && param.atom.$type === 'NameAtom'
          ? param.atom.value
          : null;
      if (name === null || name === 'pattern' || name === 'context') {
        if (!others) return null;
        rest.push(param);
        continue;
      }
      const right = param.right;
      const text =
        right?.$type === 'StringAtom'
          ? unquote(sourceOf(right))
          : right?.$type === 'NumberAtom' || right?.$type === 'NameAtom'
            ? right.value
            : null;
      if (text === null) return null;
      if (name.toLowerCase() === 'sysref') sysRef = text;
      else equations.push([name, text]);
    }
    return { ...(sysRef !== undefined && { sysRef }), equations, rest };
  };

  /** `qualityvariable [ResponseTime] Time`, `objective ["8MinRespRate"] "…"`: the name and the value as written. */
  const quantityOf = (
    attribute: Attribute,
  ): { name: string; text: string } | null => {
    if (attribute.params.length !== 1 || attribute.values.length !== 1)
      return null;
    const [param] = attribute.params;
    if (param!.op || param!.bracket.length) return null;
    const name =
      param!.atom.$type === 'NameAtom'
        ? param!.atom.value
        : param!.atom.$type === 'StringAtom'
          ? unquote(sourceOf(param!.atom))
          : null;
    if (!name || /[[\]\s]/.test(name)) return null;
    const value = attribute.values[0]!;
    if (value.op) return null;
    const text =
      value.atom.$type === 'StringAtom' && !value.bracket.length
        ? unquote(sourceOf(value.atom))
        : oneLine(sourceOf(value));
    return text ? { name, text } : null;
  };

  /**
   * `except [o] g`, `replaces [o] g` (an identifier or a quoted name),
   * `provided [o] f`, `providednot [o] f`, `relaxedTo [o] f` (a formula),
   * `cost [o] n` and `cost n`, as KAOSTools' attribute parsers read them
   * (one obstacle in brackets, one value); null in any other form.
   */
  const annotationOf = (
    word: Annotation['word'],
    attribute: Attribute,
    where: Where,
  ): Annotation | null => {
    if (attribute.values.length !== 1 || attribute.params.length > 1)
      return null;
    const [param] = attribute.params;
    const value = attribute.values[0]!;
    const obstacle =
      param && !param.op && !param.bracket.length ? refOf(param.atom) : null;
    if (param && !obstacle) return null;
    const base = { word, obstacle, attribute, file: where.file };
    if (word === 'cost')
      return value.atom.$type === 'NumberAtom' &&
        !value.op &&
        !value.bracket.length
        ? { ...base, text: value.atom.value }
        : null;
    if (!obstacle || value.op || value.bracket.length) return null;
    if (word === 'except' || word === 'replaces') {
      const goal = refOf(value.atom);
      return goal ? { ...base, goal } : null;
    }
    return {
      ...base,
      text:
        value.atom.$type === 'FormulaAtom'
          ? formulaText(value.atom)
          : value.atom.$type === 'StringAtom'
            ? unquote(sourceOf(value.atom))
            : oneLine(sourceOf(value)),
    };
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
      annotations: [],
      objects: noObjectLinks(),
      raw: [],
      declared: false,
    };
    elements.set(element.key, element);
    if (ref.id !== undefined) byId.set(ref.id, element);
    else byName.set(ref.name!, element);
    diagnostics.push({
      severity: 'warning',
      message: `${ref.id ?? `"${ref.name}"`} is not declared: read as a${/^[aeiou]/.test(word) ? 'n' : ''} ${word}`,
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
      sysRef?: string;
      equations: [string, string][];
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
      /** kaosres's (goal-controller#191): from the goals' annotations */
      countermeasure: CountermeasureTexts;
    }[];
    assignments: {
      agent: Element;
      goal: Element;
      props: [string, string][];
    }[];
    conflicts: { a: Element; b: Element }[];
    /** the operation and object models' (goal-controller#194), each from its source to its target */
    objects: {
      type: string;
      name: string;
      source: Element;
      target: Element;
      props: [string, string][];
    }[];
  } = {
    refinements: [],
    obstructions: [],
    resolutions: [],
    assignments: [],
    conflicts: [],
    objects: [],
  };
  for (const element of elements.values()) {
    for (const r of element.refinements)
      links.refinements.push({
        parent: element,
        tactic: r.tactic,
        ...(r.sysRef !== undefined && { sysRef: r.sysRef }),
        equations: r.equations,
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
        countermeasure: {},
      });
    for (const { ref, props } of element.assignments)
      links.assignments.push({
        agent: resolve(ref, 'agent'),
        goal: element,
        props,
      });
    const {
      performers,
      inputs,
      outputs,
      causes,
      operationalises,
      monitors,
      controls,
      links: legs,
    } = element.objects;
    const object = (
      type: string,
      name: string,
      source: Element,
      target: Element,
      props: [string, string][] = [],
    ) => links.objects.push({ type, name, source, target, props });
    for (const ref of performers)
      object(
        KAOS_TYPES.performance,
        'performs',
        resolve(ref, 'agent'),
        element,
      );
    for (const { ref, conditions } of operationalises)
      object(
        KAOS_TYPES.operationalisation,
        'operationalises',
        element,
        resolve(ref, 'goal'),
        [...conditions],
      );
    for (const { ref, delay } of causes)
      object(
        KAOS_TYPES.cause,
        'causes',
        resolve(ref, 'event'),
        element,
        delay !== undefined ? [['Delay', delay]] : [],
      );
    for (const ref of inputs)
      object(KAOS_TYPES.input, 'input', resolve(ref, 'entity'), element);
    for (const ref of outputs)
      object(KAOS_TYPES.output, 'output', element, resolve(ref, 'entity'));
    for (const [list, type, name, key] of [
      [monitors, KAOS_TYPES.monitoring, 'monitors', 'Monitors'],
      [controls, KAOS_TYPES.control, 'controls', 'Controls'],
    ] as const)
      for (const { ref, written } of list)
        object(
          type,
          name,
          element,
          // an attribute's object is an entity; a name alone, KAOSTools' predicate
          resolve(ref, written.includes('.') ? 'entity' : 'predicate'),
          [[key, written]],
        );
    for (const { ref, multiplicity, role } of legs)
      object(
        KAOS_TYPES.associationLink,
        'links',
        element,
        resolve(ref, 'entity'),
        [
          ...(multiplicity !== undefined
            ? [['Multiplicity', multiplicity] as [string, string]]
            : []),
          ...(role !== undefined ? [['Role', role] as [string, string]] : []),
        ],
      );
  }
  for (const { a, b } of conflicts)
    links.conflicts.push({ a: resolve(a, 'goal'), b: resolve(b, 'goal') });

  // kaosres's (goal-controller#191): each goal's annotations on the
  // resolution they are about, made when no `resolvedby` declares it
  const annotationRaw = (
    element: Element,
    annotation: Annotation,
    why: string,
  ) => {
    if (!element.raw.length) raw.push(element);
    element.raw.push(sourceOf(annotation.attribute));
    say(
      { file: annotation.file },
      'warning',
      `${annotation.attribute.name} of ${element.id ?? element.name}: kept as written, not read (${why})`,
      at(annotation.attribute),
    );
  };
  // `cost n` (every obstacle the goal resolves) last, once every other
  // annotation has made its resolution; an element made while resolving
  // has no annotations
  const everyObstacle = (annotation: Annotation) =>
    annotation.word === 'cost' && !annotation.obstacle;
  const annotated = [...elements.values()].flatMap((element) =>
    element.annotations.map((annotation) => ({ element, annotation })),
  );
  for (const { element, annotation } of [
    ...annotated.filter(({ annotation }) => !everyObstacle(annotation)),
    ...annotated.filter(({ annotation }) => everyObstacle(annotation)),
  ]) {
    const label = element.id ?? element.name ?? 'a goal';
    // `cost [x] n` whose x is no obstacle: KAOSTools' cost variable
    // (before 2017-03), one of several costs SEAMS'17 leaves out
    const named = annotation.obstacle?.id ?? annotation.obstacle?.name;
    const declared =
      annotation.obstacle &&
      (annotation.obstacle.id !== undefined
        ? byId.get(annotation.obstacle.id)
        : byName.get(annotation.obstacle.name!));
    if (
      annotation.word === 'cost' &&
      annotation.obstacle &&
      declared?.word !== 'obstacle'
    ) {
      annotationRaw(
        element,
        annotation,
        `${named} is no obstacle: a cost variable has no place in the model`,
      );
      continue;
    }
    const goal =
      annotation.word === 'except'
        ? resolve(annotation.goal!, 'goal')
        : element;
    const obstacles = annotation.obstacle
      ? [resolve(annotation.obstacle, 'obstacle')]
      : links.resolutions.filter((r) => r.goal === goal).map((r) => r.obstacle);
    if (!obstacles.length) {
      annotationRaw(element, annotation, `${label} resolves no obstacle`);
      continue;
    }
    for (const obstacle of obstacles) {
      let resolution = links.resolutions.find(
        (r) => r.goal === goal && r.obstacle === obstacle,
      );
      if (!resolution) {
        resolution = {
          goal,
          obstacle,
          type: '',
          anchor: '',
          countermeasure: {},
        };
        links.resolutions.push(resolution);
        say(
          { file: annotation.file },
          'info',
          `${annotation.attribute.name} of ${label}: no resolvedby says ${goal.id ?? goal.name} resolves ${obstacle.id ?? obstacle.name}, so it does`,
          at(annotation.attribute),
        );
      }
      const cm = resolution.countermeasure;
      if (annotation.word === 'cost') {
        cm.Cost = annotation.text!;
        continue;
      }
      const form = FORMS[annotation.word];
      if (cm.Form !== undefined && cm.Form !== form) {
        annotationRaw(
          element,
          annotation,
          `that resolution's form is ${cm.Form} already`,
        );
        continue;
      }
      cm.Form = form;
      if (annotation.word === 'except') {
        if (resolution.anchor && resolution.anchor !== element.key)
          say(
            { file: annotation.file },
            'warning',
            `${annotation.attribute.name} of ${label}: its resolution was anchored on ${resolution.anchor}, now on ${label}`,
            at(annotation.attribute),
          );
        resolution.anchor = `\u0000${element.key}`;
      } else if (annotation.word === 'replaces')
        cm.Replaces = `\u0000${resolve(annotation.goal!, 'goal').key}`;
      else cm.Condition = annotation.text!;
    }
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
  // kaossim's (goal-controller#193): a refinement's `v = "…"` is v's
  // distribution when it reads as one, else its equation, Boolean when the
  // model declares v Boolean
  const booleans = new Set(
    [...elements.values()].flatMap((element) =>
      [...element.props].flatMap(([key, value]) =>
        key.startsWith('QualityVariable[') && value === 'Boolean'
          ? [key.slice('QualityVariable['.length, -1)]
          : [],
      ),
    ),
  );
  const equationKey = (variable: string, text: string) =>
    'distribution' in readDistribution(text, { point: true, range: 'real' })
      ? `Distribution[${variable}]`
      : booleans.has(variable)
        ? `BooleanEquation[${variable}]`
        : `Equation[${variable}]`;
  for (const {
    parent,
    tactic,
    refinees,
    sysRef,
    equations,
  } of links.refinements) {
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
        customProperties: {
          SysRef: sysRef ?? '',
          Status: '',
          Tactic: tactic ?? '',
          ...Object.fromEntries(
            equations.map(([v, text]) => [equationKey(v, text), text]),
          ),
        },
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
    if (obstacle && (sysRef !== undefined || equations.length))
      diagnostics.push({
        severity: 'info',
        message: `${parent.id}: an obstacle refinement's SysRef and equations have no place in the model, not read`,
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
  // an annotation's goals by their element (the anonymous have ids now)
  const idOf = (key: string) =>
    key.startsWith('\u0000') ? elements.get(key.slice(1))!.id! : key;
  for (const {
    goal,
    obstacle,
    type,
    anchor,
    countermeasure,
  } of links.resolutions)
    pistarLinks.push({
      id: linkId(`${goal.id}-resolves-${obstacle.id}`),
      type: KAOS_TYPES.resolution,
      source: goal.id,
      target: obstacle.id,
      customProperties: {
        ResolutionType: type,
        Anchor: idOf(anchor),
        ...countermeasure,
        ...(countermeasure.Replaces !== undefined && {
          Replaces: idOf(countermeasure.Replaces),
        }),
      },
    });
  for (const { agent, goal, props } of links.assignments)
    pistarLinks.push({
      id: linkId(`${agent.id}-assigned-${goal.id}`),
      type: KAOS_TYPES.assignment,
      source: agent.id,
      target: goal.id,
      ...(props.length && { customProperties: Object.fromEntries(props) }),
    });
  for (const { a, b } of links.conflicts)
    pistarLinks.push({
      id: linkId(`${a.id}-conflicts-${b.id}`),
      type: KAOS_TYPES.conflict,
      source: a.id,
      target: b.id,
    });
  for (const { type, name, source, target, props } of links.objects)
    pistarLinks.push({
      id: linkId(`${source.id}-${name}-${target.id}`),
      type,
      source: source.id,
      target: target.id,
      ...(props.length && { customProperties: Object.fromEntries(props) }),
    });

  // positions: a refinement's children below it, an obstacle below what it
  // obstructs, a resolving goal below its obstacle, an agent beside its goal
  const BELOW = 'below';
  // a predicate or a type nothing links (KAOSTools' are declared apart):
  // in rows below the model, not a root of its own (goal-controller#194)
  const linked = new Set(
    links.objects.flatMap((o) => [o.source.id!, o.target.id!]),
  );
  const loose = new Set(
    [...elements.values()]
      .filter(
        (e) =>
          (e.word === 'predicate' || e.word === 'type') && !linked.has(e.id!),
      )
      .map((e) => e.id!),
  );
  const laidOut = layOut(
    {
      orphans: nodes.filter((node) => !loose.has(node.id)),
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
        // an operation below the requirement it operationalises, an object
        // beside what links it (goal-controller#194)
        ...links.objects.map((o) =>
          o.type === KAOS_TYPES.operationalisation
            ? { type: BELOW, source: o.source.id, target: o.target.id }
            : { type: 'beside', source: o.target.id, target: o.source.id },
        ),
      ],
    },
    undefined,
    new Set([BELOW]),
  );
  const extent = placeLoose(
    nodes.filter((node) => loose.has(node.id)),
    laidOut,
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
    // the operation and object models' kinds, declared in the file
    // (goal-controller#194) by a model that has any
    ...(usesOperationKinds(nodes, pistarLinks) && {
      [FILE_METAMODEL_KEY]: KAOS_OPERATIONS_BLOCK,
    }),
  };
  // in istar-ts's form, as the workbench writes a KAOS model
  const model = toPistarObject(
    parsePistar(json, { metamodel: KAOS_OBSTACLES, fileMetamodel: true }),
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
  if (evidence.length)
    projectResources.evidence = {
      [EVIDENCE_PATH]: evidenceText({ evidence }),
    };
  if (designs.length)
    projectResources.design = { [DESIGNS_PATH]: designsText({ designs }) };
  return {
    model,
    dialectRecord: {
      // experts first: kaosexpert's dialect reads resolutions too (kaosprop's
      // keys), its quantities are the file's
      engine: expertForms
        ? KAOS_EXPERT_ENGINE
        : simForms
          ? KAOS_SIM_ENGINE
          : links.resolutions.length
            ? KAOS_RESOLUTION_ENGINE
            : KAOS_ENGINE,
      projectResources,
    },
    diagnostics,
  };
};
