/**
 * A KAOS piStar model as KAOSTools' textual KAOS (goal-controller#181): the
 * reader's inverse (./read.ts), in the syntax KAOSTools' PEG reads
 * (`declare goal [ g ] … end`, `refinedby [case] a [.8], b`, `resolvedby
 * [mitigation:g] r`), so KAOSTools stays an oracle.
 *
 * - Each element in the model's order, its refinements, obstructions,
 *   resolutions and assignments as attributes of the element they refine,
 *   obstruct, resolve or are assigned; what the file had in another order is
 *   written in this one (the round trip is structural, not textual).
 * - The `kaos` dialect's text keys `.kaos` has no attribute for are custom
 *   attributes (`$Priority "high"`), which the reader reads back.
 * - kaosexpert's (goal-controller#190): an obstacle's or a domain
 *   property's distribution `probability X`, an expert's `probability[e1]
 *   X`, each as written; the experts and calibration variables of the
 *   project's resources (`experts.json`, `calibrations.json`) as `declare
 *   expert` and `declare calibration`, after the elements, and their
 *   quantile levels as `@experts.quantiles`.
 * - kaosres's (goal-controller#191): a resolution's `Form` and its payload
 *   as KAOSTools annotates a goal for an obstacle (`except [o] g` on the
 *   anchor; `provided`, `providednot`, `relaxedTo`, `replaces` on the
 *   countermeasure goal), and its `Cost` as `cost [o] n` on that goal.
 * - kaossim's (goal-controller#193, D1), in our own attributes (KAOSTools
 *   has none for them): a goal's keyed quantities as `qualityvariable [v]
 *   Time`, `samplespace [v] "…"`, `qualitydefinition [v] "…"`,
 *   `distribution [v] exponential[60]`, `objective [o] "…"`, `mean [o]
 *   "…"`, `objectivespec [o] "…"`, `modal [o] Max`, `target [o] 50%`, `current [o] 35%`; a
 *   refinement's `SysRef` and equations as its parameters (`refinedby
 *   [sysref = "1.2", T = "A + B"] a, b`), an assignment's as its
 *   (`assignedto [sysref = "4.3", A = "exponential[5]"] agent`).
 * - kaossim's designs (`designs.json`) as `declare design [ id ] … end`,
 *   after the evidence items.
 * - A conflict between two goals as KAOSTools' older `declare constraint
 *   [ c ] conflict a, b end` (goal-controller#191), after the elements.
 * - What the reader kept as written (`kaosUnsupported`) at the end, as it
 *   was.
 * - Not written, and said: a refinement's `Status`, an
 *   obstacle refinement's `Probability`, a conflict's `BoundaryCondition`
 *   or one with an end .kaos doesn't declare, a key no dialect declares;
 *   nor positions (`KAOS_LOSSY`).
 */
import {
  keyedKeyOf,
  numberOf,
  readDistribution,
  type NativeDiagnostic,
  type NativeFileContext,
  type NativeWriteResult,
  type PistarJson,
} from '@goal-controller/dialect';
import { readJson } from '../../engines/projectResources';
import type {
  CalibrationsFile,
  EvidenceFile,
  ExpertsFile,
} from '../../engines/kaosexpert/resources';
import type { DesignsFile } from '../../engines/kaossim/designs';
import { kaosLanguage } from '@goal-controller/goal-language/formats';
import type { CountermeasureForm } from '../../engines/kaosres/definition';
import { identifierOf, KAOS_UNSUPPORTED_KEY } from './read';
import {
  CUSTOM_KEYS,
  KAOS_TYPES,
  KAOSTOOLS_RESOLUTIONS,
  KAOSTOOLS_TACTICS,
  RESOLUTION_PATTERNS,
  TACTIC_PATTERNS,
  isKaosIdentifier,
} from './vocabulary';

/**
 * What `.kaos` doesn't carry, as piStar paths: positions, sizes, the links'
 * ids (the reader makes them from the structure), and the diagram's records
 * of the workbench (its description, mode and framework).
 */
