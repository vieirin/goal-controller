/**
 * The toy's Langium language (toy.langium, generated with langium-cli):
 * what an engine ships when a format needs a grammar of its own.
 */
import {
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  EmptyFileSystem,
  inject,
} from 'langium';
import {
  ToyGeneratedModule,
  ToyGeneratedSharedModule,
} from './generated/module';

const shared = inject(
  createDefaultSharedCoreModule(EmptyFileSystem),
  ToyGeneratedSharedModule,
);
export const toyLanguage = inject(
  createDefaultCoreModule({ shared }),
  ToyGeneratedModule,
);
shared.ServiceRegistry.register(toyLanguage);
