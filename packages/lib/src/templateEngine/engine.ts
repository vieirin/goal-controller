import { type GoalTree } from '../GoalTree/types';
import { validate } from '../prismValidator';
import { decisionVariablesTemplate } from './decisionVariables';
import { changeManagerModule } from './modules/changeManager/changeManager';
import { goalModules } from './modules/goalModule/goalModules';
import { systemModule } from './modules/system/system';

const edgeDTMCTemplate = ({
  gm,
  fileName,
  clean = false,
  variables,
  generateDecisionVars = true,
}: {
  gm: GoalTree;
  fileName: string;
  clean?: boolean;
  variables?: Record<string, boolean | number>;
  generateDecisionVars?: boolean;
}): string => {
  const dtmcModel = `dtmc

${decisionVariablesTemplate({ gm, enabled: generateDecisionVars })}

${goalModules({ gm })}

${changeManagerModule({ gm, fileName, variables })}

${systemModule({ gm, fileName, clean, variables })}
`;
  return dtmcModel;
};

export const generateValidatedPrismModel = ({
  gm,
  fileName,
  clean = false,
  variables,
  generateDecisionVars = true,
}: {
  gm: GoalTree;
  fileName: string;
  clean?: boolean;
  variables?: Record<string, boolean | number>;
  generateDecisionVars?: boolean;
}): string => {
  const prismModel = edgeDTMCTemplate({
    gm,
    fileName,
    clean,
    variables,
    generateDecisionVars,
  });
  // const all = [
  //   ...allByType({ gm, type: 'goal' }),
  //   ...allByType({ gm, type: 'task' }),
  // ];
  // console.log(
  //   all.map((goal) => ({
  //     id: goal.id,
  //     children: childrenIncludingTasks({ node: goal }).map((child) => child.id),
  //     relationToChildren: goal.relationToChildren,
  //   })),
  // );
  // console.log('==============================================');
  // console.log(
  //   all.map((goal) => ({
  //     id: goal.id,
  //     relationToChildren: goal.relationToChildren,
  //   })),
  // );
  // console.log('==============================================');
  // console.log(
  //   all
  //     .filter(
  //       (goal) =>
  //         !!goal.execCondition?.maintain?.sentence ||
  //         !!goal.execCondition?.assertion?.sentence,
  //     )
  //     .map((goal) => ({
  //       id: goal.id,
  //       maintain: goal.execCondition?.maintain?.sentence,
  //       assertion: goal.execCondition?.assertion?.sentence,
  //     })),
  // );
  // console.log('==============================================');
  // console.log('==============================================');
  // console.log(
  //   all
  //     .filter((goal) => !!goal.execCondition?.maintain?.sentence)
  //     .map((goal) => ({
  //       id: goal.id,
  //       type: 'maintain',
  //       formula: 1,
  //       formulaExpected: 1,
  //     })),
  // );
  const report = validate(gm, prismModel, fileName);
  if (report.summary.totalMissing > 0) {
    throw new Error('PRISM model is not valid');
  }
  return prismModel;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const __test_only_exports__ = {
  edgeDTMCTemplate,
};
