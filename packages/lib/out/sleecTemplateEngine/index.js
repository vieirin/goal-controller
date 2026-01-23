"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleecTemplateEngine = void 0;
const utils_1 = require("../GoalTree/utils");
const renameTaskId = (id) => id.replace('.', '_');
const taskFluentName = (task, op) => {
    return `${op}${task.properties.FluentName}`;
};
const generateTaskRules = (tasks) => {
    const hasAvoidEvents = (task) => !!task.properties.AvoidEvent;
    return `rules
      ${tasks
        .map((task) => {
        return `
      Rule${renameTaskId(task.id)}_1 when ${task.properties.TriggeringEvent} and ${task.properties.PreCond} then ${taskFluentName(task, 'Start')}
      Rule${renameTaskId(task.id)}_2 when ${taskFluentName(task, 'Start')} then ${taskFluentName(task, 'Pursuing')} within ${task.properties.TemporalConstraint}
      Rule${renameTaskId(task.id)}_3 when ${taskFluentName(task, 'Pursuing')} and ${task.properties.PostCond} then ${taskFluentName(task, 'Achieved')} unless (not ${task.properties.PostCond}) then ${taskFluentName(task, 'ReportFailure')} 
      ${hasAvoidEvents(task) ? generateAvoidEventsRules(task) : ''}`;
    })
        .join('\n')}
end`;
};
function generateAvoidEventsRules(task) {
    return `Rule${renameTaskId(task.id)}_4 when Achieved${task.properties.AvoidEvent} then ${taskFluentName(task, 'Pursuing')}`;
}
const sleecTemplateEngine = (tree) => {
    const tasks = (0, utils_1.allByType)({ gm: tree, type: 'task' });
    return `${generateTaskRules(tasks)}`;
};
exports.sleecTemplateEngine = sleecTemplateEngine;
//# sourceMappingURL=index.js.map