/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated|@supabase|lucide-react-native))',
  ],
  // Sibling session worktrees live under .claude/worktrees; don't run their tests here.
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: ['lib/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
};
