import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "*.js",
  ]),
  {
    rules: {
      // Allow any for gradual typing migration
      '@typescript-eslint/no-explicit-any': 'off',
      // Completely disable unused-vars warnings for legacy code cleanup
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'error',
      // Disable new react-hooks rules that are too strict for existing code
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      // Allow Link components via <a> for gradual migration
      '@next/next/no-html-link-for-pages': 'off',
      '@next/next/no-img-element': 'off',
      // Allow function hoisting patterns
      'no-use-before-define': 'off',
      // Disable rules that are too strict for existing code
      'react-hooks/rules-of-hooks': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/no-refs-during-render': 'off',
      'react-hooks/refs': 'off',
    },
  },
  {
    files: ['*.js', 'src/lib/logger.ts'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['**/*.config.*', 'scripts/**', 'src/scripts/**', 'prisma/**'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
]);

export default eslintConfig;
