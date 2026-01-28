/**
 * Model namespace - Utilities for working with iStar models
 */
import { readFileSync } from 'fs';
import type { Model as IStarModel } from './types/';

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
          throw new Error('invalid number of roots, one allowed');
        }
        if (isRoot) {
          node.customProperties.root = 'true';
        }
        return isRoot || hasRoot;
      }, false),
    )
    .every((isValid) => isValid);

  if (!root) {
    throw new Error('invalid number of root, one allowed');
  }
}

/**
 * Load an iStar model from a file
 */
function loadModel(filename: string): IStarModel {
  const modelFile = readFileSync(filename);
  const model = JSON.parse(modelFile.toString()) as IStarModel;
  validateModel(model);
  return model;
}

/**
 * Parse an iStar model from JSON string
 */
function parseModel(json: string): IStarModel {
  const model = JSON.parse(json) as IStarModel;
  validateModel(model);
  return model;
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
