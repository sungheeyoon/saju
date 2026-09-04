'use server';

import { revalidatePath } from 'next/cache';

import { supabaseOnServer } from '../../auth/server-client';
import type { SaveResult } from '../actions';
import { selfElementSummary } from '../summary';
import { missingInProfile, type DiscoveryProfileInput } from './profile';

/**
 * 공개용 프로필을 저장한다.
 *
 * RPC 가 없다. 별명·소개·선호는 정책이 이미 열어 준 칸이고(`"내 프로필만 고친다"`),
 * 열려 있는 것을 함수로 다시 감싸면 판정하는 자리가 둘이 된다. **참여 상태와 오행
 * 요약은 이 길로 못 지나간다** — 그 둘은 열어 준 칸이 아니다.
 */
export async function saveDiscoveryProfile(profile: DiscoveryProfileInput): Promise<SaveResult> {
  const missing = missingInProfile(profile);
  if (missing !== null) return { ok: false, message: missing };

  const supabase = await supabaseOnServer();

  const row = {
    nickname: profile.nickname.trim(),
    // 소개는 있거나 없다. 빈 문자열로 저장하면 「없음」이 두 값이 된다.
    intro: profile.intro.trim() || null,
    prefer_gender: profile.preferGender,
  };

  /**
   * 처음인지 아닌지를 먼저 묻는다.
   *
   * upsert 한 줄로 줄일 수 있지만 그러려면 충돌 대상으로 `user_id` 를 실어야 하고,
   * 그 값은 **기본값이 `auth.uid()` 라 앱이 적을 이유가 없는 값**이다. 적기 시작하면
   * 남의 id 를 적을 수 있는 자리가 생긴다(정책이 막지만, 열지 않는 편이 낫다).
   */
  const { data: existing } = await supabase.from('discovery_profile').select('user_id').maybeSingle();

  const { error } = existing
    ? await supabase.from('discovery_profile').update(row).eq('user_id', existing.user_id)
    : await supabase.from('discovery_profile').insert(row);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/me/discovery');
  return { ok: true };
}

/**
 * 매칭 참여를 켜고 끈다.
 *
 * **켤 때 오행 요약을 함께 낸다.** 요약은 브라우저가 아니라 여기서 내 판본을 읽어
 * 만든다 — 클라이언트가 지어 보낼 수 있으면 매칭 풀에 아무 요약이나 올라간다.
 * 자격(사주가 있는가·별명이 있는가·계정이 살아 있는가)은 RPC 가 묻는다.
 */
export async function setDiscoveryParticipation(on: boolean): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  if (!on) {
    const { error } = await supabase.rpc('set_discovery_participation', {
      p_on: false,
      p_summary: null,
    });
    if (error) return { ok: false, message: error.message };

    revalidatePath('/me/discovery');
    return { ok: true };
  }

  const self = await selfElementSummary();
  if (self === null) {
    return {
      ok: false,
      message: '저장된 내 사주를 읽지 못해 참여할 수 없습니다. 내 사주 화면을 먼저 확인해 주세요.',
    };
  }

  const { error } = await supabase.rpc('set_discovery_participation', {
    p_on: true,
    p_summary: self.summary,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath('/me/discovery');
  return { ok: true };
}

/**
 * 목록을 새로 받는다 — **인자가 없다**(ADR 0037).
 *
 * 뽑기도 씨앗도 5분 쿨다운도 DB 안에 있다. 여기서 씨앗을 지어 보내면 사용자가 씨앗을
 * 바꿔 가며 다시 뽑을 수 있고, 그때 노출 기록이 무엇을 잰 것인지 말할 수 없게 된다.
 * 거절의 문장도 DB 가 낸다 — 「방금 새로 받았습니다」를 여기서 다시 판정하지 않는다.
 */
export async function refreshDiscoveryBoard(): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('refresh_discovery_snapshot');
  if (error) return { ok: false, message: error.message };

  revalidatePath('/me');
  return { ok: true };
}

/**
 * 이 사람은 그만 본다 — **차단이 아니다.**
 *
 * 되돌릴 수 있다. 차단은 접촉을 막는 별개의 일이고, 막을 접촉은 아직 없다.
 */
export async function hideCandidate(candidateUserId: string): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  // `user_id` 는 적지 않는다 — 기본값이 `auth.uid()` 이고 정책이 같은 것을 묻는다.
  const { error } = await supabase
    .from('discovery_hidden')
    .insert({ hidden_user_id: candidateUserId });

  if (error) return { ok: false, message: error.message };

  revalidatePath('/me');
  return { ok: true };
}

/**
 * 그만 보기로 한 사람을 **한꺼번에** 되돌린다.
 *
 * 한 명씩 되돌리는 화면을 만들려면 그 사람이 누구인지 이름으로 보여야 하는데, 우리는
 * 감춘 사람의 별명을 붙들고 있지 않다 — 감춘 뒤에는 그 프로필을 읽을 이유가 없기
 * 때문이다. 그래서 화면은 「몇 명」까지만 말하고 되돌리기는 전부다.
 */
export async function unhideAllCandidates(): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  // 정책이 자기 행만 열어 주므로 `user_id` 를 적지 않는다. 조건은 모양만 남긴다.
  const { error } = await supabase.from('discovery_hidden').delete().not('hidden_user_id', 'is', null);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/me');
  return { ok: true };
}

/**
 * 상세 궁합을 함께 보자고 청한다.
 *
 * **인자는 상대 하나뿐이다.** 판본도 추천 이유도 정책 버전도 RPC 가 그 자리에서 읽는다 —
 * 앱이 실어 보내면 그 값은 손으로 적은 값이 되고, 이 서버 액션도 RPC 도 주소만 알면
 * 부를 수 있는 자리다(`my_discovery_board` 와 같은 규율).
 *
 * 거절의 문장도 하나다. 없는 사람·참여하지 않는 사람·차단한 사람·이미 결정이 있는
 * 사람이 모두 같은 말을 받는다 — 갈라서 말하면 「저 사람이 이 서비스를 쓰나」를 묻는
 * 문이 된다. 그 판정은 DB 안에 있고 여기서 다시 하지 않는다.
 */
export async function requestMatch(candidateUserId: string): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('request_match', {
    p_candidate_user_id: candidateUserId,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath('/me');
  revalidatePath('/me/requests');
  return { ok: true };
}
