// Load rulesdir plugin and set the rules directory
const rulesdir = require('eslint-plugin-rulesdir');
rulesdir.RULES_DIR = './eslint-rules';

// Load the base config from JSON
const baseConfig = require('./.eslintrc.json');

module.exports = {
  ...baseConfig,
  ignorePatterns: ['.eslintrc.js', '*.config.js'],
  plugins: [...(baseConfig.plugins || []), 'prettier', 'rulesdir'],
  rules: {
    ...baseConfig.rules,
    'rulesdir/no-direct-children-tasks-pattern': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': [
      'error',
      {
        allowArgumentsExplicitlyTypedAsAny: true,
        allowDirectConstAssertionInArrowFunctions: true,
        allowHigherOrderFunctions: true,
        allowTypedFunctionExpressions: true,
      },
    ],
    '@typescript-eslint/semi': 'off',
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/member-delimiter-style': 'off',
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/comma-dangle': 'off',
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    '@typescript-eslint/restrict-template-expressions': [
      'error',
      {
        allowNumber: true,
        allowBoolean: true,
        allowNullish: true,
        allowRegExp: true,
        allowAny: true,
      },
    ],
    'generator-star-spacing': ['error', { before: false, after: true }],
    '@typescript-eslint/space-before-function-paren': [
      'error',
      {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always',
      },
    ],
    'prettier/prettier': 'off',
    'no-console': ['error', { allow: ['warn'] }],
  },
  overrides: [
    {
      files: ['src/cli.ts', 'src/cli/**/*.ts'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['*.js', '*.config.js', '.eslintrc.js'],
      parserOptions: {
        project: null,
      },
    },
  ],
};
