import { CALENDAR_KO, GENDER_KO } from '@/src/lib/saju';
import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';

import { PILLAR_COLUMNS } from '../../../../saju/shared';
import type { FixtureSelf } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { ElementBar, PillarGrid } from './chart';
import { Button, CARD, TONE, TYPE, Tag, Text } from './ui';

/*
  **내 카드 — 새로 그렸다.** 읽히는 차례를 크기로 정한다:
  ① 명식 여덟 글자(44/52px) ② 내 이름(22/24px) ③ 사주풀이 비유 한 줄(15px) ④ 나머지 전부(12~13px).

  지금 `PillarCard` 는 이름(20) · 일주 표식(18) · 여덟 글자(20~24)가 거의 같은 크기라 어디부터 읽을지 안 정해진다.
  「○○ 일주」 이름은 뺐다 — 일주는 네 기둥 중 초록 칸이 말한다. 단추는 둘뿐이고 무게가 다르다:
  풀이(주, 채움) · 사주 자세히 보기(보조, 테두리).
*/

export function SelfCard({ self }: { self: FixtureSelf }) {
  const { query, saju, reading } = self;
  const birth = [
    query.calendar === 'solar' ? query.date : `${CALENDAR_KO[query.calendar]} ${query.date}`,
    query.hourKnown === false ? HOUR_UNKNOWN_LABEL : query.time,
    GENDER_KO[query.gender],
    query.city,
  ].join(' · ');

  return (
    <section aria-labelledby="sys-self-name" className={CARD}>
      <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:grid-rows-[auto_1fr_auto] lg:gap-x-12 lg:gap-y-8">
        <header className="lg:col-start-1 lg:row-start-1">
          <div className="min-w-0">
            <Text as="span" variant="label" tone="accent" className="block">
              내 사주
            </Text>
            <Text as="h2" variant="title" id="sys-self-name">
              {self.label}
            </Text>
          </div>
        </header>

        <div className="flex flex-col gap-3 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:justify-center">
          <PillarGrid saju={saju} name={self.label} />
          <Text variant="caption" tone="muted" className="text-center">
            {birth}
          </Text>
        </div>

        <ElementBar saju={saju} className="lg:col-start-1 lg:row-start-2 lg:self-end" />

        <div className="flex flex-col gap-4 border-t border-border pt-5 lg:col-start-1 lg:row-start-3">
          {reading === null ? (
            <Text variant="body" tone="secondary">
              기질과 삶의 흐름을 읽어보세요
            </Text>
          ) : (
            <figure className="flex flex-col gap-1">
              <figcaption className="flex items-center gap-2">
                <span className={`${TYPE.label} ${TONE.muted}`}>사주풀이</span>
                {!reading.fromCurrentChart && <Tag>이전 명식</Tag>}
              </figcaption>
              <blockquote className={`${TYPE.body} font-medium text-foreground`}>
                “{reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}”
              </blockquote>
            </figure>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button href={previewHref('/me/readings/self')} variant="primary" icon={reading === null ? 'spark' : 'book'} arrow>
              {reading === null ? '사주풀이 받기' : '사주풀이 보기'}
            </Button>
            <Button href={previewHref(`/me/people/${self.personId}`)} variant="secondary">
              사주 자세히 보기
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 내 사주 전 — 할 일이 하나라 주 단추 하나. 빈 네 기둥이 무엇이 채워질지 미리 보인다 */
export function RegisterSelf() {
  return (
    <section aria-labelledby="sys-register" className={CARD}>
      <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Text as="span" variant="label" tone="accent">
              내 사주
            </Text>
            <Text as="h2" variant="title" id="sys-register">
              내 사주 등록
            </Text>
            <Text variant="body" tone="secondary" className="mt-1">
              출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
            </Text>
          </div>
          <Button href={previewHref('/me')} variant="primary" icon="plus" className="self-stretch sm:self-start">
            내 명식 등록
          </Button>
        </div>
        <ol aria-hidden="true" className="grid grid-cols-4 gap-2 sm:gap-3">
          {PILLAR_COLUMNS.map(({ key, label }) => (
            <li
              key={key}
              className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border-strong px-1 pb-4 pt-2.5"
            >
              <span className={`${TYPE.label} ${TONE.muted}`}>{label}</span>
              <span className={`${TYPE.display} ${TONE.muted} opacity-30`}>?</span>
              <span className={`${TYPE.display} ${TONE.muted} opacity-30`}>?</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
