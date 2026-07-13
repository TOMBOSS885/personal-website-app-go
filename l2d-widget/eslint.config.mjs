import hacxy from '@hacxy/eslint-config';

export default hacxy({
  rules: {
    'max-params': 0,
    'antfu/no-import-dist': 0
  },
  ignores: ['dist/**', '.cache/**', '.github/**'],
}).append({
  name: 'local/windows-line-endings',
  rules: {
    'format/prettier': 'off',
    'style/linebreak-style': 'off',
  },
});
