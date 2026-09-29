'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { RESUME_READING_PATH } from '@/src/lib/consent';
import { toSearchParams, type Query } from '@/src/lib/input/query';
import { fallbackTasteOf, tasteKeyOf } from '@/src/lib/reading/taste';
import type { Saju, Utterance } from '@/src/lib/saju';

import { supabaseInBrowser } from './auth/browser-client';
import { SelfCard } from './me/home/self-card';
import { READING_DRAFT_KEY } from './reading-draft';
import { SignInCarrying } from './sign-in-carrying';
import { tastePassage } from './taste-passage';
import { BUTTON_PRIMARY } from './ui/buttons';
import { Icon } from './ui/icons';
import { CARD, TYPE_META, TYPE_NAME } from './ui/surfaces';

/**
 * 로그인 전 결과의 첫머리 — **맛보기**(흐름 시안 g 의 2~3단계, ADR 0131).
 *
 * 한동안 로그인하지 않은 사람이 생일을 넣으면 여덟 글자 표부터 신살 · 강약 · 용신 · 관계 · 운까지 카드 아홉 장이 섰다.
 * 처음 온 사람에게 가장 어려운 덩어리가 맨 앞이었고, 풀이로 가는 길은 그 아래 작은 칸 하나였다. 이제 차례가 뒤집힌다 —
 * **내 사주 카드(천간 그림) → 짧은 맛보기 → 잠긴 목차와 로그인** 이 먼저 서고, 표는 지우지 않고 「사주 자세히 보기」에
 * 접힌다.
 *
 * ## 맛보기 글은 어디서 오나
 *
 * 미리 만든 표에서 열쇠(일주-월지) 하나로 읽는다 — 방문자의 입력은 브라우저 밖으로 안 나가고, 문에 가는 것은 열쇠뿐이다.
 * 표가 비었거나 못 읽으면 **엔진이 이 사주에서 낸 정해진 문장**이 선다(`fallbackTasteOf`). 둘 다 이 사주에 대한 참인
 * 문장이라 화면은 둘을 가르지 않는다.
 *
 * ## 목차는 본 풀이의 절 이름이다
 *
 * 서버(`app/page.tsx`)가 프롬프트의 절 이름을 지어 넘긴다 — 모델이 실제로 단 소제목은 검사 전이라 없고, 우리가 시킨
 * 이름만 참이다. 누르면 입력을 탭에 두고 로그인 · 가입을 거쳐 「이 사주가 내 사주 맞나요?」로 돌아온다(ADR 0128).
 */
export function Taste({
  query,
  saju,
  utterances,
  outline,
  detail,
}: {
  /** 화면에 서 있는 사주의 입력 — 로그인을 다녀와 되찾는 것이 이것이다 */
  query: Query;
  saju: Saju;
  utterances: readonly Utterance[];
  /** 본 사주풀이의 절 이름 */
  outline: readonly string[];
  /** 접어 둘 만세력 — 지우지 않는다 */
  detail: ReactNode;
}) {
  const name = query.name.trim();

  return (
    <div className="flex flex-col gap-4">
      {/* 카드는 홈의 내 사주 카드 그대로 — 가입하면 홈에서 만날 얼굴이 이것이다(운영자 2026-09-29) */}
      <SelfCard personId={null} label={name || '나'} query={query} saju={saju} reading={null} />

      <TastePassage saju={saju} utterances={utterances} />

      <LockedOutline outline={outline} query={query} />

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

/** 읽은 칸과 그 글 — 칸이 바뀌면(다시 제출) 읽은 것이 지금 칸의 것이 아니므로 기다림으로 돌아간다 */
type Passage = { key: string; text: string | null };

/**
 * 맛보기 문단 — 표의 글이 있으면 그 글, 없으면 엔진의 문장.
 *
 * **기다리는 동안은 자리만 잡는다.** 엔진의 문장을 먼저 세웠다가 표의 글로 갈면 읽던 글이 바뀐다. 문 하나라 짧다.
 */
function TastePassage({ saju, utterances }: { saju: Saju; utterances: readonly Utterance[] }) {
  const key = tasteKeyOf(saju.pillars);
  const [passage, setPassage] = useState<Passage | null>(null);

  useEffect(() => {
    let alive = true;
    void tastePassage(supabaseInBrowser(), key)
      /* 못 읽었으면 빈 칸과 같이 선다 — 부속 정보라 오류를 세우지 않는다(ADR 0078). 까닭은 문이 기록에 남긴다 */
      .then((read) => (alive ? setPassage({ key, text: read.ok ? read.value : null }) : undefined))
      .catch(() => (alive ? setPassage({ key, text: null }) : undefined));
    return () => {
      alive = false;
    };
  }, [key]);

  const text = passage?.key === key ? (passage.text ?? fallbackTasteOf(utterances).join(' ')) : null;

  return (
    <section aria-labelledby="taste-heading" aria-busy={text === null} className={CARD}>
      <h2 id="taste-heading" className={TYPE_META}>
        맛보기
      </h2>
      {text === null ? (
        <div aria-hidden className="mt-3 flex flex-col gap-2">
          <span className="h-3.5 w-full rounded-full bg-surface-sunken" />
          <span className="h-3.5 w-11/12 rounded-full bg-surface-sunken" />
          <span className="h-3.5 w-2/3 rounded-full bg-surface-sunken" />
        </div>
      ) : (
        <p className="mt-2 text-[15px] leading-7 text-foreground">{text}</p>
      )}
    </section>
  );
}

/**
 * 잠긴 목차 — 본 사주풀이의 절 이름과, 그것을 받으러 가는 단추.
 *
 * 앞의 두 줄 아래에는 글이 이어지는 듯한 흐린 막대가 선다 — 글자가 아니라 모양이라 읽히지 않는다(`aria-hidden`).
 */
function LockedOutline({ outline, query }: { outline: readonly string[]; query: Query }) {
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
          draft={toSearchParams(query).toString()}
          next={RESUME_READING_PATH}
          className={`${BUTTON_PRIMARY} w-full`}
        >
          로그인하고 전체 풀이 받기
        </SignInCarrying>
        <p className="text-center text-xs leading-5 text-secondary">
          로그인하면 이 입력으로 돌아와요. 가입하면 받은 풀이권으로 사주풀이를 볼 수 있어요.
        </p>
      </div>
    </section>
  );
}
