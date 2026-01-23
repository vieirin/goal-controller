"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeManagerModuleTemplate = void 0;
const transitions_1 = require("./tasks/transitions");
const variables_1 = require("./tasks/variables");
const changeManagerModuleTemplate = ({ tasks, }) => {
    const { variables, transitions } = tasks.reduce((acc, task) => {
        acc.variables.push((0, variables_1.taskVariables)(task));
        acc.transitions.push((0, transitions_1.taskTransitions)(task));
        return acc;
    }, { variables: [], transitions: [] });
    return `module ChangeManager
  ${variables.join('\n  ')}
  ${transitions.join('\n')}
endmodule`;
};
exports.changeManagerModuleTemplate = changeManagerModuleTemplate;
//# sourceMappingURL=index.js.map