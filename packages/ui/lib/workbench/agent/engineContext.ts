/**
 * Goal-controller's own context for M6's agent (goal-controller#415): the
 * active dialect/engine's type definitions, the goal language's notation
 * forms, and the active mode's own constraints, as `HostContextProvider`s
 * (`@istar-ts/actions`, #175) — opaque text to istar-ts, built from the
 * dialect's data, never hand-written per engine.
 */
import type { HostContextProvider } from '@istar-ts/actions';
import {
  ISTAR_ACTOR_KINDS,
  type AnyDialect,
  type PropertyDefinition,
  type ValueConfig,
} from '@goal-controller/dialect';
import type { ModelMode } from '@/lib/workbench/pistar';
import type { TransformEngine } from '@/lib/types';
import { dialectOf } from '@/lib/workbench/engineDialects';
import { guardsForMode } from '@/components/workbench/engines/modeGuards';

const describeValue = (value: ValueConfig): string => {
  switch (value.type) {
    case 'enum':
      return `one of: ${value.options.map((o) => o.value || '(unset)').join(', ')}${value.open ? ', or free text' : ''}`;
    case 'int':
    case 'number':
      return `a ${value.type}${value.min !== undefined ? `, min ${value.min}` : ''}${value.max !== undefined ? `, max ${value.max}` : ''}`;
    case 'text':
      return 'free text';
    case 'bool':
      return 'true or false';
    case 'assertion':
      return `a condition over ${value.resolves.join(', ')}`;
    case 'expression':
      return `a numeric expression${value.resolves ? ` over ${value.resolves.join(', ')}` : ''}`;
    case 'refList':
      return `ids of ${'kind' in value ? value.kind : value.kinds.join(' or ')}, comma-separated`;
    case 'pairList':
      return `name:value pairs, comma-separated (${value.value} values)`;
    case 'nameList':
      return 'names, comma-separated';
    case 'annotatedName':
      return 'a line without an id';
    case 'reference':
      return 'a name of its target';
    case 'formula':
      return `a ${value.language} formula`;
    case 'probability':
      return 'a probability (0.8, or 80%)';
    case 'distribution':
      return 'a probability distribution';
    case 'ocl':
      return 'an OCL expression';
  }
};

const describeProperty = (property: PropertyDefinition): string => {
  const value =
    'when' in property.value
      ? `${describeValue(property.value.matching)} (when ${property.value.when.key} = ${property.value.when.equals}), else ${describeValue(property.value.otherwise)}`
      : describeValue(property.value);
  return `  - ${property.key}: ${value} — ${property.help}`;
};

/** The type definitions of an engine's active dialect, as plain text (none: the dialect has no properties). */
export const typeDefinitionsText = (dialect: AnyDialect): string => {
  const sections: string[] = [];
  for (const [kind, properties] of Object.entries(dialect.properties)) {
    const element = dialect.elements[kind];
    const header = element?.prefix
      ? `${kind} (id prefix ${element.prefix})`
      : kind;
    sections.push(
      [header, ...properties.map(describeProperty)].join('\n') || header,
    );
  }
  for (const [kind, properties] of Object.entries(dialect.links ?? {})) {
    if (properties.length === 0) continue;
    sections.push(
      [`link ${kind}`, ...properties.map(describeProperty)].join('\n'),
    );
  }
  if (dialect.actors && dialect.actors.length > 0) {
    const actorKinds = ISTAR_ACTOR_KINDS.join(', ');
    sections.push(
      [`actor (${actorKinds})`, ...dialect.actors.map(describeProperty)].join(
        '\n',
      ),
    );
  }
  return sections.join('\n\n');
};

/** The goal language's generic forms, written once: never duplicated per dialect. */
const GENERIC_NOTATION_HELP = `An element's line is \`<Prefix><id>: Name\`, e.g. \`G1: Deliver sample\`. A
notation in brackets after the name (\`G1: Deliver sample [G2;G3]\`) says how G1's children
execute, with the dialect's own operators (below) between their ids. A property line, indented
under its element, is \`key value\` (e.g. \`priority high\`). A link with properties is written
\`link <id> {key = value, ...}\` under its source. An actor with properties is \`actor <id>
{key = value, ...}\` at the top of the document.`;

export const notationHelpText = (dialect: AnyDialect | null): string => {
  if (!dialect) return GENERIC_NOTATION_HELP;
  if (!dialect.notation) return GENERIC_NOTATION_HELP;
  const { operators, standalone, modifiers, constructs } = dialect.notation;
  const constructLines = Object.entries(operators).map(
    ([symbol, name]) =>
      `  ${symbol}  ${constructs[name]?.label ?? modifiers?.[name]?.label ?? name}: ${constructs[name]?.help ?? modifiers?.[name]?.help ?? ''}`,
  );
  const standaloneLines = Object.entries(standalone ?? {}).map(
    ([symbol, name]) =>
      `  [${symbol}]  ${constructs[name]?.label ?? name}: ${constructs[name]?.help ?? ''}`,
  );
  return [
    GENERIC_NOTATION_HELP,
    `This dialect's own operators (others are disabled, and reported if written):`,
    ...constructLines,
    ...standaloneLines,
  ].join('\n');
};

const engineConstraintsText = (mode: ModelMode): string | null => {
  const { describe } = guardsForMode(mode);
  if (describe.length === 0) return null;
  return describe.map((line) => `- ${line}`).join('\n');
};

/**
 * Goal-controller's context providers for the active engine/mode (#415):
 * the system prompt gets one section per provider, and (on backend A)
 * they're also served as the session's MCP resources.
 */
export const contextProvidersFor = (
  engine: TransformEngine,
  mode: ModelMode,
): HostContextProvider[] => {
  const dialect = dialectOf(engine);
  const providers: HostContextProvider[] = [];
  if (dialect) {
    providers.push({
      name: 'type-definitions',
      title: 'Element, link and actor properties',
      text: typeDefinitionsText(dialect),
      // the system prompt only: `list-types` and `notation-help` (hostTools.ts)
      // are the on-demand MCP tools, and share these names with the host tool
      // below, so these providers never become resources/tools of their own
      // (goal-controller#415, server-mcp's default dataMode: 'tools' would
      // otherwise register two tools of the same name).
      resource: false,
    });
    providers.push({
      name: 'notation-help',
      title: 'Goal notation',
      text: notationHelpText(dialect),
      resource: false,
    });
  }
  const constraints = engineConstraintsText(mode);
  if (constraints) {
    providers.push({
      name: 'engine-constraints',
      title: `${mode}'s own constraints`,
      text: constraints,
      resource: false,
    });
  }
  return providers;
};
