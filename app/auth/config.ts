/**
 * Supabase 접속값 — **둘 다 공개 키다.**
 *
 * `NEXT_PUBLIC_` 이라 브라우저 번들에 그대로 들어간다. 그래도 되는 이유는 이 키가
 * 권한을 주지 않기 때문이다 — 무엇을 볼 수 있는지는 키가 아니라 RLS 정책이 정한다.
 * 그래서 정책을 DB 에 건 것이고, 키를 숨기는 것으로 대신할 수 있는 일이 아니다.
 *
 * `SUPABASE_SECRET_KEY`(service role)는 **여기 오지 않는다.** 그건 RLS 를 통째로
 * 지나가는 키라 사용자 경로에 쓰지 않는다.
 *
 * 그 키를 드는 자리가 딱 하나 생겼다 — 공유 결과가 매인 판본을 읽는 문이다
 * (`app/me/match/inputs.ts`, ADR 0010). 여기 두지 않는 것은 그대로다: 그 자리는
 * 자기가 쓰는 값을 자기가 읽고, 없으면 화면이 「지금은 열 수 없습니다」로 선다.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export type SupabaseEnv = { url: string; publishableKey: string };

/**
 * 없으면 그 자리에서 멈춘다.
 *
 * 빈 문자열로 client 를 만들면 로그인 버튼이 눌리고 아무 일도 안 일어나거나,
 * 「Failed to fetch」 같은 말로 실패한다. 무엇이 없는지 여기서 말한다.
 */
export function supabaseEnv(): SupabaseEnv {
  if (!url || !publishableKey) {
    throw new Error(
      'Supabase 접속값이 없습니다 — NEXT_PUBLIC_SUPABASE_URL 과 ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 를 확인하세요 (vercel env pull).',
    );
  }
  return { url, publishableKey };
}
