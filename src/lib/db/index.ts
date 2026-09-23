/**
 * **DB 가 말하는 모양은 여기서만 주장한다.**
 *
 * `database.generated.ts` 는 `supabase gen types typescript --local` 이 지은 것이고
 * 손으로 고치지 않는다(`npm run db:types`). 마이그레이션만 고치고 이 파일을 안 다시
 * 지으면 CI 가 diff 로 빨개진다 — 그 자리가 **지금 정의를 읽을 수 있는 유일한 자리**다.
 *
 * 이 모듈은 **타입만** 낸다. `src/lib` 은 supabase 를 부르지 않는다(런타임 의존 0건) —
 * 그 성질을 여기서도 지킨다. 문을 부르는 일은 앱의 **읽는 문**이 하고, snake_case 를
 * 도메인의 말로 옮기는 일도 그 문 안의 어댑터가 한다(ADR 0072 의 문 둘과 같은 결).
 */

import type { Database } from './database.generated';

export type { Database };

/** 문 이름 하나 — `Database` 가 아는 것만 쓴다 */
type RpcName = keyof Database['public']['Functions'];

/**
 * 문이 내주는 행 하나.
 *
 * 대부분의 문이 `returns table (...)` 이라 배열을 내주므로, 그 원소를 집어 온다.
 * 스칼라를 내주는 문(`returns uuid` 등)은 그 값 자체가 된다.
 */
export type RpcRow<N extends RpcName> =
  Database['public']['Functions'][N]['Returns'] extends readonly (infer Row)[]
    ? Row
    : Database['public']['Functions'][N]['Returns'];

/** 문이 받는 인자 한 벌 */
type RpcArgs<N extends RpcName> = Database['public']['Functions'][N]['Args'];

/**
 * **생성 타입이 말하지 못하는 것 하나 — 인자의 `null` 허용.**
 *
 * `gen types` 는 인자를 이름과 타입으로만 적는다. `p_intro text` 가 NULL 을 받는지는
 * 그 파일에 안 적히고, 그래서 `null` 을 실어 보내는 자리가 전부 타입에서 걸린다.
 *
 * 생략으로 바꾸면 안 되는 자리가 있다. **기본값이 없는 인자를 빼면 PostgREST 가 함수
 * 자체를 못 찾는다** — `create_managed_person` 이 26키로 나가 운영에서 화면이 안 열린
 * 적이 있다(`src/lib/input/revision.ts`). `default null` 이 붙은 인자만 생략과 `null` 이
 * 같은 뜻이고, 그 판정은 마이그레이션에 있지 여기에 없다.
 *
 * 그래서 **그 하나만 우리가 주장하고, 주장하는 자리를 이 함수로 모은다.** 이름은
 * 여전히 생성 타입이 잠근다 — 없는 인자를 적으면 여기서 걸린다.
 */
type NullableArgs<N extends RpcName> = {
  [K in keyof RpcArgs<N>]: RpcArgs<N>[K] | null;
};

/** 문이 받는 한 벌 — 이름과 칸은 생성 타입이, `null` 허용은 이 함수가 주장한다 */
export const rpcArgs = <N extends RpcName>(args: NullableArgs<N>): RpcArgs<N> =>
  args as RpcArgs<N>;
