import fs from 'fs';
import path from 'path';
import type { GoalExecutionDetail, GoalNode } from '../GoalTree/types';

type LoggerStore = {
  goalModules: number;
  goalVariables: number;
  goalPursueLines: number;
  goalAchievabilityFormulas: number;
  goalMaintainFormulas: number;
  goalAchievedLines: number;
  goalSkipLines: number;
  tasksVariables: number;
  tasksLabels: number;
  tasksAchievabilityConstants: number;
  tasksTryLines: number;
  tasksFailedLines: number;
  tasksAchievedLines: number;
  tasksSkippedLines: number;
  systemVariables: number;
  systemResources: number;
  systemContextVariables: number;
};

type VariableDefinitionBase = {
  variable: string;
  initialValue: number | boolean | 'MISSING_VARIABLE_DEFINITION';
  upperBound?: number | boolean;
  lowerBound?: number | boolean;
  type?: 'boolean' | 'int';
};

type VariableDefinition =
  | (VariableDefinitionBase & { context: 'goal' | 'task' })
  | (VariableDefinitionBase & {
      context: 'system';
      subContext: 'resource' | 'context';
    });

export const createStore = (): LoggerStore => {
  // Create a plain object to hold the state
  const state: LoggerStore = {
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
  };

  // Create a Proxy that intercepts property access for all LoggerStore properties
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const emptyStore = {} as LoggerStore;
  return new Proxy(emptyStore, {
    get(_target, prop: keyof LoggerStore) {
      return state[prop];
    },
    set(_target, prop: keyof LoggerStore, value: number) {
      state[prop] = value;
      return true;
    },
  });
};

const createLoggerFile = (modelFileName: string): fs.WriteStream => {
  const logFilePath = `logs/${modelFileName}.log`;
  const logDir = path.dirname(logFilePath);
  fs.mkdirSync(logDir, { recursive: true });
  return fs.createWriteStream(logFilePath, { flags: 'w' });
};

