"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskTransitions = void 0;
const logger_1 = require("../../../../../logger/logger");
const common_1 = require("../../../../../mdp/common");
const common_2 = require("../../../../common");
const common_3 = require("../../../goalModule/template/pursue/common");
const pursueTask = (task) => {
    const logger = (0, logger_1.getLogger)();
    const leftStatement = `${(0, common_3.hasBeenPursued)(task, {
        condition: false,
    })} & ${(0, common_3.hasBeenAchieved)(task, { condition: false })}`;
    const updateStatement = `(${(0, common_3.hasBeenPursued)(task, {
        condition: true,
        update: true,
    })})`;
    const prismLabelStatement = `[${(0, common_2.pursueTransition)(task.id)}] ${leftStatement} -> ${updateStatement};`;
    logger.taskTranstions.transition(task.id, leftStatement, updateStatement, prismLabelStatement, 'pursue');
    return prismLabelStatement;
};
const achieveTask = (task) => {
    const logger = (0, logger_1.getLogger)();
    const leftStatement = `${(0, common_3.hasBeenAchievedAndPursued)(task, {
        achieved: true,
        pursued: true,
    })}`;
    const prismLabelStatement = `[${(0, common_2.achievedTransition)(task.id)}] ${leftStatement} -> true;`;
    logger.taskTranstions.transition(task.id, leftStatement, 'true', prismLabelStatement, 'achieve');
    return prismLabelStatement;
};
const tryTask = (task) => {
    const logger = (0, logger_1.getLogger)();
    const taskAchievabilityVariable = (0, common_2.achievableFormulaVariable)(task.id);
    const leftStatement = `[${(0, common_2.tryTransition)(task.id)}] ${(0, common_3.hasBeenAchievedAndPursued)(task, {
        achieved: false,
        pursued: true,
    })}`;
    const updateStatement = `${taskAchievabilityVariable}: ${(0, common_1.parenthesis)((0, common_3.hasBeenAchieved)(task, {
        condition: true,
        update: true,
    }))} + 1-${taskAchievabilityVariable}: ${(0, common_1.parenthesis)((0, common_3.hasBeenPursued)(task, { condition: false, update: true }))};`;
    const tryStatement = `${leftStatement} -> ${updateStatement}`;
    logger.taskTranstions.transition(task.id, leftStatement, updateStatement, tryStatement, 'try', task.properties.maxRetries);
    return tryStatement;
};
const taskTransitions = (task) => {
    return `
  // Task ${task.id}: ${task.name}
  ${pursueTask(task)}
  ${tryTask(task)}
  ${achieveTask(task)}
  `;
};
exports.taskTransitions = taskTransitions;
//# sourceMappingURL=transitions.js.map