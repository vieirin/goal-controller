"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePrismModel = void 0;
const parseVariable = (line) => {
    // Match patterns like:
    // G0_pursued : [0..1] init 0;
    // variable: bool init true;
    // variable: [0..10] init 5;
    const varMatch = line.match(/^\s*(\w+)\s*:\s*(?:\[(\d+)\.\.(\d+)\]|bool)\s*init\s*(\w+)\s*;/);
    if (!varMatch)
        return null;
    const name = varMatch[1];
    const lower = varMatch[2];
    const upper = varMatch[3];
    const initValue = varMatch[4];
    if (!name || !initValue)
        return null;
    if (lower && upper) {
        // Integer variable
        return {
            name,
            type: 'int',
            bounds: { lower: parseInt(lower, 10), upper: parseInt(upper, 10) },
            initialValue: parseInt(initValue, 10),
        };
    }
    else {
        // Boolean variable
        return {
            name,
            type: 'bool',
            initialValue: initValue === 'true',
        };
    }
};
/**
 * Extracts variable references from a guard condition string.
 * Handles patterns like:
 * - variable=value
 * - variable'=value (updates)
 * - variable>=value, variable<=value, variable!=value
 * - variable>value, variable<value
 * - Parenthesized expressions
 */
const extractVariablesFromGuard = (guard) => {
    const variables = new Set();
    // Match variable patterns in the guard
    // Patterns: var=value, var'=value, var>=value, var<=value, var!=value, var>value, var<value
    // Also handle formulas like var_achieved_maintain=true/false
    const variablePattern = /(\w+)(?:'|>=|<=|!=|>|<|=)/g;
    let match;
    while ((match = variablePattern.exec(guard)) !== null) {
        const varName = match[1];
        // Skip common keywords and operators
        if (varName &&
            !['true', 'false', 'min', 'max', 'and', 'or', 'not'].includes(varName)) {
            variables.add(varName);
        }
    }
    // Also match standalone variable names in parentheses or as part of formulas
    // This catches cases like (var1 & var2) or var1 * var2
    const guardWords = guard.split(/\s*[&|()+\-*=<>!]\s*/);
    guardWords.forEach((word) => {
        const trimmed = word.trim();
        // Match if it looks like a variable (starts with letter/underscore, contains alphanumeric/underscore)
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
            // Skip numbers, boolean literals, and common keywords
            if (!/^\d+$/.test(trimmed) &&
                trimmed !== 'true' &&
                trimmed !== 'false' &&
                !['and', 'or', 'not', 'min', 'max'].includes(trimmed.toLowerCase())) {
                variables.add(trimmed);
            }
        }
    });
    return Array.from(variables);
};
const parseTransition = (line) => {
    // Match patterns like:
    // [pursue_G0] G0_pursued=0 & G0_achieved=0 -> (G0_pursued'=1);
    // [achieved_G0] condition -> update;
    const transitionMatch = line.match(/^\s*\[([^\]]+)\]\s*(.+?)\s*->\s*(.+?)\s*;?\s*$/);
    if (!transitionMatch)
        return null;
    const label = transitionMatch[1];
    const guard = transitionMatch[2];
    const update = transitionMatch[3];
    if (!label || !guard || !update)
        return null;
    const guardTrimmed = guard.trim();
    const variablesReferenced = extractVariablesFromGuard(guardTrimmed);
    return {
        label: label.trim(),
        guard: guardTrimmed,
        update: update.trim(),
        variablesReferenced,
    };
};
const parseFormula = (line) => {
    // Match patterns like:
    // formula G0_achievable = G1_achievable * G2_achievable;
    // const double T1_achievable = 0.9;
    const formulaMatch = line.match(/^\s*(?:formula|const\s+double)\s+(\w+)\s*=\s*(.+?)\s*;?\s*$/);
    if (!formulaMatch)
        return null;
    const name = formulaMatch[1];
    const expression = formulaMatch[2];
    if (!name || !expression)
        return null;
    // Check if it's a constant (const double)
    if (line.includes('const double')) {
        const constValue = parseFloat(expression);
        if (!isNaN(constValue)) {
            return {
                name,
                expression: constValue.toString(),
            };
        }
    }
    return {
        name,
        expression: expression.trim(),
    };
};
const parseModule = (lines, startIndex) => {
    // Find module declaration
    const moduleMatch = lines[startIndex]?.match(/^\s*module\s+(\w+)\s*$/);
    if (!moduleMatch)
        return null;
    const moduleName = moduleMatch[1];
    if (!moduleName)
        return null;
    // Look backwards for goal type in header comments
    // Headers are typically 3-5 lines before the module declaration
    let goalType;
    for (let j = Math.max(0, startIndex - 10); j < startIndex; j++) {
        const line = lines[j];
        if (!line)
            continue;
        const trimmedLine = line.trim();
        const typeMatch = trimmedLine.match(/^\/\/\s*Type:\s*(\w+)/i);
        const typeStr = typeMatch?.[1]?.toLowerCase();
        if (typeStr === 'choice') {
            goalType = 'choice';
            break;
        }
        else if (typeStr === 'degradation') {
            goalType = 'degradation';
            break;
        }
        else if (typeStr === 'sequence') {
            goalType = 'sequence';
            break;
        }
        else if (typeStr === 'interleaved') {
            goalType = 'interleaved';
            break;
        }
        else if (typeStr === 'alternative') {
            goalType = 'alternative';
            break;
        }
        else if (typeStr === 'basic') {
            goalType = 'basic';
            break;
        }
    }
    const variables = [];
    const transitions = [];
    let i = startIndex + 1;
    let inModule = true;
    while (i < lines.length && inModule) {
        const line = lines[i]?.trim() || '';
        if (line === 'endmodule') {
            inModule = false;
            break;
        }
        // Try to parse as variable
        const variable = parseVariable(line);
        if (variable) {
            variables.push(variable);
            i++;
            continue;
        }
        // Try to parse as transition
        const transition = parseTransition(line);
        if (transition) {
            transitions.push(transition);
            i++;
            continue;
        }
        // Skip comments and empty lines
        if (line.startsWith('//') || line === '') {
            i++;
            continue;
        }
        i++;
    }
    // Calculate line count: from module declaration to endmodule (inclusive)
    const lineCount = i - startIndex + 1;
    return {
        module: {
            name: moduleName,
            variables,
            transitions,
            goalType,
            lineCount,
        },
        nextIndex: i + 1,
    };
};
const parsePrismModel = (prismModel) => {
    const lines = prismModel.split('\n');
    const goalModules = new Map();
    let changeManagerModule;
    let systemModule;
    const formulas = [];
    const constants = new Map();
    let i = 0;
    // Skip dtmc declaration if present
    while (i < lines.length && lines[i]?.trim().startsWith('dtmc')) {
        i++;
    }
    // Skip empty lines
    while (i < lines.length && lines[i]?.trim() === '') {
        i++;
    }
    // Parse modules
    while (i < lines.length) {
        const line = lines[i]?.trim() || '';
        // Check if it's a module
        if (line.startsWith('module ')) {
            const result = parseModule(lines, i);
            if (result) {
                const { module, nextIndex } = result;
                if (module.name === 'ChangeManager') {
                    changeManagerModule = module;
                }
                else if (module.name === 'System') {
                    systemModule = module;
                }
                else {
                    // Assume it's a goal module
                    goalModules.set(module.name, module);
                }
                i = nextIndex;
                continue;
            }
        }
        // Check if it's a formula or constant
        if (line.startsWith('formula ') || line.startsWith('const ')) {
            const formula = parseFormula(line);
            if (formula) {
                // Check if it's a constant
                if (line.startsWith('const double')) {
                    const value = parseFloat(formula.expression);
                    if (!isNaN(value)) {
                        constants.set(formula.name, value);
                    }
                }
                formulas.push(formula);
            }
        }
        i++;
    }
    return {
        goalModules,
        changeManagerModule,
        systemModule,
        formulas,
        constants,
    };
};
exports.parsePrismModel = parsePrismModel;
//# sourceMappingURL=parser.js.map