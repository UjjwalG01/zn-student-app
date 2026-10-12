import { secureStorage } from '@/lib/storage/secure';
import * as SecureStore from 'expo-secure-store';
const store = (SecureStore as any).__store as Map<string, string>;

it('setTokens stores both keys; clearAll wipes both (NEW-6 revocation cleanup)', async () => {
  await secureStorage.setTokens('A', 'R');
  expect(store.get('zn.accessToken')).toBe('A');
  expect(store.get('zn.refreshToken')).toBe('R');
  await secureStorage.clearAll();
  expect(store.size).toBe(0);
});
