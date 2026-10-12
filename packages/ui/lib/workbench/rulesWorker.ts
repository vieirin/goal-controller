/// <reference lib="webworker" />
/**
 * The rules worker (goal-controller#75): Nemo's web build runs each engine's
 * rules off the page's thread. Each request carries a sequence number; the
 * answer carries it back, and the page keeps only the latest's.
 */
import init, * as nemo from 'nemo-wasm';
import {
  checkProject,
  type NemoModule,
  type RuleDiagnostic,
  type RuleProject,
} from '@goal-controller/lib';
import { ENGINE_RULES, type DialectEngine } from './engineDialects';

export type RulesRequest = {
  seq: number;
  engine: DialectEngine;
  project: RuleProject;
};
export type RulesAnswer =
  | { seq: number; diagnostics: RuleDiagnostic[]; ms: number }
  | { seq: number; error: string };

const ready = init();

self.onmessage = async ({ data }: MessageEvent<RulesRequest>) => {
  const { seq, engine, project } = data;
  try {
    await ready;
    const started = performance.now();
    const { diagnostics } = await checkProject(
      nemo as unknown as NemoModule,
      ENGINE_RULES[engine],
      project,
    );
    self.postMessage({
      seq,
      diagnostics,
      ms: performance.now() - started,
    } satisfies RulesAnswer);
  } catch (error) {
    self.postMessage({ seq, error: String(error) } satisfies RulesAnswer);
  }
};
