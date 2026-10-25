import Link from 'next/link';

import { isBlocked } from '@/src/lib/account';
import { SAJU_PATH } from '@/src/lib/consent';
import { UNREADABLE_INPUT_NOTE, storedChartOf } from '@/src/lib/input/stored';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import { Icon } from '../../ui/icons';
import { CARD_FRAME, COLUMN, TYPE_META, TYPE_TITLE } from '../../ui/surfaces';
import { readAccount } from '../account';
import { AccountNotice } from '../account-notice';
import { myDiscoveryProfile } from '../discovery/discovery-profile';
import { openDiscoveryParticipation } from '../discovery/participation';
import { myCircle } from '../home/circle';
import { MyPeople, circlePeopleOf } from '../home/circle-view';
import { isFirstVisit } from '../home/first-visit';
import { selfReadingOf } from '../home/map/model';
import { ReceivedReadings } from '../home/received-readings';
import { runningReadings } from '../home/running';
import { RunningReadings } from '../home/running-band';
import { makingPeopleOf, makingSelf } from '../home/running-line';
import { SelfCard } from '../home/self-card';
import { NO_FACE, myHomeFace } from '../home/self-face';
import { Onboarding } from '../onboarding';
import { storedInputOf, storedInputsOf } from '../person-input';
import { myReadings } from '../reading/current';
import { FailureLine } from '../../ui/failure-line';
import { HOME_ROW_LINK } from '../home/home-list';

/**
 * 로그인한 사람이 도착하는 자리 — **홈.**
 *
 * 인사 → (만드는 중인 풀이) → 줄인 내 사주 카드 → 내가 받은 사주풀이 셋 → 저장한 사람 차례로 내려온다(ADR 0129 「2026-09-29 u2」 · ADR 0157).
 * 처음 온 사람(받은 풀이 · 저장한 사람이 없다)은 받은 사주풀이 칸 없이 카드 → 저장한 사람이다(G-99 안 A, 운영자 2026-10-18).
 * 관계 지도는 궁합 탭(`/compat`)에 선다. 인연 · 궁합은 머리글의 탭이, 풀이 보관함은 받은 사주풀이의 머리가 든다.
 *
 * 저장된 입력으로 **서버에서 계산한다.** 익명 화면은 브라우저에서 계산하지만 부르는 함수는 같다(`chartOf`)
 * — 저장하기 전에 본 사주와 저장한 뒤에 보는 사주가 다를 자리를 만들지 않으려는 것이다.
 */
export default async function MePage() {
  const supabase = await supabaseOnServer();

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  // 정책이 자기 행만 내주므로 `where` 를 적지 않는다. 적으면 판정하는 자리가 둘이 된다.
  const { state, row: account } = await readAccount(supabase, ['status', 'self_person_id', 'nickname']);
  const selfPersonId = state.kind === 'active' ? state.selfPersonId : null;
  const nickname = account?.nickname?.trim() ?? '';

  return (
    <main className="app-shell flex min-w-0 flex-1 flex-col gap-6 py-4 sm:gap-12 sm:py-12">
      {isBlocked(state) ? (
        <AccountNotice state={state} />
      ) : (
        <>
          {selfPersonId === null ? (
            /* 등록 전에는 폼 판 한 장이 본문이다 — 인사와 판을 폼의 기둥에 묶어 가운데 세운다. 홈 전폭으로 펴면 폼 오른쪽이 통째로 빈다 */
            <div className={`mx-auto flex w-full ${COLUMN} flex-col gap-3 sm:gap-12`}>
              <Greeting name={nickname} />
              <Onboarding nickname={account?.nickname ?? ''} />
            </div>
          ) : (
            <>
              <Greeting name={nickname} />
              <Home selfPersonId={selfPersonId} userId={user.id} nickname={nickname} />
            </>
          )}
        </>
      )}
    </main>
  );
}

/**
 * 인사 한 줄 — 넓은 화면에서 가장 먼저 읽히는 글자. 날짜는 한국 시각이다(서버의 시계는 UTC 다).
 *
 * **폰에서는 눈에 안 보이고 제목으로만 남는다**(2026-09-25). 폰의 첫 화면은 카드 한 장이 다 들어야 하는데
 * 인사가 그 앞에서 100px 가까이 썼고, 매일 오는 사람에게 인사는 이틀째부터 안 읽힌다. 내 사주 카드의 이름
 * 줄이 그 자리를 맡는다. 지우지 않는 것은 이 줄이 화면의 하나뿐인 `h1` 이라서다.
 */
