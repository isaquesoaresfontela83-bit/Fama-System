export default [{
  files:['features/pedidos/*.mjs','features/liquid-glass/*.mjs','features/audit/*.mjs','scripts/audit-*.mjs'],
  ignores:['**/dist/**'],
  languageOptions:{ecmaVersion:'latest',sourceType:'module'},
  rules:{
    'no-eval':'error', 'no-implied-eval':'error', 'no-new-func':'error',
    'no-unreachable':'error', 'no-unsafe-finally':'error', 'no-dupe-args':'error',
    'no-duplicate-case':'error','no-constant-binary-expression':'error',
    'no-unused-vars':['error',{args:'none',caughtErrors:'none',varsIgnorePattern:'^_'}],
  },
}];
