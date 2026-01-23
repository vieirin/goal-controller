"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemModuleTemplate = void 0;
const variable_1 = require("./variable");
const systemModuleTemplate = ({ variables, resources, defaultVariableValues, oldTransitions, }) => {
    const resourceVariables = resources.map((resource) => {
        if (resource.variable.type === 'boolean') {
            return (0, variable_1.defineVariable)((0, variable_1.resourceVariableName)(resource), resource.variable.initialValue ?? 'MISSING_VARIABLE_DEFINITION', resource.variable.type, 'resource');
        }
        return (0, variable_1.defineVariable)((0, variable_1.resourceVariableName)(resource), resource.variable.initialValue ?? 'MISSING_VARIABLE_DEFINITION', resource.variable.type, 'resource', resource.variable.lowerBound, resource.variable.upperBound);
    });
    return `module System
  ${[
        variables.map((variable) => {
            return (0, variable_1.defineVariable)(variable, defaultVariableValues[variable] ?? 'MISSING_VARIABLE_DEFINITION', 'boolean', 'context');
        }),
        resourceVariables.join('\n  '),
        oldTransitions?.map((str) => str.trim()).join('\n  ') ?? '',
    ]
        .filter(Boolean)
        .flat()
        .join('\n  ')
        .trim()}
endmodule`;
};
exports.systemModuleTemplate = systemModuleTemplate;
//# sourceMappingURL=index.js.map