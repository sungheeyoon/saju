'use client';

import { useState } from 'react';

import { RESUME_PAIR_PATH } from '@/src/lib/consent';
import { calculateChart } from '@/src/lib/input/chart';
import { DEFAULT_QUERY, mergeSearchParams, missingAnswer, toSearchParams, type Query } from '@/src/lib/input/query';
import { pairTasteOf, type PairTaste as Taste } from '@/src/lib/matching/pair-taste';

import { BirthFields } from './birth-form';
import { PAIR_DRAFT_KEY } from './reading-draft';
import { SignInCarrying } from './sign-in-carrying';
import { BUTTON_PRIMARY } from './ui/buttons';
import { elementScope } from './ui/element-tone';
import { Icon } from './ui/icons';
import { STEM_PICTURE, StemSymbol } from './ui/stem-symbol';
import { CARD, PAPER, PAPER_BOTTOM, TYPE_META } from './ui/surfaces';
import { STEM_INFO } from '@/src/lib/saju';

/**
 * 첫 화면의 **로그인 전 궁합 결과** — 로그인 없이 두 사람을 넣어 본다(흐름 시안 g, ADR 0131).
 *
 * `/compat` 은 로그인 관문 안이다(ADR 0128) — 두 사람을 정하는 순간 대상이 서버에 서기 때문이다. 그래서 로그인 전의
 * 궁합은 여기서 **브라우저 계산으로만** 선다: 두 사람의 일간 그림, 엔진이 낸 한 줄(`pairTasteOf`), 가린 점수, 궁합풀이가
 * 다루는 것. 아무것도 저장하지 않고 주소에도 안 싣는다.
 *
 * 「로그인하고 궁합풀이 받기」는 두 사람을 탭의 `sessionStorage` 에 두고 `/compat#resume-pair` 로 간다 — 궁합 화면의 두
 * 칸이 그 입력으로 채워진 채 선다(`app/hash-query.ts`). 출생 정보는 로그인 주소(`next`)에 안 실린다(ADR 0007).
 */
export function PairTaste() {
  const [forms, setForms] = useState<{ a: Query; b: Query }>({ a: DEFAULT_QUERY, b: DEFAULT_QUERY });
  const [tried, setTried] = useState(false);
  const [shown, setShown] = useState<{ taste: Taste; names: { a: string; b: string }; draft: string } | null>(null);

  const missing = missingAnswer(forms.a) ?? missingAnswer(forms.b);

  const submit = () => {
    if (missing !== null) {
      setTried(true);
      return;
    }
    const a = calculateChart(forms.a);
    const b = calculateChart(forms.b);
    if (!a.ok || !b.ok) {
      setTried(true);
      return;
    }
    setTried(false);
    const names = { a: forms.a.name.trim(), b: forms.b.name.trim() };
    setShown({
      taste: pairTasteOf({ a: a.saju, b: b.saju }, names),
      names,
      draft: mergeSearchParams(toSearchParams(forms.a, 'a.'), toSearchParams(forms.b, 'b.')).toString(),
    });
  };

  /* 계산이 거절한 까닭(없는 날짜 등)은 빠진 칸 다음에 말한다 */
  const refused = (() => {
    if (missing !== null) return missing;
    const a = calculateChart(forms.a);
    if (!a.ok) return a.message;
    const b = calculateChart(forms.b);
    return b.ok ? null : b.message;
  })();

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        // 첫 화면 종이의 아래 토막 — 입구 「궁합 보기」 곧장 아래에 「나」 · 「상대」 묶음 두 장이 선다(시안 n, ADR 0132)
        className={`${PAPER_BOTTOM} flex flex-col gap-4`}
      >
        {(['a', 'b'] as const).map((side) => (
          <fieldset key={side} aria-label={side === 'a' ? '나' : '상대'} className="flex min-w-0 flex-col">
            {/* 설정 앱의 구역 머리 — 묶음 위 작은 회색 글자 */}
            <legend className="mb-1.5 px-4 text-[13px] font-medium text-secondary">{side === 'a' ? '나' : '상대'}</legend>
            <BirthFields
              value={forms[side]}
              onChange={(next) => setForms((current) => ({ ...current, [side]: next }))}
            />
          </fieldset>
        ))}
        <div className="flex flex-col gap-2">
          <button
            type="submit"
            aria-describedby={tried && refused !== null ? 'pair-missing' : undefined}
            className={`${BUTTON_PRIMARY} mt-1 w-full`}
          >
            무료로 두 사람 궁합 보기
          </button>
          {tried && refused !== null && (
            <p id="pair-missing" role="alert" className="text-sm font-medium text-danger">
              {refused}
            </p>
          )}
        </div>
      </form>

      {shown !== null && <PairTasteResult {...shown} />}
    </div>
  );
}

