import {
  createDefaultCoreModule,
  createLangiumParser,
  createDefaultSharedCoreModule,
  EmptyFileSystem,
  inject,
  type AstNode,
  type LangiumCoreServices,
  type Module,
  type ParseResult,
  type PartialLangiumCoreServices,
} from 'langium';
import type { MutRoSeAstType } from './generated/ast';
import {
  MutRoSeGeneratedModule,
  MutRoSeGeneratedSharedModule,
} from './generated/module';
import { MutroseLexer, type MutroseStart } from './lexer';

/** The grammar rule each lexer start parses. */
const START_RULE: Record<MutroseStart, string> = {
  expression: 'OclExpression',
  variables: 'OclVariables',
  names: 'Names',
  robotNumber: 'RobotNumber',
  creationCondition: 'CreationCondition',
  forAll: 'ForAllShape',
  select: 'SelectShape',
  type: 'VariableType',
};
const START_OF_RULE = new Map(
  Object.entries(START_RULE).map(([start, rule]) => [
    rule,
    start as MutroseStart,
  ]),
);

/**
 * The lexer is MutroseLexer (a token set for each value); the parser tells
 * it the start of the rule it parses with, so `parse(text, { rule })` is
 * all a reader calls.
 */
const MutroseModule: Module<LangiumCoreServices, PartialLangiumCoreServices> = {
  parser: {
    Lexer: (services) => new MutroseLexer(services),
    LangiumParser: (services) => {
      const parser = createLangiumParser(services);
      const parse = parser.parse.bind(parser);
      parser.parse = (text, options) => {
        (services.parser.Lexer as MutroseLexer).start =
          START_OF_RULE.get(options?.rule ?? '') ?? 'expression';
        return parse(text, options);
      };
      return parser;
    },
  },
};

/** MutRoSe's services: `$ast` (a type, never set) says which AST they parse. */
export type MutroseServices = LangiumCoreServices & {
  readonly $ast?: MutRoSeAstType;
};

let services: MutroseServices | undefined;
/** The parser services (no LSP), created on first use: MutRoSe's language for the pool's `langium(…)`. */
export const mutroseServices = (): MutroseServices => {
  if (services) return services;
  const shared = inject(
    createDefaultSharedCoreModule(EmptyFileSystem),
    MutRoSeGeneratedSharedModule,
  );
  services = inject(
    createDefaultCoreModule({ shared }),
    MutRoSeGeneratedModule,
    MutroseModule,
  );
  shared.ServiceRegistry.register(services);
  return services;
};

/** Parses a value with the rule of a lexer start, synchronously, without linking. */
export const parseWith = <T extends AstNode>(
  start: MutroseStart,
  text: string,
): ParseResult<T> => {
  return mutroseServices().parser.LangiumParser.parse<T>(text, {
    rule: START_RULE[start],
  });
};
