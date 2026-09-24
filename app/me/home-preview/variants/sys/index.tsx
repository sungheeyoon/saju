import { WARNING_ACKNOWLEDGE_LABEL, WARNING_NOTICE_TITLE, warningNoticeLines, type WarningNotice } from '@/src/lib/account';

import type { VariantProps } from '..';
import { previewHref } from '../../shared/preview-href';
import { Icon } from './icons';
import { BottomMenu, TopMenu, Trailing } from './menu';
import { PeopleSection } from './people';
import { RegisterSelf, SelfCard } from './self-card';
import styles from './sys.module.css';
import { Button, CARD, Cell, CountBadge, Text } from './ui';

/*
  **2차 sys · 디자인 시스템 — 지금 것을 다듬기.**

  색 토큰 · Pretendard · 28px 모서리 카드는 그대로 두고, 무엇이 문제였는지를 부품으로 고친다: 글자 다섯 단
  (`ui.tsx` 의 `TYPE`), 누르는 것 세 단 + 아이콘 단추 + 칸, 대비를 보정한 토큰(`sys.module.css`).
  이 파일은 그 부품만으로 조립한다 — 여기에 `text-sm` 같은 날 크기가 없다. 내용과 길은 R 을 따른다.

  간격은 일곱 단(4 · 8 · 12 · 16 · 24 · 32 · 48)만 쓴다. 영역 사이 24(폰) / 32(넓은 폭), 카드 안 20 / 32.
*/
export default function Variant({ state }: VariantProps) {
  const { self, people } = state;
  const selfId = self?.personId ?? null;

  return (
    <div className={`${styles.root} flex min-w-0 flex-col gap-6 sm:gap-8`}>
      <TopMenu unread={state.unread} unreadChat={state.unreadChat} />

      <header className="flex items-center justify-between gap-3">
        <Text as="h2" variant="title">
          나의 사주와 인연
        </Text>
        <Trailing unread={state.unread} className="-mr-2 sm:hidden" />
      </header>

      {state.warning !== null && <Warning notice={state.warning} />}
      {state.unread > 0 && <UnreadCell count={state.unread} />}

      {self === null ? <RegisterSelf /> : <SelfCard self={self} />}

      <PeopleSection people={people} readings={state.readings} selfId={selfId} />

      <More withMatching={self !== null} />

      <BottomMenu unreadChat={state.unreadChat} />
    </div>
  );
}

/** 경고 안내 — 승인 문구 그대로(ADR 0108). 단추는 이 영역의 주 행동 하나라 채운다 */
function Warning({ notice }: { notice: WarningNotice }) {
  return (
    <section
      aria-label={WARNING_NOTICE_TITLE}
      className="flex flex-col gap-4 rounded-[1.75rem] border border-danger/40 bg-danger-wash p-5 sm:flex-row sm:items-start sm:gap-4 sm:p-6"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface text-danger">
        <Icon name="alert" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Text as="h2" variant="heading" tone="danger">
          {WARNING_NOTICE_TITLE}
        </Text>
        <div className="flex flex-col gap-1">
          {warningNoticeLines(notice).map((line) => (
            <Text key={line} variant="body">
              {line}
            </Text>
          ))}
        </div>
        <Button href={previewHref('/me')} variant="primary" className="self-stretch sm:self-start">
          {WARNING_ACKNOWLEDGE_LABEL}
        </Button>
      </div>
    </section>
  );
}

/** 새 소식 — 칸 하나. 알림이 실제로 있을 때만 선다 */
function UnreadCell({ count }: { count: number }) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <Cell
        href={previewHref('/me/requests')}
        icon="bell"
        tone="accent"
        title="아직 확인하지 않은 새 소식이 있습니다."
        trailing={<CountBadge count={count} />}
      />
    </div>
  );
}

/** 다른 화면으로 가는 길 — 단추가 아니라 칸이다. 넓은 폭에서는 세 칸이 나란히 선다 */
function More({ withMatching }: { withMatching: boolean }) {
  return (
    <section aria-labelledby="sys-more" className="flex flex-col gap-3">
      <Text as="h2" variant="heading" id="sys-more" className="px-1">
        더 해 보기
      </Text>
      <div className={`${CARD} grid divide-y divide-border overflow-hidden ${withMatching ? 'md:grid-cols-3' : 'md:grid-cols-2'} md:divide-x md:divide-y-0`}>
        {withMatching && (
          <Cell
            href={previewHref('/me/matching')}
            icon="people"
            title="매칭에서 오늘의 인연 만나기"
            description="예측 궁합과 보완하는 기운으로, 나의 귀인을 찾아보세요."
          />
        )}
        <Cell href={previewHref('/compat')} icon="pair" title="궁합 보러 가기" />
        <Cell href={previewHref('/')} icon="compass" title="다른 사람 사주 보기" />
      </div>
    </section>
  );
}
