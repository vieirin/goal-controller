"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pursueAlternativeGoal = exports.pursueDegradationGoal = exports.pursueChoiceGoal = void 0;
const utils_1 = require("../../../../../GoalTree/utils");
const logger_1 = require("../../../../../logger/logger");
const common_1 = require("../../../../../mdp/common");
const common_2 = require("../../../../common");
const common_3 = require("./common");
/*
G1: Goal[T1|T2]
module G1 //non-idempotent, a.k.a choose once!
  G1_pursued : [0..1] init 0;
  G1_achieved : [0..1] init 0;
  G1_chosen : [0..2] init 0; //which one is chosen?

//  [pursue_T1] G1_pursued=1 & G1_achieved=0 & G1_chosen!=2 -> (G1_chosen'=1);
//  [pursue_T2] G1_pursued=1 & G1_achieved=0 & G1_chosen!=1 -> (G1_chosen'=2);

  [achieved_G1] (T1_achieved>0 | T2_achieved>0) & G1_pursued=1 -> (G1_pursued'=0) & (G1_achieved'=1);
endmodule
*/
const pursueChoiceGoal = (goal, alternative, currentChildId) => {
    if (goal.relationToChildren === 'and') {
        throw new Error(`Alternative goals are not supported for AND joints. Found in goal ${goal.id}`);
    }
    const { choice: choiceLogger } = (0, logger_1.getLogger)().pursue.executionDetail;
    if (goal.relationToChildren === 'or') {
        const otherGoals = alternative.filter((goalId) => goalId !== currentChildId);
        const notChosen = otherGoals
            .map((goalId) => {
            const originalIndex = alternative.indexOf(goalId);
            return `${(0, common_2.chosenVariable)(goal.id)}!=${originalIndex + 1}`;
        })
            .join((0, common_1.separator)('and'));
        choiceLogger(currentChildId, otherGoals, notChosen);
        return notChosen;
    }
    return '';
};
exports.pursueChoiceGoal = pursueChoiceGoal;
const pursueDegradationGoal = (goal, degradationList, currentChildId) => {
    if (goal.relationToChildren === 'and') {
        throw new Error(`Alternative goals are not supported for AND joints. Found in goal ${goal.id}`);
    }
    const { degradation: degradationLogger } = (0, logger_1.getLogger)().pursue.executionDetail;
    if (goal.relationToChildren === 'or') {
        const otherGoals = degradationList.filter((goalId) => goalId !== currentChildId);
        degradationLogger.init(currentChildId, degradationList);
        const maybeRetry = goal.executionDetail?.retryMap?.[currentChildId];
        if (maybeRetry) {
            return (0, common_3.hasFailedAtMostNTimes)(currentChildId, maybeRetry - 1);
        }
        const result = otherGoals
            .map((goalId) => {
            // For degradation, we only need to check retry conditions (failures of earlier goals)
            // We don't need to check if the parent goal has been pursued (that's already in the base guard)
            const maybeRetry = goal.executionDetail?.retryMap?.[goalId];
            const retryCondition = maybeRetry && (0, common_3.hasFailedAtLeastNTimes)(goalId, maybeRetry);
            if (maybeRetry) {
                degradationLogger.retry(currentChildId, goalId, maybeRetry);
            }
            return retryCondition || '';
        })
            .filter(Boolean)
            .join((0, common_1.separator)('and'));
        return result;
    }
    return '';
};
exports.pursueDegradationGoal = pursueDegradationGoal;
// chooses either one of the children always
const pursueAlternativeGoal = (goal, currentChildId) => {
    const children = (0, utils_1.childrenIncludingTasks)({ node: goal });
    const otherGoals = children.filter((child) => child.id !== currentChildId);
    const { alternative: alternativeLogger } = (0, logger_1.getLogger)().pursue.executionDetail;
    alternativeLogger(currentChildId, otherGoals.map((child) => child.id));
    return otherGoals
        .map((child) => {
        return `${(0, common_1.pursued)(child.id)}=0`;
    })
        .join((0, common_1.separator)('and'));
};
exports.pursueAlternativeGoal = pursueAlternativeGoal;
//# sourceMappingURL=orGoal.js.map