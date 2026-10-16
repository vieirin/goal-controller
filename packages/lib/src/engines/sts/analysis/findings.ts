/**
 * The analyses' findings (goal-controller#161 item 2), in the framework's
 * shape (`AnalysisFinding`, #162): a kind, a severity, a message, the
 * piStar ids of the elements (and actors) and links involved, the one it
 * is about first, and its own facts in `details`, which the oracle
 * compares.
 */
import type { AnalysisFinding } from '../../analysis';

export type StsFinding = AnalysisFinding;

/** A finding, its element and link ids each once, in the order given. */
export const finding = (
  kind: string,
  severity: AnalysisFinding['severity'],
  message: string,
  elements: readonly string[],
  links: readonly string[],
  details?: Readonly<Record<string, string>>,
): StsFinding => ({
  kind,
  severity,
  message,
  elements: [...new Set(elements)],
  links: [...new Set(links)],
  ...(details && { details }),
});
