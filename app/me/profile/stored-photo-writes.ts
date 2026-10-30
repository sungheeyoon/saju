import type { SupabaseClient } from '@supabase/supabase-js';

import { rpcArgs, type Database } from '@/src/lib/db';
import { FOCUS_CENTER, focusOf, sameFocus, type PhotoFocus } from '@/src/lib/profile';

import { answerOfThrown, userFacingDbMessage } from '../../db-error';
import { photoStoreIfReady } from '../photo/s3-store';
import { STORE_FAILED, storePhoto, type Answer, type StoredPhotoDoors } from './stored-photo';

/**
 * **저장소에 사진을 올리는 몸통** — 웹의 서버 액션과 앱의 문(`app/api/mobile/me/photo`, ADR 0211 추기)이 같은 것을 부른다. 다른 것은 사람을
 * 알아보는 클라이언트뿐이고, 사람 · 한도 · 여섯 장은 DB 의 문이 그 사람으로 본다.
 */

type Supabase = SupabaseClient<Database>;

/** 바꾼 장의 새 판본 — 화면이 서버 목록이 오기 전에 그 칸의 미리보기를 새 장에 잇는다 */
export type PhotoReplaced = { ok: true; version: number } | { ok: false; message: string };

/** `placed` — 사진이 목록에 놓였나. 자리만 못 적은 실패는 `ok: false` 여도 놓였다 */
export type StoredAnswer = { readonly placed: boolean };

/** 고른 자리를 적는다 — 가운데면 부르지 않는다(올린 · 바꾼 장은 이미 가운데다) */
export async function savedFocus(
  supabase: Supabase,
  position: number,
  version: number | null,
  focus: PhotoFocus | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (focus === undefined || sameFocus(focus, FOCUS_CENTER)) return { ok: true };
  const { error } = await supabase.rpc('set_my_photo_focus', rpcArgs<'set_my_photo_focus'>({
    p_position: position,
    p_x: focus.x,
    p_y: focus.y,
    ...(version === null ? {} : { p_version: version }),
  }));
  if (error) return { ok: false, message: userFacingDbMessage(error, 'set_my_photo_focus') };
  return { ok: true };
}

/** 두 벌과 보일 자리 — 화면이 `FormData` 로 보낸다(base64 가 아니라 바이트 그대로 — 본문 한도 1MB 에 두 벌이 든다. 웹은 서버 액션의 한도, 앱은 문의 `PHOTO_BODY_MAX_BYTES` 다) */
async function storedForm(form: FormData) {
  const bytesOf = async (name: string) => {
    const part = form.get(name);
    return part instanceof Blob ? new Uint8Array(await part.arrayBuffer()) : new Uint8Array();
  };
  const x = Number(form.get('focusX'));
  const y = Number(form.get('focusY'));
  return {
    card: await bytesOf('card'),
    large: await bytesOf('large'),
    focus: form.has('focusX') ? focusOf(x, y) : undefined,
  };
}

/** 표 받기 · 버리기는 더하기와 바꾸기가 같다 — 적는 문만 다르다 */
function storedDoors<T>(supabase: Supabase, save: StoredPhotoDoors<T>['save']): StoredPhotoDoors<T> {
  return {
    begin: async (): Promise<Answer<string>> => {
      const { data, error } = await supabase.rpc('begin_my_photo_upload');
      return error ? { ok: false, message: userFacingDbMessage(error, 'begin_my_photo_upload') } : { ok: true, value: data };
    },
    save,
    drop: async (objectKey) => {
      const { error } = await supabase.rpc('drop_my_photo_upload', rpcArgs<'drop_my_photo_upload'>({ p_object_key: objectKey }));
      if (error) throw Object.assign(new Error('drop_my_photo_upload'), { code: error.code });
    },
  };
}

/**
 * 맨 뒤에 더한다. 꺼졌으면 거절한다 — 화면이 켜졌던 때 그려졌고 그 사이 꺼진 것이다. 차례는 `storePhoto`.
 */
export async function addStoredPhotoAs(supabase: Supabase, form: FormData): Promise<({ ok: true } | { ok: false; message: string }) & StoredAnswer> {
  let sent: Awaited<ReturnType<typeof storedForm>>;
  let placed: Answer<number>;
  try {
    const store = photoStoreIfReady();
    if (store === null) return { ok: false, message: STORE_FAILED, placed: false };
    sent = await storedForm(form);
    placed = await storePhoto(
      store,
      storedDoors(supabase, async (objectKey, contentType) => {
        const { data, error } = await supabase.rpc('add_my_photo_object', rpcArgs<'add_my_photo_object'>({
          p_object_key: objectKey,
          p_content_type: contentType,
        }));
        return error ? { ok: false, message: userFacingDbMessage(error, 'add_my_photo_object') } : { ok: true, value: data };
      }),
      sent,
    );
  } catch (thrown) {
    return { ok: false, message: answerOfThrown(thrown, 'addStoredPhoto', STORE_FAILED), placed: false };
  }
  if (!placed.ok) return { ...placed, placed: false };

  return { ...(await savedFocus(supabase, placed.value, null, sent.focus)), placed: true };
}

/**
 * 그 자리에서 바꾼다. `position` · `version` 은 그 자리에 있다고 화면이 본 장이다. 옛 장의 객체는 DB 의 지울 줄로 간다.
 */
export async function replaceStoredPhotoAs(supabase: Supabase, form: FormData): Promise<PhotoReplaced & StoredAnswer> {
  const position = Number(form.get('position'));
  const version = Number(form.get('version'));
  let sent: Awaited<ReturnType<typeof storedForm>>;
  let replaced: Answer<number>;
  try {
    const store = photoStoreIfReady();
    if (store === null) return { ok: false, message: STORE_FAILED, placed: false };
    sent = await storedForm(form);
    replaced = await storePhoto(
      store,
      storedDoors(supabase, async (objectKey, contentType) => {
        const { data, error } = await supabase.rpc('replace_my_photo_object', rpcArgs<'replace_my_photo_object'>({
          p_position: position,
          p_version: version,
          p_object_key: objectKey,
          p_content_type: contentType,
        }));
        return error ? { ok: false, message: userFacingDbMessage(error, 'replace_my_photo_object') } : { ok: true, value: data };
      }),
      sent,
    );
  } catch (thrown) {
    return { ok: false, message: answerOfThrown(thrown, 'replaceStoredPhoto', STORE_FAILED), placed: false };
  }
  if (!replaced.ok) return { ...replaced, placed: false };

  const framed = await savedFocus(supabase, position, replaced.value, sent.focus);
  return framed.ok ? { ok: true, version: replaced.value, placed: true } : { ...framed, placed: true };
}
