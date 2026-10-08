import {
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
import { RtLexer } from './lexer.js';
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
