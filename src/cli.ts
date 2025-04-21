import inquirer from 'inquirer';
import { runModel } from './cli/menu/selectModel';
import { inputDefaultVariables } from './cli/menu/variablesInput';
import {
  getFilesInDirectory,
  getLastSelectedModel,
  saveLastSelectedModel,
} from './cli/utils';

const mainMenu = async () => {
  const lastSelectedModel = await getLastSelectedModel();
  const menuChoices = [
    { name: 'Run the model', value: 'run' },
    { name: 'Input default variables', value: 'variables' },
  ];

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
    await runModel(lastSelectedModel);
  } else if (action === 'run') {
    const files = await getFilesInDirectory('examples');
    if (files.length === 0) {
      console.log('No files found in the example directory.');
      return mainMenu();
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
    await runModel(selectedFile);
  } else if (action === 'variables') {
    await inputDefaultVariables();
  }

  // Return to main menu
  return mainMenu();
};

// Start the CLI
mainMenu().catch((error) => {
  if (error.name === 'ExitPromptError') {
    console.log('Exiting...');
    process.exit(0);
  }
  console.error(error);
});
