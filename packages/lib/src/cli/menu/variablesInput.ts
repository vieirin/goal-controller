import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import inquirer from 'inquirer';
import { loadPistarModel } from '@goal-controller/goal-tree';
import { convertToTree } from '@goal-controller/goal-tree';
import {
  getTaskAchievabilityVariables,
  treeContextVariables,
} from '@goal-controller/goal-tree';
import { getVariablesFilePath } from '../../utils/variablesPath';
import { getFilesInDirectory, getLastSelectedModel } from '../utils';

// Re-export for backwards compatibility
export { getVariablesFilePath };

const saveVariables = async (
  variables: Record<string, boolean>,
  modelPath: string,
) => {
  try {
    const variablesFilePath = getVariablesFilePath(modelPath);
    const variablesDir = variablesFilePath.substring(
      0,
      variablesFilePath.lastIndexOf('/'),
    );

    // Ensure the directory exists
    if (!existsSync(variablesDir)) {
      await mkdir(variablesDir, { recursive: true });
    }

    await writeFile(variablesFilePath, JSON.stringify(variables, null, 2));
    console.log(`Variables saved to ${variablesFilePath}`);
  } catch (error) {
    console.error('Error saving variables:', error);
  }
};

const getExistingVariables = async (
  modelPath: string,
): Promise<Record<string, boolean>> => {
  try {
    const variablesFilePath = getVariablesFilePath(modelPath);
    if (existsSync(variablesFilePath)) {
      const data = await readFile(variablesFilePath, 'utf-8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Error reading variables file:', error);
    return {};
  }
};

export const inputDefaultVariables = async (
  selectedModel?: string,
): Promise<void> => {
  try {
    let modelPath = selectedModel;

    if (!selectedModel) {
      // Always show the model list first
      const files = await getFilesInDirectory('examples');
      if (files.length === 0) {
        console.log('No files found in the example directory.');
        return;
      }

      // Get the last selected model to use as default if available
      const lastSelectedModel = await getLastSelectedModel();

      const { selectedFile } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedFile',
          message: 'Select a model file to extract variables from:',
          choices: files.map((file) => ({
            name: file.name,
            value: file.path,
          })),
          default: lastSelectedModel || files[0]?.path,
        },
      ]);

      modelPath = selectedFile;
    }

    // At this point modelPath is guaranteed to be a string
    const model = loadPistarModel({ filename: modelPath as string });
    const tree = convertToTree({ model });
    const contextVariables = treeContextVariables(tree);
    const achievabilityVariables = getTaskAchievabilityVariables(tree);
    const variables = [...contextVariables, ...achievabilityVariables];

    if (variables.length === 0) {
      console.log('No variables found in the model.');
      return;
    }

    // Get existing variable values
    const existingVariables = await getExistingVariables(modelPath as string);

    // Create questions for each variable
    const questions = variables.map((variable) =>
      contextVariables.includes(variable)
        ? {
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
          }
        : {
            type: 'input' as const,
            name: variable,
            message: `Enter default value for ${variable} (0.0-1.0):`,
            default:
              existingVariables[variable] !== undefined
                ? String(existingVariables[variable])
                : '0.0',
            validate: (input: string) => {
              const value = parseFloat(input);
              if (!isNaN(value) && value >= 0.0 && value <= 1.0) {
                return true;
              }
              return 'Please enter a value between 0.0 and 1.0';
            },
            filter: (input: string) => parseFloat(input),
          },
    );

    // Prompt for variable values
    const answers = await inquirer.prompt<Record<string, boolean>>(questions);

    // Save variables
    await saveVariables(answers, modelPath as string);

    console.log('Default variables have been set successfully!');
  } catch (error) {
    console.error('Error setting default variables:', error);
  }
};
