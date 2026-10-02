'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { RESUME_READING_PATH } from '@/src/lib/consent';
import { toSearchParams, type Query } from '@/src/lib/input/query';
import { TASTE_WAIT, type TasteAnswer } from '@/src/lib/reading/taste-visit';
import type { Saju } from '@/src/lib/saju';

import { noteTasteStep, readTaste, requestTaste } from './actions';
import { SelfCard } from './me/home/self-card';
import { READING_DRAFT_KEY, TASTE_SESSION_KEY } from './reading-draft';
import { SignInCarrying } from './sign-in-carrying';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from './ui/buttons';
import { Icon } from './ui/icons';
import { CARD, TYPE_META, TYPE_NAME } from './ui/surfaces';

/**
 * 로그인 전 결과의 첫머리 — **로그인 전 사주 문단**(흐름 시안 g 의 2~3단계, ADR 0131 의 6 · 7 · ADR 0143).
 *
 * 차례는 **내 사주 카드(천간 그림) → 짧은 로그인 전 사주 문단 → 잠긴 목차와 로그인** 이고, 표는 지우지 않고 「사주 자세히
 * 보기」에 접힌다.
 *
 * ## 로그인 전 사주 문단의 글은 어디서 오나
 *
 * **이 사람의 사주로 서버가 쓴다**(ADR 0143). 화면은 입력(주소 `#` 뒤의 모양)을 서버 액션에 보내고(`requestTaste`), 서버가
 * 명식을 다시 계산해 근거와 지문을 짓고 · 예약하고 · 모델을 부르고 · 검사한 글을 돌려준다. 같은 입력을 다시 넣으면 같은 글이다
 * (모델을 다시 안 부른다). **실패하면 실패로 선다** — 다른 글로 바꿔치기하지 않는다. 글 아래 「더보기」를 누르면 가입으로 가는
 * 단추가 서고, 가입한 뒤의 전체 사주풀이가 이 글이 멈춘 물음에서 잇는다.
 *
 * ## 목차는 본 풀이의 절 이름이다
 *
 * 서버(`app/page.tsx`)가 프롬프트의 절 이름을 지어 넘긴다 — 모델이 실제로 단 소제목은 검사 전이라 없고, 우리가 시킨
 * 이름만 참이다. 누르면 입력을 탭에 두고 로그인 · 가입을 거쳐 「이 사주가 내 사주 맞나요?」로 돌아온다(ADR 0128).
 */
export function Taste({
  query,
  saju,
  outline,
  detail,
}: {
  /** 화면에 서 있는 사주의 입력 — 로그인을 다녀와 되찾는 것이 이것이다 */
  query: Query;
  saju: Saju;
  /** 본 사주풀이의 절 이름 */
  outline: readonly string[];
  /** 접어 둘 만세력 — 지우지 않는다 */
  detail: ReactNode;
}) {
  const name = query.name.trim();
  const draft = toSearchParams(query).toString();
  /** 글이 선 세션 — 가입 왕복이 들고 간다. 글이 안 섰으면 `null` 이다 */
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {/* 카드는 홈의 내 사주 카드 그대로 — 가입하면 홈에서 만날 얼굴이 이것이다(운영자 2026-09-29) */}
      <SelfCard personId={null} label={name || '나'} query={query} saju={saju} reading={null} />

      <TastePassage draft={draft} onSession={setSessionId} />

      <LockedOutline outline={outline} draft={draft} sessionId={sessionId} />

      <details id="saju-detail" data-fold="" className="group/detail scroll-mt-24">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-[1.5rem] border border-border bg-surface px-5 py-4 hover:border-border-strong sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className={TYPE_NAME}>사주 자세히 보기</span>
            <span className="mt-0.5 block text-[13px] leading-5 text-secondary">여덟 글자 · 신살 · 오행 · 용신 · 관계 · 운</span>
          </span>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-sunken text-secondary transition-transform group-open/detail:rotate-180">
            <Icon name="chevron" className="size-4 rotate-90" />
          </span>
        </summary>
        <div className="pt-4">{detail}</div>
      </details>
    </div>
  );
}

