/**
 * The annotations typed by an engine's kinds and messages, so that a kind
 * or a message key completes and a misspelt one doesn't compile:
 *
 *   const KINDS = { 'toy.thing': { label: 'thing' } } as const;
 *   const MESSAGES = { 'toy.noThing': '{name} is no thing' } as const;
 *   const { defines, refersTo } = annotationsFor(KINDS, MESSAGES);
 *
 * The same functions as protocol.ts's, with narrower types: nothing changes
 * at run time.
 */
import { langium } from './parsers';
import {
  defines,
  link,
  refersTo,
  scope,
  written,
  type Annotated,
  type DefinesOptions,
  type LangiumGrammar,
  type LangiumOptions,
  type Parser,
  type Path,
  type RefersToOptions,
  type Scope,
  type UntypedAst,
} from './protocol';

export type TypedAnnotations<
  K extends string,
  M extends string,
  L extends string = string,
> = {
  defines: (kind: K, options?: DefinesOptions) => Annotated;
  refersTo: (
    kinds: K | readonly K[],
    where?: Scope,
    options?: RefersToOptions<M>,
  ) => Annotated;
  link: (name: L, options?: { from?: Path }) => Annotated;
  /** the scopes, `through` by the engine's links (or the built-in `type`) */
  scope: {
    owner: (path: Path) => Scope;
    through: (link: L | 'type', path: Path) => Scope;
    previous: (first: Path) => Path;
  };
  written: typeof written;
  langium: <A extends object = UntypedAst>(
    grammar: LangiumGrammar<A>,
    options?: LangiumOptions<K, NoInfer<A>>,
  ) => Parser;
};

/**
 * The annotations of an engine whose kinds are `K` and whose messages' keys
 * are `M`: given as type arguments, or inferred from the kinds and messages
 * themselves (only their keys are read, and only by the type checker).
 */
export const annotationsFor = <
  K extends string,
  M extends string = string,
  L extends string = string,
>(
  _kinds?: Readonly<Record<K, unknown>>,
  _messages?: Readonly<Record<M, unknown>>,
  _links?: readonly L[],
): TypedAnnotations<K, M, L> => ({
  defines,
  refersTo,
  link,
  scope,
  written,
  // the same function: its options typed by the engine's kinds
  langium: langium as TypedAnnotations<K, M, L>['langium'],
});
