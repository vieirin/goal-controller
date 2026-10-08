import { inject, type Module } from 'langium';
import {
  createDefaultModule,
  createDefaultSharedModule,
  type DefaultSharedModuleContext,
  type LangiumServices,
  type LangiumSharedServices,
  type PartialLangiumServices,
} from 'langium/lsp';
import {
  RtNotationGeneratedModule,
  RtNotationGeneratedSharedModule,
} from './generated/module.js';
import { RtCoreModule } from './module.js';

/** Language-server services (validation, completion, hover) on top of the core ones. */
export const RtLspModule: Module<LangiumServices, PartialLangiumServices> = {};

export const createRtServices = (
  context: DefaultSharedModuleContext,
): { shared: LangiumSharedServices; RtNotation: LangiumServices } => {
  const shared = inject(
    createDefaultSharedModule(context),
    RtNotationGeneratedSharedModule,
  );
  const RtNotation = inject(
    createDefaultModule({ shared }),
    RtNotationGeneratedModule,
    RtCoreModule,
    RtLspModule,
  );
  shared.ServiceRegistry.register(RtNotation);
  return { shared, RtNotation };
};
