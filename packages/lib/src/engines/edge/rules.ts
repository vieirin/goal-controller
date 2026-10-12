/** Edge on the rule layer (goal-controller#75): the Edge engines' rules, in Edge's dialect. */
import type { AnyDialect } from '@goal-controller/dialect';
import { edgeFamilyRules } from '../edgeFamily/rules';
import { edge } from './definition';

export const edgeRules = edgeFamilyRules('edge', edge as AnyDialect);
