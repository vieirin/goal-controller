/**
 * Model namespace - Utilities for working with iStar models
 */
import {
  childrenOf,
  isActor,
  parsePistar,
  updateElement,
} from '@istar-ts/core';
import { readFileSync } from 'fs';
import type { Model as IStarModel } from './types/';

/**
 * Validate an iStar model: every actor must have exactly one root (a node with
 * no outgoing links, not counting qualities and the elements they qualify).
 *
 * @returns the model with each root marked by the `root: "true"` custom property
 * @throws Error if the model is invalid
 */
function validateModel(model: IStarModel): IStarModel {
  const links = [...model.links.values()];
  const actors = [...model.elements.values()].filter(isActor);

  let validated = model;
  for (const actor of actors) {
    const nodes = childrenOf(model, actor.id);
    let hasRoot = false;
    for (const node of nodes) {
      // Exclude Quality nodes from root check
      if (node.kind === 'istar.Quality') {
        continue;
      }
      // Also exclude nodes that are targets of QualificationLinks
      const isQualifiedByQuality = links.some(
        (link) =>
          link.kind === 'istar.QualificationLink' &&
          link.target === node.id &&
          nodes.find((n) => n.id === link.source)?.kind === 'istar.Quality',
      );
      if (isQualifiedByQuality) {
        continue;
      }

      // A root has no outgoing links
      if (links.some((link) => link.source === node.id)) {
        continue;
      }
      if (hasRoot) {
        throw new Error(
          '[INVALID_MODEL]: Invalid number of roots, one allowed',
        );
      }
      hasRoot = true;
      validated = updateElement(validated, node.id, {
        customProperties: { ...node.customProperties, root: 'true' },
      });
    }

    if (!hasRoot) {
      throw new Error('[INVALID_MODEL]: Invalid number of roots, one allowed');
    }
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
} as const;

// Export type for the namespace
export type ModelNamespace = typeof Model;