function Greeting({ name }: { name: string }) {
  const today = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Seoul',
  });
  return (
    <header className="sr-only flex flex-col gap-1 sm:not-sr-only">
      <p className={TYPE_META}>{today}</p>
      <h1 className={TYPE_TITLE}>{name === '' ? '반가워요' : `${name} 님, 오늘도 반가워요`}</h1>
    </header>
  );
}

/**
 * 홈의 본체 — 줄인 내 사주 카드 → 내가 받은 사주풀이 셋 → 저장한 사람 타일(u2, 운영자 2026-09-29).
 *
 * 나 탭은 **나와 내 사람들**을 본다. 이번 달 흐름은 걷었다(ADR 0129 「2026-09-29 u2」). 저장한 사람은 궁합 탭에서 다시
 * 여기로 왔다 — 프로덕션 홈(`a45e34e`)의 타일 그대로다. 폰 첫 화면(390×664)에 카드 · 받은 사주풀이 · 저장한 사람 머리까지
 * 든다(`e2e/signed-in.spec.ts` 가 잰다). 이 화면에서 연 결과는 주소에 `from=me` 를 든다(`home/from-me.ts`).
 *
 * **읽는 것은 두 물결이다**(2026-09-30). 내 엣지(이름) · 자리 수 · 내 입력 · 만든 풀이 목록 · 참여 설정 · 만드는 중인 풀이가 한 번에 겹쳐 돌고,
 * 저장한 사람들의 입력과 참여를 여는 문이 그 뒤에 함께 돈다. 저장한 사람 타일(`MyPeople`)과 참여를 여는 문은 스스로 읽지 않고
 * 여기서 읽은 것을 받는다 — 저마다 읽던 동안 같은 엣지 · 입력을 세 번 읽었고, 참여를 여는 문의 차례 넷이 화면을 붙들었다.
 *
 * **참여를 여는 문은 아무것도 안 그린다**(ADR 0070 · 0076) — 후보 탐색은 매칭에서만 하고 참여를 여는 일은 홈에도 남는다.
 * 못 열어도 홈을 오류로 세우지 않는다(`openDiscoveryParticipation`).
 */
