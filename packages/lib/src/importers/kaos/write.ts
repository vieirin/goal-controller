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
 * - What the reader kept as written (`kaosUnsupported`) at the end, as it
 *   was.
 * - Not written, and said: a refinement's `SysRef` and `Status`, an
 *   obstacle refinement's `Probability`, a conflict, a key no dialect
 *   declares; nor positions (`KAOS_LOSSY`).
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
  ExpertsFile,
} from '../../engines/kaosexpert/resources';
import { kaosLanguage } from '@goal-controller/goal-language/formats';
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

  // what each element is the target of, in the model's order
  const refinements = new Map<string, Json[]>();
  const binary = new Map<string, Json[]>();
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
    } else
      say(
        `${link.type} ${link.source} → ${link.target}: no .kaos attribute for it, not written`,
      );
  }

  const lines: string[] = [
    `@title ${quoted(String(json.diagram?.name ?? modelName))}`,
  ];
  // kaosexpert's resources (goal-controller#190)
  const expertFiles = resourceValues(projectResources.expert) as ExpertsFile[];
  const calibrationFiles = resourceValues(
    projectResources.calibration,
  ) as CalibrationsFile[];
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
        !(WRITTEN[type] ?? []).includes(key) &&
        !(CUSTOM_KEYS[type] ?? []).includes(key)
      )
        say(`${name}: its ${key} has no .kaos attribute, not written`);

    for (const link of refinements.get(id) ?? []) {
      const hub = (link.hub ?? {}) as Json;
      const hubProps = (hub.customProperties ?? {}) as Record<string, unknown>;
      const obstacle = hub.type === KAOS_TYPES.obstacleRefinementHub;
      let pattern = '';
      for (const [key, value] of Object.entries(hubProps)) {
        if (value === '' || value === undefined) continue;
        if (key === 'Tactic' && !obstacle) {
          const tactic = String(value);
          const written = TACTIC_PATTERNS[tactic] ?? tactic;
          if (!KAOSTOOLS_TACTICS[written])
            say(
              `${name}: KAOSTools has no refinement pattern ${tactic}, written as it is`,
              'info',
            );
          pattern = ` [${isKaosIdentifier(written) ? written : quoted(written)}]`;
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
      if (refinees.length)
        body.push(`refinedby${pattern} ${refinees.join(', ')}`);
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
      } else body.push(`assignedto ${source}`);
    }
    lines.push(
      '',
      `declare ${word} [ ${name} ]`,
      ...body.map((l) => `  ${l}`),
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
  const kept = json.diagram?.customProperties?.[KAOS_UNSUPPORTED_KEY];
  if (typeof kept === 'string' && kept) lines.push('', kept);
  return { text: `${lines.join('\n')}\n`, diagnostics };
};