const createLogger = (
  modelFileName: string,
  store: LoggerStore,
  logToConsole: boolean = false,
) => {
  const logFile = createLoggerFile(modelFileName);
  const write = (message: string): void => {
    logFile.write(message);
    if (logToConsole) {
      // eslint-disable-next-line no-console
      console.log(message);
    }
  };

  return {
    decisionVariable: (decisionVariable: [string, number]) => {
      write(
        `[DECISION VARIABLES]: ${decisionVariable[0]}: space ${decisionVariable[1]}\n`,
      );
    },
    initGoal: (goal: GoalNode) => {
      store.goalModules++;
      write(`[INIT GOAL] ${goal.id}: ${goal.name ?? 'none'}\n`);
      write(
        `\tChildren: ${
          goal.children?.length && goal.children.length > 0
            ? goal.children.map((child) => child.id).join(', ')
            : 'none'
        }\n`,
      );
      write(
        `\tTasks: ${goal.tasks?.map((task) => task.id).join(', ') ?? 'none'}\n`,
      );
      write(
        `\tType: ${
          goal.execCondition?.maintain?.sentence ? 'maintain' : 'achieve'
        }\n`,
      );
      write(`\tRelation to children: ${goal.relationToChildren ?? 'none'}\n`);
      write(`\tExecution detail: ${goal.executionDetail?.type ?? 'none'}\n`);
      write(`\t[TRACE]: [${goal.id}] Emits module: ${goal.id}\n`);
    },
    initTask: (task: GoalNode) => {
      write(`[INIT TASK] ${task.id}: ${task.name ?? 'none'}\n`);
      write(
        `\tResources: ${
          task.resources?.length && task.resources.length > 0
            ? task.resources.map((resource) => resource.id).join(', ')
            : 'none'
        }\n`,
      );
    },
    initSystem: () => {
      write('[INIT SYSTEM MODULE]\n');
    },
    maintainFormulaDefinition: (
      goalId: string,
      formula: string,
      sentence: string,
      prismLine: string,
    ) => {
      store.goalMaintainFormulas++;
      write(`\t[TRACE] ${goalId}.maintainCondition -> ${formula} \n`);
      write(
        `\t[FORMULA DEFINITION] ${formula}; guard statement: ${sentence}\n`,
      );
      write(`\t\t[PRISM emitted statement]: ${prismLine}\n`);
    },
    achievabilityFormulaDefinition: (
      goalId: string,
      formula: string,
      type: 'AND' | 'OR' | 'SINGLE_GOAL',
      sentence: string,
      prismLine: string,
    ) => {
      store.goalAchievabilityFormulas++;
      write(`\t[TRACE] ${goalId}.${type} -> ${formula} \n`);
      write(
        `\t[FORMULA DEFINITION] ${formula}; guard statement: ${sentence}\n`,
      );
      write(`\t\t[PRISM emitted statement]: ${prismLine}\n`);
    },
    achievabilityTaskConstant: (
      taskId: string,
      constant: string,
      value: number,
    ) => {
      store.tasksAchievabilityConstants++;
      write(
        `\t[TASK ACHIEVABILITY CONSTANT] ${taskId}: ${constant} = ${value}\n`,
      );
    },
    taskTranstions: {
      transition: (
        taskId: string,
        leftStatement: string,
        updateStatement: string,
        prismLabelStatement: string,
        transition: 'pursue' | 'achieve' | 'failed' | 'try',
        maxRetries?: number,
      ) => {
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
        write(
          `\t[${transitionLogLabel}] Task ${taskId} ${transitionLogLabel} label\n`,
        );
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
      pursue: (goal: GoalNode, step: number) => {
        write(`\t[PURSUE GENERATION] ${goal.id} - STEP ${step}\n`);
      },
      defaultPursueCondition: (pursueCondition: string) => {
        write(`\t\t[DEFAULT PURSUE CONDITION] ${pursueCondition}\n`);
      },
      update: (update: string) => {
        write(`\t\t[UPDATE] ${update}\n`);
      },
      goalDependency: (goalId: string, dependsOn: string[]) => {
        if (!dependsOn.length) {
          return;
        }
        write(`\t\t[GOAL DEPENDENCY] ${goalId}: ${dependsOn.join(', ')}\n`);
      },
      executionDetail: {
        choice: (
          currentGoal: string,
          otherGoals: string[],
          guardStatement: string,
        ) => {
          write('\t\t[EXECUTION DETAIL: CHOICE]\n');
          write(`\t\t\t[CURRENT GOAL] ${currentGoal}\n`);
          write(`\t\t\t[OTHER GOALS] ${otherGoals.join(', ')}\n`);
          write(`\t\t\t[GUARD STATEMENT] ${guardStatement}\n`);
        },
        degradation: {
          init: (currentGoal: string, degradation: string[]) => {
            const priority =
              degradation.findIndex((goal) => goal === currentGoal) + 1;
            write(
              `\t\t[EXECUTION DETAIL: DEGRADATION] ${currentGoal} priority #${priority} : ${degradation.join(
                ' -> ',
              )}\n`,
            );
          },
          retry: (
            currentGoal: string,
            goalToRetry: string,
            amountOfRetries: number,
          ) => {
            write(
              `\t\t[EXECUTION DETAIL: DEGRADATION] ${currentGoal} retry after: ${goalToRetry} ${amountOfRetries} times\n`,
            );
          },
          alternative: (currentGoal: string, alternative: string[]) => {
            write(
              `\t\t[EXECUTION DETAIL: ALTERNATIVE GOAL] ${currentGoal} other alternatives: ${alternative.join(
                ', ',
              )}\n`,
            );
          },
        },
        sequence: (
          goalId: string,
          currentGoal: string,
          leftGoals: string[],
          rightGoals: string[],
        ) => {
          write(
            `\t\t[EXECUTION DETAIL: SEQUENCE] ${goalId}: Curr ${currentGoal};\n`,
          );
          write(
            `\t\t\t[LEFT GOALS] - should be achieved:  ${
              leftGoals.length > 0 ? leftGoals.join(', ') : 'none'
            }\n`,
          );
          write(
            `\t\t\t[RIGHT GOALS] - should be not achieved: ${rightGoals.join(
              ', ',
            )}\n`,
          );
        },
        alternative: (currentGoal: string, alternative: string[]) => {
          write(
            `\t\t[EXECUTION DETAIL: ALTERNATIVE GOAL] ${currentGoal} other alternatives: ${alternative.join(
              ', ',
            )}\n`,
          );
        },
        interleaved: () => {
          write(
            '\t\t[EXECUTION DETAIL: INTERLEAVED] interleaved goals have no guard condition\n',
          );
        },
        activationContext: (sentence: string) => {
          write(
            `\t\t[EXECUTION DETAIL: CONTEXT] Guard statement: ${sentence}\n`,
          );
        },
        noActivationContext: (goalId: string) => {
          write(
            `\t\t[EXECUTION DETAIL: CONTEXT] Guard statement: ${goalId} has no activation context\n`,
          );
        },
      },
      stepStatement: (step: number, left: string, right: string) => {
        write(`\t\tPRISM statement: ${left} -> ${right}\n`);
        write(`\t[END OF STEP ${step}]\n`);
      },
      finish: () => {
        store.goalPursueLines++;
        write('\t[END OF PURSUE]\n');
      },
    },
    achieve: (
      goalId: string,
      condition: string,
      update: string,
      prismLabelStatement: string,
    ) => {
      store.goalAchievedLines++;
      write(`\t[ACHIEVE] Goal ${goalId} achieved label\n`);
      write(`\t\t[CONDITION] ${condition}\n`);
      write(`\t\t[UPDATE] ${update}\n`);
      write(`\t\tPRISM statement: ${prismLabelStatement}\n`);
      write('\t[END OF ACHIEVE]\n');
    },
    skip: (
      goalId: string,
      leftStatement: string,
      updateStatement: string,
      prismLabelStatement: string,
    ) => {
      store.goalSkipLines++;
      write(`\t[SKIP] Goal ${goalId} skipped label\n`);
      write(`\t\t[CONDITION] ${leftStatement}\n`);
      write(`\t\t[UPDATE] ${updateStatement}\n`);
      write(`\t\tPRISM statement: ${prismLabelStatement}\n`);
      write('\t[END OF SKIP]\n');
    },
    variableDefinition: ({
      variable,
      initialValue,
      upperBound,
      lowerBound,
      type = 'int',
      context = 'goal',
      ...props
    }: VariableDefinition) => {
      if (context === 'goal') {
        store.goalVariables++;
      } else if (context === 'task') {
        store.tasksVariables++;
      } else if (context === 'system') {
        store.systemVariables++;
        if ('subContext' in props && props.subContext === 'resource') {
          store.systemResources++;
        } else if ('subContext' in props && props.subContext === 'context') {
          store.systemContextVariables++;
        }
      }

      if (initialValue === 'MISSING_VARIABLE_DEFINITION') {
        write(
          `\t[VARIABLE DEFINITION] ${variable}; initial value: MISSING_VARIABLE_DEFINITION; type: ${type}\n`,
        );
        return;
      }

      if (type === 'boolean') {
        write(
          `\t[VARIABLE DEFINITION] ${variable}; initial value: ${initialValue}; type: ${type}\n`,
        );
        return;
      }
      write(
        `\t[VARIABLE DEFINITION] ${variable}; initial value: ${initialValue}; ${
          lowerBound ? `lower bound: ${lowerBound}; ` : ''
        }${upperBound ? `upper bound: ${upperBound};` : ''} type: ${type}\n`,
      );
    },
    executionDetail: (executionDetail: GoalExecutionDetail) => {
      write(`\t[EXECUTION DETAIL] ${executionDetail.type}\n`);
    },

    info: (message: string, level: number) => {
      write(`${'\t'.repeat(level)}${message}\n`);
    },
    error: (source: string, message: string | Error | unknown) => {
      write(`[ERROR] ${source}: ${message as string}\n`);
    },
    trace: (source: string, message: string, level: number = 0) => {
      write(`${'\t'.repeat(level)}[TRACE] ${source}: ${message}\n`);
    },
    close: () => {
      write('----------------------------------------\n');
      write(`[LOGGER SUMMARY] ${modelFileName}\n`);
      write('----------GOAL SUMMARY----------\n');
      write(`[GOAL MODULES] ${store.goalModules}\n`);
      write(`[GOAL VARIABLES] ${store.goalVariables}\n`);
      write(`[GOAL PURSUE LINES] ${store.goalPursueLines}\n`);
      write(`[GOAL ACHIEVED LINES] ${store.goalAchievedLines}\n`);
      write(`[GOAL SKIPPED LINES] ${store.goalSkipLines}\n`);
      write(
        `[GOAL ACHIEVABILITY FORMULAS] ${store.goalAchievabilityFormulas}\n`,
      );
      write(`[GOAL MAINTAIN FORMULAS] ${store.goalMaintainFormulas}\n`);
      write('----------CHANGE MANAGER SUMMARY----------\n');
      write(`[TASKS VARIABLES] ${store.tasksVariables}\n`);
      write(`[TASKS LABELS] ${store.tasksLabels}\n`);
      write(`[TASKS TRY LINES] ${store.tasksTryLines}\n`);
      write(`[TASKS FAILED LINES] ${store.tasksFailedLines}\n`);
      write(`[TASKS ACHIEVED LINES] ${store.tasksAchievedLines}\n`);
      write(`[TASKS SKIPPED LINES] ${store.tasksSkippedLines}\n`);
      write(
        `[TASKS ACHIEVABILITY CONSTANTS] ${store.tasksAchievabilityConstants}\n`,
      );
      write('----------SYSTEM SUMMARY----------\n');
      write(`[SYSTEM VARIABLES] ${store.systemVariables}\n`);
      write(`[SYSTEM RESOURCES] ${store.systemResources}\n`);
      write(`[SYSTEM CONTEXT VARIABLES] ${store.systemContextVariables}\n`);
      write('----------------------------------------\n');
    },
  };
};

let logger: ReturnType<typeof createLogger>;
let store: LoggerStore;

export const initLogger = (
  modelFileName: string,
  logToConsole: boolean = false,
): ReturnType<typeof createLogger> => {
  store = createStore();
  logger = createLogger(modelFileName, store, logToConsole);
  return logger;
};

export const getLogger = (): ReturnType<typeof createLogger> => {
  if (!logger) {
    throw new Error('Logger not initialized');
  }
  return logger;
};
