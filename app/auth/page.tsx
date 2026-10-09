import { redirect } from 'next/navigation';

import { SERVICE_NAME } from '@/src/lib/brand';

import { BUTTON_TERTIARY } from '../ui/buttons';
import { Icon, type IconName } from '../ui/icons';
import { NoticeScreen } from '../ui/notice-screen';
import { SIGNED_OUT_EXIT, SIGNED_OUT_REACH } from '../service-features';
import { SignInButton } from './sign-in-button';
import { supabaseOnServer } from './server-client';
import { signedInUser } from './signed-in';
import { RESUME_PAIR_PATH, RESUME_READING_PATH, afterSignIn, safeReturnPath } from '@/src/lib/consent';
import { HomeLink } from '../home-link';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const returnTo = safeReturnPath((await searchParams).next);
  const supabase = await supabaseOnServer();
  if ((await signedInUser(supabase)) !== null) redirect(afterSignIn(returnTo));

  /* 첫 화면의 로그인 전 궁합 결과에서 온 사람도 궁합으로 간다(ADR 0131) */
  const forCompat = returnTo === '/compat' || returnTo === RESUME_PAIR_PATH;
  const forReading = returnTo === RESUME_READING_PATH;

  return (
    <NoticeScreen
      title={forCompat ? '궁합풀이는 로그인하면 볼 수 있어요' : forReading ? '내 사주풀이로 이어갈까요?' : `${SERVICE_NAME} 시작하기`}
      description={
        <p>
          {/*
            궁합 쪽은 제목이 이미 「왜 여기 섰는가」를 다 말한다 — 본문이 그 이유를 한 번 더
            적으면 바로 아래 선 베타 안내까지 같이 안 읽힌다.
          */}
          {forReading && '로그인하면 방금 본 사주로 돌아와요. 출생 정보를 저장하면 사주풀이를 받을 수 있어요. '}
          {!forCompat && !forReading && '로그인하면 저장한 사람과 사주풀이를 다음에도 이어서 볼 수 있어요. '}
          지금은 비공개 베타라, 처음 오셨다면 로그인 뒤에 <strong className="font-semibold">테스트 코드</strong>가
          필요해요.
        </p>
      }
      actions={<SignInButton returnTo={returnTo} />}
      note={
        /*
          코드가 없는 사람의 길 — 막다른 자리로 두지 않는다. 첫 화면은 로그인 없이 사주와 궁합 첫 신호까지 연다.
          까닭 한 줄과 출구 이름은 로그인 실패 화면과 같은 상수다(`SIGNED_OUT_REACH` · `SIGNED_OUT_EXIT`, e2e 가 잰다).
        */
        <>
          <p>{SIGNED_OUT_REACH}</p>
          <HomeLink className={`${BUTTON_TERTIARY} w-fit`}>{SIGNED_OUT_EXIT}</HomeLink>
        </>
      }
    >
      {/*
        **누르기 전에 무엇이 열리는지 본다**(그로스 시안, 2026-10-03). 구글 단추 하나만 서 있으면 「로그인해서 뭘
        하지?」의 답이 화면에 없다. 적는 것은 로그인 뒤 실제로 있는 화면뿐이다(사주풀이 · 저장한 사람 · 궁합풀이 · 인연).
      */}
      <ul className="flex flex-col gap-2.5" aria-label="로그인하면">
        {UNLOCKS.map(({ icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-[15px] leading-6 text-foreground">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-cream-ink shadow-card">
              <Icon name={icon} className="size-[18px]" />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </NoticeScreen>
  );
}

/** 로그인 뒤에 실제로 있는 것 — 수 · 가격은 안 적는다(바뀔 수 있다) */
const UNLOCKS: readonly { icon: IconName; text: string }[] = [
  { icon: 'reading', text: '내 사주를 읽고 쓴 사주풀이' },
  { icon: 'people', text: '가족 · 친구를 저장하고 그 사람의 풀이도' },
  { icon: 'taiji', text: '두 사람의 궁합풀이와 점수' },
  { icon: 'heart', text: '사주로 어울리는 인연 만나기' },
];
