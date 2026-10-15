/**
 * A dialect's own textual language over Langium (goal-controller#143): an
 * engine ships a `.langium` grammar under `engines/<engine>/language/`, with
 * its `langium-config.json` (`build:lib` runs `langium generate` for each,
 * scripts/langium-generate.mjs), and `defineLanguage` turns the generated
 * module into what a native file needs: `parse` (its reader maps the AST to
 * the model), `highlight` for its tab, and `complete`. Each language has
 * services of its own, apart from the goal language's and every other's.
 *
 * The goal language's Langium runs it (`@goal-controller/goal-language/formats`;
 * its CommonJS bundle requires the package's one Langium copy), with
 * services of the language's own: the goal language's grammar is untouched.
 */
import {
  AstUtils,
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  CstUtils,
  EmptyFileSystem,
  GrammarAST,
  inject,
  type AstNode,
  type LangiumCoreServices,
  type LangiumGeneratedCoreServices,
  type LangiumGeneratedSharedCoreServices,
  type LangiumSharedCoreServices,
  type LanguageMetaData,
  type Module,
  type PartialLangiumCoreServices,
} from 'langium';
import type {
  NativeCompletion,
  NativeDiagnostic,
  NativeHighlight,
  NativeHighlightKind,
  NativeLanguage,
} from '@goal-controller/dialect';

/** What `langium generate` writes in `generated/module.ts`, as `import * as generated` reads it. */
export type GeneratedLanguageModule = Readonly<Record<string, unknown>>;

export type LanguageOptions = {
  /** the language's id, when the module generates several (its `langium-config.json`'s `languages[].id`) */
  language?: string;
  /** a module of the dialect's own on top of the generated one (a lexer, value converters) */
  module?: Module<LangiumCoreServices, PartialLangiumCoreServices>;
  /**
   * How a terminal rule's tokens are highlighted, by its name, where the
   * default isn't it: a rule returning a number is `number`, one named like
   * `STRING` is `string`, any other `name`
   */
  terminals?: Readonly<Record<string, NativeHighlightKind>>;
};

/** A dialect's language: a native file's `language`, and the parser its reader reads with. */
export type Language<A extends AstNode = AstNode> = NativeLanguage & {
  /** its Langium services (parser only), created on first use */
  services: () => LangiumCoreServices;
  /** a text's AST (Langium's, with `$cstNode`s; references unlinked, `$refText` names them), and its syntax errors */
  parse: (text: string) => { ast: A; diagnostics: NativeDiagnostic[] };
};

/** The one export of the generated module whose name ends so, or the language's. */
const pick = <T>(
  generated: GeneratedLanguageModule,
  suffix: string,
  prefix: string | undefined,
): T => {
  const names = Object.keys(generated).filter(
    (name) =>
      name.endsWith(suffix) &&
      (prefix === undefined || name === prefix + suffix),
  );
  if (names.length !== 1)
    throw new Error(
      names.length
        ? `defineLanguage: the module generates ${names.join(', ')}; say which language`
        : `defineLanguage: no ${prefix ?? ''}${suffix} in the generated module`,
    );
  return generated[names[0]!] as T;
};

/**
 * A language from its generated module (`import * as generated from
 * './generated/module'`): its parser, its highlighting from the grammar
 * (keywords, terminals, what is a definition's name and what a reference),
 * its completions (keywords and the names the text defines).
 */
