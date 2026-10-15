/**
 * iStarDT-X (`.istardt`, `.istardtx`) into goal-controller
 * (goal-controller#119): the one actor's model as a piStar model in the
 * iStar-DT dialect, laid out (the file has no diagram), and the file's
 * options as the engine's. One way: no export back to iStarDT-X
 * (packages/dialect/docs/importers.md).
 */
import type { ImportResult } from '../types';
import { toPistar } from './pistar';
import { readIstardtDocument } from './read';

/** An iStarDT-X text as an iStar-DT model; null with error diagnostics when it isn't one. */
export const importIstardt = (
  text: string,
  { modelName }: { modelName?: string } = {},
): ImportResult => {
  const { document, diagnostics } = readIstardtDocument(text);
  if (!document) return { model: null, dialectRecord: null, diagnostics };
  const model = toPistar(document, diagnostics, modelName);
  const options: Record<string, boolean | number> = {};
  if (document.options.continuous !== undefined)
    options.continuous = document.options.continuous.trim() === 'true';
  const penalty = Number(document.options.infeasibleActionPenalty);
  if (
    document.options.infeasibleActionPenalty !== undefined &&
    Number.isFinite(penalty)
  )
    options.infeasibleActionPenalty = penalty;
  return {
    model,
    dialectRecord: { engine: 'istardt', projectResources: {}, options },
    diagnostics,
  };
};

export { readIstardtDocument, type IstardtDocument } from './read';
export { assertionText, expressionText } from './pistar';
