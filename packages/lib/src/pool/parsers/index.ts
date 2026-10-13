/**
 * The parsers an engine picks from, and only these: JSON, XML and YAML
 * (each a tree with its offsets), the goal model, and a Langium language.
 */
import type {
  GoalModelOptions,
  LangiumGrammar,
  LangiumOptions,
  Parser,
  UntypedAst,
} from '../protocol';
import type { Parsed } from '../read';
import { parseJson } from './json';
import { parseXmlTree } from './xml';
import { parseYaml } from './yaml';

/** A parser to a tree with offsets (jsonc-parser's `Node`). */
export type TreeParser = Parser & { tree: (text: string) => Parsed };
export type LangiumParser = Parser & {
  grammar: LangiumGrammar;
  options: LangiumOptions;
};
export type GoalModelParser = Parser & { options: GoalModelOptions };

const parser = <P extends object>(name: string, rest: P) =>
  ({ name, ...rest }) as unknown as Parser & P;

export const json = parser('json', { tree: parseJson });
export const xml = parser('xml', { tree: parseXmlTree });
export const yaml = parser('yaml', { tree: parseYaml });
/**
 * The project's goal model: its elements, each field a document of its own,
 * with their place in the tree (and, given `children`, what each one's
 * notation names among its children).
 */
export const goalModel = (options: GoalModelOptions = {}): Parser =>
  parser('goalModel', { options });

/**
 * A Langium language's documents (or, with `written`, values), typed by its
 * AST types when given (`langium<ToyAstType>(…)`).
 */
export const langium = <
  A extends object = UntypedAst,
  K extends string = string,
>(
  grammar: LangiumGrammar<A>,
  options: LangiumOptions<K, NoInfer<A>> = {},
): Parser => parser('langium', { grammar, options: options as LangiumOptions });

export const isTreeParser = (p: Parser): p is TreeParser => 'tree' in p;
export const isLangium = (p: Parser): p is LangiumParser =>
  p.name === 'langium';
export const isGoalModel = (p: Parser): p is GoalModelParser =>
  p.name === 'goalModel';
