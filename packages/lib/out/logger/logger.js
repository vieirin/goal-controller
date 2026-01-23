"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = exports.initLogger = exports.createStore = void 0;
const fs_1 = __importDefault(require("fs"));
const filePath_1 = require("./filePath");
const createStore = () => {
    // Create a plain object to hold the state
    const state = {
        goalModules: 0,
        goalVariables: 0,
        goalPursueLines: 0,
        goalAchievabilityFormulas: 0,
        goalMaintainFormulas: 0,
        tasksVariables: 0,
        tasksLabels: 0,
        tasksAchievabilityConstants: 0,
        systemVariables: 0,
        goalAchievedLines: 0,
        goalSkipLines: 0,
        tasksTryLines: 0,
        tasksFailedLines: 0,
        tasksAchievedLines: 0,
        tasksSkippedLines: 0,
        systemResources: 0,
        systemContextVariables: 0,
        // New counters
        totalGoals: 0,
        goalTypeDegradation: 0,
        goalTypeChoice: 0,
        goalTypeAlternative: 0,
        goalTypeSequence: 0,
        goalTypeInterleaved: 0,
        totalTasks: 0,
        totalResources: 0,
        totalNodes: 0,
        totalVariables: 0,
    };
    // Create a Proxy that intercepts property access for all LoggerStore properties
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const emptyStore = {};
    return new Proxy(emptyStore, {
        get(_target, prop) {
            return state[prop];
        },
        set(_target, prop, value) {
            state[prop] = value;
            return true;
        },
    });
};
exports.createStore = createStore;
const createLoggerFile = (modelFileName) => {
    try {
        const logFilePath = (0, filePath_1.ensureLogFileDirectory)(modelFileName, '.log');
        if (!logFilePath) {
            // Directory creation failed (e.g., serverless environment)
            return null;
        }
        return fs_1.default.createWriteStream(logFilePath, { flags: 'w' });
    }
    catch {
        // If file creation fails, return null for in-memory mode
        return null;
    }
};
const createLogger = (modelFileName, store, logToConsole = false, inMemory = false) => {
    const startTime = Date.now();
    const logFile = inMemory ? null : createLoggerFile(modelFileName);
    const logBuffer = [];
    const write = (message) => {
        if (logFile) {
            logFile.write(message);
        }
        else {
            // In-memory mode: store in buffer
            logBuffer.push(message);
        }
        if (logToConsole) {
            // eslint-disable-next-line no-console
            console.log(message);
        }
    };
    const loggerInstance = {
        decisionVariable: (decisionVariable) => {
            write(`[DECISION VARIABLES]: ${decisionVariable[0]}: space ${decisionVariable[1]}\n`);
        },
        initGoal: (goal) => {
            store.goalModules++;
            store.totalGoals++;
            // Track execution detail type
            if (goal.executionDetail) {
                switch (goal.executionDetail.type) {
                    case 'degradation':
                        store.goalTypeDegradation++;
                        break;
                    case 'choice':
                        store.goalTypeChoice++;
                        break;
                    case 'alternative':
                        store.goalTypeAlternative++;
                        break;
                    case 'sequence':
                        store.goalTypeSequence++;
                        break;
                    case 'interleaved':
                        store.goalTypeInterleaved++;
                        break;
                }
            }
            write(`[INIT GOAL] ${goal.id}: ${goal.name ?? 'none'}\n`);
            write(`\tChildren: ${goal.children?.length && goal.children.length > 0
                ? goal.children.map((child) => child.id).join(', ')
                : 'none'}\n`);
            write(`\tTasks: ${goal.tasks?.map((task) => task.id).join(', ') ?? 'none'}\n`);
            write(`\tType: ${goal.execCondition?.maintain?.sentence ? 'maintain' : 'achieve'}\n`);
            write(`\tRelation to children: ${goal.relationToChildren ?? 'none'}\n`);
            write(`\tExecution detail: ${goal.executionDetail?.type ?? 'none'}\n`);
            write(`\t[TRACE]: [${goal.id}] Emits module: ${goal.id}\n`);
        },
        initTask: (task) => {
            store.totalTasks++;
            // Count resources for this task
            if (task.resources && task.resources.length > 0) {
                store.totalResources += task.resources.length;
            }
            write(`[INIT TASK] ${task.id}: ${task.name ?? 'none'}\n`);
            write(`\tResources: ${task.resources?.length && task.resources.length > 0
                ? task.resources.map((resource) => resource.id).join(', ')
                : 'none'}\n`);
        },
        initSystem: () => {
            write('[INIT SYSTEM MODULE]\n');
        },
        maintainFormulaDefinition: (goalId, formula, sentence, prismLine) => {
            store.goalMaintainFormulas++;
            write(`\t[TRACE] ${goalId}.maintainCondition -> ${formula} \n`);
            write(`\t[FORMULA DEFINITION] ${formula}; guard statement: ${sentence}\n`);
            write(`\t\t[PRISM emitted statement]: ${prismLine}\n`);
        },
        achievabilityFormulaDefinition: (goalId, formula, type, sentence, prismLine) => {
            store.goalAchievabilityFormulas++;
            write(`\t[TRACE] ${goalId}.${type} -> ${formula} \n`);
            write(`\t[FORMULA DEFINITION] ${formula}; guard statement: ${sentence}\n`);
            write(`\t\t[PRISM emitted statement]: ${prismLine}\n`);
        },
        achievabilityTaskConstant: (taskId, constant, value) => {
            store.tasksAchievabilityConstants++;
            write(`\t[TASK ACHIEVABILITY CONSTANT] ${taskId}: ${constant} = ${value}\n`);
        },
        taskTranstions: {
            transition: (taskId, leftStatement, updateStatement, prismLabelStatement, transition, maxRetries) => {
                store.tasksLabels++;
                switch (transition) {
                    case 'try':
                        store.tasksTryLines++;
                        break;
                    case 'failed':
                        store.tasksFailedLines++;
                        break;
                    case 'achieve':
                        store.tasksAchievedLines++;
                        break;
                    case 'pursue':
                        store.tasksSkippedLines++;
                        break;
                }
                const transitionLogLabel = transition.toUpperCase();
                write(`\t[${transitionLogLabel}] Task ${taskId} ${transitionLogLabel} label\n`);
                write(`\t\t[CONDITION] ${leftStatement}\n`);
                if (maxRetries) {
                    write(`\t\t[MAX RETRIES] ${maxRetries}\n`);
                }
                write(`\t\t[UPDATE] ${updateStatement}\n`);
                write(`\t\tPRISM statement: ${prismLabelStatement}\n`);
                write(`\t[END OF ${transitionLogLabel}]\n`);
            },
        },
        pursue: {
            pursue: (goal, step) => {
                write(`\t[PURSUE GENERATION] ${goal.id} - STEP ${step}\n`);
            },
            defaultPursueCondition: (pursueCondition) => {
                write(`\t\t[DEFAULT PURSUE CONDITION] ${pursueCondition}\n`);
            },
            update: (update) => {
                write(`\t\t[UPDATE] ${update}\n`);
            },
            goalDependency: (goalId, dependsOn) => {
                if (!dependsOn.length) {
                    return;
                }
                write(`\t\t[GOAL DEPENDENCY] ${goalId}: ${dependsOn.join(', ')}\n`);
            },
            executionDetail: {
                choice: (currentGoal, otherGoals, guardStatement) => {
                    write('\t\t[EXECUTION DETAIL: CHOICE]\n');
                    write(`\t\t\t[CURRENT GOAL] ${currentGoal}\n`);
                    write(`\t\t\t[OTHER GOALS] ${otherGoals.join(', ')}\n`);
                    write(`\t\t\t[GUARD STATEMENT] ${guardStatement}\n`);
                },
                degradation: {
                    init: (currentGoal, degradation) => {
                        const priority = degradation.findIndex((goal) => goal === currentGoal) + 1;
                        write(`\t\t[EXECUTION DETAIL: DEGRADATION] ${currentGoal} priority #${priority} : ${degradation.join(' -> ')}\n`);
                    },
                    retry: (currentGoal, goalToRetry, amountOfRetries) => {
                        write(`\t\t[EXECUTION DETAIL: DEGRADATION] ${currentGoal} retry after: ${goalToRetry} ${amountOfRetries} times\n`);
                    },
                    alternative: (currentGoal, alternative) => {
                        write(`\t\t[EXECUTION DETAIL: ALTERNATIVE GOAL] ${currentGoal} other alternatives: ${alternative.join(', ')}\n`);
                    },
                },
                sequence: (goalId, currentGoal, leftGoals, rightGoals) => {
                    write(`\t\t[EXECUTION DETAIL: SEQUENCE] ${goalId}: Curr ${currentGoal};\n`);
                    write(`\t\t\t[LEFT GOALS] - should be achieved:  ${leftGoals.length > 0 ? leftGoals.join(', ') : 'none'}\n`);
                    write(`\t\t\t[RIGHT GOALS] - should be not achieved: ${rightGoals.join(', ')}\n`);
                },
                alternative: (currentGoal, alternative) => {
                    write(`\t\t[EXECUTION DETAIL: ALTERNATIVE GOAL] ${currentGoal} other alternatives: ${alternative.join(', ')}\n`);
                },
                interleaved: () => {
                    write('\t\t[EXECUTION DETAIL: INTERLEAVED] interleaved goals have no guard condition\n');
                },
                activationContext: (sentence) => {
                    write(`\t\t[EXECUTION DETAIL: CONTEXT] Guard statement: ${sentence}\n`);
                },
                noActivationContext: (goalId) => {
                    write(`\t\t[EXECUTION DETAIL: CONTEXT] Guard statement: ${goalId} has no activation context\n`);
                },
            },
            stepStatement: (step, left, right) => {
                write(`\t\tPRISM statement: ${left} -> ${right}\n`);
                write(`\t[END OF STEP ${step}]\n`);
            },
            finish: () => {
                store.goalPursueLines++;
                write('\t[END OF PURSUE]\n');
            },
        },
        achieve: (goalId, condition, update, prismLabelStatement) => {
            store.goalAchievedLines++;
            write(`\t[ACHIEVE] Goal ${goalId} achieved label\n`);
            write(`\t\t[CONDITION] ${condition}\n`);
            write(`\t\t[UPDATE] ${update}\n`);
            write(`\t\tPRISM statement: ${prismLabelStatement}\n`);
            write('\t[END OF ACHIEVE]\n');
        },
        skip: (goalId, leftStatement, updateStatement, prismLabelStatement) => {
            store.goalSkipLines++;
            write(`\t[SKIP] Goal ${goalId} skipped label\n`);
            write(`\t\t[CONDITION] ${leftStatement}\n`);
            write(`\t\t[UPDATE] ${updateStatement}\n`);
            write(`\t\tPRISM statement: ${prismLabelStatement}\n`);
            write('\t[END OF SKIP]\n');
        },
        variableDefinition: ({ variable, initialValue, upperBound, lowerBound, type = 'int', context = 'goal', ...props }) => {
            if (context === 'goal') {
                store.goalVariables++;
            }
            else if (context === 'task') {
                store.tasksVariables++;
            }
            else if (context === 'system') {
                store.systemVariables++;
                if ('subContext' in props && props.subContext === 'resource') {
                    store.systemResources++;
                }
                else if ('subContext' in props && props.subContext === 'context') {
                    store.systemContextVariables++;
                }
            }
            if (initialValue === 'MISSING_VARIABLE_DEFINITION') {
                write(`\t[VARIABLE DEFINITION] ${variable}; initial value: MISSING_VARIABLE_DEFINITION; type: ${type}\n`);
                return;
            }
            if (type === 'boolean') {
                write(`\t[VARIABLE DEFINITION] ${variable}; initial value: ${initialValue}; type: ${type}\n`);
                return;
            }
            write(`\t[VARIABLE DEFINITION] ${variable}; initial value: ${initialValue}; ${lowerBound ? `lower bound: ${lowerBound}; ` : ''}${upperBound ? `upper bound: ${upperBound};` : ''} type: ${type}\n`);
        },
        executionDetail: (executionDetail) => {
            write(`\t[EXECUTION DETAIL] ${executionDetail.type}\n`);
        },
        info: (message, level) => {
            write(`${'\t'.repeat(level)}${message}\n`);
        },
        error: (source, message) => {
            write(`[ERROR] ${source}: ${message}\n`);
        },
        trace: (source, message, level = 0) => {
            write(`${'\t'.repeat(level)}[TRACE] ${source}: ${message}\n`);
        },
        getReport: () => {
            const endTime = Date.now();
            const elapsedTime = endTime - startTime;
            const elapsedSeconds = (elapsedTime / 1000).toFixed(3);
            const elapsedFormatted = elapsedTime >= 1000
                ? `${elapsedSeconds}s (${elapsedTime}ms)`
                : `${elapsedTime}ms`;
            // Calculate total nodes and total variables
            store.totalNodes =
                store.totalGoals + store.totalTasks + store.totalResources;
            store.totalVariables =
                store.goalVariables + store.tasksVariables + store.systemVariables;
            const summaryLines = [];
            summaryLines.push('----------------------------------------\n');
            summaryLines.push(`[LOGGER SUMMARY] ${modelFileName}\n`);
            summaryLines.push(`[ELAPSED TIME] ${elapsedFormatted}\n`);
            summaryLines.push('----------MODEL STRUCTURE SUMMARY----------\n');
            summaryLines.push(`[TOTAL GOALS] ${store.totalGoals}\n`);
            summaryLines.push(`[TOTAL TASKS] ${store.totalTasks}\n`);
            summaryLines.push(`[TOTAL RESOURCES] ${store.totalResources}\n`);
            summaryLines.push(`[TOTAL NODES] ${store.totalNodes}\n`);
            summaryLines.push(`[TOTAL VARIABLES] ${store.totalVariables}\n`);
            summaryLines.push('----------GOAL TYPE BREAKDOWN----------\n');
            summaryLines.push(`[GOAL TYPE: DEGRADATION] ${store.goalTypeDegradation}\n`);
            summaryLines.push(`[GOAL TYPE: CHOICE] ${store.goalTypeChoice}\n`);
            summaryLines.push(`[GOAL TYPE: ALTERNATIVE] ${store.goalTypeAlternative}\n`);
            summaryLines.push(`[GOAL TYPE: SEQUENCE] ${store.goalTypeSequence}\n`);
            summaryLines.push(`[GOAL TYPE: INTERLEAVED] ${store.goalTypeInterleaved}\n`);
            summaryLines.push('----------GOAL SUMMARY----------\n');
            summaryLines.push(`[GOAL MODULES] ${store.goalModules}\n`);
            summaryLines.push(`[GOAL VARIABLES] ${store.goalVariables}\n`);
            summaryLines.push(`[GOAL PURSUE LINES] ${store.goalPursueLines}\n`);
            summaryLines.push(`[GOAL ACHIEVED LINES] ${store.goalAchievedLines}\n`);
            summaryLines.push(`[GOAL SKIPPED LINES] ${store.goalSkipLines}\n`);
            summaryLines.push(`[GOAL ACHIEVABILITY FORMULAS] ${store.goalAchievabilityFormulas}\n`);
            summaryLines.push(`[GOAL MAINTAIN FORMULAS] ${store.goalMaintainFormulas}\n`);
            summaryLines.push('----------CHANGE MANAGER SUMMARY----------\n');
            summaryLines.push(`[TASKS VARIABLES] ${store.tasksVariables}\n`);
            summaryLines.push(`[TASKS LABELS] ${store.tasksLabels}\n`);
            summaryLines.push(`[TASKS TRY LINES] ${store.tasksTryLines}\n`);
            summaryLines.push(`[TASKS FAILED LINES] ${store.tasksFailedLines}\n`);
            summaryLines.push(`[TASKS ACHIEVED LINES] ${store.tasksAchievedLines}\n`);
            summaryLines.push(`[TASKS SKIPPED LINES] ${store.tasksSkippedLines}\n`);
            summaryLines.push(`[TASKS ACHIEVABILITY CONSTANTS] ${store.tasksAchievabilityConstants}\n`);
            summaryLines.push('----------SYSTEM SUMMARY----------\n');
            summaryLines.push(`[SYSTEM VARIABLES] ${store.systemVariables}\n`);
            summaryLines.push(`[SYSTEM RESOURCES] ${store.systemResources}\n`);
            summaryLines.push(`[SYSTEM CONTEXT VARIABLES] ${store.systemContextVariables}\n`);
            summaryLines.push('----------------------------------------\n');
            const fullLog = logBuffer.join('') + summaryLines.join('');
            return {
                log: fullLog,
                summary: {
                    elapsedTime: elapsedFormatted,
                    elapsedTimeMs: elapsedTime,
                    totalGoals: store.totalGoals,
                    totalTasks: store.totalTasks,
                    totalResources: store.totalResources,
                    totalNodes: store.totalNodes,
                    totalVariables: store.totalVariables,
                    goalTypeDegradation: store.goalTypeDegradation,
                    goalTypeChoice: store.goalTypeChoice,
                    goalTypeAlternative: store.goalTypeAlternative,
                    goalTypeSequence: store.goalTypeSequence,
                    goalTypeInterleaved: store.goalTypeInterleaved,
                    goalModules: store.goalModules,
                    goalVariables: store.goalVariables,
                    goalPursueLines: store.goalPursueLines,
                    goalAchievedLines: store.goalAchievedLines,
                    goalSkippedLines: store.goalSkipLines,
                    goalAchievabilityFormulas: store.goalAchievabilityFormulas,
                    goalMaintainFormulas: store.goalMaintainFormulas,
                    tasksVariables: store.tasksVariables,
                    tasksLabels: store.tasksLabels,
                    tasksTryLines: store.tasksTryLines,
                    tasksFailedLines: store.tasksFailedLines,
                    tasksAchievedLines: store.tasksAchievedLines,
                    tasksSkippedLines: store.tasksSkippedLines,
                    tasksAchievabilityConstants: store.tasksAchievabilityConstants,
                    systemVariables: store.systemVariables,
                    systemResources: store.systemResources,
                    systemContextVariables: store.systemContextVariables,
                },
            };
        },
        close: () => {
            const endTime = Date.now();
            const elapsedTime = endTime - startTime;
            const elapsedSeconds = (elapsedTime / 1000).toFixed(3);
            const elapsedFormatted = elapsedTime >= 1000
                ? `${elapsedSeconds}s (${elapsedTime}ms)`
                : `${elapsedTime}ms`;
            // Calculate total nodes and total variables
            store.totalNodes =
                store.totalGoals + store.totalTasks + store.totalResources;
            store.totalVariables =
                store.goalVariables + store.tasksVariables + store.systemVariables;
            write('----------------------------------------\n');
            write(`[LOGGER SUMMARY] ${modelFileName}\n`);
            write(`[ELAPSED TIME] ${elapsedFormatted}\n`);
            write('----------MODEL STRUCTURE SUMMARY----------\n');
            write(`[TOTAL GOALS] ${store.totalGoals}\n`);
            write(`[TOTAL TASKS] ${store.totalTasks}\n`);
            write(`[TOTAL RESOURCES] ${store.totalResources}\n`);
            write(`[TOTAL NODES] ${store.totalNodes}\n`);
            write(`[TOTAL VARIABLES] ${store.totalVariables}\n`);
            write('----------GOAL TYPE BREAKDOWN----------\n');
            write(`[GOAL TYPE: DEGRADATION] ${store.goalTypeDegradation}\n`);
            write(`[GOAL TYPE: CHOICE] ${store.goalTypeChoice}\n`);
            write(`[GOAL TYPE: ALTERNATIVE] ${store.goalTypeAlternative}\n`);
            write(`[GOAL TYPE: SEQUENCE] ${store.goalTypeSequence}\n`);
            write(`[GOAL TYPE: INTERLEAVED] ${store.goalTypeInterleaved}\n`);
            write('----------GOAL SUMMARY----------\n');
            write(`[GOAL MODULES] ${store.goalModules}\n`);
            write(`[GOAL VARIABLES] ${store.goalVariables}\n`);
            write(`[GOAL PURSUE LINES] ${store.goalPursueLines}\n`);
            write(`[GOAL ACHIEVED LINES] ${store.goalAchievedLines}\n`);
            write(`[GOAL SKIPPED LINES] ${store.goalSkipLines}\n`);
            write(`[GOAL ACHIEVABILITY FORMULAS] ${store.goalAchievabilityFormulas}\n`);
            write(`[GOAL MAINTAIN FORMULAS] ${store.goalMaintainFormulas}\n`);
            write('----------CHANGE MANAGER SUMMARY----------\n');
            write(`[TASKS VARIABLES] ${store.tasksVariables}\n`);
            write(`[TASKS LABELS] ${store.tasksLabels}\n`);
            write(`[TASKS TRY LINES] ${store.tasksTryLines}\n`);
            write(`[TASKS FAILED LINES] ${store.tasksFailedLines}\n`);
            write(`[TASKS ACHIEVED LINES] ${store.tasksAchievedLines}\n`);
            write(`[TASKS SKIPPED LINES] ${store.tasksSkippedLines}\n`);
            write(`[TASKS ACHIEVABILITY CONSTANTS] ${store.tasksAchievabilityConstants}\n`);
            write('----------SYSTEM SUMMARY----------\n');
            write(`[SYSTEM VARIABLES] ${store.systemVariables}\n`);
            write(`[SYSTEM RESOURCES] ${store.systemResources}\n`);
            write(`[SYSTEM CONTEXT VARIABLES] ${store.systemContextVariables}\n`);
            write('----------------------------------------\n');
            if (logFile) {
                logFile.end();
            }
        },
    };
    return loggerInstance;
};
let logger;
let store;
const initLogger = (modelFileName, logToConsole = false, inMemory = false) => {
    store = (0, exports.createStore)();
    logger = createLogger(modelFileName, store, logToConsole, inMemory);
    return logger;
};
exports.initLogger = initLogger;
const getLogger = () => {
    if (!logger) {
        throw new Error('Logger not initialized');
    }
    return logger;
};
exports.getLogger = getLogger;
//# sourceMappingURL=logger.js.map