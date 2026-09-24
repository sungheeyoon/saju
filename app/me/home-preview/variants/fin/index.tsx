import { WARNING_ACKNOWLEDGE_LABEL, WARNING_NOTICE_TITLE, warningNoticeLines, type WarningNotice } from '@/src/lib/account';

import type { VariantProps } from '..';
import { previewHref } from '../../shared/preview-href';
import styles from './fin.module.css';
import { TabBar, TopBar } from './menu';
import { PeopleBlock } from './people-block';
import { RegisterSelf, SelfBlock } from './self-block';
import { BUTTON, Badge, Block, Icon, IconCircle, ListRow, TYPE, type IconName } from './ui';

/*
  **2차 · 프로덕트 — 핀테크 앱.** 내용은 R 을 따르고 모양은 토스 · 카카오뱅크의 문법을 쓴다.

  회색 바탕 위에 흰 덩어리가 선다. 테두리는 한 줄도 없다 — 층은 면의 명도와 여백이 가른다.
  덩어리마다 굵고 큰 제목 하나, 주 단추는 많아야 하나, 목록은 줄 전체가 누를 자리다.
  폰은 한 줄로 쌓고, 넓은 화면(lg)은 왼쪽에 나 · 더 해 보기, 오른쪽에 저장한 사람을 세운다.
*/
export default function Variant({ state }: VariantProps) {
  const { self, people } = state;

  return (
    <div className={`-mx-4 flex min-w-0 flex-col gap-3 px-3 py-4 sm:mx-0 sm:rounded-[2rem] sm:p-5 lg:gap-4 lg:p-6 ${styles.canvas}`}>
      <TopBar unread={state.unread} unreadChat={state.unreadChat} />

      {state.warning !== null && <Warning notice={state.warning} />}
      {state.unread > 0 && <Unread count={state.unread} />}

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-4">
        <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
          {self === null ? <RegisterSelf /> : <SelfBlock self={self} />}
          <div className="hidden lg:block">
            <More signedUpSelf={self !== null} />
          </div>
        </div>

        <PeopleBlock
          people={people}
          readings={state.readings}
          selfId={self?.personId ?? null}
          primaryAdd={self !== null && people.length === 0}
        />

        <div className="lg:hidden">
          <More signedUpSelf={self !== null} />
        </div>
      </div>

      <TabBar unreadChat={state.unreadChat} />
    </div>
  );
}

/** 경고 안내 — 승인 문구 그대로. 「확인했습니다」는 모양만 선다(원본은 서버 액션) */
function Warning({ notice }: { notice: WarningNotice }) {
  return (
    <Block label={WARNING_NOTICE_TITLE} className="flex flex-col gap-5 px-5 pb-5 pt-6 sm:px-6 sm:pb-6">
      <div className="flex flex-col gap-3">
        <IconCircle tone="danger">
          <Icon name="alert" className="size-6" stroke={2} />
        </IconCircle>
        <h2 className={`${TYPE.heading} text-danger`}>{WARNING_NOTICE_TITLE}</h2>
        <div className={`flex flex-col gap-1 ${TYPE.body} text-[var(--fin-text)]`}>
          {warningNoticeLines(notice).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
      <button type="button" className={`${BUTTON.primary} lg:w-80`}>
        {WARNING_ACKNOWLEDGE_LABEL}
      </button>
    </Block>
  );
}

/** 새 소식 — 알림 한 줄. 종 원 · 문장 · 개수 · 셰브론 */
function Unread({ count }: { count: number }) {
  return (
    <Block label="새 소식" className="py-1">
      <ListRow
        href={previewHref('/me/requests')}
        icon={
          <IconCircle tone="accent">
            <Icon name="bell" />
          </IconCircle>
        }
        title={<span className="whitespace-normal">아직 확인하지 않은 새 소식이 있습니다.</span>}
        trailing={<Badge count={count} />}
      />
    </Block>
  );
}

/** 더 해 보기 — 셋째 행동의 목록. 줄마다 아이콘 원 · 제목 · 셰브론 */
function More({ signedUpSelf }: { signedUpSelf: boolean }) {
  const links: { href: string; label: string; icon: IconName }[] = [
    { href: '/', label: '다른 사람 사주 보기', icon: 'search' },
    { href: '/compat', label: '궁합 보러 가기', icon: 'heart' },
    ...(signedUpSelf ? [{ href: '/me/matching', label: '매칭에서 오늘의 인연 만나기', icon: 'people' as const }] : []),
  ];
  return (
    <Block label="더 해 보기" className="pb-2 pt-6">
      <h2 className={`px-5 sm:px-6 ${TYPE.heading}`}>더 해 보기</h2>
      <nav aria-label="더 해 보기" className="mt-2 flex flex-col px-0">
        {links.map((link) => (
          <ListRow
            key={link.href}
            href={previewHref(link.href)}
            icon={
              <IconCircle>
                <Icon name={link.icon} />
              </IconCircle>
            }
            title={link.label}
          />
        ))}
      </nav>
    </Block>
  );
}
