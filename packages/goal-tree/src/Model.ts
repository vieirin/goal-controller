/**
 * Model namespace - Utilities for working with iStar models
 */
import {
  isActorIn,
  metamodelOf,
  parsePistar,
  updateElement,
} from '@istar-ts/core';
import { readFileSync } from 'fs';
import { reduceModel, singleChildGoals } from './internal/reduce';
import {
  actorRoots,
  modelShapeProblem,
  type RootReading,
} from './internal/roots';
import type { Model as IStarModel } from './types/';

/**
 * Validate an iStar model: it must have the shape `dialect`'s engine reads
 * (its `model`, by default one actor with one root goal; goal-controller#125),
 * its roots resolved from the link graph as `dialect` reads it (`actorRoots`).
 *
 * @returns the model with each root marked by the `root: "true"` custom property
 * @throws Error if the model is outside the shape (`modelShapeProblem`)
 */
function validateModel<EK extends string, LK extends string>(
  model: IStarModel<EK, LK>,
  dialect?: RootReading,
): IStarModel<EK, LK> {
  const problem = modelShapeProblem(model, dialect);
  if (problem) throw new Error(`[INVALID_MODEL]: ${problem}`);

  let validated = model;
  for (const actor of [...model.elements.values()].filter(
    isActorIn(metamodelOf(model)),
  ))
    for (const root of actorRoots(model, actor.id, dialect))
      validated = updateElement(validated, root.id, {
        customProperties: { ...root.customProperties, root: 'true' },
      });

  return validated;
}

/**
 * Parse an iStar model from JSON string
 */
function parseModel(json: string, dialect?: RootReading): IStarModel {
  let model: IStarModel;
  try {
    model = parsePistar(json);
  } catch (error) {
    throw new Error(
      `[INVALID_MODEL]: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return validateModel(model, dialect);
}

/**
 * Load an iStar model from a file
 */
function loadModel(filename: string, dialect?: RootReading): IStarModel {
  return parseModel(readFileSync(filename).toString(), dialect);
}

/**
 * Model namespace containing utilities for iStar models
 */
export const Model = {
  /**
   * Load an iStar model from a file path
   */
  load: loadModel,

  /**
   * Parse an iStar model from JSON string
   */
  parse: parseModel,

  /**
   * Validate an iStar model, returning it with its roots marked
   * @throws Error if the model is invalid
   */
  validate: validateModel,

  /**
   * piStar ids of the goals with a single child (AND/OR refinements) and a parent
   */
  singleChildGoals,

  /**
   * Remove the single-child goals, refining each one's child into the first ancestor
   * with more than one child (or the root). Returns the reduced model and the removed ids.
   */
  reduce: reduceModel,
} as const;

// Export type for the namespace
export type ModelNamespace = typeof Model;
