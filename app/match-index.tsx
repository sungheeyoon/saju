import type { MatchPreview } from '@/src/lib/matching';

import { CARD } from './card';
import { Icon } from './ui/icons';

/**
 * 「궁합 베타」 지표를 화면에 세우는 자리 — **여기서는 아무것도 계산하지 않는다.**
 *
 * 숫자와 문구는 전부 `buildMatchPreview` 가 낸다. 화면이 제 손으로 가중치를 얹기
 * 시작하면 정책 버전이 가리키는 것과 사람이 본 것이 갈라진다.
 *
 * **셈이 끝난 값만 받는다.** 두 `Saju` 를 받지 않는 것이 요점이다 — 익명 화면은
 * 브라우저가 두 명식을 들고 있어도 되지만(자기가 입력한 것이다) Match 결과 화면은
 * 상대의 `Saju` 전체를 브라우저로 내려보내지 않는다(ADR 0008·0010). 받는 것을 `MatchPreview`
 * 하나로 좁히면 **그 규율이 타입에 적힌다** — 상대의 `Saju`와 원국 전체 판정을 넘길
 * 자리가 없다. 결과에서 서로의 여덟 글자를 공유한다는 동의와 이 경계는 별개다(ADR 0012).
 */
export function MatchIndexCard({
  preview,
  names,
  children,
}: {
  preview: MatchPreview;
  /** 두 사람을 부르는 말 — 지표 위에 누구와 누구인지를 적는다 */
  names: Record<'a' | 'b', string>;
  /** 카드 아래에 덧붙는 것 — 화면마다 다르다(익명 화면의 신청 칸 같은 것) */
  children?: React.ReactNode;
}) {
  return (
    <section className={`${CARD} flex flex-col gap-6`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/*
          **`preview.policyVersion` 은 여기 안 선다.** ADR 0026 이 「딱지에서 뺀다」고
          적어 두고 각주만 고쳤다 — 정작 이 줄이 남아 `궁합 베타 · match-v0` 으로 서
          있었고, e2e 가 그것을 못박아 두어 초록불이었다. 내부 판본 이름은 사용자에게
          아무 뜻이 없다(ADR 0026). 값은 `preview` 에 그대로 실려
          있으므로 되짚을 때는 자료에서 읽는다.
        */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-[13px] font-semibold text-cream-ink">
          <Icon name="heart" className="size-4" />
          궁합 베타
        </span>
        <span className="text-[13px] text-secondary">검증 중인 판정은 지표에서 제외</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr] lg:items-center">
        {/*
          수 하나가 크게 서되 **「베타 탐색 지표」라는 이름이 늘 곁에 붙는다** — 정답처럼 읽히지 않게.
          크림 원은 홈 · 지도의 「나와 궁합 ♥78」과 같은 말투다.
        */}
        <div className="flex flex-col items-center gap-1 rounded-[1.75rem] bg-cream px-5 py-6 text-center">
          <p className="text-[13px] font-semibold text-cream-ink">
            {names.a} × {names.b}
          </p>
          <p className="font-rounded text-[3.5rem] leading-none tabular-nums text-foreground">{preview.index}</p>
          <p className="text-[13px] text-cream-ink">100점 만점 베타 탐색 지표</p>
        </div>

        <div className="flex flex-col gap-5">
          {preview.dimensions.map((dimension) => (
            <div key={dimension.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold">{dimension.label}</span>
                <span className="text-[15px] font-semibold tabular-nums">{dimension.score}</span>
              </div>
              {/*
                막대는 값을 다시 읽는 그림일 뿐이다. 옆의 숫자가 원본이고, 폭은
                거기서 나온다 — 눈으로 어림한 길이를 값으로 읽지 않게 한다.
              */}
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-track">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${dimension.score}%` }}
                />
              </div>
              <p className="mt-1.5 text-[13px] leading-5 text-secondary">{dimension.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="font-rounded text-[1.3rem] leading-7">먼저 보이는 신호</h3>
        <ul className="mt-2 flex flex-col gap-2 text-[15px] leading-6">
          {preview.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-[0.6rem] size-1.5 shrink-0 rounded-full bg-foreground/40" />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[13px] leading-5 text-secondary">{preview.caveat}</p>

      {children}
    </section>
  );
}

/**
 * 엔진과 지표의 경계 — **화면마다 다시 쓰지 않는다.**
 *
 * 익명 화면과 Match 결과 화면이 같은 지표를 세우므로 같은 각주가 붙어야 한다. 두
 * 곳에 손으로 적으면 한쪽만 고쳐지고, 그때 더 세게 말하는 쪽이 남는다.
 */
export function ScoringNote() {
  return (
    <p className="text-[13px] leading-5 text-secondary">
      <strong className="font-semibold text-foreground">사주 엔진은 점수를 내지 않습니다.</strong> 위 베타 지표는
      엔진이 낸 사실에 공개된 가중치를 얹은 제품용 비교값입니다. 맞춰볼 외부 기준이 아직
      없으므로 궁합의 정답이나 관계의 좋고 나쁨으로 읽지 않습니다.
    </p>
  );
}
