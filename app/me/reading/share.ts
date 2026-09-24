'use server';

import { sharePath, type ShareKind } from '../../share/path';
import { supabaseOnServer } from '../../auth/server-client';
import { currentReading, type CurrentReading } from './current';
import { isShareable, shareTargetArgs, type ReadingTarget } from './target';
import { answerOfThrown, userFacingDbMessage } from '../../db-error';
import { rpcArgs } from '@/src/lib/db';

/** 링크를 못 냈다 — 까닭을 우리가 못 고를 때 이 버튼이 세우는 한 문장 */
const NOT_ISSUED = '공유 링크를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.';

/**
 * 풀이를 공유본으로 내놓고 **주소를 받는다.**
 *
 * ## 무엇을 보낼 수 있나
 *
 * 내 사주풀이 · 저장한 사람의 풀이 · 내가 고른 두 사람의 궁합. 셋 다 **내가 넣은
 * 자료**다. **인연 궁합(`match`)은 안 된다** — 거기 있는 상대는 실재하는 계정이고,
 * 그 사람이 동의한 것은 「이 사람에게 내 여덟 글자를 연다」이지 「누구에게든 연다」가
 * 아니다(ADR 0012). DB 의 문도 그 갈래를 받지 않는다.
 *
 * ## 브라우저가 보낸 글은 안 쓴다
 *
 * 버튼은 대상만 말한다. 글은 여기서 다시 읽고(`currentReading` — RLS 와
 * `reading_scope` 가 볼 수 있는 것만 내준다) 그것을 넘긴다. 화면이 들고 있던 글을
 * 그대로 받으면, 그 글이 화면에 선 것과 같은 것인지 서버가 알 수 없다.
 *
 * `currentReading` 이 이미 **내부 검토용 근거 절을 자른 뒤**의 글을 낸다
 * (`readingBody`). 자르는 규칙이 사는 자리는 거기 하나이고, DB 의 문은 받은 글이
 * 저장된 원문 안의 글인지만 확인한다.
 *
 * ## AI 도 풀이권도 안 건드린다
 *
 * 이 길에는 생성이 없다. 읽고 한 줄을 적을 뿐이라, 링크를 몇 번 내도 잔액은 안 움직인다.
 *
 * @returns 성공하면 `/share/…` 경로. **절대 주소가 아니다** — 그것은 브라우저가
 *   자기 origin 을 붙여 짓는다(`share-button.tsx`).
 */
export async function shareMyReading(
  target: ReadingTarget,
): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  /**
   * **막는 자리는 여기 하나이고, 그 뒤로는 타입이 든다.** `isShareable` 이 좁혀 주므로
   * 아래 `shareTargetArgs` 는 `match` 를 받을 수조차 없다 — 이 검사를 지우면 컴파일이 깨진다.
   */
  if (!isShareable(target)) {
    return { ok: false, message: '인연 궁합은 공유 링크를 만들 수 없습니다.' };
  }

  /* 풀이를 못 읽으면 문이 던진다 — 던지지 않고 값으로 낸다. 액션이 던지면 운영의 Next 가
     그 문장을 영어 안내로 바꾼다(ADR 0078) */
  let reading: CurrentReading | null;
  try {
    reading = await currentReading(target);
  } catch (thrown) {
    return { ok: false, message: answerOfThrown(thrown, 'share_my_reading', NOT_ISSUED) };
  }
  if (reading === null) {
    return { ok: false, message: '공유할 풀이가 없습니다.' };
  }

  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc('share_my_reading', rpcArgs<'share_my_reading'>({
    p_body: reading.output,
    p_metaphor: reading.metaphor,
    ...shareTargetArgs(target),
  }));

  /**
   * **대체 문장은 그대로 두고 우리말 거절만 지나가게 한다.** 이 자리의 「공유 링크를
   * 만들지 못했습니다」는 잘 지은 말이라 기본 문장보다 낫다 — 다만 DB 가 한국어로 낸
   * 거절까지 이 말로 덮고 있었다(예: 「공유할 수 없는 풀이입니다」). 기록은 한 문이 남긴다.
   */
  if (error) {
    return {
      ok: false,
      message: userFacingDbMessage(
        error,
        'share_my_reading',
        NOT_ISSUED,
      ),
    };
  }

  const token = data as string | null;
  if (token === null || token === '') {
    return { ok: false, message: NOT_ISSUED };
  }

  return { ok: true, path: sharePath(target.kind as ShareKind, token) };
}
