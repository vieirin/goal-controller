import { existsSync, readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import inquirer from 'inquirer';
import path from 'path';
import { runModel } from './cli/menu/selectModel';
import {
  getVariablesFilePath,
  inputDefaultVariables,
} from './cli/menu/variablesInput';
import {
  getFilesInDirectory,
  getLastSelectedModel,
  saveLastSelectedModel,
} from './cli/utils';
import { GoalTree, Model } from '@goal-controller/goal-tree';
import { edgeEngineMapper } from './engines/edge';

const loadVariables = (modelPath: string): Record<string, boolean | number> => {
  const variablesFilePath = getVariablesFilePath(modelPath);
  try {
    return JSON.parse(readFileSync(variablesFilePath, 'utf8'));
  } catch (error) {
    console.error('Error reading variables file:', error);
    return {};
  }
};

// Parse command line arguments for clean flag
const args = process.argv.slice(2);
const cleanFlag = args.includes('--clean') || args.includes('-c');

const mainMenu = async (): Promise<void> => {
  const lastSelectedModel = await getLastSelectedModel();
  const menuChoices = [
    { name: 'Run the model', value: 'run' },
    { name: 'Input default variables', value: 'variables' },
    { name: 'Dump tree to JSON', value: 'dumpTree' },
  ];

  if (process.env.MODE === 'last' && lastSelectedModel) {
    const variables = loadVariables(lastSelectedModel);
    await runModel(lastSelectedModel, variables, cleanFlag);
    return;
  }

  // Add "Run last selected model" option if it exists
  if (lastSelectedModel) {
    const fileName = lastSelectedModel.split('/').pop() || 'unknown';
    menuChoices.unshift({
      name: `Run last selected model (${fileName})`,
      value: 'last',
    });
  }

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: menuChoices,
    },
  ]);

  if (action === 'last' && lastSelectedModel) {
    // Check if variables file exists for the last selected model
    const variablesFilePath = getVariablesFilePath(lastSelectedModel);
    if (!existsSync(variablesFilePath)) {
      console.log(
        'Variables file not found for the last selected model. Please input variables first.',
      );
      await inputDefaultVariables(lastSelectedModel);
    }
    const variables = loadVariables(lastSelectedModel);
    await runModel(lastSelectedModel, variables, cleanFlag);
  } else if (action === 'run') {
    const files = await getFilesInDirectory('examples');
    if (files.length === 0) {
      console.log('No files found in the example directory.');
      await mainMenu();
    }

    const { selectedFile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedFile',
        message: 'Select a model file to run:',
        choices: files.map((file) => ({
          name: file.name,
          value: file.path,
        })),
        default: lastSelectedModel || files[0]?.path,
      },
    ]);

    await saveLastSelectedModel(selectedFile);

    // Check if variables file exists for the selected model
    const variablesFilePath = getVariablesFilePath(selectedFile);
    if (!existsSync(variablesFilePath)) {
      console.log(
        'Variables file not found for the selected model. Please input variables first.',
      );
      await inputDefaultVariables(selectedFile);
    }

    const variables = loadVariables(selectedFile);
    await runModel(selectedFile, variables, cleanFlag);
  } else if (action === 'variables') {
    await inputDefaultVariables();
  } else if (action === 'dumpTree') {
    const files = await getFilesInDirectory('examples');
    if (files.length === 0) {
      console.log('No files found in the example directory.');
      await mainMenu();
      return;
    }

    const { selectedFile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedFile',
        message: 'Select a model file to run:',
        choices: files.map((file) => ({
          name: file.name,
          value: file.path,
        })),
        default: lastSelectedModel || files[0]?.path,
      },
    ]);

    const model = Model.load(selectedFile);
    const tree = GoalTree.fromModel(model, edgeEngineMapper);
    const json = tree.toJSON();
    await writeFile(`output/${path.parse(selectedFile).name}.json`, json);
    console.log(
      `The file ${path.parse(selectedFile).name}.json was saved successfully!`,
    );
  }

  // Return to main menu
  await mainMenu();
};

// Start the CLI
mainMenu().catch((error) => {
  if (error.name === 'ExitPromptError') {
    console.log('Exiting...');
    process.exit(0);
  }
  console.error(error);
});
