/**
 * Model namespace - Utilities for working with iStar models
 */
import { isActor, parsePistar, updateElement } from '@istar-ts/core';
import { readFileSync } from 'fs';
import { reduceModel, singleChildGoals } from './internal/reduce';
import { findActorRoot } from './internal/roots';
import type { Model as IStarModel } from './types/';

/**
 * Validate an iStar model: every actor must have exactly one root (resolved
 * from the link graph; see `findActorRoot`).
 *
 * @returns the model with each root marked by the `root: "true"` custom property
 * @throws Error if the model is invalid
 */
function validateModel(model: IStarModel): IStarModel {
  const actors = [...model.elements.values()].filter(isActor);

  let validated = model;
  for (const actor of actors) {
    const root = findActorRoot(model, actor.id);
    validated = updateElement(validated, root.id, {
      customProperties: { ...root.customProperties, root: 'true' },
    });
  }

  return validated;
}

/**
 * Parse an iStar model from JSON string
 */
function parseModel(json: string): IStarModel {
  let model: IStarModel;
  try {
    model = parsePistar(json);
  } catch (error) {
    throw new Error(
      `[INVALID_MODEL]: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return validateModel(model);
}

/**
 * Load an iStar model from a file
 */
function loadModel(filename: string): IStarModel {
  return parseModel(readFileSync(filename).toString());
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
