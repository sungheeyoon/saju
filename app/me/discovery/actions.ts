'use server';

import { refresh } from '../../refresh';
import type { SaveResult } from '../../save-result';
import { supabaseOnServer } from '../../auth/server-client';
import { publicCardFromRow } from '../candidates';
import { selfElementSummary } from '../summary';
import { PREFER_GENDERS, type PreferGender } from './profile';
import { userFacingDbMessage } from '../../db-error';

/**
 * 만나볼 상대의 조건을 저장한다.
 *
 * RPC 가 없다. 이 칸은 정책이 이미 열어 준 자리이고(`"내 프로필만 고친다"`), 열려 있는
 * 것을 함수로 다시 감싸면 판정하는 자리가 둘이 된다. **참여 상태와 오행 요약은 이 길로
 * 못 지나간다** — 그 둘은 열어 준 칸이 아니다.
 *
 * **이름과 소개도 이 길로 안 지나간다.** 계정으로 옮겨 갔고, 그 표에는 열어 준 칸이 없다.
 */
export async function savePreferGender(value: PreferGender): Promise<SaveResult> {
  if (!(PREFER_GENDERS as readonly string[]).includes(value)) {
    return { ok: false, message: '만나볼 상대의 성별을 다시 골라 주세요.' };
  }

  const supabase = await supabaseOnServer();

  /**
   * 처음인지 아닌지를 먼저 묻는다.
   *
   * upsert 한 줄로 줄일 수 있지만 그러려면 충돌 대상으로 `user_id` 를 실어야 하고,
   * 그 값은 **기본값이 `auth.uid()` 라 앱이 적을 이유가 없는 값**이다. 적기 시작하면
   * 남의 id 를 적을 수 있는 자리가 생긴다(정책이 막지만, 열지 않는 편이 낫다).
   */
  const { data: existing } = await supabase.from('discovery_profile').select('user_id').maybeSingle();

  const { error } = existing
    ? await supabase.from('discovery_profile').update({ prefer_gender: value }).eq('user_id', existing.user_id)
    : await supabase.from('discovery_profile').insert({ prefer_gender: value });

  if (error) return { ok: false, message: userFacingDbMessage(error, 'discovery_profile.upsert') };

  refresh('discovery-settings-changed');
  return { ok: true };
}

/**
 * 매칭 참여를 켜고 끈다.
 *
 * **켤 때 오행 요약을 함께 낸다.** 요약은 브라우저가 아니라 여기서 내 판본을 읽어
 * 만든다 — 클라이언트가 지어 보낼 수 있으면 매칭 풀에 아무 요약이나 올라간다.
 * 자격(사주가 있는가·계정이 살아 있는가)은 RPC 가 묻는다 — 이름은 이미 있다(§5.1).
 */
export async function setDiscoveryParticipation(on: boolean): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  if (!on) {
    const { error } = await supabase.rpc('set_discovery_participation', {
      p_on: false,
      p_summary: null,
    });
    if (error) return { ok: false, message: userFacingDbMessage(error, 'set_discovery_participation') };

    refresh('discovery-settings-changed');
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
  if (error) return { ok: false, message: userFacingDbMessage(error, 'set_discovery_participation') };

  refresh('discovery-settings-changed');
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
  if (error) return { ok: false, message: userFacingDbMessage(error, 'refresh_discovery_snapshot') };

  refresh('board-refreshed');
  return { ok: true };
}

/**
 * 이 사람은 **지금은** 지나친다.
 *
 * 수명은 최근 스물과 24시간이 정한다(`discovery_passed_active`) — 영구 제외가 아니라
 * **잠시 넘기고 다시 꺼낼 수 있는 보관**이다. 접촉을 끊는 차단과 한 표에 담지 않는 까닭이
 * 그것이다: 한 낱말이 두 뜻을 갖는 순간 어느 쪽도 못 말한다.
 *
 * **같은 사람을 다시 넘기면 맨 위로 옮긴다** — 겹쳐 쌓지 않는다. 그래서 `user_id` 를
 * 손으로 싣는다: 기본값이 `auth.uid()` 라도 충돌 대상 칼럼이 payload 에 있어야 upsert
 * 가 한 번의 왕복으로 끝난다. 정책의 `with check` 가 같은 값을 다시 묻는다.
 */
export async function passCandidate(candidateUserId: string): Promise<SaveResult> {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요합니다.' };

  const { error } = await supabase
    .from('discovery_passed')
    .upsert(
      { user_id: user.id, passed_user_id: candidateUserId, passed_at: new Date().toISOString() },
      { onConflict: 'user_id,passed_user_id' },
    );

  if (error) return { ok: false, message: userFacingDbMessage(error, 'discovery_passed.insert') };

  refresh('deck-moved');
  return { ok: true };
}

/**
 * 보관함에서 꺼낸다 — 「다시 만나보기」와 방금 둔 것의 「실행 취소」가 같이 쓴다.
 *
 * 꺼내는 순간 다시 후보가 된다(`discovery_eligible`). 기본키가
 * `(user_id, passed_user_id)` 이고 정책이 `user_id = auth.uid()` 라 내 행 하나에만 닿는다.
 */
export async function restorePassed(candidateUserId: string) {
  const supabase = await supabaseOnServer();
  const self = await selfElementSummary();
  if (!self) return { ok: false as const, message: '내 사주를 먼저 확인해 주세요.' };
  const { data, error } = await supabase.rpc('restore_passed_connection', {
    p_candidate_user_id: candidateUserId,
  });
  if (error) return { ok: false as const, message: userFacingDbMessage(error, 'restore_passed_connection') };
  if (!data?.card) return { ok: false as const, message: '복원한 인연을 읽지 못했습니다. 목록을 새로 열어 주세요.' };
  refresh('deck-moved');
  return {
    ok: true as const,
    card: publicCardFromRow(data.card, self.summary),
    passed: (data.passed ?? []).map((row: Parameters<typeof publicCardFromRow>[0]) => publicCardFromRow(row, self.summary)),
  };
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

  if (error) return { ok: false, message: userFacingDbMessage(error, 'request_match') };

  refresh('match-requested');
  return { ok: true };
}
