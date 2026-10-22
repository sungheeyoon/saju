'use server';

import { refresh } from '../../refresh';
import type { SaveResult } from '../../save-result';
import { supabaseOnServer } from '../../auth/server-client';
import { FOCUS_CENTER, PHOTO_TYPES, focusOf, missingInProfile, sameFocus, type PhotoFocus, type ProfileInput } from '@/src/lib/profile';
import { answerOfThrown, userFacingDbMessage } from '../../db-error';
import { rpcArgs } from '@/src/lib/db';
import { photoStoreIfReady } from '../photo/s3-store';
import { STORE_FAILED, storePhoto, type Answer, type StoredPhotoDoors } from './stored-photo';

/**
 * 프로필을 저장한다 — **RPC 를 지난다.**
 *
 * `discovery_profile` 때와 다르다. 그 표는 별명·소개 칸을 열 단위로 열어 두었고 서버
 * 액션이 그 칸에 직접 썼다. `app_user` 는 그렇게 열려 있지 않다 — 계정 상태와 안내 확인
 * 기록이 한 행에 있어서, 한 칸을 열면 그 옆 칸을 안 여는 이유를 정책이 매번 다시 대야
 * 한다. 거절의 문장도 DB 가 낸다(「이미 사용 중인 닉네임이에요. …」).
 */
export async function saveProfile(profile: ProfileInput): Promise<SaveResult> {
  const missing = missingInProfile(profile);
  if (missing !== null) return { ok: false, message: missing };

  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('save_my_profile', rpcArgs<'save_my_profile'>({
    p_nickname: profile.nickname.trim(),
    p_intro: profile.intro.trim() || null,
  }));

  if (error) return { ok: false, message: userFacingDbMessage(error, 'save_my_profile') };

  /*
    이름은 거의 모든 화면에 선다 — 후보 카드도 요청 목록도 소식도. 한 자리만 새로
    그리면 나머지는 옛 이름을 든 채로 남는다.
  */
  refresh('account-changed');
  return { ok: true };
}

/** 받지 않는 형식 — 올리기와 바꾸기가 같은 말이다 */
const PHOTO_TYPE_REFUSED = 'JPG · PNG · WebP 사진만 올릴 수 있어요. 다른 사진을 골라 주세요.';

/**
 * 사진 한 장을 **맨 뒤에** 더한다 — **줄이는 일은 브라우저가 했다**(G-60).
 *
 * 여기 닿는 것은 이미 512px 안팎으로 줄여 놓은 바이트다(`shrink`). 그렇다고 믿지는 않는다 —
 * 상한도 형식도 여섯 장도 DB 가 다시 본다. 이 액션도 주소만 알면 부를 수 있다.
 */
export async function addPhoto(photo: {
  contentType: string;
  base64: string;
  /** 고른 뒤 맞춘 보일 자리 — 가운데면 따로 안 적는다(새 장의 기본값) */
  focus?: PhotoFocus;
}): Promise<SaveResult> {
  if (!(PHOTO_TYPES as readonly string[]).includes(photo.contentType)) return { ok: false, message: PHOTO_TYPE_REFUSED };

  const supabase = await supabaseOnServer();

  const { data: placed, error } = await supabase.rpc('add_my_photo', rpcArgs<'add_my_photo'>({
    p_content_type: photo.contentType,
    p_base64: photo.base64,
  }));

  if (error) return { ok: false, message: userFacingDbMessage(error, 'add_my_photo') };

  /*
    자리는 올린 뒤에 따로 적는다 — 올리기와 한 문이 아니다. 이것이 실패하면 사진은 가운데로 선 채 남고 까닭이 선다
    (「위치 조정」으로 다시 맞춘다). 막 올린 장이라 판본을 모른다 — 자리 번호로 적는다(같은 사람의 쓰기는 계정 잠금으로 줄을 선다).
  */
  const framed = await savedFocus(supabase, placed, null, photo.focus);
  refresh('account-changed');
  return framed;
}

