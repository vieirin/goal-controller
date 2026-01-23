"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__test_only_exports__ = exports.generateValidatedPrismModel = void 0;
const prismValidator_1 = require("../prismValidator");
const decisionVariables_1 = require("./decisionVariables");
const changeManager_1 = require("./modules/changeManager/changeManager");
const goalModules_1 = require("./modules/goalModule/goalModules");
const system_1 = require("./modules/system/system");
const edgeDTMCTemplate = ({ gm, fileName, clean = false, variables, }) => {
    const dtmcModel = `dtmc

${(0, decisionVariables_1.decisionVariablesTemplate)({ gm })}

${(0, goalModules_1.goalModules)({ gm })}

${(0, changeManager_1.changeManagerModule)({ gm, fileName, variables })}

${(0, system_1.systemModule)({ gm, fileName, clean, variables })}
`;
    return dtmcModel;
};
const generateValidatedPrismModel = ({ gm, fileName, clean = false, variables, }) => {
    const prismModel = edgeDTMCTemplate({ gm, fileName, clean, variables });
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
    const report = (0, prismValidator_1.validate)(gm, prismModel, fileName);
    if (report.summary.totalMissing > 0) {
        throw new Error('PRISM model is not valid');
    }
    return prismModel;
};
exports.generateValidatedPrismModel = generateValidatedPrismModel;
// eslint-disable-next-line @typescript-eslint/naming-convention
exports.__test_only_exports__ = {
    edgeDTMCTemplate,
};
//# sourceMappingURL=engine.js.map