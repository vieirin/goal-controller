/**
 * KAOSTools' textual KAOS (`.kaos`, goal-controller#181), a format the goal
 * language serves: its grammar (./kaos.langium, generated into ./generated,
 * apart from the goal grammar's), made a language with `defineLanguage`
 * (services of its own on this package's Langium). `kaosLanguage` is a
 * native file's language (the `.kaos` tab's highlighting and completions);
 * `parseKaos` reads a text into the AST lib's importer maps to a model; the
 * helpers read what the AST keeps in its CST, so a reader needs no Langium
 * of its own.
 */
import { CstUtils, GrammarUtils, type AstNode } from 'langium';
import type { NativeDiagnostic } from '@goal-controller/dialect';
import { defineLanguage } from '../language.js';
import type { Declaration, KaosFile } from './generated/ast.js';
import * as generated from './generated/module.js';

export const kaosLanguage = defineLanguage<KaosFile>(generated, {
  terminals: { NUMBER: 'number', MODEL_ATTRIBUTE: 'keyword' },
});

/** A `.kaos` text's AST (references by name, as written) and its syntax errors, with where. */
export const parseKaos = (
  text: string,
): { ast: KaosFile; diagnostics: NativeDiagnostic[] } =>
  kaosLanguage.parse(text);

/** Where a node is in the text read. */
export type KaosRange = { from: number; to: number };

/** A node's text as the file has it. */
export const kaosSourceOf = (node: AstNode): string =>
  node.$cstNode?.text ?? '';

/** A node's range; none for a node the parser made up. */
export const kaosRangeOf = (node: AstNode): KaosRange | undefined =>
  node.$cstNode
    ? { from: node.$cstNode.offset, to: node.$cstNode.end }
    : undefined;

/** A declaration's first words (`declare goal`), for a diagnostic's range. */
export const kaosHeadRangeOf = (
  declaration: Declaration,
): KaosRange | undefined => {
  const kind = GrammarUtils.findNodeForProperty(declaration.$cstNode, 'kind');
  return kind && declaration.$cstNode
    ? { from: declaration.$cstNode.offset, to: kind.end }
    : kaosRangeOf(declaration);
};

/** A formula's tokens joined by one space where the file had any (a space, a line break, a comment). */
export const kaosFormulaText = (node: AstNode): string => {
  const leaves = node.$cstNode
    ? [...CstUtils.flattenCst(node.$cstNode)].filter((leaf) => !leaf.hidden)
    : [];
  return leaves
    .map((leaf, i) =>
      i > 0 && leaf.offset > leaves[i - 1]!.end ? ` ${leaf.text}` : leaf.text,
    )
    .join('');
};

export type {
  Atom as KaosAtom,
  Attribute as KaosAttribute,
  Declaration as KaosDeclaration,
  KaosFile,
  Value as KaosValue,
} from './generated/ast.js';
