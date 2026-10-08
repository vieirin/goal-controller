/// <reference lib="webworker" />
import { startRtWorkerServer } from '@goal-controller/rt-language/worker';
import { PROPERTY_SPECS } from './edgeProperties';

// the engine's property rules (its own checks), for the property lines and fields
const { goal, task, resource } = PROPERTY_SPECS.edgev2;

startRtWorkerServer(self as unknown as DedicatedWorkerGlobalScope, {
  rules: { goal, task, resource },
});
