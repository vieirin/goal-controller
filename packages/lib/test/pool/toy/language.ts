/**
 * The toy's Langium language (toy.langium, generated with langium-cli):
 * what an engine ships when a format needs a grammar of its own.
 */
import {
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  EmptyFileSystem,
  inject,
  type LangiumCoreServices,
} from 'langium';
import type { ToyAstType } from './generated/ast';
import {
  ToyGeneratedModule,
  ToyGeneratedSharedModule,
} from './generated/module';

const shared = inject(
  createDefaultSharedCoreModule(EmptyFileSystem),
  ToyGeneratedSharedModule,
);
/**
 * Its services, saying which AST they parse (for the type checker only:
 * the pool's `langium(…)` infers it, so its options are checked by it)
 */
export type ToyServices = LangiumCoreServices & { readonly $ast?: ToyAstType };

const services = inject(
  createDefaultCoreModule({ shared }),
  ToyGeneratedModule,
);
shared.ServiceRegistry.register(services);
export const toyLanguage: ToyServices = services;
