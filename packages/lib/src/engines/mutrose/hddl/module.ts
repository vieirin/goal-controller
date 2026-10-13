/**
 * HDDL's language (./hddl.langium): its parser services, for the pool's
 * `langium(…)`.
 */
import {
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  EmptyFileSystem,
  inject,
  type LangiumCoreServices,
} from 'langium';
import {
  HddlGeneratedModule,
  HddlGeneratedSharedModule,
} from './generated/module';

let services: LangiumCoreServices | undefined;
/** The parser services (no LSP), created on first use. */
export const hddlServices = (): LangiumCoreServices => {
  if (services) return services;
  const shared = inject(
    createDefaultSharedCoreModule(EmptyFileSystem),
    HddlGeneratedSharedModule,
  );
  services = inject(createDefaultCoreModule({ shared }), HddlGeneratedModule);
  shared.ServiceRegistry.register(services);
  return services;
};
