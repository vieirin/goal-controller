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

/**
 * `transform`'s options, minus the text: the worker reads its own mirror's.
 * `requestId` lets the main thread match a `transformed` response back to
 * the call that asked for it, and drop one that arrives superseded or for a
 * session it no longer belongs to (goal-controller#432 review).
 */
export type TransformRequestOptions = Omit<TransformOptions, 'modelJson'> & {
  readonly requestId: number;
};

/**
 * `modelSignature`: the content signature (`signature.ts`'s `modelSignature`)
 * of the model the worker actually transformed, echoed back so the main
 * thread can label the resulting `Run` with what it was *really* generated
 * from, not the signature it had when it asked (goal-controller#432 review).
 * `null` only when the worker never reached the mirror (no model to sign).
 */
export type TransformOutcome = {
  requestId: number;
  modelSignature: string | null;
} & (
  | { ok: true; files: EngineOutputFile[]; report: LoggerReport | null }
  | { ok: false; error: string }
);

/** Sent once, with the mirror's `MessagePort` transferred alongside it. */
export type EngineWorkerConnect = {
  readonly type: 'connect';
  /**
   * The model's root metamodel, by `rootMetamodelOf(model).name`
   * (`dialects.ts`, goal-controller#467): a `Metamodel` object can't cross
   * `postMessage` (its link rules are functions), so the worker looks this
   * up itself (`metamodelByName`) to build its mirror with the same choice
   * the main thread made.
   */
  readonly metamodelName: string;
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
      readonly options: TransformRequestOptions;
    }
  | {
      /** a liveness probe: the worker answers `pong` as soon as it's free */
      readonly type: 'ping';
      readonly id: number;
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
      readonly outcome: TransformOutcome;
    }
  | {
      readonly type: 'pong';
      readonly id: number;
    };
