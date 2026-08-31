import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Returns true ONLY when running inside Expo Go during local development.
 * Evaluates to false in all APK builds (whether EAS preview APK, production APK, or standalone binaries).
 */
export const isDevEnvironment = (): boolean => {
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  return Boolean(__DEV__ && isExpoGo);
};
