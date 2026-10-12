/**
 * Each engine's pool: the providers it registers. These would live with the
 * engines (`lib/src/engines/<engine>/pool.ts`); the spike keeps them here so
 * nothing in the engines changes. A provider is a value, registered by as
 * many engines as speak its files (HDDL by MutRoSe, and by any engine after).
 */
import type { AnyDialect } from '@goal-controller/dialect';
import { definePool, type PoolSetup } from './core/pool';
import { hddlProviderWith } from './providers/hddl';
import { modelProvider } from './providers/model';
import { mutroseProvider } from './providers/mutrose';
import { variablesProvider } from './providers/variables';
import { worldProvider } from './providers/world';

export const mutrosePool = (definition: AnyDialect): PoolSetup =>
  definePool('mutrose', [
    modelProvider({ definition, taskNames: true }),
    worldProvider,
    // MutRoSe's domains use types they don't list (`?r - robot`)
    hddlProviderWith({ typesByUse: true }),
    mutroseProvider,
  ]);

/** Edge and edgeV2: variables declared, and typed, by variables.json. */
export const edgePool = (definition: AnyDialect): PoolSetup =>
  definePool(definition.id, [
    modelProvider({ definition, variables: { kind: 'edge.variable' } }),
    variablesProvider,
  ]);

/** GODA: variables declared by their first use, typed by every use. */
export const godaPool = (definition: AnyDialect): PoolSetup =>
  definePool('goda', [modelProvider({ definition, variables: 'uses' })]);

/** The pool of an engine (by its definition's id), if the spike has one. */
export const poolFor = (definition: AnyDialect): PoolSetup | null =>
  definition.id === 'mutrose'
    ? mutrosePool(definition)
    : definition.id === 'edge' || definition.id === 'edgeV2'
      ? edgePool(definition)
      : definition.id === 'goda'
        ? godaPool(definition)
        : null;
