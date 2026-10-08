import { defineEngine } from '../schema';
import { edgeV2 } from './edgeV2';

/** EdgeV2's dialect, read by the Langium parser instead of ANTLR. */
export const edgeLangium = defineEngine({
  ...edgeV2,
  id: 'edgeLangium',
  name: 'EdgeLangium',
  parser: 'langium',
});
