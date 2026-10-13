/**
 * The parsers an engine picks from, and only these: JSON, XML and YAML
 * (each a tree with its offsets), the goal model, and a Langium language.
 */
import type { LangiumGrammar, LangiumOptions, Parser } from '../protocol';
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

const parser = <P extends object>(name: string, rest: P) =>
  ({ name, ...rest }) as unknown as Parser & P;

export const json = parser('json', { tree: parseJson });
export const xml = parser('xml', { tree: parseXmlTree });
export const yaml = parser('yaml', { tree: parseYaml });
/** The project's goal model: its elements, each field a document of its own. */
export const goalModel = parser('goalModel', {});

/** A Langium language's documents (or, with `written`, values). */
export const langium = (
  grammar: LangiumGrammar,
  options: LangiumOptions = {},
): Parser => parser('langium', { grammar, options });

export const isTreeParser = (p: Parser): p is TreeParser => 'tree' in p;
export const isLangium = (p: Parser): p is LangiumParser =>
  p.name === 'langium';
