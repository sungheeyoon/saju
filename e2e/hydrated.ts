import { expect, type Locator } from '@playwright/test';

/**
 * **손이 붙은 뒤에 누른다** — 서버 HTML 로 먼저 선 단추는 보이고 눌리지만, 누름을 받는 손(React)은 하이드레이션
 * 뒤에 붙는다. 그 전의 누름은 아무 일도 안 하고 사라지고, Playwright 는 그것을 다시 누르지 않는다.
 *
 * 워커 셋 · 첫 컴파일 · CI 처럼 하이드레이션이 늦는 날에만 붉어서 흔들리는 시험으로 보였다(2026-09-26 — 사람 더하기 ·
 * 오늘의 인연 넘기기 · 사진 끌기). `networkidle` 은 손이 붙었다는 뜻이 아니다. React 가 요소에 제 속성
 * (`__reactProps$…`)을 다는 것이 붙었다는 표시다.
 */
export async function hydrated(control: Locator): Promise<Locator> {
  await expect
    .poll(() => control.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps$'))), {
      message: '하이드레이션이 끝나지 않았다',
    })
    .toBe(true);
  return control;
}
