import { Bone, SkeletonMain } from '../ui/skeleton';

/**
 * 궁합 탭의 뼈대 — 「궁합 새로 보기」와 흰 고르는 판(두 칸 · 사이를 묻는 띠) · 한 줄 안내, 관계 지도
 * (`page.tsx` · `compat-picker.tsx` · `home/map/relation-map.tsx`, 「2026-09-29 u2」). 폭(`max-w-[58rem]`)과 판의 모양을
 * 실제 화면에 맞춘다 — 어긋나면 다 불러온 순간 화면이 출렁인다(2026-10-09 화면 갤러리 감사).
 *
 * **궁합풀이 한 줄(`archive.tsx` 의 `CompatSummary`)은 자리를 두지 않는다**(2026-10-10). 본 궁합이 있을 때만 서는 줄이라 늘
 * 두면 처음 온 사람에게 68px 띠가 섰다가 걷혀 지도가 올라갔다. 사이를 묻는 띠는 처음 열면 늘 서는 것 — 칩 넷(폰은 두 줄), 그 오른쪽
 * (폰은 아래)의 「궁합 보기」, 단추가 왜 잠겼는지 말하는 한 줄 — 을 다 둔다.
 *
 * 다른 탭 넷과 같은 까닭이다(ADR 0116) — 로그인을 읽는 동적 화면이라 뼈대가 없으면 누른 뒤 서버 응답이 다 올 때까지 지금
 * 화면에 머문다. 이 폴더는 궁합 첫 화면 하나만 품으므로 무리 폴더가 필요 없다. 익명으로 곧바로 열면 로그인으로 보내는
 * 것이 307 대신 200 + 문서 안의 되돌림이 된다 — 탭 넷과 같은 대가다.
 */
export default function CompatLoading() {
  return (
    <SkeletonMain name="compat" className="app-shell flex max-w-[58rem] flex-1 flex-col gap-8 py-6 sm:gap-10 sm:py-12">
      <div className="flex flex-col gap-4">
        <Bone className="h-8 w-40 rounded-full" />

        {/* 고르는 판 — `CARD_FRAME` 과 같은 흰 판 */}
        <div className="overflow-hidden rounded-[1.75rem] border border-border bg-surface">
          <div className="px-5 pt-6 sm:px-6">
            <Bone className="h-7 w-56 max-w-full rounded-full" />
          </div>
          <div className="grid items-start sm:grid-cols-[1fr_auto_1fr]">
            {[0, 1].map((side) => (
              <div key={side} className="contents">
                {/* 두 칸 사이의 「×」 자리 — 실제 판처럼 넓은 화면에서는 가운데 좁은 열이다 */}
                {side === 1 && <span aria-hidden="true" className="h-8 sm:w-4" />}
                <div className="flex min-w-0 flex-col gap-3 p-5 sm:p-6">
                  <Bone className="h-11 w-full rounded-xl" />
                  <Bone className="h-[3.25rem] w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
          {/* 사이를 묻는 띠 — `relation-choice.tsx` 의 물음 · 설명(폰 세 줄, 넓은 화면 한 줄) · 칩 줄과 그 아래 잠긴 까닭 한 줄 */}
          <div className="border-t border-border p-5 sm:p-6">
            <Bone className="h-7 w-48 max-w-full rounded-full" />
            <div className="flex h-[3.75rem] flex-col justify-between py-0.5 sm:h-5">
              <Bone className="h-4 w-full rounded-full" />
              <Bone className="h-4 w-full rounded-full sm:hidden" />
              <Bone className="h-4 w-1/2 rounded-full sm:hidden" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                {['w-14', 'w-20', 'w-24', 'w-28'].map((width) => (
                  <span key={width} className="flex h-11 items-center">
                    <Bone className={`h-9 rounded-full ${width}`} />
                  </span>
                ))}
              </div>
              <div className="ml-auto pl-1.5">
                <Bone className="h-12 w-40 rounded-full sm:w-44" />
              </div>
            </div>
            <div className="mt-2 flex h-5 justify-end">
              <Bone className="h-5 w-44 rounded-full" />
            </div>
          </div>
        </div>

        <Bone className="h-6 w-64 max-w-full rounded-full" />
      </div>

      {/* 관계 지도 — 크림 판 · 머리 줄 · 정사각 궤도(폰 24rem · 넓은 화면 30rem) · 범례(설명이 폰은 두 줄) */}
      <div className="flex flex-col rounded-[2rem] bg-cream">
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <Bone className="h-8 w-32 rounded-full" />
        </div>
        <div className="grid place-items-center px-[8%] py-[9%] sm:px-[10%] sm:py-6">
          <Bone className="aspect-square w-full max-w-[24rem] rounded-full sm:max-w-[30rem]" />
        </div>
        <div className="flex flex-col gap-2 px-5 pb-5 pt-1 sm:px-6">
          <Bone className="h-5 w-48 rounded-full" />
          <Bone className="h-5 w-full rounded-full" />
          <Bone className="-mt-1 h-4 w-2/3 rounded-full sm:hidden" />
        </div>
      </div>
    </SkeletonMain>
  );
}