/** 고른 자리를 적는다 — 가운데면 부르지 않는다(올린 · 바꾼 장은 이미 가운데다) */
async function savedFocus(
  supabase: Supabase,
  position: number,
  version: number | null,
  focus: PhotoFocus | undefined,
): Promise<SaveResult> {
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

/**
 * 한 장의 **보일 자리**만 바꾼다(「위치 조정」, G-98) — 바이트 · 판본 · 하루 한도는 그대로다(`20261203090000`).
 *
 * `version` 은 그 자리에 있다고 화면이 본 장이다 — 다른 탭이 먼저 목록을 바꿨으면 거절된다.
 */
export async function setPhotoFocus(photo: { position: number; version: number; focus: PhotoFocus }): Promise<SaveResult> {
  const supabase = await supabaseOnServer();
  const { error } = await supabase.rpc('set_my_photo_focus', rpcArgs<'set_my_photo_focus'>({
    p_position: photo.position,
    p_x: photo.focus.x,
    p_y: photo.focus.y,
    p_version: photo.version,
  }));
  if (error) return { ok: false, message: userFacingDbMessage(error, 'set_my_photo_focus') };

  refresh('account-changed');
  return { ok: true };
}

/** 바꾼 장의 새 판본 — 화면이 서버 목록이 오기 전에 그 칸의 미리보기를 새 장에 잇는다 */
export type PhotoReplaced = { ok: true; version: number } | { ok: false; message: string };

/**
 * 한 장을 **그 자리에서** 바꾼다 — 자리 · 다른 장은 그대로, 판본만 바뀐다(`20261202090000`).
 *
 * 지우기 + 올리기 + 옮기기 세 번을 부르지 않는다 — 여섯 장이 찼을 때 · 그 사이 망이 끊겼을 때 한 장이 사라지거나 대표가
 * 바뀐 채 남는다. DB 가 한 트랜잭션에서 바이트를 갈아 끼우고 하루 올리기 한도를 한 번 센다. `version` 은 그 자리에 있다고
 * 화면이 본 장이다 — 다른 탭이 먼저 바꿨으면 거절된다.
 */
export async function replacePhoto(photo: {
  position: number;
  version: number;
  contentType: string;
  base64: string;
  /** 고른 뒤 맞춘 보일 자리 — 바꾼 장은 DB 가 가운데로 돌려 두므로 가운데가 아니면 다시 적는다 */
  focus?: PhotoFocus;
}): Promise<PhotoReplaced> {
  if (!(PHOTO_TYPES as readonly string[]).includes(photo.contentType)) return { ok: false, message: PHOTO_TYPE_REFUSED };

  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('replace_my_photo', rpcArgs<'replace_my_photo'>({
    p_position: photo.position,
    p_version: photo.version,
    p_content_type: photo.contentType,
    p_base64: photo.base64,
  }));

  if (error) return { ok: false, message: userFacingDbMessage(error, 'replace_my_photo') };

  const framed = await savedFocus(supabase, photo.position, data, photo.focus);
  refresh('account-changed');
  return framed.ok ? { ok: true, version: data } : framed;
}

/**
 * 한 장을 내린다 — 뒤의 장이 한 칸씩 당겨 앉는다. 자리를 세는 일은 DB 가 한다.
 *
 * **판본(`version`)으로 그 장을 확인한다** — 두 탭 · 재시도가 같은 자리를 두 번 보내면 둘째 누름은 당겨 앉은
 * 다른 장이 아니라 아무것도 안 지운다(`20261027090000`).
 */
export async function removePhoto(photo: { position: number; version: number }): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc(
    'remove_my_photo',
    rpcArgs<'remove_my_photo'>({ p_position: photo.position, p_version: photo.version }),
  );
  if (error) return { ok: false, message: userFacingDbMessage(error, 'remove_my_photo') };

  refresh('account-changed');
  return { ok: true };
}

/**
 * 한 장을 다른 자리로 옮긴다 — 사이의 장이 한 칸씩 밀린다. 맞바꾸지 않는다.
 *
 * `version` 은 `from` 에 있다고 화면이 본 장이다. 그 사이 다른 탭이 목록을 바꿨으면 DB 가 「사진을 옮기지
 * 못했습니다.」로 거절하고 화면이 목록을 다시 받는다.
 */
export async function movePhoto(from: number, to: number, version: number): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc(
    'move_my_photo',
    rpcArgs<'move_my_photo'>({ p_from: from, p_to: to, p_version: version }),
  );
  if (error) return { ok: false, message: userFacingDbMessage(error, 'move_my_photo') };

  refresh('account-changed');
  return { ok: true };
}

type Supabase = Awaited<ReturnType<typeof supabaseOnServer>>;

/** 두 벌과 보일 자리 — 화면이 `FormData` 로 보낸다(base64 가 아니라 바이트 그대로 — 본문 한도 1MB 에 두 벌이 든다) */
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
 * 저장소에 사진 한 장을 **맨 뒤에** 더한다 — 저장소가 켜진 배포에서만 화면이 부른다(G-120). 꺼졌으면 거절한다 — 화면이 켜졌던
 * 때 그려졌고 그 사이 꺼진 것이다. 차례는 `storePhoto`.
 */
export async function addStoredPhoto(form: FormData): Promise<SaveResult> {
  const supabase = await supabaseOnServer();
  let sent: Awaited<ReturnType<typeof storedForm>>;
  let placed: Answer<number>;
  try {
    const store = photoStoreIfReady();
    if (store === null) return { ok: false, message: STORE_FAILED };
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
    return { ok: false, message: answerOfThrown(thrown, 'addStoredPhoto', STORE_FAILED) };
  }
  if (!placed.ok) return placed;

  const framed = await savedFocus(supabase, placed.value, null, sent.focus);
  refresh('account-changed');
  return framed;
}

/**
 * 저장소의 새 장으로 한 장을 **그 자리에서** 바꾼다 — `replacePhoto` 와 같은 뜻(판본만 바뀐다). `position` · `version` 은 그
 * 자리에 있다고 화면이 본 장이다. 옛 장의 객체는 DB 의 지울 줄로 간다.
 */
export async function replaceStoredPhoto(form: FormData): Promise<PhotoReplaced> {
  const position = Number(form.get('position'));
  const version = Number(form.get('version'));
  const supabase = await supabaseOnServer();
  let sent: Awaited<ReturnType<typeof storedForm>>;
  let replaced: Answer<number>;
  try {
    const store = photoStoreIfReady();
    if (store === null) return { ok: false, message: STORE_FAILED };
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
    return { ok: false, message: answerOfThrown(thrown, 'replaceStoredPhoto', STORE_FAILED) };
  }
  if (!replaced.ok) return replaced;

  const framed = await savedFocus(supabase, position, replaced.value, sent.focus);
  refresh('account-changed');
  return framed.ok ? { ok: true, version: replaced.value } : framed;
}
