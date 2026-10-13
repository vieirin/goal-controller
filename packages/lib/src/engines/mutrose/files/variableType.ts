/**
 * A type as MutRoSe writes it (`Room`, `Sequence(Room)`: its grammar's
 * VariableType), read with its grammar: its class is the element's, when
 * it has one. The goal model's Controls and the configuration's mappings
 * write types so; each says what the class refers to.
 */
import { type Annotated } from '../../../pool';
import { langium } from '../pool/vocabulary';
import type { VariableType } from '../language/generated/ast';
import { mutroseServices } from '../language';

/** VariableType's annotations, the class referred to by `toClass` */
export const variableType = (toClass: Annotated) => ({
  VariableType: {
    name: (node: VariableType) => (node.element ? [] : [toClass]),
    element: [toClass],
  },
});

/** a string that is a type, on its own (the configuration's `ocl_type`) */
export const typeWritten = (toClass: Annotated) =>
  langium(mutroseServices(), {
    start: 'VariableType',
    annotate: variableType(toClass),
  });
