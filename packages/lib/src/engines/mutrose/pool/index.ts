/**
 * MutRoSe's definition pool (goal-controller#59, #82): its engine's
 * declaration (./engine.ts) as the pool an editor of a MutRoSe project
 * serves every tab from, and the names of the goal model's documents.
 */
import { poolOf } from '../../../pool';
import { mutrosePoolDeclaration } from './engine';

export { mutrosePoolDeclaration } from './engine';
export { OTHER_MODEL } from '../files/goalModel';

/** MutRoSe's pool. */
export const mutrosePool = poolOf(mutrosePoolDeclaration);

/** A model field's document id. */
export const modelDocument = (element: string, field: string) =>
  `model:${element}:${field}`;

/** The element and field of a model document id (null: not the model's). */
export const modelField = (
  document: string,
): { element: string; field: string } | null => {
  const match = /^model:(.*):([^:]*)$/.exec(document);
  return match ? { element: match[1]!, field: match[2]! } : null;
};
