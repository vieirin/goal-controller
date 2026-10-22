/**
 * The metamodel lib reads a KAOS model's kinds with (goal-controller#194):
 * istar-ts's KAOS with its obstacle analysis, and the `kaos` dialect's
 * operation and object models (`kaosOperations`), their kinds typed. A
 * model of those kinds declares them in its file too (its `"metamodel"`
 * block, `KAOS_OPERATIONS_BLOCK`), which the workbench reads them by on the
 * KAOS root; read with this metamodel, the block is kept as written.
 */
import { defineMetamodelExtension, extendMetamodel } from '@istar-ts/core';
import { KAOS_OBSTACLES } from '@istar-ts/dsm3-kaos/metamodel';
import { metamodelExtensionOf } from '@goal-controller/dialect';
import { kaosOperations } from './index';

/** The operation and object models' kinds, as a model's `"metamodel"` block declares them. */
export const KAOS_OPERATIONS_BLOCK = metamodelExtensionOf(kaosOperations);

/** KAOS, its obstacle analysis, and the operation and object models. */
export const KAOS_MODEL = extendMetamodel(
  KAOS_OBSTACLES,
  defineMetamodelExtension(KAOS_OPERATIONS_BLOCK),
);
