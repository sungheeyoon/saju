'use server';

import { refresh } from '../../refresh';
import type { SaveResult } from '../../save-result';
import { supabaseOnServer } from '../../auth/server-client';
import { PHOTO_TYPES, missingInProfile, type PhotoFocus, type ProfileInput } from '@/src/lib/profile';
import { userFacingDbMessage } from '../../db-error';
import { rpcArgs } from '@/src/lib/db';
import { addStoredPhotoAs, replaceStoredPhotoAs, savedFocus, type PhotoReplaced } from './stored-photo-writes';

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

/**
 * 저장소에 사진 한 장을 **맨 뒤에** 더한다 — 저장소가 켜진 배포에서만 화면이 부른다(G-120). 몸통은 앱의 문과 함께 쓴다(`stored-photo-writes.ts`).
 * 사진이 놓였으면 자리만 못 적었어도 목록이 바뀌었으니 무른다.
 */
export async function addStoredPhoto(form: FormData): Promise<SaveResult> {
  const { placed, ...answer } = await addStoredPhotoAs(await supabaseOnServer(), form);
  if (placed) refresh('account-changed');
  return answer;
}

/** 저장소의 새 장으로 한 장을 **그 자리에서** 바꾼다 — `replacePhoto` 와 같은 뜻(판본만 바뀐다) */
export async function replaceStoredPhoto(form: FormData): Promise<PhotoReplaced> {
  const { placed, ...answer } = await replaceStoredPhotoAs(await supabaseOnServer(), form);
  if (placed) refresh('account-changed');
  return answer;
}
