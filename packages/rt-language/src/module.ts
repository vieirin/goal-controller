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
import type { DependsOnValue } from './generated/ast.js';
import { RtLexer } from './lexer.js';
import { PROPERTY_MODES, type RtPropertyKey } from './properties.js';
import { RtContext } from './context.js';
import { registerRtValidationChecks, RtValidator } from './validator.js';

export type RtAddedServices = {
  context: { Context: RtContext };
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
  context: {
    Context: () => new RtContext(),
  },
  validation: {
    RtValidator: (services) => {
      const validator = new RtValidator(services.context.Context);
      validator.dependsOnOf = (value) =>
        value
          ? parseValue<DependsOnValue>(
              services,
              'dependsOn',
              value,
            ).value.ids.map((id) => id.name)
          : [];
      return validator;
    },
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