/** 받은 입력과 그 답 — 입력이 바뀌면(다시 제출) 받은 답이 지금 입력의 것이 아니므로 기다림으로 돌아간다 */
type Passage = { draft: string; attempt: number; answer: TasteAnswer };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 서버에 묻고, 「기다린다」면 잠깐씩 다시 묻는다 — **상한이 있다**(`TASTE_WAIT`). 상한을 넘기면 시간 초과로 선다.
 * 액션이 던지면(배포가 바뀌어 액션을 못 찾음 · 네트워크) 실패로 서고 다시 읽기를 연다.
 */
async function askTaste(draft: string, alive: () => boolean): Promise<TasteAnswer> {
  let answer: TasteAnswer;
  try {
    answer = await requestTaste(draft);
  } catch {
    return { state: 'failed', retry: true };
  }
  const deadline = Date.now() + TASTE_WAIT.forMs;
  while (answer.state === 'waiting' && alive()) {
    if (Date.now() > deadline) return { state: 'timeout', retry: true };
    await pause(TASTE_WAIT.everyMs);
    try {
      answer = await readTaste(answer.sessionId);
    } catch {
      return { state: 'failed', retry: true };
    }
  }
  return answer;
}

/**
 * 퍼널 한 단계 — 답을 안 기다리고, 못 세도 누름은 그대로다. **글이 선 세션이 있을 때만** 센다 — 세션당 한 번이라 세션이
 * 없는 누름(글이 못 선 자리의 가입 단추)은 셀 자리가 없다.
 */
const note = (step: 'more_clicked' | 'signup_started', sessionId: string | null) => {
  if (sessionId === null) return;
  void noteTasteStep(step, sessionId).catch(() => undefined);
};

/**
 * 로그인 전 사주 문단 — 서버가 이 사주로 쓴 글, 또는 왜 못 섰는지.
 *
 * **기다리는 동안은 자리만 잡는다** — 막대 넷이 글이 설 높이를 미리 쥐어 화면이 덜 흔들린다.
 */
function TastePassage({ draft, onSession }: { draft: string; onSession: (sessionId: string | null) => void }) {
  const [passage, setPassage] = useState<Passage | null>(null);
  /** 「다시 읽기」를 누를 때마다 하나씩 — 같은 입력으로 다시 묻게 한다 */
  const [attempt, setAttempt] = useState(0);
  /** 「더보기」를 눌렀나 — 입력이 바뀌면 처음부터 */
  const [moreFor, setMoreFor] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void askTaste(draft, () => alive).then((answer) => {
      if (!alive) return;
      setPassage({ draft, attempt, answer });
      onSession(answer.state === 'ready' ? answer.sessionId : null);
    });
    return () => {
      alive = false;
    };
  }, [draft, attempt, onSession]);

  const retry = useCallback(() => setAttempt((at) => at + 1), []);

  const answer = passage !== null && passage.draft === draft && passage.attempt === attempt ? passage.answer : null;
  const waiting = answer === null || answer.state === 'waiting';

  return (
    <section aria-labelledby="taste-heading" aria-busy={waiting} className={CARD}>
      <h2 id="taste-heading" className={TYPE_META}>
        사주가 보여 주는 나
      </h2>
      {waiting ? (
        <div aria-hidden className="mt-3 flex flex-col gap-2">
          <span className="h-3.5 w-full rounded-full bg-surface-sunken" />
          <span className="h-3.5 w-11/12 rounded-full bg-surface-sunken" />
          <span className="h-3.5 w-full rounded-full bg-surface-sunken" />
          <span className="h-3.5 w-2/3 rounded-full bg-surface-sunken" />
        </div>
      ) : answer.state === 'ready' ? (
        <>
          <div className="mt-2 flex flex-col gap-3">
            {paragraphsOf(answer.preview).map((paragraph, at) => (
              <p key={at} className="text-[15px] leading-7 text-foreground">
                {paragraph}
              </p>
            ))}
          </div>
          {moreFor === draft ? (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-[13px] leading-5 text-secondary">가입하면 이 물음의 답부터 전체 사주풀이가 이어져요.</p>
              <SignInCarrying
                draftKey={READING_DRAFT_KEY}
                draft={draft}
                next={RESUME_READING_PATH}
                carry={{ key: TASTE_SESSION_KEY, value: answer.sessionId }}
                onFollow={() => note('signup_started', answer.sessionId)}
                className={`${BUTTON_PRIMARY} w-full`}
              >
                무료 회원가입하고 이어보기
              </SignInCarrying>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMoreFor(draft);
                note('more_clicked', answer.sessionId);
              }}
              className={`${BUTTON_SECONDARY} mt-4 w-full`}
            >
              더보기
            </button>
          )}
        </>
      ) : (
        <TasteTrouble answer={answer} draft={draft} onRetry={retry} />
      )}
    </section>
  );
}

