import { Bone, SkeletonMain } from '../../ui/skeleton';
import { COLUMN } from '../../ui/surfaces';

import { SETTINGS_GROUP } from './card';

/**
 * 계정 관리의 뼈대 — 회색 바탕 위의 제목, 흰 무리 넷(내 프로필 · 인연 · 선택 동의 · 계정)과 그 아래 탈퇴하기 글자(`view.tsx` ·
 * `card.tsx`). 무리는 실제 화면의 차례이고 모양도 같은 상수(`SETTINGS_GROUP`)다 — 폰에서 화면 끝까지 가는 흰 면, 사이는 16px 띠.
 * 이 기기의 알림 무리는 공개 열쇠가 있는 배포에만 서므로 뼈대에 두지 않는다.
 *
 * 머리글의 톱니에서 여는 화면이다. 탭 넷과 같은 까닭으로 뼈대를 둔다(ADR 0116) — 로그인을 읽는 동적 화면이라 뼈대가
 * 없으면 누른 뒤 서버 응답이 다 올 때까지 지금 화면에 머문다. 이 폴더는 이 화면 하나만 품고 `notFound()` 가 없다.
 */
type Row = { kind: 'switch'; text: string } | { kind: 'choice' } | { kind: 'link' } | { kind: 'text' };

const GROUPS: { title: boolean; description: boolean; rows: Row[] }[] = [
  { title: true, description: false, rows: [{ kind: 'switch', text: 'h-11' }, { kind: 'choice' }] },
  {
    title: true,
    description: true,
    rows: [{ kind: 'switch', text: 'h-16' }, { kind: 'switch', text: 'h-24' }, { kind: 'link' }],
  },
  { title: true, description: false, rows: [{ kind: 'text' }] },
];

export default function SettingsLoading() {
  return (
    <SkeletonMain name="settings" className="flex w-full flex-1 flex-col bg-surface-sunken">
      <div className={`mx-auto flex w-full ${COLUMN} flex-col gap-4 pb-10 pt-8 sm:px-5 sm:pb-14 sm:pt-12`}>
        <Bone className="mx-6 h-[2.275rem] w-36 rounded-full sm:h-[2.6rem]" />
        {/* 맨 위 내 프로필 — 56px 동그라미와 이름 · 이메일 */}
        <div className={SETTINGS_GROUP}>
          <div className="flex min-h-20 items-center gap-4 px-6 py-4">
            <Bone className="size-14 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Bone className="h-5 w-24 rounded-full" />
              <Bone className="h-4 w-44 max-w-full rounded-full" />
            </div>
          </div>
        </div>
        {GROUPS.map((group, at) => (
          <div key={at} className={SETTINGS_GROUP}>
            <div className="flex flex-col gap-1 px-6 pb-1 pt-3">
              {group.title && <Bone className="h-4 w-16 rounded-full" />}
              {group.description && <Bone className="h-4 w-full rounded-full" />}
            </div>
            {group.rows.map((row, line) => (
              <div key={line} className="px-6 py-3">
                {row.kind === 'switch' && (
                  /* 이름과 스위치가 한 줄, 설명은 그 아래 줄 폭을 다 쓴다(`SettingsSwitchRow`) */
                  <div className={`flex flex-col gap-2 overflow-hidden ${row.text}`}>
                    <div className="flex items-center gap-4">
                      <Bone className="h-5 w-32 max-w-full rounded-full" />
                      <Bone className="ml-auto h-8 w-[3.25rem] shrink-0 rounded-full" />
                    </div>
                    <Bone className="h-4 w-full max-w-sm shrink-0 rounded-full" />
                  </div>
                )}
                {row.kind === 'choice' && (
                  <div className="flex flex-col gap-2">
                    <Bone className="h-5 w-28 rounded-full" />
                    <Bone className="h-11 w-full rounded-cell" />
                    <Bone className="h-4 w-48 max-w-full rounded-full" />
                  </div>
                )}
                {row.kind === 'link' && (
                  <div className="flex min-h-8 flex-col gap-1.5">
                    <Bone className="h-5 w-36 rounded-full" />
                    <Bone className="h-4 w-40 rounded-full" />
                  </div>
                )}
                {row.kind === 'text' && <Bone className="h-6 w-20 rounded-full" />}
              </div>
            ))}
          </div>
        ))}
        <Bone className="mx-6 h-5 w-16 rounded-full" />
      </div>
    </SkeletonMain>
  );
}
