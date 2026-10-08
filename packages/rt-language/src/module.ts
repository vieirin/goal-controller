import {
  type AstNode,
  type ParseResult,
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  EmptyFileSystem,
  inject,
  type LangiumCoreServices,
  type LangiumSharedCoreServices,
  type Module,
  type PartialLangiumCoreServices,
} from 'langium';
import {
  RtNotationGeneratedModule,
  RtNotationGeneratedSharedModule,
} from './generated/module.js';
import { PROPERTY_MODES, RtLexer, type RtPropertyKey } from './lexer.js';
import { RtStructure } from './structure.js';
import { registerRtValidationChecks, RtValidator } from './validator.js';

export type RtAddedServices = {
  structure: { Structure: RtStructure };
  validation: { RtValidator: RtValidator };
};

export type RtCoreServices = LangiumCoreServices & RtAddedServices;

/** Services shared by the engine parser and the language server. */
export const RtCoreModule: Module<
  RtCoreServices,
  PartialLangiumCoreServices & RtAddedServices
> = {
  parser: {
    Lexer: (services) => new RtLexer(services),
  },
  structure: {
    Structure: () => new RtStructure(),
  },
  validation: {
    RtValidator: (services) => new RtValidator(services.structure.Structure),
  },
};

/** Parser and validator services (no LSP), for parsing goal names and tests. */
export const createRtCoreServices = (): {
  shared: LangiumSharedCoreServices;
  RtNotation: RtCoreServices;
} => {
  const shared = inject(
    createDefaultSharedCoreModule(EmptyFileSystem),
    RtNotationGeneratedSharedModule,
  );
  const RtNotation = inject(
    createDefaultCoreModule({ shared }),
    RtNotationGeneratedModule,
    RtCoreModule,
  );
  shared.ServiceRegistry.register(RtNotation);
  registerRtValidationChecks(RtNotation);
  return { shared, RtNotation };
};

/** The rule that reads one value of each lexer mode on its own. */
const VALUE_RULE = {
  assertion: 'AssertionValue',
  dependsOn: 'DependsOnValue',
  value: 'RawValue',
} as const;

/** Parses one property value on its own (an inspector field, the engine). */
export const parseValue = <T extends AstNode>(
  services: LangiumCoreServices,
  key: RtPropertyKey,
  text: string,
): ParseResult<T> => {
  const mode = PROPERTY_MODES[key];
  (services.parser.Lexer as RtLexer).startMode = mode;
  return services.parser.LangiumParser.parse<T>(text, {
    rule: VALUE_RULE[mode],
  });
};
