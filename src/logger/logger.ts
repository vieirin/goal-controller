import fs from 'fs';
import path from 'path';
import type { GoalExecutionDetail, GoalNode } from '../GoalTree/types';

export interface LoggerStore {
  goalModules: number;
  goalVariables: number;
  goalPursueLines: number;
  goalAchievabilityFormulas: number;
  goalMaintainFormulas: number;
  taskVariables: number;
  taskLabels: number;
  taskAchievabilityConstants: number;
  systemVariables: number;
  incrementGoalModules: () => void;
  incrementGoalVariables: () => void;
  incrementGoalPursueLines: () => void;
  incrementGoalAchievabilityFormulas: () => void;
  incrementGoalMaintainFormulas: () => void;
  incrementTaskVariables: () => void;
  incrementTaskLabels: () => void;
  incrementTaskAchievabilityConstants: () => void;
  incrementSystemVariables: () => void;
}

export const createStore = (): LoggerStore => {
  const store: LoggerStore = {
    goalModules: 0,
    goalVariables: 0,
    goalPursueLines: 0,
    goalAchievabilityFormulas: 0,
    goalMaintainFormulas: 0,
    taskVariables: 0,
    taskLabels: 0,
    taskAchievabilityConstants: 0,
    systemVariables: 0,
    incrementGoalModules: () => {
      store.goalModules++;
    },
    incrementGoalVariables: () => {
      store.goalVariables++;
    },
    incrementGoalPursueLines: () => {
      store.goalPursueLines++;
    },
    incrementGoalAchievabilityFormulas: () => {
      store.goalAchievabilityFormulas++;
    },
    incrementGoalMaintainFormulas: () => {
      store.goalMaintainFormulas++;
    },
    incrementTaskVariables: () => {
      store.taskVariables++;
    },
    incrementTaskLabels: () => {
      store.taskLabels++;
    },
    incrementTaskAchievabilityConstants: () => {
      store.taskAchievabilityConstants++;
    },
    incrementSystemVariables: () => {
      store.systemVariables++;
    },
  };
  return store;
};

const createLoggerFile = (modelFileName: string) => {
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
  const write = (message: string) => {
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
      store.incrementGoalModules();
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
    formulaDefinition: (
      goalId: string,
      formula: string,
      sentence: string,
      prismLine: string,
    ) => {
      store.incrementGoalMaintainFormulas();
      write(`\t[TRACE] ${goalId}.maintainCondition -> ${formula} \n`);
      write(
        `\t[FORMULA DEFINITION] ${formula}; guard statement: ${sentence}\n`,
      );
      write(`\t\t[PRISM emitted statement]: ${prismLine}\n`);
    },
    taskTranstions: {
      transition: (
        taskId: string,
        leftStatement: string,
        updateStatement: string,
        prismLabelStatement: string,
        transition: 'pursue' | 'achieve' | 'failed',
        maxRetries?: number,
      ) => {
        store.incrementTaskLabels();
        const transitionLogLabel = transition.toUpperCase();
        write(`\t[${transitionLogLabel}] Task ${taskId} skipped label\n`);
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
        store.incrementGoalPursueLines();
        write(`\t\tPRISM statement: ${left} -> ${right}\n`);
        write(`\t[END OF STEP ${step}]\n`);
      },
    },
    achieve: (
      goalId: string,
      condition: string,
      update: string,
      prismLabelStatement: string,
    ) => {
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
    }: {
      variable: string;
      initialValue: number | boolean | 'MISSING_VARIABLE_DEFINITION';
      upperBound?: number | boolean;
      lowerBound?: number | boolean;
      type?: 'boolean' | 'int';
      context?: 'goal' | 'task' | 'system';
    }) => {
      if (context === 'goal') {
        store.incrementGoalVariables();
      } else if (context === 'task') {
        store.incrementTaskVariables();
      } else if (context === 'system') {
        store.incrementSystemVariables();
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
    error: (source: string, message: string) => {
      write(`[ERROR] ${source}: ${message}\n`);
    },
    trace: (source: string, message: string, level: number = 0) => {
      write(`${'\t'.repeat(level)}[TRACE] ${source}: ${message}\n`);
    },
  };
};

let logger: ReturnType<typeof createLogger>;
let store: LoggerStore;

export const initLogger = (
  modelFileName: string,
  logToConsole: boolean = false,
) => {
  store = createStore();
  logger = createLogger(modelFileName, store, logToConsole);
};

export const getLogger = () => {
  if (!logger) {
    throw new Error('Logger not initialized');
  }
  return logger;
};