/** 궁합풀이가 다루는 것 — 소제목은 모델이 두 사람에 맞춰 정하므로(`needs-v1`) 절 이름 대신 프롬프트가 묻는 것을 적는다 */
const PAIR_COVERS: readonly string[] = [
  '서로에게 어떤 사람인가',
  '어디가 맞고 어디서 부딪히는가',
  '함께 지내면 되풀이될 장면',
  '오래 가려면 무엇이 필요한가',
  '지금이 이 관계에 어떤 시기인가',
];

function PairTasteResult({ taste, names, draft }: { taste: Taste; names: { a: string; b: string }; draft: string }) {
  return (
    <>
      <section aria-labelledby="pair-taste-heading" className={`${PAPER} flex flex-col items-center gap-3 text-center`}>
        <h2 id="pair-taste-heading" className={TYPE_META}>
          {names.a} × {names.b} · 두 사람의 궁합
        </h2>
        <div className="flex items-center justify-center gap-3">
          {(['a', 'b'] as const).map((side, index) => {
            const stem = taste.dayMasters[side];
            return (
              <span key={side} className="flex items-center gap-3">
                {index === 1 && <span aria-hidden className="text-muted">×</span>}
                <span className={`${elementScope(STEM_INFO[stem].element)} flex flex-col items-center gap-1`}>
                  <span className="grid size-16 place-items-center rounded-full bg-[var(--tile)]">
                    <StemSymbol stem={stem} className="size-10" />
                  </span>
                  <span className="text-[13px] text-secondary">
                    {names[side]} · {STEM_PICTURE[stem]}
                  </span>
                </span>
              </span>
            );
          })}
        </div>
        <p className="max-w-md text-[15px] leading-7 text-foreground">{taste.line}</p>
        <p className="flex items-center gap-2 text-[13px] text-secondary">
          <span aria-hidden className="rounded-full bg-surface-sunken px-3 py-1 font-rounded text-xl text-muted blur-[4px]">
            00
          </span>
          <Icon name="lock" className="size-4" />
          점수는 궁합풀이에서 볼 수 있어요
        </p>
      </section>

      <section aria-labelledby="pair-outline-heading" className={CARD}>
        <h2 id="pair-outline-heading" className={TYPE_META}>
          궁합풀이에서 다루는 것
        </h2>
        <ol className="mt-3 flex flex-col gap-3">
          {PAIR_COVERS.map((title, index) => (
            <li key={title} className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <span className="tabular-nums text-secondary">{index + 1}.</span>
              <span className="min-w-0 flex-1">{title}</span>
              <Icon name="lock" className="size-4 shrink-0 text-muted" />
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-col gap-2">
          <SignInCarrying draftKey={PAIR_DRAFT_KEY} draft={draft} next={RESUME_PAIR_PATH} className={`${BUTTON_PRIMARY} w-full`}>
            로그인하고 궁합풀이 받기
          </SignInCarrying>
          <p className="text-center text-xs leading-5 text-secondary">
            로그인하면 입력한 두 사람으로 이어서 볼 수 있어요. 가입하면 풀이권으로 궁합풀이를 받을 수 있어요.
          </p>
        </div>
      </section>
    </>
  );
}