export const KAOS_LOSSY = [
  'orphans.*.x',
  'orphans.*.y',
  'links.*.id',
  'links.*.hub.id',
  'links.*.hub.x',
  'links.*.hub.y',
  'links.*.starts.*.id',
  'links.*.starts.*.target',
  'links.*.end.id',
  'links.*.end.source',
  'display',
  'saveDate',
  'diagram.width',
  'diagram.height',
  'diagram.customProperties.Description',
  'diagram.customProperties.engine',
  'diagram.customProperties.framework',
];

type Json = Record<string, any>;

/** A string as KAOSTools quotes it: `""` a quote. */
const quoted = (text: string) => `"${text.replace(/"/g, '""')}"`;

/** A quantity as written, when it is one KAOSTools reads (`.8`, `95%`, `1e-3`). */
const isNumber = (text: string) =>
  /^(?:\d+(?:\.\d+)?|\.\d+)(?:e-?(?:\d+(?:\.\d+)?|\.\d+))?%?$/.test(text);

/** Whether a text reads as a KAOSTools formula. */
const isFormula = (text: string) => {
  const { ast, diagnostics } = kaosLanguage.parse(
    `declare goal [ g ] formalspec ${text} end`,
  );
  const [item] = ast.items;
  return (
    !diagnostics.length &&
    ast.items.length === 1 &&
    item?.$type === 'Declaration' &&
    item.attributes.length === 1 &&
    item.attributes[0]!.values.length === 1 &&
    item.attributes[0]!.values[0]!.atom.$type === 'FormulaAtom'
  );
};

const WORDS: Readonly<Record<string, string>> = {
  [KAOS_TYPES.goal]: 'goal',
  [KAOS_TYPES.softgoal]: 'softgoal',
  [KAOS_TYPES.obstacle]: 'obstacle',
  [KAOS_TYPES.domainProperty]: 'domainproperty',
  [KAOS_TYPES.agent]: 'agent',
  [KAOS_TYPES.environmentAgent]: 'agent',
};

/** The keys each kind's attributes or custom attributes write; any other set key is said. */
const WRITTEN: Readonly<Record<string, readonly string[]>> = {
  [KAOS_TYPES.goal]: ['Description', 'FormalSpec', 'RSR', 'ESR'],
  [KAOS_TYPES.softgoal]: ['Description', 'FormalSpec', 'RSR', 'ESR'],
  [KAOS_TYPES.obstacle]: ['Description', 'FormalSpec', 'Probability', 'Beta'],
  [KAOS_TYPES.domainProperty]: [
    'Kind',
    'Description',
    'FormalSpec',
    'Probability',
  ],
  [KAOS_TYPES.agent]: ['Description'],
  [KAOS_TYPES.environmentAgent]: ['Description'],
};

/**
 * A distribution, or a value, as written (kaosexpert's `Probability`,
 * goal-controller#190): one the dialect reports (falling quantiles) is written
 * as it is, when it has a distribution's form and numbers.
 */
const isEstimate = (text: string) => {
  if ('distribution' in readDistribution(text, { point: true })) return true;
  const inner = /^\s*(?:\((.*)\)|[A-Za-z]+\s*\[(.*)\])\s*$/s.exec(text);
  return (
    !!inner &&
    (inner[1] ?? inner[2]!).split(',').every((part) => numberOf(part) !== null)
  );
};

/** kaossim's keyed goal keys (goal-controller#193) and their attributes, in the order written. */
const SIM_ATTRIBUTES = {
  QualityVariable: 'qualityvariable',
  SampleSpace: 'samplespace',
  QualityDefinition: 'qualitydefinition',
  Distribution: 'distribution',
  Objective: 'objective',
  Mean: 'mean',
  ObjectiveSpec: 'objectivespec',
  Modal: 'modal',
  Target: 'target',
  Current: 'current',
} as const;
type SimKey = keyof typeof SIM_ATTRIBUTES;
const isSimKey = (key: string): key is SimKey =>
  Object.hasOwn(SIM_ATTRIBUTES, key);
/** The keys a hub's or an assignment's parameters write (`v = "…"`), keyed by a variable. */
const EQUATION_KEYS = new Set(['Equation', 'BooleanEquation', 'Distribution']);

/** A name as a parameter: an identifier as it is, any other quoted. */
const nameParam = (name: string) =>
  /^[A-Za-z$][A-Za-z0-9_-]*$/.test(name) ? name : quoted(name);

