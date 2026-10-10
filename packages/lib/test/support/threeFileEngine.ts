/**
 * A fixture engine that makes three files of a model, as GODA-MDP will
 * (goal-controller#33): a property file, the primary model (second, so
 * nothing may take the first file for the primary) and a script. The script
 * says which goal each line is about (`owners`); the property file doesn't.
 */
import { outputBaseName, type EngineOutput } from '../../src/engines/output';

export const threeFileEngine = (
  goals: readonly string[],
  { modelName }: { modelName: string },
): EngineOutput => ({
  files: [
    {
      id: 'reachability-max',
      fileName: 'ReachabilityMax.pctl',
      language: 'pctl',
      text: 'Pmax=? [ F "success" ]\n',
    },
    {
      id: 'model',
      fileName: `${outputBaseName(modelName)}.nm`,
      language: 'prism',
      primary: true,
      text: `mdp\n\n${goals.map((goal) => `module ${goal}\nendmodule`).join('\n\n')}\n`,
    },
    {
      id: 'evaluate',
      fileName: 'evaluate.sh',
      language: 'shell',
      text: goals.map((goal) => `echo ${goal}`).join('\n'),
      owners: goals.map((goal) => [goal]),
    },
  ],
});
