'use server';

import { revalidatePath } from 'next/cache';

import { PRICE_OPTIONS, type SurveyAnswers } from '@/src/lib/survey';

import { supabaseOnServer } from '../../auth/server-client';

/**
 * 답을 저장한다 — **초안과 제출이 한 문을 지난다.**
 *
 * 문을 둘로 나누면 검사가 두 벌이 되고, 초안이라고 아무 값이나 받으면 제출로 바꾸는
 * 순간 검사에 걸리는 줄이 이미 저장돼 있게 된다. 무엇을 받고 무엇을 비우는지는 DB 가
 * 정한다(`save_service_survey`) — 여기서 한 번 더 다듬으면 다듬는 자리가 둘이 된다.
 *
 * **제시 금액 목록은 서버가 싣는다.** 브라우저가 보내게 하면 그 값이 곧 「무엇을 보여
 * 줬는가」의 기록인데, 보낸 쪽이 고칠 수 있는 기록은 기록이 아니다.
 */
export async function saveServiceSurvey(
  answers: SurveyAnswers,
  submit: boolean,
): Promise<{ ok: true; submittedAt: string | null } | { ok: false; message: string }> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('save_service_survey', {
    p_liked: [...answers.liked],
    p_unknown: [...answers.unknown],
    p_improve: [...answers.improve],
    p_improve_text: answers.improveText.trim() === '' ? null : answers.improveText,
    p_wants: [...answers.wants],
    p_wants_new: [...answers.wantsNew],
    p_price_solo: answers.priceSolo,
    p_price_pair: answers.pricePair,
    p_price_factors: [...answers.priceFactors],
    p_free_text: answers.freeText.trim() === '' ? null : answers.freeText,
    p_price_options: [...PRICE_OPTIONS],
    p_submit: submit,
  });

  if (error) return { ok: false, message: error.message };

  /*
    제출한 뒤에는 화면이 「고맙습니다」로 서야 하고, 그 값은 서버가 내려주는
    `submitted_at` 이다. 초안 저장은 무르게 하지 않는다 — 몇 초마다 도는 자동 저장이
    화면을 다시 그리면 쓰던 칸이 흔들린다.
  */
  if (submit) revalidatePath('/me/survey');

  return { ok: true, submittedAt: (data as string | null) ?? null };
}