/** A value as .kaos reads it back: a word or a number as it is, a distribution (`exponential[60]`) too, any other quoted. */
const valueText = (key: SimKey, text: string) => {
  if (key === 'QualityVariable' || key === 'Modal')
    return /^[A-Za-z][A-Za-z0-9_]*$/.test(text) ? text : quoted(text);
  if (key === 'Target' || key === 'Current')
    return isNumber(text) ? text : quoted(text);
  if (key === 'Distribution')
    return isNumber(text) || /^[A-Za-z]+\s*\[[^\]"]*\]$/.test(text)
      ? text
      : quoted(text);
  return quoted(text);
};

/** A refinement's or an assignment's kaossim parameters: `sysref = "…"`, `v = "…"`. */
const simParams = (props: Record<string, unknown>): string[] => {
  const params: string[] = [];
  const sysRef = props.SysRef;
  if (typeof sysRef === 'string' && sysRef.trim())
    params.push(`sysref = ${quoted(sysRef.trim())}`);
  for (const [key, value] of Object.entries(props)) {
    const keyed = keyedKeyOf(key);
    if (!keyed || !EQUATION_KEYS.has(keyed.key)) continue;
    if (typeof value === 'string' && value.trim())
      params.push(`${nameParam(keyed.name)} = ${quoted(value.trim())}`);
  }
  return params;
};

/** A project resource kind's JSON files' values, in path order. */
const resourceValues = (
  files: Readonly<Record<string, string>> | undefined,
): unknown[] =>
  Object.keys(files ?? {})
    .sort()
    .flatMap((path) => {
      const { value } = readJson({ path, text: files![path]! });
      return value === undefined ? [] : [value];
    });

/** A resolution's `Form` (kaosres's, goal-controller#191) and the attribute KAOSTools annotates a goal with. */
const ANNOTATIONS = {
  except: 'except',
  provided: 'provided',
  providedNot: 'providednot',
  relaxedTo: 'relaxedTo',
  replaces: 'replaces',
} as const satisfies Record<CountermeasureForm, string>;

const isForm = (text: string): text is CountermeasureForm =>
  Object.hasOwn(ANNOTATIONS, text);

/** A model as a `.kaos` text, with what it doesn't write. */
export const writeKaos = (
  pistar: PistarJson,
  {
    modelName = 'model',
    projectResources = {},
  }: Pick<NativeFileContext, 'projectResources'> & { modelName?: string } = {},
): NativeWriteResult => {
  const diagnostics: NativeDiagnostic[] = [];
  const say = (
    message: string,
    severity: NativeDiagnostic['severity'] = 'warning',
  ) => diagnostics.push({ severity, message });
  const json = pistar as Json;
  if (!Array.isArray(json.orphans))
    return {
      text: null,
      diagnostics: [{ severity: 'error', message: 'Not a piStar model' }],
    };
  for (const actor of json.actors ?? [])
    say(`${actor.text ?? actor.id}: KAOS has no actors, not written`);

  // each element's identifier: its id, when it is a KAOSTools one; its name's otherwise
  const nodes: Json[] = (json.orphans as Json[]).filter((node) => {
    if (WORDS[node.type]) return true;
    say(
      `${node.text ?? node.id}: a ${node.type} has no .kaos declaration, not written`,
    );
    return false;
  });
  const identifier = new Map<string, string>();
  const taken = new Set(
    nodes.map((n) => String(n.id)).filter((id) => isKaosIdentifier(id)),
  );
  for (const node of nodes) {
    const id = String(node.id);
    if (isKaosIdentifier(id) && !identifier.has(id)) {
      identifier.set(id, id);
      continue;
    }
    const base = identifierOf(String(node.text ?? ''), WORDS[node.type]!);
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base}_${n}`;
    taken.add(name);
    identifier.set(id, name);
    say(
      `${node.text ?? id}: its id ${id} is no KAOSTools identifier, written as ${name}`,
      'info',
    );
  }
  const ref = (id: unknown) => identifier.get(String(id));

  // kaosres's (goal-controller#191): a resolution's Form, payload and Cost
  // as KAOSTools annotates a goal for an obstacle, on the goal it is about
  // (`except` on the anchor, the others on the countermeasure goal)
  const annotations = new Map<string, string[]>();
  for (const link of (json.links ?? []) as Json[]) {
    if (link.type !== KAOS_TYPES.resolution) continue;
    const goal = ref(link.source);
    const obstacle = ref(link.target);
    if (goal === undefined || obstacle === undefined) continue;
    // a link's customProperties are open (piStar keeps every key as read):
    // narrowed here to the texts of the keys kaosres gives a resolution
    const value = (
      key: 'Anchor' | 'Cost' | 'Form' | 'Condition' | 'Replaces',
    ): string => {
      const text: unknown = link.customProperties?.[key];
      return typeof text === 'string' ? text.trim() : '';
    };
    const annotate = (on: string, line: string) =>
      annotations.set(on, [...(annotations.get(on) ?? []), line]);
    const what = `${goal} resolves ${obstacle}`;
    const written = value('Form');
    const form = isForm(written) ? written : null;
    if (written && !form)
      say(`${what}: KAOSTools has no form ${written}, not written`);
    else if (form === 'except') {
      const anchor = ref(value('Anchor'));
      if (anchor === undefined)
        say(`${what}: an except needs its Anchor, not written`);
      else annotate(value('Anchor'), `except [${obstacle}] ${goal}`);
    } else if (form === 'replaces') {
      const replaced = ref(value('Replaces'));
      if (replaced === undefined)
        say(`${what}: replaces needs the goal it Replaces, not written`);
      else annotate(String(link.source), `replaces [${obstacle}] ${replaced}`);
    } else if (form) {
      const word = ANNOTATIONS[form];
      const condition = value('Condition');
      if (!condition) say(`${what}: ${form} needs its Condition, not written`);
      else if (isFormula(condition))
        annotate(String(link.source), `${word} [${obstacle}] ${condition}`);
      else {
        annotate(
          String(link.source),
          `${word} [${obstacle}] ${quoted(condition)}`,
        );
        say(
          `${what}: its Condition is no KAOSTools formula, written as a string (KAOSTools won't read it)`,
        );
      }
    }
    const cost = value('Cost');
    if (cost && /^\d+(?:\.\d+)?$|^\.\d+$/.test(cost))
      annotate(String(link.source), `cost [${obstacle}] ${cost}`);
    else if (cost) say(`${what}: its Cost ${cost} is no number, not written`);
  }

  // what each element is the target of, in the model's order
  const refinements = new Map<string, Json[]>();
  const binary = new Map<string, Json[]>();
  const conflicts: Json[] = [];
  const push = (map: Map<string, Json[]>, key: string, link: Json) =>
    map.set(key, [...(map.get(key) ?? []), link]);
  for (const link of (json.links ?? []) as Json[]) {
    if (link.hub) {
      const target = link.end?.target;
      if (ref(target) === undefined)
        say(
          `a refinement of ${target}: it refines no element .kaos declares, not written`,
        );
      else push(refinements, String(target), link);
    } else if (
      link.type === KAOS_TYPES.obstruction ||
      link.type === KAOS_TYPES.resolution ||
      link.type === KAOS_TYPES.assignment
    ) {
      if (ref(link.source) === undefined || ref(link.target) === undefined)
        say(
          `${link.type} ${link.source} → ${link.target}: an end .kaos doesn't declare, not written`,
        );
      else push(binary, String(link.target), link);
    } else if (link.type === KAOS_TYPES.conflict) {
      if (ref(link.source) === undefined || ref(link.target) === undefined)
        say(
          `${link.type} ${link.source} → ${link.target}: an end .kaos doesn't declare, not written`,
        );
      else conflicts.push(link);
    } else
      say(
        `${link.type} ${link.source} → ${link.target}: no .kaos attribute for it, not written`,
      );
  }

  const lines: string[] = [
    `@title ${quoted(String(json.diagram?.name ?? modelName))}`,
  ];
  // kaosexpert's resources (goal-controller#190, #199)
  const expertFiles = resourceValues(projectResources.expert) as ExpertsFile[];
  const calibrationFiles = resourceValues(
    projectResources.calibration,
  ) as CalibrationsFile[];
  const evidenceFiles = resourceValues(
    projectResources.evidence,
  ) as EvidenceFile[];
  for (const file of expertFiles)
    if (typeof file?.quantiles === 'string')
      lines.push(`@experts.quantiles ${quoted(file.quantiles)}`);
  for (const node of nodes) {
    const id = String(node.id);
    const name = ref(id)!;
    const type = String(node.type);
    const props = (node.customProperties ?? {}) as Record<string, unknown>;
    const text = (key: string) => {
      const value = props[key];
      return typeof value === 'string' ? value : '';
    };
    const word =
      type === KAOS_TYPES.domainProperty && text('Kind') === 'hypothesis'
        ? 'domainhypothesis'
        : WORDS[type]!;
    if (
      type === KAOS_TYPES.domainProperty &&
      text('Kind') !== 'hypothesis' &&
      text('Kind') !== 'invariant'
    )
      say(
        `${name}: its Kind is ${text('Kind') || 'unset'}, written as a domain property (an invariant)`,
        'info',
      );
    const body: string[] = [];
    if (String(node.text ?? '') !== name)
      body.push(`name ${quoted(String(node.text ?? ''))}`);
    if (text('Description'))
      body.push(`definition ${quoted(text('Description'))}`);
    if (
      text('FormalSpec') &&
      type !== KAOS_TYPES.agent &&
      type !== KAOS_TYPES.environmentAgent
    ) {
      if (isFormula(text('FormalSpec')))
        body.push(`formalspec ${text('FormalSpec')}`);
      else {
        body.push(`formalspec ${quoted(text('FormalSpec'))}`);
        say(
          `${name}: its FormalSpec is no KAOSTools formula, written as a string (KAOSTools won't read it)`,
        );
      }
    }
    if (type === KAOS_TYPES.environmentAgent) body.push('type environment');
    // ESR and Beta are distributions too (goal-controller#199, HASE'11's
    // P(G) and β; no per-expert form, unlike an obstacle's Probability)
    const DISTRIBUTION_KEYS = ['Probability', 'ESR', 'Beta'];
    const quantity = (key: string, attribute: string) => {
      const value = text(key).trim();
      if (!value) return;
      if (isNumber(value)) body.push(`${attribute} ${value}`);
      else if (DISTRIBUTION_KEYS.includes(key) && isEstimate(value))
        body.push(`${attribute} ${value}`);
      else say(`${name}: its ${key} ${value} is no number, not written`);
    };
    if (type === KAOS_TYPES.goal || type === KAOS_TYPES.softgoal) {
      quantity('RSR', 'rsr');
      quantity('ESR', 'esr');
    }
    if (type === KAOS_TYPES.obstacle || type === KAOS_TYPES.domainProperty)
      quantity('Probability', 'probability');
    if (type === KAOS_TYPES.obstacle) quantity('Beta', 'beta');
    // an expert's estimate: `probability[e1] (…)` (kaosexpert's, goal-controller#190)
    const keyed = (key: string) =>
      (type === KAOS_TYPES.obstacle || type === KAOS_TYPES.domainProperty) &&
      keyedKeyOf(key)?.key === 'Probability';
    for (const [key, value] of Object.entries(props)) {
      if (!keyed(key) || typeof value !== 'string' || !value.trim()) continue;
      const expert = keyedKeyOf(key)!.name;
      if (isEstimate(value))
        body.push(`probability[${expert}] ${value.trim()}`);
      else say(`${name}: its ${key} ${value} is no estimate, not written`);
    }
    // kaossim's (goal-controller#193): a goal's quantities, by name
    const simKey = (key: string) =>
      (type === KAOS_TYPES.goal || type === KAOS_TYPES.softgoal) &&
      isSimKey(keyedKeyOf(key)?.key ?? '');
    for (const [key, value] of Object.entries(props)) {
      if (!simKey(key) || typeof value !== 'string' || !value.trim()) continue;
      const { key: base, name: variable } = keyedKeyOf(key)!;
      const sim = base as SimKey;
      body.push(
        `${SIM_ATTRIBUTES[sim]} [${nameParam(variable)}] ${valueText(sim, value.trim())}`,
      );
    }
    for (const key of CUSTOM_KEYS[type] ?? [])
      if (
        text(key) &&
        !(
          key === 'Type' &&
          type === KAOS_TYPES.softgoal &&
          text(key) === 'softgoal'
        )
      )
        body.push(`$${key} ${quoted(text(key))}`);
    for (const [key, value] of Object.entries(props))
      if (
        value !== '' &&
        !keyed(key) &&
        !simKey(key) &&
        !(WRITTEN[type] ?? []).includes(key) &&
        !(CUSTOM_KEYS[type] ?? []).includes(key)
      )
        say(`${name}: its ${key} has no .kaos attribute, not written`);

    for (const link of refinements.get(id) ?? []) {
      const hub = (link.hub ?? {}) as Json;
      const hubProps = (hub.customProperties ?? {}) as Record<string, unknown>;
      const obstacle = hub.type === KAOS_TYPES.obstacleRefinementHub;
      let pattern = '';
      const params = obstacle ? [] : simParams(hubProps);
      for (const [key, value] of Object.entries(hubProps)) {
        if (value === '' || value === undefined) continue;
        if (
          !obstacle &&
          (key === 'SysRef' || EQUATION_KEYS.has(keyedKeyOf(key)?.key ?? ''))
        )
          continue;
        if (key === 'Tactic' && !obstacle) {
          const tactic = String(value);
          const written = TACTIC_PATTERNS[tactic] ?? tactic;
          if (!KAOSTOOLS_TACTICS[written])
            say(
              `${name}: KAOSTools has no refinement pattern ${tactic}, written as it is`,
              'info',
            );
          pattern = isKaosIdentifier(written) ? written : quoted(written);
        } else
          say(
            `${name}: a refinement's ${key} has no .kaos attribute, not written`,
          );
      }
      const refinees = ((link.starts ?? []) as Json[]).flatMap((leg) => {
        const child = ref(leg.source);
        if (child === undefined) {
          say(
            `${name}: its refinement's ${leg.source} is no element .kaos declares, not written`,
          );
          return [];
        }
        const p = String(leg.customProperties?.Probability ?? '').trim();
        if (p && !isNumber(p))
          say(
            `${name}: ${child}'s leg Probability ${p} is no number, not written`,
          );
        return [p && isNumber(p) ? `${child} [${p}]` : child];
      });
      // the pattern first, kaossim's parameters after it
      const all = [...(pattern ? [pattern] : []), ...params];
      if (params.length)
        say(
          `${name}: a refinement's SysRef and equations written as parameters KAOSTools doesn't read (only goal-controller does)`,
          'info',
        );
      if (refinees.length)
        body.push(
          `refinedby${all.length ? ` [${all.join(', ')}]` : ''} ${refinees.join(', ')}`,
        );
    }
    for (const link of binary.get(id) ?? []) {
      const source = ref(link.source)!;
      const linkProps = (link.customProperties ?? {}) as Record<
        string,
        unknown
      >;
      if (link.type === KAOS_TYPES.obstruction) {
        const p = String(linkProps.Probability ?? '').trim();
        if (p && isNumber(p)) {
          body.push(`obstructedby ${source} [${p}]`);
          say(
            `${source} obstructs ${name} with a Probability KAOSTools doesn't read (only goal-controller does)`,
            'info',
          );
        } else {
          if (p)
            say(
              `${source} → ${name}: its Probability ${p} is no number, not written`,
            );
          body.push(`obstructedby ${source}`);
        }
      } else if (link.type === KAOS_TYPES.resolution) {
        const type = String(linkProps.ResolutionType ?? '');
        const anchor = String(linkProps.Anchor ?? '');
        const pattern = RESOLUTION_PATTERNS[type] ?? type;
        if (pattern && !KAOSTOOLS_RESOLUTIONS[pattern])
          say(
            `${source} resolves ${name}: KAOSTools has no resolution pattern ${type}, written as it is`,
            'info',
          );
        const anchorName = anchor ? (ref(anchor) ?? anchor) : '';
        const anchored = anchorName && isKaosIdentifier(anchorName);
        if (anchorName && !anchored)
          say(
            `${source} resolves ${name}: its Anchor ${anchor} is no identifier, not written`,
          );
        const p = pattern
          ? isKaosIdentifier(pattern)
            ? pattern
            : quoted(pattern)
          : '';
        body.push(
          `resolvedby${p ? ` [${p}${anchored ? `:${anchorName}` : ''}]` : ''} ${source}`,
        );
      } else {
        const params = simParams(linkProps);
        if (params.length)
          say(
            `${name} assigned to ${source}: its SysRef and estimates written as parameters KAOSTools doesn't read (only goal-controller does)`,
            'info',
          );
        body.push(
          `assignedto${params.length ? ` [${params.join(', ')}]` : ''} ${source}`,
        );
      }
    }
    body.push(...(annotations.get(id) ?? []));
    lines.push(
      '',
      `declare ${word} [ ${name} ]`,
      ...body.map((l) => `  ${l}`),
      'end',
    );
  }
  for (const link of conflicts) {
    const [a, b] = [ref(link.source)!, ref(link.target)!];
    const base = identifierOf(`${a} conflicts ${b}`, 'goal');
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
    taken.add(id);
    // open, as a resolution's: DSM3's one key on a Conflict, narrowed here
    const condition: unknown = link.customProperties?.BoundaryCondition;
    const boundary = typeof condition === 'string' ? condition.trim() : '';
    if (boundary)
      say(
        `the conflict between ${a} and ${b}: KAOSTools has no attribute for its BoundaryCondition, not written`,
      );
    lines.push(
      '',
      `declare constraint [ ${id} ]`,
      `  conflict ${a}, ${b}`,
      'end',
    );
  }
  for (const file of expertFiles)
    for (const expert of Array.isArray(file?.experts) ? file.experts : [])
      lines.push(
        '',
        `declare expert [ ${expert.id} ]`,
        ...(expert.name !== undefined ? [`  name ${quoted(expert.name)}`] : []),
        ...(expert.kept ?? []).map((line) => `  ${line}`),
        'end',
      );
  for (const file of calibrationFiles)
    for (const calibration of Array.isArray(file?.calibrations)
      ? file.calibrations
      : [])
      lines.push(
        '',
        `declare calibration${calibration.id ? ` [ ${calibration.id} ]` : ''}`,
        ...(calibration.name !== undefined
          ? [`  name ${quoted(calibration.name)}`]
          : []),
        ...(calibration.value !== undefined
          ? [`  probability ${calibration.value}`]
          : []),
        ...Object.entries(calibration.estimates ?? {}).map(
          ([expert, estimate]) => `  probability[${expert}] ${estimate}`,
        ),
        ...(calibration.kept ?? []).map((line) => `  ${line}`),
        'end',
      );
  // kaosexpert's evidence items (goal-controller#199): declared after the
  // experts and calibration variables, an Evidence key names one by its id
  for (const file of evidenceFiles)
    for (const item of Array.isArray(file?.evidence) ? file.evidence : [])
      lines.push(
        '',
        `declare evidence [ ${item.id} ]`,
        ...(item.name !== undefined ? [`  name ${quoted(item.name)}`] : []),
        ...(item.kind !== undefined ? [`  kind ${quoted(item.kind)}`] : []),
        ...(item.kept ?? []).map((line) => `  ${line}`),
        'end',
      );
  // kaossim's designs (goal-controller#193): after the evidence items
  const designFiles = resourceValues(projectResources.design) as DesignsFile[];
  for (const file of designFiles)
    for (const design of Array.isArray(file?.designs) ? file.designs : [])
      lines.push(
        '',
        `declare design [ ${design.id} ]`,
        ...(design.name !== undefined ? [`  name ${quoted(design.name)}`] : []),
        ...(design.options ?? []).map((o) => `  option ${quoted(o)}`),
        ...Object.entries(design.set ?? {}).map(
          ([v, text]) => `  set [${nameParam(v)}] ${quoted(text)}`,
        ),
        ...(design.source !== undefined
          ? [`  source ${quoted(design.source)}`]
          : []),
        ...(design.kept ?? []).map((line) => `  ${line}`),
        'end',
      );
  const kept = json.diagram?.customProperties?.[KAOS_UNSUPPORTED_KEY];
  if (typeof kept === 'string' && kept) lines.push('', kept);
  return { text: `${lines.join('\n')}\n`, diagnostics };
};
