import 'server-only';

import { photoStoreConfigOf, type StoreState } from './store';

/** 이 배포의 사진 저장소 켜는 값 — 서버에서만 읽는다(G-120). 셈은 `store.ts` 의 `photoStoreConfigOf` */
export function photoStoreState(): StoreState {
  return photoStoreConfigOf({
    PHOTO_STORE_BUCKET: process.env.PHOTO_STORE_BUCKET,
    PHOTO_STORE_REGION: process.env.PHOTO_STORE_REGION,
    PHOTO_STORE_ROLE_ARN: process.env.PHOTO_STORE_ROLE_ARN,
    PHOTO_STORE_ACCESS_KEY_ID: process.env.PHOTO_STORE_ACCESS_KEY_ID,
    PHOTO_STORE_SECRET_ACCESS_KEY: process.env.PHOTO_STORE_SECRET_ACCESS_KEY,
  });
}

/** 올리기가 저장소로 가나 — 켜졌을 때만. 오설정은 DB 길이다(`store.ts` 머리말) */
export const photoStoreIsOn = (): boolean => photoStoreState().state === 'ready';
