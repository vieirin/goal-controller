"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.goalModule = void 0;
const logger_1 = require("../../../../logger/logger");
const achieve_1 = require("./achieve");
const formulas_1 = require("./formulas");
const utils_1 = require("../../../../GoalTree/utils");
const pursue_1 = require("./pursue");
const skip_1 = require("./skip");
const variables_1 = require("./variables");
const goalModule = (goal) => {
    const logger = (0, logger_1.getLogger)();
    logger.initGoal(goal);
    const formulaStatements = [
        (0, formulas_1.maintainConditionFormula)(goal),
        (0, formulas_1.achievableGoalFormula)(goal),
    ]
        .filter(Boolean)
        .join('\n');
    return `// ID: ${goal.id}
// Name: ${goal.name}
// Type: ${goal.executionDetail?.type || 'basic'}
// Relation to children: ${goal.relationToChildren}
// Children: ${(0, utils_1.childrenIncludingTasks)({ node: goal })
        .map((child) => child.id)
        .join(', ')}
module ${goal.id}
  ${(0, variables_1.variablesDefinition)(goal)}

  ${(0, pursue_1.pursueStatements)(goal).join('\n  ')}

  ${(0, achieve_1.achieveStatement)(goal)}
  
  ${(0, skip_1.skipStatement)(goal)}
endmodule

${formulaStatements}
`.trim();
};
exports.goalModule = goalModule;
//# sourceMappingURL=index.js.map