async function Home({ selfPersonId, userId, nickname }: { selfPersonId: string; userId: string; nickname: string }) {
  const supabase = await supabaseOnServer();

  const [circle, self, readings, profile, runningRead, faceRead] = await Promise.all([
    myCircle(supabase, selfPersonId),
    storedInputOf(supabase, selfPersonId),
    myReadings(),
    myDiscoveryProfile(),
    runningReadings(),
    myHomeFace(supabase),
  ]);
  /* 대표 사진 — 꾸밈이다. 못 읽었으면 사진 없는 나(일간 그림)로 선다(ADR 0078) */
  const face = { userId, nickname, ...(faceRead.ok ? faceRead.value : NO_FACE) };
  /* 못 읽었으면 만드는 중인 것이 없는 것처럼 선다 — 부속 정보다(ADR 0078). 단추는 「받기」로 돌아간다 */
  const running = runningRead.ok ? runningRead.value : [];

  /**
   * **못 읽는 입력은 메우지 않는다.** 모르는 출생지를 서울로 치면 저장할 때 본 사주와 다른 사주가 이
   * 화면에 나온다. 값은 남아 있고 읽는 쪽이 못 읽는 것이므로 그렇게 말하고 멈춘다 — 풀이 목록과 사람은 그대로 선다.
   */
  const stood = self !== null && circle.self !== null ? storedChartOf(self.input, circle.self.label) : null;

  const [inputs] = await Promise.all([
    storedInputsOf(
      supabase,
      circle.people.map((person) => person.personId),
    ),
    openDiscoveryParticipation(profile, selfPersonId, stood, self?.versions ?? null),
  ]);

  const selfCard =
    stood === null ? (
      <FailureLine retry>내 사주를 불러오지 못했어요.</FailureLine>
    ) : !stood.ok ? (
      <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5 sm:p-6">
        <p className="text-sm">{stood.message}</p>
        <p className="text-small text-muted">{UNREADABLE_INPUT_NOTE}</p>
      </section>
    ) : (
      <SelfCard
        personId={selfPersonId}
        label={stood.query.name}
        query={stood.query}
        saju={stood.saju}
        reading={selfReadingOf(readings)}
        making={makingSelf(running)}
        face={face}
        compact
      />
    );

  const myPeople = (
    <MyPeople
      selfPersonId={selfPersonId}
      readings={readings}
      circle={circle}
      people={circlePeopleOf(circle, inputs)}
      making={makingPeopleOf(running)}
    />
  );

  /*
    **처음 온 사람의 홈**(운영자 결정 2026-10-18 G-99 안 A) — 받은 풀이 · 저장한 사람이 하나도 없으면 「내가 받은 사주풀이」는 빈 점선
    한 권뿐이라 카드의 「사주풀이 받기」를 두 번 권했다. 그 칸을 걷고 저장한 사람을 카드 바로 아래로 올린다 — 내 사주 카드 →
    저장한 사람 → 다른 사람 사주 보기. 풀이 보관함으로 가는 길도 그 칸의 머리와 함께 빠진다 — 보관함이 비어 있다. 넓은 화면에서도
    카드는 다시 온 사람의 홈과 같은 폭(왼쪽 7)이다. 무엇이든 하나 생기면 아래 차례다(`home/first-visit.ts`)
  */
  if (isFirstVisit({ readings, running, people: circle.people.length })) {
    return (
      <>
        <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="min-w-0">{selfCard}</div>
        </div>
        {myPeople}
        <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <OtherSaju />
        </div>
      </>
    );
  }

  return (
    <>
      {/* 만드는 중인 풀이 — 있을 때만, 내 사주 카드보다 앞에 선다(ADR 0157). 시작한 일이 어디쯤인지가 먼저다 */}
      <RunningReadings running={running} />

      {/*
        **내 사주가 먼저 선다**(2026-09-25) — 이 앱의 첫 얼굴은 나다. 넓은 화면에서는 왼쪽의 넓은 칸(7)이고 오른쪽(5)에
        내가 받은 사주풀이가 선다.
      */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          {selfCard}
          <OtherSaju />
        </div>

        <ReceivedReadings readings={readings} makingSelf={makingSelf(running)} />
      </div>

      {myPeople}
    </>
  );
}

/**
 * **다른 사람 사주 보기** — 저장하지 않고 한 사람을 계산하는 자리(`/saju`, ADR 0144)로 가는 길. 내 사주 카드 바로 아래 한 줄이다.
 *
 * 처음에는 저장한 사람 구역 끝의 작은 보조 링크였다 — 홈의 주인공은 내 사주와 저장한 사람이라는 판단이었다. 남의 사주를 보는
 * 것도 이 서비스를 쓰는 까닭일 수 있는데 폰에서는 화면을 다 내려야 보였다(운영자 2026-10-08). 모양은 아래 목록들과 같은 흰 판의 줄 하나다
 * (`home/home-list.tsx`) — 검색 표시도 오행 파스텔을 벗었다(2026-10-25 홈 위계 정리).
 *
 * **줄어들지 않는다(`shrink-0`)** — 넓은 화면에서 카드가 칸을 다 채우게(`h-full`) 세로 flex 안에 서는데, 판이 `overflow-hidden` 이라
 * 최소 높이가 0 으로 풀려 폰에서 이 줄이 49px 로 눌렸다(표시 원의 아래가 잘리고 글자가 가운데를 벗어났다, 2026-10-26 2차).
 */
function OtherSaju() {
  return (
    <div className={`${CARD_FRAME} shrink-0 py-1`}>
      <Link href={SAJU_PATH} className={HOME_ROW_LINK}>
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-sunken text-foreground">
          <Icon name="search" className="size-5" />
        </span>
        <span className="min-w-0 flex-1 text-body font-semibold">다른 사람 사주 보기</span>
        <Icon name="chevron" className="size-5 shrink-0 text-secondary" />
      </Link>
    </div>
  );
}
