import Link from 'next/link';

import { PeopleFinder } from '../../../people/finder';
import { PERSON_LIMIT, type FixturePerson } from '../../fixtures';
import { PersonCard } from '../../shared/person-card';
import { previewHref } from '../../shared/preview-href';

/*
  **`/me/people` 을 통째로 홈에 들였다** — 머리 · 추가 · 찾는 칸 · 카드가 그 화면의 차례 그대로다.

  가설은 하나다: 저장 자리가 열이라 **전부 한 화면에 들어간다.** 그래서 카드는 줄이지 않고 원본 그대로
  세운다(`PersonCard` 사본, 관리 메뉴 ⋯ 자리 포함). 찾는 칸은 원본의 `PeopleFinder` 를 그대로 빌렸다 —
  서버 액션이 없는 클라이언트 칸이라 여섯부터 서고 실제로 좁힌다.

  h1 이 아니라 h2 다 — 이 화면의 h1 은 홈의 것이다. 「사람 추가」 는 원본에서 그 자리에 폼이 펴지는 단추인데
  (`AddPerson`, 서버 액션), 여기서는 모양만 같은 링크다.
*/

const ADD_BUTTON =
  'inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong sm:h-10';

export function PeopleSection({ people }: { people: readonly FixturePerson[] }) {
  const used = people.length;
  const remaining = PERSON_LIMIT - used;

  return (
    <section aria-labelledby="a3-people" className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-6">
        <div className="min-w-0">
          <p className="eyebrow">사람</p>
          <h2 id="a3-people" className="mt-1 text-2xl font-bold tracking-[-0.04em]">
            저장한 사람
          </h2>
          <p className="mt-1 text-sm text-secondary">
            가족이나 친구의 출생 정보를 저장하고 관리하세요.
            <span className="ml-2 text-muted">
              {used}/{PERSON_LIMIT}명
            </span>
          </p>
        </div>
        <Link
          href={previewHref('/compat')}
          className="rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
        >
          궁합 보러 가기
        </Link>
      </header>

      {remaining <= 0 ? (
        <p className="rounded-[1.75rem] border border-border bg-surface-sunken p-5 text-sm text-muted">
          등록할 수 있는 {PERSON_LIMIT}명을 다 채웠습니다. 목록에서 누군가를 빼면 다시 등록할 수 있습니다.
        </p>
      ) : (
        <Link href={previewHref('/me#add-person')} className={`${ADD_BUTTON} self-start`}>
          사람 추가
        </Link>
      )}

      {people.length === 0 ? (
        <p className="rounded-[1.75rem] border border-border bg-surface-sunken p-5 text-sm text-muted">
          아직 저장한 사람이 없습니다. 이름과 출생 정보를 입력해 사람을 추가해 보세요.
        </p>
      ) : (
        <PeopleFinder
          people={people.map((person) => ({
            personId: person.personId,
            label: person.local_label,
            card: <PersonCard person={person} reading={person.reading} />,
          }))}
        />
      )}
    </section>
  );
}
