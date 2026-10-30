/** Supabase 가 세션을 읽고 쓰는 꼴 */
export type SessionStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type Cipher = {
  newKey(): Promise<string>;
  seal(text: string, key: string): Promise<string>;
  open(sealed: string, key: string): Promise<string>;
};

/**
 * 세션을 암호문으로 두는 저장소 — 키만 `vault`(기기의 보안 저장소)에, 암호문은 `box`(일반 저장소)에 둔다.
 * 세션이 보안 저장소의 값 크기(iOS 에서 약 2048 바이트)를 넘을 수 있어서다.
 *
 * - 옛 평문 세션은 처음 읽을 때 암호문으로 옮기고 지운다. 옮기지 못하면 그 값으로 이번만 잇고 다음에 다시 옮긴다.
 * - 쓰기가 실패하면 던진다 — 평문으로 물러서지 않는다.
 * - 읽기가 실패하면 세션 없음으로 답하고 아무것도 지우지 않는다. 잠긴 기기의 일시적인 실패로 세션을 잃지 않는다.
 */
export function sealedStorage({ vault, box, cipher }: { vault: SessionStore; box: SessionStore; cipher: Cipher }): SessionStore {
  const sealedName = (key: string) => `${key}.sealed`;
  /* 보안 저장소의 키에는 영문 · 숫자 · `.` · `-` · `_` 만 든다 */
  const vaultName = (key: string) => `${key.replace(/[^A-Za-z0-9._-]/g, '_')}.key`;

  /* 동시에 쓰는 둘이 서로 다른 키를 만들면 암호문을 못 연다 — 같은 약속을 나눠 갖는다 */
  const opening = new Map<string, Promise<string>>();
  const keyFor = (key: string): Promise<string> => {
    const known = opening.get(key);
    if (known !== undefined) return known;
    const made = (async () => {
      const stored = await vault.getItem(vaultName(key));
      if (stored !== null) return stored;
      const fresh = await cipher.newKey();
      await vault.setItem(vaultName(key), fresh);
      return fresh;
    })();
    opening.set(key, made);
    made.catch(() => opening.delete(key));
    return made;
  };

  const setItem = async (key: string, value: string) => {
    const sealed = await cipher.seal(value, await keyFor(key));
    await box.setItem(sealedName(key), sealed);
    await box.removeItem(key);
  };

  return {
    setItem,
    async getItem(key) {
      const sealed = await box.getItem(sealedName(key));
      if (sealed === null) {
        const legacy = await box.getItem(key);
        if (legacy === null) return null;
        try {
          await setItem(key, legacy);
        } catch (thrown) {
          console.error('session move', thrown instanceof Error ? thrown.name : 'unknown');
        }
        return legacy;
      }
      try {
        const stored = await vault.getItem(vaultName(key));
        return stored === null ? null : await cipher.open(sealed, stored);
      } catch (thrown) {
        console.error('session read', thrown instanceof Error ? thrown.name : 'unknown');
        return null;
      }
    },
    async removeItem(key) {
      opening.delete(key);
      await box.removeItem(sealedName(key));
      await box.removeItem(key);
      await vault.removeItem(vaultName(key));
    },
  };
}

/** 글자를 바이트로 — 런타임의 `TextDecoder` 에 기대지 않으려고 퍼센트 인코딩의 ASCII 로 옮긴다. 세션에는 한글 이름이 들 수 있다 */
export const textToBytes = (text: string): Uint8Array => Uint8Array.from(encodeURIComponent(text), (char) => char.charCodeAt(0));

export const bytesToText = (bytes: Uint8Array): string => decodeURIComponent(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
