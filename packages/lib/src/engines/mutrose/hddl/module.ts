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
import type { HddlAstType } from './generated/ast';
import {
  HddlGeneratedModule,
  HddlGeneratedSharedModule,
} from './generated/module';

/** HDDL's services: `$ast` (a type, never set) says which AST they parse. */
export type HddlServices = LangiumCoreServices & {
  readonly $ast?: HddlAstType;
};

let services: HddlServices | undefined;
/** The parser services (no LSP), created on first use. */
export const hddlServices = (): HddlServices => {
  if (services) return services;
  const shared = inject(
    createDefaultSharedCoreModule(EmptyFileSystem),
    HddlGeneratedSharedModule,
  );
  services = inject(createDefaultCoreModule({ shared }), HddlGeneratedModule);
  shared.ServiceRegistry.register(services);
  return services;
};
