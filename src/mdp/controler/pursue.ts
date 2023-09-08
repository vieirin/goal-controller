import { ConditionDependency } from '../../ObjectiveTree/dependencyResolver';
import { achievable, achieved, not, parenthesis, separator } from '../common';
import { dependency } from './dependency';

const pursueAchieved = (goalIds: string[]) =>
  not(parenthesis(goalIds.map(achieved).join(separator('or'))));

const pursueAchievable = (conditions: ConditionDependency[]) => {
  return parenthesis(
    conditions
      .map((condition) => {
        const defaultSentence = achievable(condition.goal);
        if (condition.depends) {
          return parenthesis(
            [
              defaultSentence,
              dependency({ condition, negateItems: false, sep: 'or' }),
            ].join(separator('and'))
          );
        }
        return defaultSentence;
      })
      .join(separator('or'))
  );
};

export const variantsPursue = ({
  conditions,
}: {
  conditions: ConditionDependency[];
}) => {
  const goalIds = conditions.map(({ goal }) => goal);

  return [pursueAchieved(goalIds), pursueAchievable(conditions)].join(
    separator('and')
  );
};