export const defineLanguage = <A extends AstNode = AstNode>(
  generated: GeneratedLanguageModule,
  { language, module, terminals = {} }: LanguageOptions = {},
): Language<A> => {
  // the generated names start with the language's name, as the config spells it
  const metaData = Object.entries(generated).find(
    ([name, value]) =>
      name.endsWith('LanguageMetaData') &&
      (language === undefined ||
        (value as LanguageMetaData).languageId === language),
  );
  if (!metaData)
    throw new Error(
      `defineLanguage: no ${language ?? ''} language metadata in the generated module`,
    );
  const prefix = metaData[0].slice(0, -'LanguageMetaData'.length);
  const { languageId, caseInsensitive } = metaData[1] as LanguageMetaData;
  const sharedModule = pick<
    Module<LangiumSharedCoreServices, LangiumGeneratedSharedCoreServices>
  >(generated, 'GeneratedSharedModule', undefined);
  const languageModule = pick<
    Module<LangiumCoreServices, LangiumGeneratedCoreServices>
  >(generated, 'GeneratedModule', prefix);

  let created: LangiumCoreServices | undefined;
  const services = (): LangiumCoreServices => {
    if (created) return created;
    const shared = inject(
      createDefaultSharedCoreModule(EmptyFileSystem),
      sharedModule,
    );
    created = module
      ? inject(createDefaultCoreModule({ shared }), languageModule, module)
      : inject(createDefaultCoreModule({ shared }), languageModule);
    shared.ServiceRegistry.register(created);
    return created;
  };

  // what the grammar says of its tokens: its keywords, its terminals' kinds
  let grammar:
    | { keywords: Set<string>; kinds: Map<string, NativeHighlightKind> }
    | undefined;
  const grammarOf = () => {
    if (grammar) return grammar;
    const rules = services().Grammar.rules;
    const keywords = new Set<string>();
    // a terminal rule's characters (`'a'..'z'`) are no keywords
    for (const rule of rules)
      if (!GrammarAST.isTerminalRule(rule))
        for (const node of AstUtils.streamAllContents(rule))
          if (GrammarAST.isKeyword(node)) keywords.add(node.value);
    const kinds = new Map<string, NativeHighlightKind>();
    for (const rule of rules)
      if (GrammarAST.isTerminalRule(rule))
        kinds.set(
          rule.name,
          terminals[rule.name] ??
            (rule.type?.name === 'number'
              ? 'number'
              : /string/i.test(rule.name)
                ? 'string'
                : 'name'),
        );
    grammar = { keywords, kinds };
    return grammar;
  };

  const parse = (text: string) => {
    const result = services().parser.LangiumParser.parse<A>(text);
    const diagnostics: NativeDiagnostic[] = [
      ...result.lexerErrors.map((error) => ({
        severity: 'error' as const,
        message: error.message,
        from: error.offset,
        to: error.offset + error.length,
      })),
      ...result.parserErrors.map((error) => {
        const from = Number.isNaN(error.token.startOffset)
          ? text.length
          : error.token.startOffset;
        const to = Number.isNaN(error.token.endOffset ?? NaN)
          ? text.length
          : error.token.endOffset! + 1;
        return { severity: 'error' as const, message: error.message, from, to };
      }),
    ];
    return { ast: result.value, diagnostics };
  };

  /** Each leaf the parser read: whether it is a definition's name or a reference, by offset. */
  const roles = (ast: AstNode | undefined) => {
    const found = new Map<number, NativeHighlightKind>();
    if (!ast?.$cstNode) return found;
    for (const leaf of CstUtils.flattenCst(ast.$cstNode)) {
      if (leaf.hidden) continue;
      const source = leaf.grammarSource;
      if (!source) continue;
      if (
        GrammarAST.isCrossReference(source) ||
        GrammarAST.isCrossReference(source.$container)
      )
        found.set(leaf.offset, 'reference');
      else {
        const assignment = containerAssignment(source);
        if (assignment?.feature === 'name' && !GrammarAST.isKeyword(source))
          found.set(leaf.offset, 'definition');
      }
    }
    return found;
  };

  const highlight = (text: string): NativeHighlight[] => {
    const { keywords, kinds } = grammarOf();
    const lexed = services().parser.Lexer.tokenize(text);
    const role = roles(parse(text).ast);
    const highlights: NativeHighlight[] = [];
    for (const token of lexed.tokens) {
      const from = token.startOffset;
      const to = from + token.image.length;
      const name = token.tokenType.name;
      const kind: NativeHighlightKind | undefined = keywords.has(name)
        ? /\w/.test(name)
          ? 'keyword'
          : 'punctuation'
        : (role.get(from) ?? kinds.get(name));
      if (kind) highlights.push({ from, to, kind });
    }
    for (const token of lexed.hidden)
      highlights.push({
        from: token.startOffset,
        to: token.startOffset + token.image.length,
        kind: 'comment',
      });
    return highlights.sort((a, b) => a.from - b.from);
  };

  const complete = (text: string, offset: number): NativeCompletion[] => {
    const { keywords } = grammarOf();
    const word = /[\p{L}\p{N}_-]*$/u.exec(text.slice(0, offset))![0];
    const fold = (value: string) =>
      caseInsensitive ? value.toLowerCase() : value;
    const starts = (label: string) =>
      label !== word && fold(label).startsWith(fold(word));
    const { ast } = parse(text);
    const names = new Set<string>();
    if (ast?.$cstNode)
      for (const leaf of CstUtils.flattenCst(ast.$cstNode)) {
        const source = leaf.grammarSource;
        if (
          source &&
          !leaf.hidden &&
          containerAssignment(source)?.feature === 'name' &&
          !GrammarAST.isCrossReference(source.$container) &&
          (leaf.offset > offset || leaf.end < offset - word.length)
        )
          names.add(leaf.text);
      }
    return [
      ...[...keywords]
        .filter((keyword) => /^\w/.test(keyword) && starts(keyword))
        .sort()
        .map((label) => ({ label, kind: 'keyword' as const })),
      ...[...names]
        .filter(starts)
        .sort()
        .map((label) => ({ label, kind: 'name' as const })),
    ];
  };

  return { id: languageId, services, parse, highlight, complete };
};

/** The assignment a grammar element is the value of (`name=ID`), if it is one's. */
const containerAssignment = (
  source: AstNode,
): GrammarAST.Assignment | undefined => {
  for (let node: AstNode | undefined = source; node; node = node.$container) {
    if (GrammarAST.isAssignment(node)) return node;
    if (GrammarAST.isAbstractRule(node)) return undefined;
  }
  return undefined;
};
