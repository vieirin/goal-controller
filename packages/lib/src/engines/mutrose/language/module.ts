import {
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  EmptyFileSystem,
  inject,
  type AstNode,
  type LangiumCoreServices,
  type Module,
  type ParseResult,
  type PartialLangiumCoreServices,
} from 'langium';
import {
  MutRoSeGeneratedModule,
  MutRoSeGeneratedSharedModule,
} from './generated/module';
import { MutroseLexer, type MutroseStart } from './lexer';

/** The lexer is MutroseLexer (a token set for each value). */
const MutroseModule: Module<LangiumCoreServices, PartialLangiumCoreServices> = {
  parser: {
    Lexer: (services) => new MutroseLexer(services),
  },
};

let services: LangiumCoreServices | undefined;
/** The parser services (no LSP), created on first use. */
const mutroseServices = (): LangiumCoreServices => {
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

/** Parses a value with the rule of a lexer start, synchronously, without linking. */
export const parseWith = <T extends AstNode>(
  start: MutroseStart,
  text: string,
): ParseResult<T> => {
  const { parser } = mutroseServices();
  (parser.Lexer as MutroseLexer).start = start;
  return parser.LangiumParser.parse<T>(text, { rule: START_RULE[start] });
};
