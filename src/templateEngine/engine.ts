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
}: {
  gm: GoalTree;
  fileName: string;
  clean?: boolean;
}): string => {
  const dtmcModel = `dtmc

${decisionVariablesTemplate({ gm })}

${goalModules({ gm })}

${changeManagerModule({ gm, fileName })}

${systemModule({ gm, fileName, clean })}
`;
  return dtmcModel;
};

export const generateValidatedPrismModel = ({
  gm,
  fileName,
  clean = false,
}: {
  gm: GoalTree;
  fileName: string;
  clean?: boolean;
}): string => {
  const prismModel = edgeDTMCTemplate({ gm, fileName, clean });
  // console.log(
  //   [...allByType({ gm, type: 'goal' }), ...allByType({ gm, type: 'task' })]
  //     .map((goal) => ({
  //       id: goal.id,
  //       ex: {
  //         maintain: goal.execCondition?.maintain?.sentence,
  //         assertion: goal.execCondition?.assertion?.sentence,
  //       },
  //     }))
  //     .filter((goal) => !!goal.ex.assertion || !!goal.ex.maintain),
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
