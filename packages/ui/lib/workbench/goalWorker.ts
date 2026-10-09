/// <reference lib="webworker" />
/**
 * The goal language server's worker: the server is dialect-agnostic (each
 * document's dialect comes in `goal/context`); this host gives it the
 * engines' named checks, by their definitions' ids, so it reports what the
 * local support does.
 */
import {
  startGoalWorkerServer,
  type CheckRegistries,
} from '@goal-controller/goal-language/worker';
import { ENGINE_CHECKS, ENGINE_DIALECTS } from './engineDialects';

// by dialect id: the server reads each document's dialect at run time
const checks: CheckRegistries = Object.fromEntries(
  (Object.keys(ENGINE_DIALECTS) as (keyof typeof ENGINE_DIALECTS)[]).map(
    (engine) => [ENGINE_DIALECTS[engine].id, ENGINE_CHECKS[engine]],
  ),
);

startGoalWorkerServer(self as unknown as DedicatedWorkerGlobalScope, {
  checks,
});
