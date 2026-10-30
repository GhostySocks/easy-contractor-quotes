/* global jest */
// AsyncStorage ships an in-memory mock for Jest; the native module is not
// available under jest-expo.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
