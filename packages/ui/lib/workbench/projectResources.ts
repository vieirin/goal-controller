/**
 * A project's resources in the workbench (goal-controller#25): the
 * declarations of a model's dialect, its resources parsed by the engine's
 * library, what they give the language (symbols and the engine's data, by
 * kind), and what is wrong with them (Problems' Model group, by the
 * resource's label; the resource's own tab underlines the range).
 */
import type {
  ProjectResourceContext,
  ProjectResourceDefinition,
} from '@goal-controller/dialect';
import type {
  ParsedResource,
  ProjectResourceParser,
  ResourceDiagnostic,
} from '@goal-controller/lib';
import type { ProjectResourceDeclarations, ResourceSlot } from '../project';
import { isTransformEngine, type TransformEngine } from '../types';
import {
  ENGINE_DIALECTS,
  ENGINE_PROJECT_RESOURCES,
  isDialectEngine,
} from './engineDialects';
import type { Problem } from './types';

/** The project resources a mode reads (an engine's definition's; none for the others). */
export const declarationsOf = (
  mode: string | null,
): ProjectResourceDeclarations | undefined =>
  isTransformEngine(mode) && isDialectEngine(mode)
    ? (
        ENGINE_DIALECTS[mode] as {
          projectResources?: ProjectResourceDeclarations;
        }
      ).projectResources
    : undefined;

/** A resource's files, as the workbench holds their text. */
export type ResourceTexts = Readonly<Record<string, string>>;

export type ParsedResources = Readonly<Record<string, ParsedResource>>;

/** Every present slot parsed with the engine's parser (none for an engine without resources). */
export const parseResources = (
  engine: TransformEngine,
  slots: readonly ResourceSlot[],
  texts: ResourceTexts,
): ParsedResources => {
  if (!isDialectEngine(engine)) return {};
  // by kind: the slots are the definition's kinds, each of which has its parser
  const parsers = ENGINE_PROJECT_RESOURCES[engine] as Readonly<
    Record<string, ProjectResourceParser>
  >;
  const parsed: Record<string, ParsedResource> = {};
  for (const slot of slots) {
    const parse = parsers[slot.kind];
    const files = slot.paths.flatMap((path) =>
      texts[path] === undefined ? [] : [{ path, text: texts[path]! }],
    );
    if (parse && files.length) parsed[slot.kind] = parse(files);
  }
  return parsed;
};

/** What the language gets of the parsed resources: symbols and data, by kind. */
export const resourcesContext = (
  parsed: ParsedResources,
): Record<string, ProjectResourceContext> =>
  Object.fromEntries(
    Object.entries(parsed).map(([kind, { symbols, data }]) => [
      kind,
      { symbols, data },
    ]),
  );

const lineColumn = (text: string, offset: number) => {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  return { line, column: offset - before.lastIndexOf('\n') };
};

/** A resource diagnostic as a problem: the resource's label is its source, its file and line in the message. */
export const resourceProblems = (
  parsed: ParsedResources,
  declarations: ProjectResourceDeclarations,
  texts: ResourceTexts,
): Problem[] =>
  Object.entries(parsed).flatMap(([kind, { diagnostics }]) => {
    const definition: ProjectResourceDefinition | undefined =
      declarations[kind];
    return diagnostics.map((diagnostic: ResourceDiagnostic) => {
      const { line, column } = lineColumn(
        texts[diagnostic.path] ?? '',
        diagnostic.from,
      );
      return {
        severity: diagnostic.severity,
        source: definition?.label ?? kind,
        message: `${diagnostic.path.split('/').pop()}:${line}:${column}: ${diagnostic.message}`,
        line,
        column,
      };
    });
  });

/** A slot's tab: one per file of a present resource. */
export const resourceTabId = (path: string): `resource:${string}` =>
  `resource:${path}`;
