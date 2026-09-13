'use server';

import { sharePath } from '../../share/path';
import { supabaseOnServer } from '../../auth/server-client';
import { currentReading } from './current';

/**
 * 내 사주풀이를 공유본으로 내놓고 **주소를 받는다.**
 *
 * ## 브라우저가 보낸 글은 안 쓴다
 *
 * 버튼은 아무것도 안 실어 보낸다. 여기서 내 결과를 다시 읽고(`currentReading` —
 * RLS 가 내 것만 내준다) 그 글을 넘긴다. 화면이 들고 있던 글을 그대로 받으면, 그
 * 글이 화면에 선 것과 같은 것인지 서버가 알 수 없다.
 *
 * `currentReading` 이 이미 **내부 검토용 근거 절을 자른 뒤**의 글을 낸다
 * (`readingBody`). 자르는 규칙이 사는 자리는 거기 하나이고, DB 의 문은 받은 글이
 * 저장된 원문 안의 글인지만 확인한다.
 *
 * ## AI 도 풀이권도 안 건드린다
 *
 * 이 길에는 생성이 없다. 읽고 한 줄을 적을 뿐이라, 링크를 몇 번 내도 잔액은 안 움직인다.
 *
 * @returns 성공하면 `/share/readings/…` 경로. **절대 주소가 아니다** — 그것은
 *   브라우저가 자기 origin 을 붙여 짓는다(`share-button.tsx`).
 */
export async function shareMyReading(): Promise<
  { ok: true; path: string } | { ok: false; message: string }
> {
  const reading = await currentReading({ kind: 'self' });
  if (reading === null) {
    return { ok: false, message: '공유할 사주풀이가 없습니다.' };
  }

  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc('share_my_reading', {
    p_body: reading.output,
    p_metaphor: reading.metaphor,
  });

  if (error) {
    console.error('공유본을 만들지 못했다', error.message);
    return { ok: false, message: '공유 링크를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.' };
  }

  const token = data as string | null;
  if (token === null || token === '') {
    return { ok: false, message: '공유 링크를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.' };
  }

  return { ok: true, path: sharePath(token) };
}
