import {
  EMPTY_ANSWERS,
  type CreditIntent,
  type CreditReason,
  type ImproveOption,
  type LikedOption,
  type PriceFactor,
  type PriceOption,
  type SurveyAnswers,
  type UnknownOption,
  type WantNewOption,
  type WantOption,
} from '@/src/lib/survey';

import { supabaseOnServer } from '../../auth/server-client';

/**
 * 서비스 설문이 **브라우저로 내려오는 문.**
 *
 * 여기서 아무것도 판정하지 않는다. **어느 문항이 서는가**는 DB 가 답하고
 * (`service_survey_context`), 화면은 그 값을 읽는다. 화면이 스스로 세면 저장하는 자리와
 * 그리는 자리가 다른 조건을 쓰게 되고, 그때 「안 물어본 문항의 답」이 저장된다.
 */

export type SurveyContext = {
  /** 남은 풀이권 — 0이면 Q3 이 안 선다 */
  readonly creditsLeft: number;
  /** 사주풀이를 읽어 봤나 — 값 문항이 이 값으로 선다 */
  readonly readSolo: boolean;
  /** 궁합을 읽어 봤나. **공유 궁합도 읽은 것이다** */
  readonly readPair: boolean;
  readonly consented: boolean;
};

export type MySurvey = {
  readonly answers: SurveyAnswers;
  readonly savedAt: string;
  /** `null` 이면 아직 초안이다 */
  readonly submittedAt: string | null;
  readonly updatedAt: string | null;
};

type Row = Record<string, unknown>;

export async function surveyContext(): Promise<SurveyContext | null> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('service_survey_context');
  if (error) return null;

  const row = ((data ?? []) as Row[])[0];
  if (row === undefined) return null;

  return {
    creditsLeft: Number(row.credits_left),
    readSolo: row.read_solo === true,
    readPair: row.read_pair === true,
    consented: row.consented === true,
  };
}

/**
 * 내가 남긴 것 — **초안도 내려온다.**
 *
 * 「답했는가」만 받으면 고치는 화면이 빈 칸으로 열리고, 거기서 다시 보내면 적어 두었던
 * 글이 지워진다. 풀이 설문이 이미 한 번 겪은 자리다.
 */
export async function mySurvey(): Promise<MySurvey | null> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_service_survey');
  if (error) return null;

  const row = ((data ?? []) as Row[])[0];
  if (row === undefined) return null;

  return {
    answers: {
      ...EMPTY_ANSWERS,
      liked: (row.liked as LikedOption[] | null) ?? [],
      unknown: (row.unknown_features as UnknownOption[] | null) ?? [],
      improve: (row.improve as ImproveOption[] | null) ?? [],
      improveText: (row.improve_text as string | null) ?? '',
      creditIntent: (row.credit_intent as CreditIntent | null) ?? null,
      creditReasons: (row.credit_reasons as CreditReason[] | null) ?? [],
      wants: (row.wants as WantOption[] | null) ?? [],
      wantsNew: (row.wants_new as WantNewOption[] | null) ?? [],
      priceSolo: (row.price_solo as PriceOption | null) ?? null,
      pricePair: (row.price_pair as PriceOption | null) ?? null,
      priceFactors: (row.price_factors as PriceFactor[] | null) ?? [],
      freeText: (row.free_text as string | null) ?? '',
    },
    savedAt: row.saved_at as string,
    submittedAt: (row.submitted_at as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}
