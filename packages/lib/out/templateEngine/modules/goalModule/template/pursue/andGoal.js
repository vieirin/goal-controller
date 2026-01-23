"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pursueAndSequentialGoal = exports.splitSequence = void 0;
const logger_1 = require("../../../../../logger/logger");
const common_1 = require("../../../../../mdp/common");
const common_2 = require("./common");
const splitSequence = (sequence, childId) => {
    if (!sequence.includes(childId)) {
        throw new Error(`Child ID ${childId} not found in sequence ${sequence.join(', ')}`);
    }
    const sequenceIndex = sequence.indexOf(childId);
    return [sequence.slice(0, sequenceIndex), sequence.slice(sequenceIndex + 1)];
};
exports.splitSequence = splitSequence;
const pursueAndSequentialGoal = (goal, sequence, childId, children) => {
    if (goal.relationToChildren === 'or') {
        throw new Error('OR relation to children without a runtime notation is not supported use Degradation goal instead');
    }
    const [leftGoals, rightGoals] = (0, exports.splitSequence)(sequence, childId);
    if (!goal.relationToChildren) {
        return '';
    }
    const childrenMap = new Map(children.map((child) => [child.id, child]));
    const resolveAndGoal = () => {
        if (leftGoals.length === 0) {
            const child = childrenMap.get(childId);
            if (!child) {
                throw new Error(`Child with ID ${childId} not found in children map for goal ${goal.id}`);
            }
            return (0, common_2.hasBeenAchieved)(child, { condition: false });
        }
        return [
            ...leftGoals.map((goalId) => {
                const child = childrenMap.get(goalId);
                if (!child) {
                    throw new Error(`Child with ID ${goalId} not found in children map for goal ${goal.id}`);
                }
                return (0, common_2.hasBeenAchieved)(child, { condition: true });
            }),
            ...rightGoals.map((goalId) => {
                const child = childrenMap.get(goalId);
                if (!child) {
                    throw new Error(`Child with ID ${goalId} not found in children map for goal ${goal.id}`);
                }
                return (0, common_2.hasBeenAchieved)(child, { condition: false });
            }),
        ].join((0, common_1.separator)('and'));
    };
    const { sequence: sequenceLogger } = (0, logger_1.getLogger)().pursue.executionDetail;
    sequenceLogger(goal.id, childId, leftGoals, rightGoals);
    if (goal.relationToChildren === 'and') {
        return resolveAndGoal();
    }
    return '';
};
exports.pursueAndSequentialGoal = pursueAndSequentialGoal;
//# sourceMappingURL=andGoal.js.map