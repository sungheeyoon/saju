'use client';

import type { PhotoFocus } from '@/src/lib/profile';

import { actionAnswer } from '../../ui/action-answer';
import { addPhoto, addStoredPhoto, replacePhoto, replaceStoredPhoto } from './actions';
import { bakeVariants, shrink } from './photo-shrink';

/**
 * 고른 사진 한 장을 서버로 — **저장소가 켜졌으면 두 벌을 `FormData` 로, 아니면 지금처럼 한 벌을 base64 로**(G-120).
 *
 * 어느 길인지는 서버가 화면을 그릴 때 정해 준다(`stored`). 두 길의 답은 같은 꼴이다. 브라우저가 못 읽은 사진이면 던진다 —
 * 부르는 쪽(`usePhotoUploads`)이 제 문장으로 받는다.
 */

type Sent = { ok: true } | { ok: false; message: string };
type Replaced = { ok: true; version: number } | { ok: false; message: string };

function storedForm(baked: { card: Blob; large: Blob }, focus: PhotoFocus): FormData {
  const form = new FormData();
  form.set('card', baked.card);
  form.set('large', baked.large);
  form.set('focusX', String(focus.x));
  form.set('focusY', String(focus.y));
  return form;
}

export async function sendNewPhoto(file: File, focus: PhotoFocus, stored: boolean): Promise<Sent> {
  if (stored) {
    const baked = await bakeVariants(file);
    if (!baked.ok) return baked;
    return actionAnswer(addStoredPhoto(storedForm(baked, focus)));
  }
  const shrunk = await shrink(file);
  if (!shrunk.ok) return shrunk;
  return actionAnswer(addPhoto({ contentType: shrunk.contentType, base64: shrunk.base64, focus }));
}

/**
 * 바꾸기 — 그 장의 지금 자리는 **구운 뒤에** 묻는다(`positionNow`). 굽는 동안 서버 목록이 바뀔 수 있다. 자리가 없으면(그 사이
 * 그 장이 빠졌다) `null` 을 돌려준다 — 부르는 쪽이 제 문장을 세운다.
 */
export async function sendReplacement(
  file: File,
  version: number,
  positionNow: () => number | null,
  focus: PhotoFocus,
  stored: boolean,
): Promise<Replaced | null> {
  if (stored) {
    const baked = await bakeVariants(file);
    if (!baked.ok) return baked;
    const position = positionNow();
    if (position === null) return null;
    const form = storedForm(baked, focus);
    form.set('position', String(position));
    form.set('version', String(version));
    return actionAnswer(replaceStoredPhoto(form));
  }
  const shrunk = await shrink(file);
  const position = positionNow();
  if (!shrunk.ok) return shrunk;
  if (position === null) return null;
  return actionAnswer(replacePhoto({ position, version, contentType: shrunk.contentType, base64: shrunk.base64, focus }));
}
