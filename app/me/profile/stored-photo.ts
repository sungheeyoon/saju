import { checkVariants, isPhotoObjectKey, variantKey, type StoredPhotoType } from '@/src/lib/profile';

import { storeErrorClassOf, type PhotoStore } from '../photo/store';

/**
 * 저장소에 사진 한 장을 둔다 — **표를 받고, 두 벌을 쓰고, DB 에 적는다**(G-120, `20261227090000`).
 *
 * 차례가 곧 안전이다.
 *
 * 1. 두 벌을 잰다(`checkVariants`) — 형식 · 변 · 바이트 · 같은 그림의 크기. 틀리면 DB 에도 저장소에도 안 닿는다
 * 2. DB 가 열쇠를 짓고 표를 적는다(`begin_my_photo_upload`) — 하루 한도가 여기서 깎인다. 거절이면 저장소에 안 쓴다
 * 3. 두 벌을 쓴다
 * 4. DB 에 적는다(더하기 · 바꾸기) — 표가 걷히고 줄이 열쇠를 든다
 *
 * 3 · 4 가 실패하면 **표를 지울 줄로 넘긴다**(`drop_my_photo_upload`) — 여기서 저장소를 바로 지우지 않는다. 4 의 실패가 「응답만
 * 끊기고 DB 는 적었다」일 수 있다 — 그때 바로 지우면 보이는 사진의 바이트가 사라진다. 넘기기는 표가 남아 있을 때만(= DB 가 안
 * 적었을 때만) 지울 줄에 넣으므로 그 경합이 없다. 넘기기도 못 하면(함수가 죽음 · 망) 표가 남고, 청소기가 한 시간 뒤 옮긴다 —
 * 어느 길로도 주인 없는 객체는 다음 청소(하루 안)까지만 남는다.
 *
 * DB 를 부르는 손은 밖에서 받는다 — 시험이 메모리 저장소와 가짜 문으로 이 차례를 잰다(`stored-photo.test.ts`).
 */

export type Answer<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

export type StoredPhotoDoors<T> = {
  readonly begin: () => Promise<Answer<string>>;
  readonly save: (objectKey: string, contentType: StoredPhotoType) => Promise<Answer<T>>;
  readonly drop: (objectKey: string) => Promise<void>;
};

/** 저장소에 못 썼다 — 사람이 다시 누르면 된다. 사진을 바꿀 일은 아니다 */
export const STORE_FAILED = '사진을 올리지 못했어요. 다시 시도해 주세요.';

export async function storePhoto<T>(
  store: PhotoStore,
  doors: StoredPhotoDoors<T>,
  variants: { readonly card: Uint8Array; readonly large: Uint8Array },
): Promise<Answer<T>> {
  const checked = checkVariants(variants.card, variants.large);
  if (!checked.ok) return { ok: false, message: checked.message };

  const begun = await doors.begin();
  if (!begun.ok) return begun;
  const key = begun.value;
  if (!isPhotoObjectKey(key)) {
    await abandon(doors, key);
    return { ok: false, message: STORE_FAILED };
  }

  try {
    await Promise.all([
      store.put(variantKey(key, 'card'), variants.card, checked.type),
      store.put(variantKey(key, 'large'), variants.large, checked.type),
    ]);
  } catch (error) {
    console.error('photo-store: 사진을 저장소에 쓰지 못했다', storeErrorClassOf('put', error));
    await abandon(doors, key);
    return { ok: false, message: STORE_FAILED };
  }

  let saved: Answer<T>;
  try {
    saved = await doors.save(key, checked.type);
  } catch (error) {
    await abandon(doors, key);
    throw error;
  }
  if (!saved.ok) await abandon(doors, key);
  return saved;
}

/** 표를 지울 줄로 — 실패해도 던지지 않는다(청소기가 한 시간 지난 표를 받는다). 저장소는 청소기만 지운다(머리말) */
async function abandon<T>(doors: StoredPhotoDoors<T>, key: string): Promise<void> {
  try {
    await doors.drop(key);
  } catch (error) {
    console.error('photo-store: 못 적은 사진의 표를 넘기지 못했다', storeErrorClassOf('drop', error));
  }
}
