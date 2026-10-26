import { Bone, SkeletonMain } from '../../ui/skeleton';
import { COLUMN } from '../../ui/surfaces';

/**
 * 홈의 뼈대 — 인사 · 줄인 내 사주 카드와 그 아래 「다른 사람 사주 보기」 줄 · 내가 받은 사주풀이 줄 · 저장한 사람 줄
 * 차례(`page.tsx`, ADR 0129 「2026-09-29 u2」). 폭 · 열 · 높이는 실제 부품(`home/self-card.tsx` 의 `compact` ·
 * `home/received-readings.tsx` · `home/home-list.tsx` 의 줄)을 따른다 — 어긋나면 다 불러온 순간 화면이
 * 출렁인다(2026-10-09 화면 갤러리 감사).
 *
 * **있을지 없을지 모르는 줄은 늘 두지 않는다**(2026-10-10). 「만드는 중」 줄(`home/running-band.tsx`)은 만드는 풀이가 있을 때만
 * 서므로 뼈대에 자리를 두지 않는다 — 늘 두면 대부분의 사람에게 빈 띠가 섰다가 걷혀 아래 전부가 올라간다. 받은 사주풀이의
 * 넷째 줄(lg)도 같은 까닭으로 안 둔다.
 *
 * **이 무리(`(home)`)는 홈 하나만 품는다.** `app/me/loading.tsx` 로 두면 `/me` 아래 모든 화면(사람 · 계정 관리 · 궁합 ·
 * 인연 결과)이 이 뼈대로 열리고, 그 화면들이 곧바로 보내는 404 · 307 도 스트리밍 뒤의 200 으로 바뀐다(흐름 검사가 그 상태
 * 코드를 잰다, ADR 0116).
 */
export default function HomeLoading() {
  return (
    <SkeletonMain name="home" className={`app-shell flex w-full ${COLUMN} min-w-0 flex-1 flex-col gap-6 py-4 sm:gap-12 sm:py-12`}>
      {/*
        인사는 폰에서 제목으로만 남는다 — 뼈대도 넓은 화면에서만 자리를 둔다.

        **자리만 두고 그리지 않는다(`invisible`, G-88).** 인사의 높이와 위 끝은 등록 전후가 같지만 옆 자리는 갈린다 — 등록 뒤는
        전폭의 왼쪽(1280 에서 x=64), 등록 전은 가운데 기둥(`COLUMN`, x=272). 뼈대는 등록 여부를 읽기 전에 서므로(미리 받아 두는
        정적 뼈대다, ADR 0116) 어느 한쪽에 뼈를 그리면 다른 쪽에서 다 불러온 순간 인사가 옆으로 옮긴다. 그래서 있을지 모르는 줄처럼
        (ADR 0116 추기) 그리지 않고, 높이만 지켜 아래 본문이 출렁이지 않게 한다. 인사는 두 상태 모두 이 빈 띠 안에 제자리로 선다.
      */}
      <div className="invisible hidden flex-col gap-1 sm:flex">
        <Bone className="h-5 w-32 rounded-full" />
        <Bone className="h-[2.925rem] w-72 max-w-full rounded-full" />
      </div>

      <div className="contents">
        <div className="flex min-w-0 flex-col gap-3">
          {/* 줄인 내 사주 카드 — 폰에서는 오행 칸과 출생 정보 상자가 없어 낮고(224px), 넓은 화면은 그 둘이 선다(594px) */}
          <div className="flex min-h-56 flex-col justify-between gap-3 rounded-card bg-surface p-4 sm:min-h-[37.125rem] sm:gap-6 sm:p-8">
            <div className="flex flex-col gap-2 sm:gap-3">
              {/* 동그란 내 프로필(56px)과 딱지 · 이름 — 원은 이름 묶음의 가운데에 선다(`home/self-card.tsx`) */}
              <div className="flex items-center gap-3">
                <Bone className="size-14 shrink-0 rounded-full" />
                <div className="flex flex-col gap-1">
                  <Bone className="h-8 w-20 rounded-full" />
                  <Bone className="h-8 w-40 rounded-full sm:h-[2.875rem] sm:w-56" />
                </div>
              </div>
              <Bone className="h-[1.6rem] w-3/4 rounded-full sm:h-[1.875rem]" />
            </div>
            <Bone className="-mt-2 h-5 w-48 rounded-full sm:mt-0 sm:h-[6.375rem] sm:w-full" />
            <div className="hidden flex-col gap-3 sm:flex">
              <Bone className="h-5 w-16 rounded-full" />
              <div className="grid grid-cols-5 gap-3">
                {[0, 1, 2, 3, 4].map((element) => (
                  <Bone key={element} className="h-[9.375rem] rounded-cell" />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex">
              <Bone className="h-12 rounded-full sm:w-52" />
              <Bone className="h-12 rounded-full sm:w-44" />
            </div>
          </div>
          {/* 「다른 사람 사주 보기」 한 줄 — 흰 판의 줄 하나(64px 와 위아래 4px · 테 둘, `app/me/(home)/page.tsx`) */}
          <Bone className="h-[4.625rem] w-full shrink-0 rounded-card" />
        </div>

        {/*
          받은 사주풀이 — 흰 판 안의 줄 셋(`home/received-readings.tsx`). 줄은 64px 이고 선이 없다. lg 에서는 넷까지 서지만 몇
          줄인지 모른다 — 셋만 둔다. 머리 줄은 구역 제목의 줄 높이(29px)다 — 오른쪽 링크는 음수 여백으로 머리를 안 늘인다
        */}
        <div className="flex min-w-0 flex-col gap-2 sm:gap-4">
          <div className="flex h-[1.8125rem] items-center">
            <Bone className="h-6 w-48 rounded-full" />
          </div>
          <RowsBone rows={3} />
        </div>
      </div>

      {/*
        저장한 사람 — 흰 판 안의 줄 목록(`home/circle-view.tsx`). 사람 줄 둘과 끝의 「사람 추가」 줄. 사람 줄은 단추(44px)와 여백이라
        64px 다
      */}
      <div className="flex flex-col gap-2 sm:gap-4">
        <div className="flex h-[1.8125rem] items-center">
          <Bone className="h-6 w-40 rounded-full" />
        </div>
        <RowsBone rows={3} />
      </div>
    </SkeletonMain>
  );
}

/** 흰 판 안의 줄 뼈대 — 동그란 표시와 글 두 줄. 선이 없고 판 위아래에 8px(`home/home-list.tsx`) */
function RowsBone({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-border bg-surface py-2">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="mx-2 flex min-h-16 items-center gap-3 px-2 py-2.5">
          <Bone className="size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone className="h-4 w-24 rounded-full" />
            <Bone className="h-3.5 w-3/4 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
