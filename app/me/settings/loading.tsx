import { Bone, SkeletonMain } from '../../ui/skeleton';
import { COLUMN } from '../../ui/surfaces';

/**
 * 계정 관리의 뼈대 — 제목 · 한 줄 설명, 무리 여섯(작은 제목 · 흰 판의 줄)(`page.tsx` · `card.tsx`). 무리는 실제 화면의
 * 차례다 — 프로필 한 줄 · 어떤 상대 · 인연 찾기 · 선택 동의(설명과 세 줄) · 로그인 정보 · 탈퇴. 줄은 `SETTINGS_ROW` 처럼
 * 폰에서 글 아래 오른쪽 끝에 손잡이가 서고 넓은 화면에서 한 줄이다 — 넷이 같은 높이의 판이면 다 불러온 순간 화면이 출렁였다
 * (2026-10-09 화면 갤러리 감사). 이 기기의 알림 줄은 공개 열쇠가 있는 배포에만 서므로 뼈대에 두지 않는다.
 *
 * 머리글의 톱니에서 여는 화면이다. 탭 넷과 같은 까닭으로 뼈대를 둔다(ADR 0116) — 로그인을 읽는 동적 화면이라 뼈대가
 * 없으면 누른 뒤 서버 응답이 다 올 때까지 지금 화면에 머문다. 이 폴더는 이 화면 하나만 품고 `notFound()` 가 없다.
 */
/**
 * 줄마다 글 상자의 높이(폰 · 넓은 화면)와 손잡이 폭 — 2026-10-10 에 실제 화면을 390 · 1280 에서 잰 값이다. 같은 높이의 줄로 두면
 * 넓은 화면에서 어떤 상대 판이 86 대 162px, 선택 동의 판이 240 대 336px 로 어긋났다(2026-10-09 화면 갤러리 감사). 어떤 상대는
 * 줄이 둘(성별 세 칸 · 그 아래 저장 줄)이고, 선택 동의의 셋은 설명이 두세 줄이다.
 */
const GROUPS = [
  { link: true, description: false, rows: [] },
  {
    link: false,
    description: false,
    rows: [
      { text: 'h-5', handle: 'w-64' },
      { text: 'h-5', handle: 'w-16' },
    ],
  },
  { link: false, description: false, rows: [{ text: 'h-17 sm:h-12', handle: 'w-32' }] },
  {
    link: false,
    description: true,
    rows: [
      { text: 'h-19', handle: 'w-40' },
      { text: 'h-30 sm:h-25', handle: 'w-48' },
      { text: 'h-13', handle: 'w-32' },
    ],
  },
  { link: false, description: false, rows: [{ text: 'h-6', handle: 'w-24' }] },
  { link: false, description: false, rows: [{ text: 'h-18 sm:h-12', handle: 'w-16' }] },
] as const;

export default function SettingsLoading() {
  return (
    <SkeletonMain name="settings" className={`app-shell flex w-full ${COLUMN} flex-1 flex-col gap-8 py-8 sm:py-12`}>
      <div className="flex flex-col gap-1">
        <Bone className="h-[2.275rem] w-36 rounded-full sm:h-[2.6rem]" />
        <Bone className="h-5 w-64 max-w-full rounded-full" />
      </div>
      {GROUPS.map((group, at) => (
        <div key={at} className="flex flex-col gap-2">
          <div className="flex flex-col gap-1 px-1">
            <Bone className="h-6 w-28 rounded-full" />
            {group.description && <Bone className="h-5 w-full rounded-full" />}
          </div>
          <div className="flex flex-col rounded-[1.5rem] border border-border bg-surface px-4 py-1 sm:px-5">
            {group.link && (
              <div className="flex min-h-14 items-center gap-3 py-3">
                <Bone className="size-11 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Bone className="h-5 w-24 rounded-full" />
                  <Bone className="h-4 w-36 rounded-full" />
                </div>
              </div>
            )}
            {group.rows.map((row, line) => (
              <div
                key={line}
                className="flex flex-col gap-3 border-t border-border py-4 first:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                {/*
                  글 상자 — 제목 한 줄과, 남는 높이에 다 드는 만큼의 설명 줄. 세로로 접히는(`flex-wrap`) 단이라 다 들지 못한 줄은
                  오른쪽 다음 단으로 넘어가 잘린다 — 반쯤 잘린 줄이 남지 않는다
                */}
                <div className={`flex min-w-0 flex-col flex-wrap content-start gap-x-8 gap-y-1 overflow-hidden sm:flex-1 ${row.text}`}>
                  <span className="flex w-full shrink-0">
                    <Bone className="h-5 w-32 max-w-full rounded-full" />
                  </span>
                  {[0, 1, 2, 3, 4].map((sentence) => (
                    <span key={sentence} className="flex w-full shrink-0 items-center">
                      <Bone className="h-4 w-full max-w-sm rounded-full" />
                    </span>
                  ))}
                </div>
                <Bone className={`h-11 max-w-full shrink-0 self-end rounded-full sm:self-auto ${row.handle}`} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkeletonMain>
  );
}
