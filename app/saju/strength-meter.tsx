import {
  HIDDEN_STEM_ROLE_KO,
  PILLAR_POSITION_KO,
  type PillarPosition,
  type Saju,
} from '@/src/lib/saju';
import {
  Fold,
} from './fold';
import { DISCLOSURE_SUMMARY } from '../ui/surfaces';
import { FACT_TAG } from './fact-tag';


/** 신강·신약 — 보조세력 비율과 득령·득지·득세 판정을 한 흐름으로 보여준다. */
export function StrengthMeter({ saju }: { saju: Saju }) {
  const { strength } = saju.analysis;
  const percent = strength.ratio * 100;
  const threshold = 50;
  const isStrong = strength.verdict === 'strong';

  return (
    <Fold
      title="신강 · 신약"
      meta={isStrong ? '신강' : '신약'}
      note="보조세력과 득령·득지·득세를 함께 봅니다"
    >
      <div className="rounded-2xl bg-surface-soft p-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p className="text-xs font-medium text-muted">현재 판정</p>
          <div className="mt-1 flex items-baseline gap-2">
            <strong className="text-3xl font-semibold">{isStrong ? '신강' : '신약'}</strong>
            <span className="text-sm text-secondary">세 기준 중 {strength.metCount}개 충족</span>
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-1 sm:mt-0 sm:text-right">
          <span className="text-3xl font-semibold tabular-nums text-foreground">{percent.toFixed(1)}</span>
          <span className="text-sm font-medium text-foreground">%</span>
          <span className="ml-1 text-xs text-muted">보조세력</span>
        </div>
      </div>

      <div className="mt-5">
        <div
          className="relative h-3 overflow-visible rounded-full bg-track"
          role="img"
          aria-label={`보조세력 ${percent.toFixed(1)}%, 신강 기준 ${threshold}%`}
        >
          <div
            className="h-full rounded-full bg-foreground/55"
            style={{ width: `${percent}%` }}
          />
          <div
            className="absolute inset-y-[-4px] w-0.5 bg-foreground/45"
            style={{ left: `${threshold}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          <span>소모 우세</span>
          <span>신강 기준 {threshold}%</span>
          <span>보조 우세</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-border px-3 py-2.5">
          <p className="text-xs text-muted">일간을 돕는 힘</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{strength.supportScore.toFixed(2)}</p>
          <p className="text-xs text-secondary">비겁·인성</p>
        </div>
        <div className="rounded-xl border border-border px-3 py-2.5">
          <p className="text-xs text-muted">일간을 소모하는 힘</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{strength.opposeScore.toFixed(2)}</p>
          <p className="text-xs text-secondary">식상·재성·관성</p>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">판정 근거</h3>
          <span className="text-xs text-muted">득령 · 득지 · 득세</span>
        </div>
      </div>
      <ul className="mt-2 grid gap-2 sm:grid-cols-3">
        {strength.criteria.map((criterion) => (
          <li
            key={criterion.key}
            className={`rounded-xl border p-3 ${
              criterion.met ? 'border-border-strong bg-surface-sunken' : 'border-border bg-surface-soft'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{criterion.label}</span>
              {/*
                **충족에 강조색을 안 쓴다.** 세력비와 게이지를 중립색으로 내린 것과 같은
                까닭이다 — 신강·신약은 좋고 나쁨이 아니므로, 세 기준 중 하나를 「달성」한
                것처럼 보이는 초록이 여기만 남으면 그 판단이 반만 적용된 것이 된다.
                가르는 일은 채움의 세기가 한다.
              */}
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                criterion.met
                  ? 'bg-foreground/85 text-background'
                  : 'bg-surface-sunken text-muted'
              }`}>
                {criterion.met ? '충족' : '미충족'}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-secondary">{criterion.detail}</p>
          </li>
        ))}
      </ul>

      {/*
        **한 줄만 남긴다.** 여기 세 문장이 있었다 — 등급 이름을 안 붙이는 까닭, 구간
        경계를 못 잡은 사정, 세 기준이 겹친다는 사실. 앞의 둘은 **없는 것에 대한 해명**이라
        화면에 안 세운다(안 붙은 등급을 사용자가 기다리고 있지 않다). 남은 하나는 바로 위
        세 줄을 읽는 방법이라 그 옆에 선다.
      */}
      <p className="mt-2 text-xs text-muted">
        세 기준은 서로 겹칩니다 — 득세 점수에 월지·일지가 이미 들어 있습니다.
      </p>

      <RootingNote saju={saju} />
    </Fold>
  );
}


/**
 * 통근·투출 — 판정이 아니라 그 재료다.
 *
 * 억부가 "아직 판정하지 않았다"고 적는 것들(종격 여부·투간과 통근의 질)이
 * 모두 이 두 사실 위에서 갈린다. 판정을 못 하더라도 재료는 보여줄 수 있고,
 * 보여주면 왜 판정을 미뤘는지도 눈에 보인다.
 *
 * 뿌리의 강약은 매기지 않는다. 어느 자리의 어느 지장간에 며칠치인지까지가
 * 사실이고, "이 정도면 통근으로 친다"는 선이 계통마다 다르다.
 */
function RootingNote({ saju }: { saju: Saju }) {
  const { dayMaster, emergences } = saju.analysis.rootedness;
  const seat = (position: PillarPosition) => PILLAR_POSITION_KO[position].charAt(0);

  return (
    <details className="group mt-4 border-t border-border pt-1">
      <summary className={DISCLOSURE_SUMMARY}>
        뿌리와 투출 자세히 보기
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="pb-2 pt-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={FACT_TAG}>사실</span>
          <span className="text-xs text-muted">일간 {dayMaster.stem}의 뿌리</span>
          {dayMaster.rooted ? (
            <>
              <span className="text-sm text-secondary">
                {dayMaster.roots
                  .map(
                    (root) =>
                      `${seat(root.position)}지 ${root.branch}의 ${root.stem}` +
                      `(${HIDDEN_STEM_ROLE_KO[root.role]} ${root.days}일)`,
                  )
                  .join(' · ')}
              </span>
              <span className="text-sm font-medium tabular-nums">합 {dayMaster.totalDays}일</span>
            </>
          ) : (
            <span className="text-sm font-medium">없음 — 지지 어디에도 통근하지 않았습니다</span>
          )}
        </div>

        {emergences.length > 0 && (
          <p className="mt-1.5 text-xs text-secondary">
            투출{' '}
            {emergences
              .map(
                (emergence) =>
                  `${seat(emergence.position)}지 ${emergence.branch}의 ${emergence.stem} → ` +
                  emergence.revealedAt.map((position) => `${seat(position)}간`).join('·'),
              )
              .join(' / ')}
          </p>
        )}

        <p className="mt-2 text-xs text-muted">
          뿌리의 강약은 매기지 않습니다. 음양이 다른 뿌리와 고지의 중기도 거르지 않고
          그대로 셉니다. 어디까지 통근으로 볼지는 계통마다 갈리며, 합충으로 뿌리가
          상했는지도 여기서는 판정하지 않습니다.
        </p>
      </div>
    </details>
  );
}
