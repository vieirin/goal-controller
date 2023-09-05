import { groupBy } from 'lodash';
import { goalRootId, leafGoals } from '../ObjectiveTree/utils';
import { GoalTree } from '../ObjectiveTree/types';

export const leavesGrouppedGoals = ({ gm }: { gm: GoalTree }) =>
  groupBy(leafGoals({ gm }), goalRootId);
