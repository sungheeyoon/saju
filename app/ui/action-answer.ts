import { unstable_rethrow } from 'next/navigation';

/**
 * **클라이언트가 서버 액션을 부르는 자리는 이것을 지난다** — 액션의 답을 받거나, 답이 안 오면 실패 값 하나를 낸다.
 *
 * 액션은 값으로 답한다(`docs/agents/code-rules/failures.md`). 그래도 **부름 자체가 던지는 길**이 남는다 — 망이 끊김 ·
 * 배포 직후 화면이 든 액션 id 를 서버가 모름 · 액션 안의 받지 않은 예외(운영의 Next 는 영어 안내로 바꿔 보낸다). 받지 않으면
 * 그 예외는 전환(`startTransition`)을 타고 가장 가까운 오류 경계(`app/error.tsx`)로 올라가, 머리글 아래가 통째로 오류
 * 화면으로 바뀌고 쓰던 입력이 사라진다. 여기서 받아 `{ ok: false, message }` 로 접으면 폼은 늘 하던 대로 실패 줄을 세운다.
 *
 * **Next 의 이동은 받지 않는다** — 액션이 `redirect()` 하면 부름이 이동 표지를 던지고, 그것이 전환을 타고 올라가야 화면이
 * 옮긴다(`unstable_rethrow`).
 *
 * 받은 예외의 원문은 사용자에게 내지 않는다 — 우리가 쓴 문장이라는 보증이 없다(`app/db-error.ts` 의 `answerOfThrown` 과 같은 까닭).
 * `app/action-calls.boundary.test.ts` 가 클라이언트 파일의 액션 부름이 이것을 지나는지 센다.
 */
export const ACTION_UNREACHED_NOTE = '처리하지 못했어요. 다시 시도해 주세요.';

/** 부름이 던졌을 때의 값 — 액션이 값으로 내는 실패와 같은 모양이라 부르는 쪽이 한 갈래로 받는다 */
export type ActionUnreached = { readonly ok: false; readonly message: string };

export function actionAnswer<T>(call: Promise<T>): Promise<T | ActionUnreached>;
/** 실패 모양이 `{ ok: false, message }` 가 아닌 액션 — 부르는 쪽이 그 모양을 지어 준다 */
export function actionAnswer<T>(call: Promise<T>, unreached: (message: string) => NoInfer<T>): Promise<T>;
export async function actionAnswer<T>(
  call: Promise<T>,
  unreached?: (message: string) => T,
): Promise<T | ActionUnreached> {
  try {
    return await call;
  } catch (thrown) {
    unstable_rethrow(thrown);
    return unreached ? unreached(ACTION_UNREACHED_NOTE) : { ok: false, message: ACTION_UNREACHED_NOTE };
  }
}
