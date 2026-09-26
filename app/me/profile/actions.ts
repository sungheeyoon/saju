'use server';

import { refresh } from '../../refresh';
import type { SaveResult } from '../../save-result';
import { supabaseOnServer } from '../../auth/server-client';
import { PHOTO_TYPES, missingInProfile, type ProfileInput } from '@/src/lib/profile';
import { userFacingDbMessage } from '../../db-error';
import { rpcArgs } from '@/src/lib/db';

/**
 * 프로필을 저장한다 — **RPC 를 지난다.**
 *
 * `discovery_profile` 때와 다르다. 그 표는 별명·소개 칸을 열 단위로 열어 두었고 서버
 * 액션이 그 칸에 직접 썼다. `app_user` 는 그렇게 열려 있지 않다 — 계정 상태와 안내 확인
 * 기록이 한 행에 있어서, 한 칸을 열면 그 옆 칸을 안 여는 이유를 정책이 매번 다시 대야
 * 한다. 거절의 문장도 DB 가 낸다(「이미 쓰고 있는 닉네임입니다」).
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

/**
 * 사진 한 장을 **맨 뒤에** 더한다 — **줄이는 일은 브라우저가 했다**(G-60).
 *
 * 여기 닿는 것은 이미 512px 안팎으로 줄여 놓은 바이트다(`shrink`). 그렇다고 믿지는 않는다 —
 * 상한도 형식도 여섯 장도 DB 가 다시 본다. 이 액션도 주소만 알면 부를 수 있다.
 */
export async function addPhoto(photo: {
  contentType: string;
  base64: string;
}): Promise<SaveResult> {
  if (!(PHOTO_TYPES as readonly string[]).includes(photo.contentType)) {
    return { ok: false, message: 'JPG · PNG · WebP 만 올릴 수 있습니다.' };
  }

  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('add_my_photo', rpcArgs<'add_my_photo'>({
    p_content_type: photo.contentType,
    p_base64: photo.base64,
  }));

  if (error) return { ok: false, message: userFacingDbMessage(error, 'add_my_photo') };

  refresh('account-changed');
  return { ok: true };
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
