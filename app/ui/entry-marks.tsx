/**
 * 첫 화면 두 입구의 그림 — 「내 사주 보기」는 해, 「궁합 보기」는 태극.
 *
 * 입구에는 오행 그림(`element-symbol`)이 서 있었다(火 · 水). 그런데 입구는 오행을 뜻하지 않아서, 색과 모양이
 * 무엇을 말하는지 물을 까닭만 만들었다. 입력 폼 시안 n 「설정 목록」(운영자 2026-09-29, ADR 0132)이 흑백 그림 둘로
 * 바꿨다 — 선 굵기 1.5 와 `currentColor` · 흰 면뿐이라 판의 색을 안 입는다.
 *
 * 장식이다(`aria-hidden`) — 이름은 입구의 글자가 든다.
 */

/** 해 — 가운데 원(테두리)과 짧은 빛살 여덟. 태극과 같은 선 굵기 */
export function SunMark({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.5" />
      {RAYS.map((deg) => (
        <line
          key={deg}
          x1="12"
          y1="2.75"
          x2="12"
          y2="5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

/**
 * 태극의 몸 — 원 테두리 · 먹색 반 · 두 점. **궁합의 그림은 이 한 벌이다**(운영자 2026-09-29 — 하트를 걷었다).
 *
 * 첫 화면 입구(`TaijiMark`)와 선 아이콘(`Icon name="taiji"` — 탭 · 단추)이 같은 모양을 쓴다. 선 굵기는 둘러싼 `<svg>` 가
 * 준다 — 입구는 1.5, 선 아이콘 한 벌은 1.8 이라 곁의 다른 탭 그림과 굵기가 같다.
 *
 * **밝은 반은 `--taiji-light` 를 칠한다. 없으면 비친다**(`transparent`). 먹색 알약(켜진 탭 · 주 단추) 위에서는 글자색이
 * 밝은 색이라 밝은 반을 흰 면으로 칠하면 두 반이 한 색이 되어 그림이 사라진다 — 비치면 알약의 먹색이 어두운 반이 된다.
 * 입구는 크림 종이 위의 흰 원이 시안이라 `var(--surface)` 를 준다.
 */
export function TaijiShapes() {
  return (
    <>
      <circle cx="12" cy="12" r="9" fill="var(--taiji-light, transparent)" stroke="currentColor" />
      {/* 먹색 반 — 아래 점은 칠하지 않고 **뚫는다**(`evenodd`) — 그래야 밝은 반과 같은 것(면이든 비침이든)이 보인다 */}
      <path
        d="M12 3a9 9 0 0 1 0 18 4.5 4.5 0 0 1 0-9 4.5 4.5 0 0 0 0-9ZM13.4 16.5a1.4 1.4 0 1 0-2.8 0 1.4 1.4 0 1 0 2.8 0Z"
        fill="currentColor"
        fillRule="evenodd"
        stroke="none"
      />
      <circle cx="12" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  );
}

/** 태극 — 흰 바탕 원에 먹색 반, 테두리 1.5 */
export function TaijiMark({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      className={`shrink-0 [--taiji-light:var(--surface)] ${className}`}
    >
      <TaijiShapes />
    </svg>
  );
}
