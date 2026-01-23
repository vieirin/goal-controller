"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.variablesDefinition = void 0;
const utils = __importStar(require("../../../../GoalTree/utils"));
const logger_1 = require("../../../../logger/logger");
const common_1 = require("../../../../mdp/common");
const common_2 = require("../../../common");
const variablesDefinition = (goal) => {
    const logger = (0, logger_1.getLogger)();
    const defineVariable = (variable, upperBound) => {
        logger.variableDefinition({
            variable,
            upperBound,
            initialValue: 0,
            type: 'int',
            context: 'goal',
        });
        return `${variable} : [0..${upperBound}] init 0;`;
    };
    const pursuedVariableStatement = defineVariable((0, common_2.pursuedVariable)(goal.id), 1);
    const achievedVariableStatement = !goal.execCondition?.maintain
        ? defineVariable((0, common_2.achievedVariable)(goal.id), 1)
        : null;
    const children = utils.childrenIncludingTasks({ node: goal });
    const chosenVariableStatement = goal.executionDetail?.type === 'choice'
        ? defineVariable((0, common_2.chosenVariable)(goal.id), children.length)
        : null;
    const childrenWithMaxRetries = utils.childrenWithMaxRetries({ node: goal });
    const maxRetriesVariableStatement = childrenWithMaxRetries.length > 0
        ? childrenWithMaxRetries
            .map((child) => {
            const maxRetries = child.properties.maxRetries;
            if (maxRetries === undefined) {
                throw new Error(`Child ${child.id} is expected to have maxRetries but it is undefined`);
            }
            return defineVariable((0, common_1.failed)(child.id), maxRetries);
        })
            .join('\n')
        : null;
    return [
        pursuedVariableStatement,
        achievedVariableStatement,
        chosenVariableStatement,
        maxRetriesVariableStatement,
    ]
        .filter(Boolean)
        .join('\n  ');
};
exports.variablesDefinition = variablesDefinition;
//# sourceMappingURL=variables.js.map