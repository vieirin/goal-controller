import type { ConditionDependency } from '../../GoalTree/dependencyResolver';
import { achievable, achieved, not, parenthesis, separator } from '../common';
import { dependency } from './dependency';

const skipAchieved = (goalIds: string[]) =>
  goalIds.map(achieved).join(separator('or'));

const skipAchievable = (conditions: ConditionDependency[]) => {
  return parenthesis(
    conditions
      .map((condition) => {
        const defaultSentence = not(achievable(condition.goal));
        if (condition.depends.length) {
          return parenthesis(
            [
              defaultSentence,
              not(dependency({ condition, negateItems: false, sep: 'or' })),
            ].join(separator('or')),
          );
        }
        return defaultSentence;
      })
      .join(separator('and')),
  );
};

export const variantsSkip = ({
  conditions,
}: {
  conditions: ConditionDependency[];
}) => {
  const goalIds = conditions.map(({ goal }) => goal);
  return parenthesis(
    [skipAchieved(goalIds), skipAchievable(conditions)].join(separator('or')),
  );
};
