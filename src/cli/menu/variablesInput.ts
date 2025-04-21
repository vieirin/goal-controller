import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import inquirer from 'inquirer';
import { basename, join } from 'path';
import { loadModel } from '../../ObjectiveTree';
import { convertToTree } from '../../ObjectiveTree/creation';
import { treeVariables } from '../../ObjectiveTree/treeVariables';
import { getFilesInDirectory, getLastSelectedModel } from '../utils';

const getVariablesFilePath = (modelPath: string): string => {
  const fileName = basename(modelPath, '.txt'); // Remove extension if present
  return join('input', fileName, 'variables.json');
};

const saveVariables = async (
  variables: Record<string, boolean>,
  modelPath: string
) => {
  try {
    const variablesFilePath = getVariablesFilePath(modelPath);
    const variablesDir = variablesFilePath.substring(
      0,
      variablesFilePath.lastIndexOf('/')
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
  modelPath: string
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

export const inputDefaultVariables = async () => {
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
    const existingVariables = await getExistingVariables(modelPath as string);

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
    await saveVariables(answers, modelPath as string);

    console.log('Default variables have been set successfully!');
  } catch (error) {
    console.error('Error setting default variables:', error);
  }
};
