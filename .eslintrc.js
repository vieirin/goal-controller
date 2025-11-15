// Load rulesdir plugin and set the rules directory
const rulesdir = require('eslint-plugin-rulesdir');
rulesdir.RULES_DIR = './eslint-rules';

// Load the base config from JSON
const baseConfig = require('./.eslintrc.json');

module.exports = {
  ...baseConfig,
  plugins: [...(baseConfig.plugins || []), 'rulesdir'],
  rules: {
    ...baseConfig.rules,
    'rulesdir/no-direct-children-tasks-pattern': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/semi': 'off',
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/member-delimiter-style': 'off',
    'no-console': ['error', { allow: ['warn'] }],
  },
};

