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

/** Services shared by the engine parser and the language server. */
export const RtCoreModule: Module<
  LangiumCoreServices,
  PartialLangiumCoreServices
> = {
  parser: {
    Lexer: (services) => new RtLexer(services),
  },
};

/** Parser-only services (no LSP), for parsing goal names. */
export const createRtCoreServices = (): {
  shared: LangiumSharedCoreServices;
  RtNotation: LangiumCoreServices;
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
  return { shared, RtNotation };
};
