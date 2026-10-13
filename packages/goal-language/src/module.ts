import {
  createDefaultCoreModule,
  createLangiumParser,
  createDefaultSharedCoreModule,
  EmptyFileSystem,
  inject,
  type AstNode,
  type LangiumCoreServices,
  type LangiumSharedCoreServices,
  type Module,
  type ParseResult,
  type PartialLangiumCoreServices,
} from 'langium';
import {
  GoalGeneratedModule,
  GoalGeneratedSharedModule,
} from './generated/module.js';
import { GoalLexer, type LexerStart } from './lexer.js';

export type GoalCoreServices = LangiumCoreServices;

/**
 * The lexer is GoalLexer (token sets by where it is in a line); the parser
 * tells it the start of the rule it parses with, so `parse(text, { rule })`
 * is all a reader calls (the definition pool's `langium(…)` does).
 */
export const GoalCoreModule: Module<
  GoalCoreServices,
  PartialLangiumCoreServices
> = {
  parser: {
    Lexer: (services) => new GoalLexer(services),
    LangiumParser: (services) => {
      const parser = createLangiumParser(services);
      const parse = parser.parse.bind(parser);
      parser.parse = (text, options) => {
        const start = options?.rule && START_OF_RULE.get(options.rule);
        if (start) (services.parser.Lexer as GoalLexer).start = start;
        return parse(text, options);
      };
      return parser;
    },
  },
};

/** Parser services (no LSP): for the engines, the editors and the tests. */
export const createGoalCoreServices = (): {
  shared: LangiumSharedCoreServices;
  Goal: GoalCoreServices;
} => {
  const shared = inject(
    createDefaultSharedCoreModule(EmptyFileSystem),
    GoalGeneratedSharedModule,
  );
  const Goal = inject(
    createDefaultCoreModule({ shared }),
    GoalGeneratedModule,
    GoalCoreModule,
  );
  shared.ServiceRegistry.register(Goal);
  return { shared, Goal };
};

/** The grammar rule each lexer start parses. */
export const START_RULE: Record<LexerStart, string> = {
  document: 'Document',
  plainDocument: 'PlainDocument',
  elementLine: 'ElementLine',
  annotatedName: 'AnnotatedName',
  assertion: 'AssertionValue',
  int: 'IntValue',
  number: 'NumberValue',
  bool: 'BoolValue',
  text: 'TextValue',
  enum: 'EnumValue',
  ocl: 'OclValue',
  refList: 'RefListValue',
  pairList: 'PairListValue',
};

const START_OF_RULE = new Map(
  Object.entries(START_RULE).map(([start, rule]) => [
    rule,
    start as LexerStart,
  ]),
);

/** Parses a text with the rule of a lexer start, synchronously, without linking. */
export const parseWith = <T extends AstNode>(
  services: GoalCoreServices,
  start: LexerStart,
  text: string,
): ParseResult<T> =>
  services.parser.LangiumParser.parse<T>(text, { rule: START_RULE[start] });
