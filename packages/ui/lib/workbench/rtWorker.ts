/// <reference lib="webworker" />
import { startRtWorkerServer } from '@goal-controller/rt-language/worker';

startRtWorkerServer(self as unknown as DedicatedWorkerGlobalScope);
