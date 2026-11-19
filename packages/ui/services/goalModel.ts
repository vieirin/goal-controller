import { Model, type RootReading } from '@goal-controller/goal-tree';
import { parsePistar, type IstarModel } from '@istar-ts/core';
import type { Framework } from '@goal-controller/dialect';
import { recordedMode } from '../lib/project';
import { declaresKinds } from '../lib/workbench/dialects';
import { FRAMEWORK_ROOTS, frameworkOfModel } from '../lib/workbench/frameworks';
import { runOf, type AnyModel, type Engine } from '@goal-controller/lib';

export interface ParseError {
  success: false;
  error: string;
  stage: 'parse' | 'validate' | 'tree';
}

export interface ParseOptions {
  /** remove the single-child goals before validating (see goal-tree's `Model.reduce`) */
  reduce?: boolean;
  /** the framework it is read in (goal-controller#171); by default, the model's (frameworkOfModel) */
  framework?: Framework;
}

/** A model parsed and read as an engine reads it (its tree, its IR, or the model as parsed). */
export type ParseModelResult<TReading> =
  | { success: true; model: AnyModel; reading: TReading }
  | ParseError;

/**
 * Goal model - handles parsing, validation, and tree conversion operations
 */
export const GoalModel = {
  /**
   * Parse and validate model, returning the raw model (no tree); its roots
   * are read as `dialect` reads them (GODA leaves unlinked Resources out)
   */
  parseModel(
    modelJson: string,
    options: ParseOptions = {},
    dialect?: RootReading,
  ): { success: true; model: AnyModel } | ParseError {
    // Parse the piStar file
    let model: AnyModel;
    try {
      // an engine whose models declare kinds of their own reads its block,
      // as does any model of another framework (goal-controller#194)
      const mode = recordedMode(modelJson);
      const framework = options.framework ?? frameworkOfModel(modelJson);
      // another framework's kinds are the IR's to read (#171, PR D)
      model = parsePistar(modelJson, {
        metamodel: FRAMEWORK_ROOTS[framework],
        fileMetamodel: declaresKinds(mode, framework),
      });
    } catch (error) {
      return {
        success: false,
        error: `Invalid model: ${error instanceof Error ? error.message : 'Unknown parse error'}`,
        stage: 'parse',
      };
    }

    if (options.reduce) model = Model.reduce(model).model;

    // Validate model (marks the root of each actor)
    try {
      model = Model.validate(model, dialect);
    } catch (error) {
      return {
        success: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown validation error'}`,
        stage: 'validate',
      };
    }

    return { success: true, model };
  },

  /**
   * A model as an engine reads it (its `run`, lib's `runOf`): as parsed, for
   * one that reads a graph; else validated, its roots as its mapper's dialect
   * reads them, and made into the engine's reading (its mapper's tree, or
   * its own IR), a failure there being the engine's.
   */
  parseFor(
    engine: Engine,
    modelJson: string,
    options: ParseOptions = {},
  ): ParseModelResult<unknown> {
    const run = runOf(engine);
    if (run.reads === 'graph') {
      const graph = this.parseAsGraph(modelJson);
      return graph.success
        ? { success: true, model: graph.model, reading: graph.model }
        : graph;
    }
    const parseResult = this.parseModel(
      modelJson,
      options,
      engine.mapper.dialect,
    );
    if (!parseResult.success) return parseResult;
    try {
      return { ...parseResult, reading: run.read(parseResult.model) };
    } catch (error) {
      return {
        success: false,
        error: `Tree conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'tree',
      };
    }
  },

  /**
   * A model read as a graph (an analysis engine's, GRL's; iStar-DT's writer):
   * parsed in its framework (goal-controller#171) with the kinds its block
   * declares, without a root or a tree.
   */
  parseAsGraph(
    modelJson: string,
  ):
    | { success: true; tree: null; model: IstarModel<string, string> }
    | ParseError {
    try {
      const model = parsePistar(modelJson, {
        metamodel: FRAMEWORK_ROOTS[frameworkOfModel(modelJson)],
        fileMetamodel: true,
      });
      return { success: true, tree: null, model };
    } catch (error) {
      return {
        success: false,
        error: `Invalid model: ${error instanceof Error ? error.message : 'Unknown parse error'}`,
        stage: 'parse',
      };
    }
  },
};
