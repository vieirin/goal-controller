/**
 * What a model's Notation text is checked against, and the check itself, as
 * the Notation editor runs it (goal-controller#415): the model's elements,
 * the workbench's context variables and the project's resources, parsed (a
 * MutRoSe world), with the engine's named checks and its grammar's word on
 * the saved lines. The editor, the Problems panel and the agent's
 * `validate-notation` all go through these, so they report the same.
 */
import type {
  AnyDialect,
  DefinitionContext,
  DocumentNode,
  DocumentTree,
} from '@goal-controller/dialect';
import { contextFromView, nodeLine } from './document.js';
import {
  documentDiagnostics,
  type Diagnostic,
  type RunCheck,
} from './diagnostics.js';
import { checkContextOf, type NamedCheck } from './checks.js';

/** A model's view, its nodes with what the engine's grammar said of their saved line (goal-tree's `GoalView` is one). */
export type NotationTree = Omit<DocumentTree, 'nodes'> & {
  nodes: ReadonlyMap<string, DocumentNode & { notationError?: string | null }>;
};

/** What the grammar said of each saved element line, by key: its error shows while the line still reads as saved. */
export type SavedLines = Readonly<
  Record<string, { line: string; error: string | null }>
>;

/** A workbench variable: only `context` ones are what an assertion may read besides resources. */
export type NotationVariable = { kind: string; name: string };

/** What the Notation editor checks a model's text against. */
export type NotationInputs = {
  tree: NotationTree;
  variables: readonly NotationVariable[];
  /** the project's resources, parsed: what checks that read them (a MutRoSe world) need */
  projectResources?: DefinitionContext['projectResources'];
};

/** The engine's named checks, by the names its dialect's properties give them. */
export type NamedChecks = Readonly<Record<string, NamedCheck | undefined>>;

/** The context a model's text is checked against: its elements, the context variables' names and the project's resources. */
export const notationContextOf = (
  definition: AnyDialect,
  { tree, variables, projectResources }: NotationInputs,
): DefinitionContext => ({
  ...contextFromView(
    definition,
    tree,
    variables.filter((v) => v.kind === 'context').map((v) => v.name),
  ),
  ...(projectResources &&
    Object.keys(projectResources).length > 0 && { projectResources }),
});

/** What the engine's grammar said of each saved element line. */
export const savedLinesOf = (
  definition: Pick<AnyDialect, 'elements'>,
  tree: NotationTree,
): SavedLines =>
  Object.fromEntries(
    [...tree.nodes.entries()].map(([key, node]) => [
      key,
      { line: nodeLine(definition, node), error: node.notationError ?? null },
    ]),
  );

/** The named checks, run against the context `model` gives when they run. */
export const runCheckIn =
  (checks: NamedChecks, model: () => DefinitionContext): RunCheck =>
  (name, input, self) =>
    checks[name]?.(input, checkContextOf(model(), self)) ?? null;

/**
 * A model's Notation text's diagnostics, exactly as the Notation editor
 * reports them for the same model, variables and project resources.
 */
export const validateNotation = (
  definition: AnyDialect,
  text: string,
  inputs: NotationInputs,
  checks: NamedChecks = {},
): Diagnostic[] => {
  const context = notationContextOf(definition, inputs);
  return documentDiagnostics(definition, text, context, {
    runCheck: runCheckIn(checks, () => context),
    saved: savedLinesOf(definition, inputs.tree),
  });
};
