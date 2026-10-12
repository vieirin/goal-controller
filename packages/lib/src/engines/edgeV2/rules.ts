/** edgeV2 on the rule layer (goal-controller#75): the Edge engines' rules, in edgeV2's dialect. */
import type { AnyDialect } from '@goal-controller/dialect';
import { edgeFamilyRules } from '../edgeFamily/rules';
import { edgeV2 } from './definition';

export const edgeV2Rules = edgeFamilyRules('edgeV2', edgeV2 as AnyDialect);
