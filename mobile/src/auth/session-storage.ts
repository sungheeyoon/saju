import AsyncStorage from '@react-native-async-storage/async-storage';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { bytesToText, sealedStorage, textToBytes, type SessionStore } from './sealed-storage';

/* 이 기기에서만 연다 — 백업을 다른 기기에 풀면 키가 안 따라가 다시 로그인한다 */
const VAULT_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

const vault: SessionStore = {
  getItem: (key) => SecureStore.getItemAsync(key, VAULT_OPTIONS),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, VAULT_OPTIONS),
  removeItem: (key) => SecureStore.deleteItemAsync(key, VAULT_OPTIONS),
};

/** 보안 저장소가 없는 웹 번들(화면 재기 전용)은 그대로 둔다 */
export const sessionStorage: SessionStore =
  Platform.OS === 'web'
    ? AsyncStorage
    : sealedStorage({
        vault,
        box: AsyncStorage,
        cipher: {
          newKey: async () => (await AESEncryptionKey.generate()).encoded('base64'),
          seal: async (text, key) => {
            const sealed = await aesEncryptAsync(textToBytes(text), await AESEncryptionKey.import(key, 'base64'));
            return sealed.combined('base64');
          },
          open: async (sealed, key) =>
            bytesToText(await aesDecryptAsync(AESSealedData.fromCombined(sealed), await AESEncryptionKey.import(key, 'base64'), { output: 'bytes' })),
        },
      });
