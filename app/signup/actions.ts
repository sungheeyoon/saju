'use server';

import { redirect } from 'next/navigation';

import { refresh } from '../refresh';
import { supabaseOnServer } from '../auth/server-client';
import { userFacingDbMessage } from '../db-error';
import { safeReturnPath } from '@/src/lib/consent';
import { rpcArgs } from '@/src/lib/db';

/** 틀린 코드의 문장 — 없는 코드 · 지난 코드 · 가입이 멈춘 때가 같은 말이다(DB 의 거절과 같은 글자) */
const WRONG_CODE_NOTE = '사용할 수 없는 코드예요. 코드를 다시 확인해 주세요.';

/**
 * 가입을 끝낸다 — **성공하면 안 돌아온다.**
 *
 * 코드·이름·안내 확인이 **한 번에** 나간다(`complete_signup`). 갈라 보내면 「코드는
 * 썼는데 이름이 없는」 계정이 생기고, 관문이 그런 사람을 어디로 보낼지 다시 정해야
 * 한다 — 그 자리를 없애려고 폼을 하나로 합친 것이다(ADR 0042).
 *
 * 판본과 **본 안내의 줄**을 화면이 들고 온다. 서버가 스스로 「지금 값」을 적으면 사용자가
 * 읽은 것과 남는 기록이 갈린다 — 읽은 것을 적어야 그 기록이 뜻이 있다. 그 사이에
 * 운영자가 일정을 옮겼으면 DB 가 거절한다.
 *
 * ## 갈 곳을 **여기서** 정한다
 *
 * 화면이 `/me` 로 보내고 거기서 관문이 한 번 더 튕기게 두면, 그 두 번째 튕김에서 화면이
 * 빈다(커밋 `2cbb31f`). 튕김이 하나면 그 자리가 없다.
 */
export async function completeSignup(answer: {
  /** 가입을 마치고 갈 곳 — 화면이 보낸 값이라 여기서 다시 좁힌다(ADR 0128) */
  returnTo: string;
  code: string;
  nickname: string;
  version: string;
  scheduleId: number;
  improvement: boolean;
  contact: boolean;
}): Promise<{ ok: false; message: string }> {
  const supabase = await supabaseOnServer();

  const { data: signedUp, error } = await supabase.rpc('complete_signup', rpcArgs<'complete_signup'>({
    /*
      **빈 칸은 `null` 로 보낸다.** 이미 이름이나 코드를 가진 사람은 그 칸을 안 보므로
      빈 문자열이 온다 — DB 가 그것을 「짓겠다」로 읽으면 2자 미만이라고 거절한다.
    */
    p_code: answer.code.trim() || null,
    p_nickname: answer.nickname.trim() || null,
    p_version: answer.version,
    p_schedule_id: answer.scheduleId,
    p_improvement: answer.improvement,
    p_contact: answer.contact,
  }));

  if (error) return { ok: false, message: userFacingDbMessage(error, 'complete_signup') };
  /*
    **틀린 코드는 거절이 아니라 `false` 로 온다** — DB 가 틀린 시도를 적고 세어야 해서 던지지 않는다
    (`20261101090000`, ADR 0124). 문장은 던지던 때와 같다: 없는 코드와 지난 코드를 가르지 않는다.
  */
  if (signedUp === false) return { ok: false, message: WRONG_CODE_NOTE };

  refresh('signed-up');

  /*
    **가려던 곳으로 간다**(ADR 0128) — 관문이 가입 화면으로 보낼 때 들려 보낸 `next` 다. 액션은 주소가 알려지면
    누구나 부르므로 화면이 넘긴 값을 믿지 않고 같은 사이트 경로로 다시 좁힌다.
    `redirect` 는 던진다 — try 안에 두지 않는다(Next 문서). 여기가 이 함수의 끝이다.
  */
  redirect(safeReturnPath(answer.returnTo));
}