/** 문단 — 빈 줄로 가른다 */
const paragraphsOf = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');

/**
 * 글이 못 선 자리 — **실패 · 시간 초과 · 한도를 가른다.** 내부 갈래와 한도 숫자는 안 보인다. 다시 읽을 수 있으면
 * 「다시 읽기」, 아니면(같은 입력이 거듭 실패 · 한도 · 서버가 닫음) 전체 풀이로 가는 가입 경로가 선다.
 */
function TasteTrouble({
  answer,
  draft,
  onRetry,
}: {
  answer: Extract<TasteAnswer, { state: 'failed' | 'timeout' | 'limited' }>;
  draft: string;
  onRetry: () => void;
}) {
  const retry = answer.state !== 'limited' && answer.retry;
  const said =
    answer.state === 'limited'
      ? '지금은 요청이 많아 이 글을 보여 드릴 수 없어요.'
      : answer.state === 'timeout'
        ? '글을 불러오는 데 시간이 너무 오래 걸렸어요.'
        : '글을 불러오지 못했어요.';

  return (
    <div role="status" className="mt-3 flex flex-col gap-3">
      <p className="text-[15px] leading-7 text-foreground">
        {said}
        {!retry && ' 가입하면 전체 사주풀이를 받을 수 있어요.'}
      </p>
      {retry ? (
        <button type="button" onClick={onRetry} className={`${BUTTON_SECONDARY} w-full sm:w-auto sm:self-start`}>
          다시 읽기
        </button>
      ) : (
        <SignInCarrying
          draftKey={READING_DRAFT_KEY}
          draft={draft}
          next={RESUME_READING_PATH}
          carry={{ key: TASTE_SESSION_KEY, value: null }}
          className={`${BUTTON_PRIMARY} w-full`}
        >
          무료 회원가입하고 이어보기
        </SignInCarrying>
      )}
    </div>
  );
}

/**
 * 잠긴 목차 — 본 사주풀이의 절 이름과, 그것을 받으러 가는 단추.
 *
 * 앞의 두 줄 아래에는 글이 이어지는 듯한 흐린 막대가 선다 — 글자가 아니라 모양이라 읽히지 않는다(`aria-hidden`).
 */
function LockedOutline({
  outline,
  draft,
  sessionId,
}: {
  outline: readonly string[];
  draft: string;
  /** 글이 선 세션 — 이 단추로 가입해도 전체 풀이가 그 글을 잇는다 */
  sessionId: string | null;
}) {
  return (
    <section aria-labelledby="outline-heading" className={CARD}>
      <h2 id="outline-heading" className={TYPE_META}>
        전체 사주풀이 목차
      </h2>
      <ol className="mt-3 flex flex-col gap-3">
        {outline.map((title, index) => (
          <li key={title}>
            <p className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <span className="tabular-nums text-secondary">{index + 1}.</span>
              <span className="min-w-0 flex-1">{title}</span>
              <Icon name="lock" className="size-4 shrink-0 text-muted" />
            </p>
            {index < 2 && (
              <div aria-hidden className="mt-2 flex flex-col gap-1.5 blur-[2px]">
                <span className="h-2.5 w-full rounded-full bg-surface-sunken" />
                <span className="h-2.5 w-4/5 rounded-full bg-surface-sunken" />
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-col gap-2">
        <SignInCarrying
          draftKey={READING_DRAFT_KEY}
          draft={draft}
          next={RESUME_READING_PATH}
          carry={{ key: TASTE_SESSION_KEY, value: sessionId }}
          onFollow={() => note('signup_started', sessionId)}
          className={`${BUTTON_PRIMARY} w-full`}
        >
          로그인하고 전체 풀이 받기
        </SignInCarrying>
        <p className="text-center text-xs leading-5 text-secondary">
          로그인하면 이 입력으로 돌아와요. 가입하면 풀이권으로 전체 사주풀이를 받을 수 있어요.
        </p>
      </div>
    </section>
  );
}
