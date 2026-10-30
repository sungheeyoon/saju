import type { DoorSave } from '@reading/door';
import type { PhotoFocus, PhotoUploadMode } from '@profile';

import { door, type DoorAnswer } from './api';

/** 줄여 구운 두 벌 — 기기 안의 주소다(`PHOTO_VARIANTS` 의 `card` · `large`) */
export type BakedVariants = { readonly card: string; readonly large: string; readonly contentType: string };

const formOf = (baked: BakedVariants, focus: PhotoFocus, extra: Record<string, string> = {}): FormData => {
  const form = new FormData();
  /* React Native 의 FormData 는 파일을 주소 · 이름 · 형식 한 묶음으로 받는다 */
  for (const name of ['card', 'large'] as const) {
    form.append(name, { uri: baked[name], name, type: baked.contentType } as unknown as Blob);
  }
  form.append('focusX', String(focus.x));
  form.append('focusY', String(focus.y));
  for (const [name, value] of Object.entries(extra)) form.append(name, value);
  return form;
};

/**
 * **저장소에 사진을 올리는 앱의 문**(ADR 0211 추기). 저장소 열쇠는 서버에만 있고, 답의 `ok: false` 문장은 웹과 같은 글자다.
 * 머리에 형식을 안 적는다 — 경계 값은 기기가 FormData 에서 짓는다.
 */

/** 화면이 보일 길 — 이 배포의 저장소가 켜졌는지는 서버만 안다 */
export const readPhotoUploadMode = (): Promise<DoorAnswer<{ mode: PhotoUploadMode }>> => door('/api/mobile/me/photo');

/** 맨 뒤에 더한다 */
export const addStoredPhoto = (baked: BakedVariants, focus: PhotoFocus): Promise<DoorAnswer<DoorSave>> =>
  door('/api/mobile/me/photo', { method: 'POST', body: formOf(baked, focus) });

/** 그 자리에서 바꾼다 — 판본은 화면이 본 그 장이다. 그 사이 목록이 바뀌었으면 DB 가 거절한다 */
export const replaceStoredPhoto = (
  target: { readonly position: number; readonly version: number },
  baked: BakedVariants,
  focus: PhotoFocus,
): Promise<DoorAnswer<{ ok: true; version: number } | { ok: false; message: string }>> =>
  door('/api/mobile/me/photo', {
    method: 'PUT',
    body: formOf(baked, focus, { position: String(target.position), version: String(target.version) }),
  });
