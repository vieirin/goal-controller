"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineVariable = exports.resourceVariableName = void 0;
const logger_1 = require("../../../../logger/logger");
const resourceVariableName = (resource) => `${resource.id}`;
exports.resourceVariableName = resourceVariableName;
const defineVariable = (variable, initialValue, type, context, lowerBound, upperBound) => {
    const logger = (0, logger_1.getLogger)();
    logger.variableDefinition({
        variable,
        initialValue,
        type,
        lowerBound,
        upperBound,
        context: 'system',
        subContext: context,
    });
    switch (type) {
        case 'boolean':
            return `${variable}: bool init ${initialValue};`;
        case 'int':
            return `${variable}: [${lowerBound}..${upperBound}] init ${initialValue};`;
    }
};
exports.defineVariable = defineVariable;
//# sourceMappingURL=variable.js.map