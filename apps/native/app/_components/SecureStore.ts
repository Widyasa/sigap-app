import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export async function getItemAsync(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore storage errors
    }
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (isWeb) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
