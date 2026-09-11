import next from 'eslint-config-next'
import tseslint from 'typescript-eslint'

/**
 * Flache ESLint-Konfiguration.
 *
 * `eslint-config-next` exportiert seit Version 16 bereits Flat-Config-Objekte —
 * FlatCompat ist nicht nötig und führt mit ESLint 10 zu einem Fehler beim
 * Serialisieren der Plugin-Referenzen. Das TypeScript-Plugin wird explizit
 * eingebunden, damit eigene Regeln darauf zugreifen können.
 */
const config = [
  ...next,
  {
    ignores: ['.next/**', '.vercel/**', 'node_modules/**', 'public/sw.js', '.data/**', 'scripts/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
]

export default config
