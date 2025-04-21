import { existsSync } from 'fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises';
import inquirer from 'inquirer';
import { join } from 'path';
import { edgeDTMCTemplate } from './dtmc/template';
import { loadModel } from './ObjectiveTree';
import { convertToTree } from './ObjectiveTree/creation';
import { treeVariables } from './ObjectiveTree/treeVariables';

const LAST_SELECTED_DB = 'lastSelected.db';
const VARIABLES_FILE = 'input/variables.json';

const getFilesInDirectory = async (directory: string) => {
  try {
    const files = await readdir(directory);
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const filePath = join(directory, file);
        const stats = await stat(filePath);
        return {
          name: file,
          path: filePath,
          mtime: stats.mtime,
        };
      })
    );
    return fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
};

const saveLastSelectedModel = async (filePath: string) => {
  try {
    await writeFile(LAST_SELECTED_DB, filePath);
    console.log(`Last selected model saved to ${LAST_SELECTED_DB}`);
  } catch (error) {
    console.error('Error saving last selected model:', error);
  }
};

const getLastSelectedModel = async (): Promise<string | null> => {
  try {
    const data = await readFile(LAST_SELECTED_DB, 'utf-8');
    return data.trim();
  } catch (error) {
    // File doesn't exist or can't be read
    return null;
  }
};

const runModel = async (filePath: string) => {
  try {
    const model = loadModel({ filename: filePath });
    const tree = convertToTree({ model });
    const output = edgeDTMCTemplate({ gm: tree });
    console.log(output);
    await writeFile('output/edge.mp', output);
    console.log('The file was saved successfully!');
  } catch (error) {
    console.error('Error running model:', error);
  }
};

const getExistingVariables = async (): Promise<Record<string, boolean>> => {
  try {
    if (existsSync(VARIABLES_FILE)) {
      const data = await readFile(VARIABLES_FILE, 'utf-8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Error reading variables file:', error);
    return {};
  }
};

const saveVariables = async (variables: Record<string, boolean>) => {
  try {
    // Ensure the input directory exists
    if (!existsSync('input')) {
      await mkdir('input', { recursive: true });
    }

    await writeFile(VARIABLES_FILE, JSON.stringify(variables, null, 2));
    console.log(`Variables saved to ${VARIABLES_FILE}`);
  } catch (error) {
    console.error('Error saving variables:', error);
  }
};

const inputDefaultVariables = async () => {
  try {
    // Get the last selected model or prompt for one
    let modelPath: string | null = await getLastSelectedModel();

    if (!modelPath) {
      const files = await getFilesInDirectory('examples');
      if (files.length === 0) {
        console.log('No files found in the example directory.');
        return;
      }

      const { selectedFile } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedFile',
          message: 'Select a model file to extract variables from:',
          choices: files.map((file) => ({
            name: file.name,
            value: file.path,
          })),
        },
      ]);

      modelPath = selectedFile;
    }

    // At this point modelPath is guaranteed to be a string
    const model = loadModel({ filename: modelPath as string });
    const tree = convertToTree({ model });
    const variables = treeVariables(tree);

    if (variables.length === 0) {
      console.log('No variables found in the model.');
      return;
    }

    // Get existing variable values
    const existingVariables = await getExistingVariables();

    // Create questions for each variable
    const questions = variables.map((variable) => ({
      type: 'input' as const,
      name: variable,
      message: `Enter default value for ${variable} (true/false):`,
      default:
        existingVariables[variable] !== undefined
          ? String(existingVariables[variable])
          : 'false',
      validate: (input: string) => {
        const value = input.toLowerCase();
        if (value === 'true' || value === 'false') {
          return true;
        }
        return 'Please enter "true" or "false"';
      },
      filter: (input: string) => input.toLowerCase() === 'true',
    }));

    // Prompt for variable values
    const answers = await inquirer.prompt<Record<string, boolean>>(questions);

    // Save variables
    await saveVariables(answers);

    console.log('Default variables have been set successfully!');
  } catch (error) {
    console.error('Error setting default variables:', error);
  }
};

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
