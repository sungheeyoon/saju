import { useRef, useTransition } from 'react';

/**
 * **한 번에 하나** — 처리 중에 다시 누른 것은 버린다. 상태(`useTransition`)는 다음 그림에야 단추를 잠그므로, 같은 그림 안의 두 번째
 * 누름은 이 자물쇠가 막는다. 일이 실패해도 자물쇠는 풀린다.
 *
 * @returns 이번 누름을 실행했는가
 */
export function oneAtATime(): { run: (work: () => Promise<void>) => boolean } {
  let busy = false;
  return {
    run(work) {
      if (busy) return false;
      busy = true;
      void work()
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
      return true;
    },
  };
}

/**
 * 확인하고 쓰는 누름의 실행기 — 전환(`useTransition`) 하나와 자물쇠(`oneAtATime`) 하나를 묶는다. `saving` 은 단추를 잠그고,
 * `run` 은 처리 중의 두 번째 누름을 버린 채 일을 전환 안에서 돌린다. 자물쇠는 일이 끝나야 풀린다 — 일이 던지면 그 예외는 전환을
 * 타고 오류 경계로 가고 자물쇠는 풀리지 않는다(화면이 오류 화면으로 바뀐다).
 *
 * 실패 뒤에 무엇을 지키고 무엇을 다시 읽나는 부르는 쪽의 일이다 — 패널마다 다르다(`afterFailure` · `isUnreached`).
 */
export function useOneAtATime(): { readonly saving: boolean; readonly run: (work: () => Promise<void>) => void } {
  const [saving, startSaving] = useTransition();
  const guard = useRef(oneAtATime());
  const run = (work: () => Promise<void>) => {
    guard.current.run(
      () =>
        new Promise<void>((finish) => {
          startSaving(async () => {
            await work();
            finish();
          });
        }),
    );
  };
  return { saving, run };
}
