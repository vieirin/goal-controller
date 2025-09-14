import fs from 'fs';
import type { GoalExecutionDetail, GoalNode } from '../ObjectiveTree/types';

const createLoggerFile = (modelFileName: string) => {
  const logFilePath = `logs/${modelFileName}.log`;
  fs.mkdirSync('logs', { recursive: true });
  return fs.createWriteStream(logFilePath, { flags: 'w' });
};

const createLogger = (modelFileName: string, logToConsole: boolean = false) => {
  const logFile = createLoggerFile(modelFileName);
  const write = (message: string) => {
    logFile.write(message);
    if (logToConsole) {
      console.log(message);
    }
  };

  return {
    decisionVariable: (decisionVariable: [string, number]) => {
      write(
        `[DECISION VARIABLES]: ${decisionVariable[0]}: space ${decisionVariable[1]}\n`
      );
    },
    initGoal: (goal: GoalNode) => {
      write(`[INIT GOAL] ${goal.id}: ${goal.name}\n`);
      write(
        `\tChildren: ${
          goal.children?.length && goal.children.length > 0
            ? goal.children.map((child) => child.id).join(', ')
            : 'none'
        }\n`
      );
      write(
        `\tTasks: ${goal.tasks?.map((task) => task.id).join(', ') ?? 'none'}\n`
      );
      write(
        `\tType: ${
          goal.execCondition?.maintain?.sentence ? 'maintain' : 'achieve'
        }\n`
      );
      write(`\tRelation to children: ${goal.relationToChildren}\n`);
      write(`\tExecution detail: ${goal.executionDetail?.type ?? 'none'}\n`);
    },
    initTask: (task: GoalNode) => {
      write(`[INIT TASK] ${task.id}: ${task.name}\n`);
      write(
        `\tResources: ${
          task.resources?.length && task.resources.length > 0
            ? task.resources.map((resource) => resource.id).join(', ')
            : 'none'
        }\n`
      );
    },
    taskTranstions: {
      transition: (
        taskId: string,
        leftStatement: string,
        updateStatement: string,
        prismLabelStatement: string,
        transition: 'pursue' | 'achieve' | 'failed'
      ) => {
        const transitionLogLabel = transition.toUpperCase();
        write(`\t[${transitionLogLabel}] Task ${taskId} skipped label\n`);
        write(`\t\t[CONDITION] ${leftStatement}\n`);
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
          guardStatement: string
        ) => {
          write(`\t\t[EXECUTION DETAIL: CHOICE]\n`);
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
                ' -> '
              )}\n`
            );
          },
          retry: (
            currentGoal: string,
            goalToRetry: string,
            amountOfRetries: number
          ) => {
            write(
              `\t\t[EXECUTION DETAIL: DEGRADATION] ${currentGoal} retry after: ${goalToRetry} ${amountOfRetries} times\n`
            );
          },
          alternative: (currentGoal: string, alternative: string[]) => {
            write(
              `\t\t[EXECUTION DETAIL: ALTERNATIVE GOAL] ${currentGoal} other alternatives: ${alternative.join(
                ', '
              )}\n`
            );
          },
        },
        sequence: (
          goalId: string,
          currentGoal: string,
          leftGoals: string[],
          rightGoals: string[]
        ) => {
          write(
            `\t\t[EXECUTION DETAIL: SEQUENCE] ${goalId}: Curr ${currentGoal};\n`
          );
          write(
            `\t\t\t[LEFT GOALS] - should be achieved:  ${
              leftGoals.length > 0 ? leftGoals.join(', ') : 'none'
            }\n`
          );
          write(
            `\t\t\t[RIGHT GOALS] - should be not achieved: ${rightGoals.join(
              ', '
            )}\n`
          );
        },
        alternative: (currentGoal: string, alternative: string[]) => {
          write(
            `\t\t[EXECUTION DETAIL: ALTERNATIVE GOAL] ${currentGoal} other alternatives: ${alternative.join(
              ', '
            )}\n`
          );
        },
        interleaved: () => {
          write(
            `\t\t[EXECUTION DETAIL: INTERLEAVED] interleaved goals have no guard condition\n`
          );
        },
        activationContext: (sentence: string) => {
          write(
            `\t\t[EXECUTION DETAIL: CONTEXT] Guard statement: ${sentence}\n`
          );
        },
        noActivationContext: (goalId: string) => {
          write(
            `\t\t[EXECUTION DETAIL: CONTEXT] Guard statement: ${goalId} has no activation context\n`
          );
        },
      },
      stepStatement: (step: number, left: string, right: string) => {
        write(`\t\tPRISM statement: ${left} -> ${right}\n`);
        write(`\t[END OF STEP ${step}]\n`);
      },
    },
    achieve: (
      goalId: string,
      condition: string,
      update: string,
      prismLabelStatement: string
    ) => {
      write(`\t[ACHIEVE] Goal ${goalId} achieved label\n`);
      write(`\t\t[CONDITION] ${condition}\n`);
      write(`\t\t[UPDATE] ${update}\n`);
      write(`\t\tPRISM statement: ${prismLabelStatement}\n`);
      write(`\t[END OF ACHIEVE]\n`);
    },
    skip: (
      goalId: string,
      leftStatement: string,
      updateStatement: string,
      prismLabelStatement: string
    ) => {
      write(`\t[SKIP] Goal ${goalId} skipped label\n`);
      write(`\t\t[CONDITION] ${leftStatement}\n`);
      write(`\t\t[UPDATE] ${updateStatement}\n`);
      write(`\t\tPRISM statement: ${prismLabelStatement}\n`);
      write(`\t[END OF SKIP]\n`);
    },
    variableDefinition: (variable: string, upperBound: number) => {
      write(
        `\t[VARIABLE DEFINITION] ${variable}; upper bound: ${upperBound}\n`
      );
    },
    executionDetail: (executionDetail: GoalExecutionDetail) => {
      write(`\t[EXECUTION DETAIL] ${executionDetail.type}\n`);
    },

    info: (message: string, level: number) => {
      write(`${'\t'.repeat(level)}${message}\n`);
    },
    error: (message: string) => {
      write(`${message}\n`);
      console.error(message);
    },
    warn: (message: string) => {
      write(`${message}\n`);
      console.warn(message);
    },
    debug: (message: string) => {
      write(`${message}\n`);
      console.debug(message);
    },
    trace: (message: string) => {
      write(`${message}\n`);
      console.trace(message);
    },
  };
};

let logger: ReturnType<typeof createLogger>;

export const initLogger = (modelFileName: string) => {
  logger = createLogger(modelFileName);
};

export const getLogger = () => {
  if (!logger) {
    throw new Error('Logger not initialized');
  }
  return logger;
};
