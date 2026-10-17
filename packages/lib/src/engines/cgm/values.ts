/**
 * A contextual goal model's properties as its dialect reads them
 * (goal-controller#187): a task's cost a number, a context's formula, a
 * statement's support, an activation and a link's contexts their
 * assertions, an intersection's amount a number. The analyses, the DLV
 * writer and the checks read these, never the texts; a value written with
 * an error is unset (the dialect's checks report it).
 */
import { viewValues, type ViewValues } from '../analysis';
import { cgm } from './definition';

export type CgmValues = ViewValues<typeof cgm>;

/** An element's properties as written (an analysis element's, a check's), and its kind (piStar's or the dialect's). */
type Item = {
  kind: string;
  properties: Readonly<Partial<Record<string, string>>>;
};

/** An element's properties, read as its kind's in the dialect. */
export const elementValues = (element: Item): CgmValues =>
  viewValues(cgm, 'element', element);

/** A link's properties, read as its kind's (a key its kind doesn't declare is none of them). */
export const linkValues = (link: Item): CgmValues =>
  viewValues(cgm, 'link', link);
