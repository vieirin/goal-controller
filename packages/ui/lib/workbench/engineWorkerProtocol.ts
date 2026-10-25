/**
 * The typed message union between the main thread and the engine worker
 * (goal-controller#413): everything that crosses `postMessage` outside the
 * action-protocol port (that one carries the mirror's `connectDispatcher`
 * traffic; this one carries the worker's own requests and results).
 */
import type { EngineOutputFile, LoggerReport } from '@goal-controller/lib';
import type { TransformOptions } from '@/services/transform';
import type { TransformEngine } from '@/lib/types';
import type { AnalyzeResponse } from './types';

/** `transform`'s options, minus the text: the worker reads its own mirror's. */
export type TransformRequestOptions = Omit<TransformOptions, 'modelJson'>;

export type TransformOutcome =
  | { ok: true; files: EngineOutputFile[]; report: LoggerReport | null }
  | { ok: false; error: string };

/** Sent once, with the mirror's `MessagePort` transferred alongside it. */
export type EngineWorkerConnect = {
  readonly type: 'connect';
};

/** Main thread → worker. */
export type EngineWorkerRequest =
  | EngineWorkerConnect
  | {
      readonly type: 'configure';
      readonly engine: TransformEngine;
      /** piStar mode has no engine to analyse or generate for */
      readonly pistar: boolean;
    }
  | {
      readonly type: 'transform';
      readonly requestId: number;
      readonly options: TransformRequestOptions;
    };

/** Worker → main thread. */
export type EngineWorkerResponse =
  | {
      readonly type: 'analyzed';
      readonly key: string;
      readonly data: AnalyzeResponse;
    }
  | {
      readonly type: 'analyzeFailed';
      readonly key: string;
      readonly message: string;
    }
  | {
      readonly type: 'transformed';
      readonly requestId: number;
      readonly outcome: TransformOutcome;
    };
