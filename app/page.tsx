import { Suspense } from 'react';

import { ELEMENTS, ELEMENT_KO } from '@/src/lib/saju';

import { CompatEntry } from './compat-entry';
import { ELEMENT_TONE } from './element-tone';
import { HOUR_UNKNOWN_LABEL } from './query';
import { SajuCalculator } from './saju-calculator';

export default function Home() {
  return (
    <main className="app-shell flex flex-1 flex-col gap-8 py-9 sm:gap-10 sm:py-14">
      <header className="relative overflow-hidden rounded-[2rem] border border-border bg-surface px-6 py-9 shadow-[var(--shadow-card)] sm:px-10 sm:py-12">
        <div className="absolute -right-12 -top-16 size-64 rounded-full bg-wood-soft blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-16 -left-20 size-56 rounded-full bg-water-soft blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="eyebrow">사주 보기</p>
          <h1 className="mt-3 text-[2rem] font-bold leading-[1.25] tracking-[-0.045em] sm:text-[3rem]">
            나를 이루는 흐름을<br className="hidden sm:block" /> 차분하게 읽어보세요
          </h1>
          <p className="mt-4 max-w-2xl text-[0.95rem] leading-7 text-secondary sm:text-base">
            출생 정보로 사주의 기본 구조와 운의 흐름을 확인하세요.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="#calculator" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-sm hover:-translate-y-0.5 hover:bg-accent-strong">
              출생 정보 입력하기
            </a>
            <CompatEntry />
          </div>
        </div>

        {/*
          다섯 색은 결과 화면과 **같은 한 벌**을 쓴다(`app/element-tone.ts`). 여기서
          손으로 적으면 히어로의 木과 여덟 글자 칸의 木이 다른 초록이 되고, 그때 색은
          아무것도 가리키지 않는 장식이 된다. 이름을 함께 세우는 것도 같은 이유다 —
          색만으로는 다섯을 가를 수 없는 사람이 있다.
        */}
        <ul className="relative mt-8 flex flex-wrap gap-2">
          {ELEMENTS.map((element) => {
            const tone = ELEMENT_TONE[element];
            return (
              <li
                key={element}
                className={`flex items-center gap-1.5 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-semibold ${tone.border} ${tone.surface}`}
              >
                <span className={`glyph grid size-6 place-items-center rounded-full bg-surface/70 ${tone.text}`}>
                  {element}
                </span>
                {ELEMENT_KO[element]}
              </li>
            );
          })}
        </ul>
      </header>

      {/*
        계산기는 주소창의 `#` 뒤를 읽는다(`app/hash-query.ts`). 이 페이지는 빌드 때 미리
        그려지고 fragment 는 서버에 오지도 않으므로, 그 값은 브라우저에서만 알 수 있다.
        폴백은 폼 자리를 차지할 만큼의 빈 상자다 — 결과가 들어오며 화면이 튀지 않게.
      */}
      <section id="calculator" className="scroll-mt-24">
        <div className="mb-5">
          <p className="eyebrow">생년월일시</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">출생 정보를 입력해 주세요</h2>
          {/*
            **비워 두는 길은 없다.** 「시간을 모르면 비워도 괜찮습니다」라고 적혀
            있었는데, 폼은 빈 칸을 거절한다(`missingForCalculation`) — 시각을 모르면
            「출생 시각 모름」을 **골라야** 넘어간다. 화면이 폼과 다른 말을 하고 있었다.
          */}
          <p className="mt-1 text-sm text-secondary">
            출생 시각을 모르면 「{HOUR_UNKNOWN_LABEL}」을 고르세요. 나머지 세 기둥은 그대로
            계산합니다.
          </p>
        </div>
        <Suspense fallback={<div className="h-56 rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]" />}>
          <SajuCalculator />
        </Suspense>
      </section>

      <footer className="border-t border-border py-6 text-xs leading-6 text-muted">
        절기는 천문 계산(태양 황경), 표준시 이력은 IANA tz 데이터에서 생성했습니다.
      </footer>
    </main>
  );
}
