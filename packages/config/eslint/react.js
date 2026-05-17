const base = require('./base');

module.exports = {
  ...base,
  extends: [
    ...base.extends,
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  plugins: [...base.plugins, 'react', 'react-hooks', 'jsx-a11y'],
  settings: {
    ...base.settings,
    react: {
      version: 'detect',
    },
  },
  rules: {
    ...base.rules,
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'jsx-a11y/anchor-is-valid': 'warn',
    'jsx-a11y/click-events-have-key-events': 'warn',
  },
};