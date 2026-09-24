import { expect, type Locator, type Page } from '@playwright/test';

/**
 * **누르는 자리의 크기를 손가락으로 잰다** — 상자가 아니라 눌리는 넓이다.
 *
 * `boundingBox()` 는 요소의 상자만 본다. 그런데 과녁을 넓히는 길은 둘이다 — 상자를 키우거나,
 * 모양은 그대로 두고 투명한 `::after` 나 덮어 깐 입력으로 눌리는 자리만 키우거나. 뒤의 것은
 * 상자에 안 잡히므로, 여기서는 가운데에서 네 방향으로 반 픽셀씩 나가며
 * `elementFromPoint` 가 **그 요소(또는 그 안의 것)** 를 돌려주는 데까지를 잰다.
 * 옆 단추가 덮고 있으면 거기서 멈춘다 — 실제로 손가락이 닿는 넓이다.
 *
 * 머리글처럼 떠 있는 판이 가리지 않게 화면 가운데로 굴린 뒤에 잰다.
 */
export async function hitArea(control: Locator): Promise<{ width: number; height: number }> {
  await expect(control).toBeVisible();
  return control.evaluate((node) => {
    node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const box = node.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const owns = (x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      return hit !== null && node.contains(hit);
    };
    const reach = (dx: number, dy: number) => {
      let step = 0;
      while (step < 160 && owns(cx + dx * (step + 0.5), cy + dy * (step + 0.5))) step += 0.5;
      return step;
    };
    return { width: reach(-1, 0) + reach(1, 0), height: reach(0, -1) + reach(0, 1) };
  });
}

/** 과녁 여럿을 한 번에 — 다 잰 뒤에 작은 것을 모아 세우므로, 실패하면 어느 것이 몇 픽셀인지가 함께 선다 */
export async function expectTargets(targets: Record<string, Locator>): Promise<void> {
  const small: string[] = [];
  for (const [name, control] of Object.entries(targets)) {
    const { width, height } = await hitArea(control);
    if (width < 44 || height < 44) small.push(`${name} ${width}×${height}`);
  }
  expect.soft(small).toEqual([]);
}

/**
 * **초점을 받은 요소의 `outline` 이 제 클래스를 따르는가.**
 *
 * 전역의 초점 테두리가 층 밖에 있으면 유틸리티의 `outline-none` 을 누른다 — 칸마다 제 테두리를
 * 따로 두르는데 전역 것이 한 겹 더 서서 두 겹이 됐다. 키보드로 온 초점인지(`:focus-visible`)부터
 * 확인하고 잰다. 스크립트로 준 초점이 그 판정을 못 받으면 이 검사는 아무것도 안 잰 것이다.
 */
export async function focusedOutline(control: Locator): Promise<{ own: string; after: string; ring: string }> {
  await control.focus();
  return control.evaluate((node) => {
    if (!node.matches(':focus-visible')) throw new Error('키보드 초점으로 판정되지 않았습니다');
    return {
      own: getComputedStyle(node).outlineStyle,
      after: getComputedStyle(node, '::after').outlineStyle,
      ring: getComputedStyle(node).boxShadow,
    };
  });
}

/**
 * **바탕 그림이 한 화면 높이마다 되풀이되지 않는가** — 칠해진 픽셀로 잰다.
 *
 * `<html>` 이 한 화면 높이(`h-full`)라 바탕의 둥근 빛이 그 높이마다 다시 깔렸고, 긴 화면에서는
 * 첫 화면 바로 아래에 가로 금이 섰다(어두운 테마에서 가장 또렷하다). 첫 화면 높이 바로 위 한 줄과
 * 바로 아래 한 줄을 왼쪽 여백에서 잘라 견준다 — 되풀이되면 아래 줄에 다음 빛의 머리가 선다.
 */
export async function seamRows(page: Page): Promise<{ above: Buffer; below: Buffer }> {
  const height = page.viewportSize()?.height ?? 0;
  await page.evaluate((top) => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, top);
  }, height - 200);
  const scrolled = await page.evaluate(() => window.scrollY);
  const edge = height - scrolled;
  const clip = (y: number) => ({ x: 2, y, width: 8, height: 1 });
  return {
    above: await page.screenshot({ clip: clip(edge - 2) }),
    below: await page.screenshot({ clip: clip(edge + 1) }),
  };
}
