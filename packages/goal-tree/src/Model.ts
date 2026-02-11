/**
 * Model namespace - Utilities for working with iStar models
 */
import { readFileSync } from 'fs';
import type { Model as IStarModel } from './types/';

/**
 * Type guard to check if a value is a valid Model structure.
 */
export function isModel(value: unknown): value is IStarModel {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Check for required properties using 'in' operator
  if (!('actors' in value) || !('links' in value)) {
    return false;
  }

  // After 'in' checks, we can safely access these properties
  // TypeScript narrows to { actors: unknown; links: unknown }
  return Array.isArray(value.actors) && Array.isArray(value.links);
}

/**
 * Validate an iStar model
 * @throws Error if the model is invalid
 */
function validateModel(model: IStarModel): void {
  const root = model.actors
    .map((item) =>
      item.nodes.reduce((hasRoot, node) => {
        // Exclude Quality nodes from root check
        if (node.type === 'istar.Quality') {
          return hasRoot;
        }
        // Check if this node has outgoing links
        const isRoot = !model.links.find((link) => link.source === node.id);
        // Also exclude nodes that are targets of QualificationLinks
        const isQualifiedByQuality = model.links.some((link) => {
          if (link.type !== 'istar.QualificationLink') return false;
          if (link.target !== node.id) return false;
          const sourceNode = item.nodes.find((n) => n.id === link.source);
          return sourceNode?.type === 'istar.Quality';
        });

        if (isQualifiedByQuality) {
          return hasRoot;
        }

        if (isRoot && hasRoot) {
          throw new Error(
            '[INVALID_MODEL]: Invalid number of roots, one allowed',
          );
        }
        if (isRoot) {
          node.customProperties.root = 'true';
        }
        return isRoot || hasRoot;
      }, false),
    )
    .every((isValid) => isValid);

  if (!root) {
    throw new Error('[INVALID_MODEL]: Invalid number of roots, one allowed');
  }
}

/**
 * Load an iStar model from a file
 */
function loadModel(filename: string): IStarModel {
  const modelFile = readFileSync(filename);
  const parsed: unknown = JSON.parse(modelFile.toString());

  if (!isModel(parsed)) {
    throw new Error('[INVALID_MODEL]: Missing or invalid actors or links');
  }

  validateModel(parsed);
  return parsed;
}

/**
 * Parse an iStar model from JSON string
 */
function parseModel(json: string): IStarModel {
  const parsed: unknown = JSON.parse(json);

  if (!isModel(parsed)) {
    throw new Error('[INVALID_MODEL]: Missing or invalid actors or links');
  }

  validateModel(parsed);
  return parsed;
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
   * Validate an iStar model
   * @throws Error if the model is invalid
   */
  validate: validateModel,
} as const;

// Export type for the namespace
export type ModelNamespace = typeof Model;
