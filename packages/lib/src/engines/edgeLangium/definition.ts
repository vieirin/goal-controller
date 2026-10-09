import { defineDialect } from '@goal-controller/dialect';
import { edgeV2 } from '../edgeV2/definition';

/** EdgeV2's dialect, read by the Langium parser instead of ANTLR. */
export const edgeLangium = defineDialect({
  ...edgeV2,
  id: 'edgeLangium',
  name: 'EdgeLangium',
  parser: 'langium',
});
