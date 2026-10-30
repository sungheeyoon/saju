import {
  ELEMENT_KO,
  ELEMENT_ROLE_KO,
  FOLLOWING_DIRECTION_KO,
  FOLLOWING_PATTERN_POLICY,
  FOLLOWING_PATTERN_STATUS_KO,
  JUDGEMENT_KO,
  PRECEDENCE_REASON_KO,
  type Saju,
} from '@/src/lib/saju';
import { percent1, percentOfRatio } from '@/src/lib/saju/view';
import {
  PRECEDENCE_NOTE,
  followingNote,
  tonggwanBridgeNote,
  tonggwanNote,
} from '@/src/lib/saju/view/notes';
import { FACT_TAG } from './fact-tag';
import { Rich } from './rich';

/*
  용신 후보 카드(`yongsin-card.tsx`)의 판 가운데 **억부를 뒤집는가를 재는 셋** — 서열 · 통관 · 종격.
*/


/**
 * 판정 사이의 서열 — **어긋날 때 무엇을 보는가.**
 *
 * 이 칸이 없는 동안 화면은 답 넷을 나란히 세우고 아무 말도 안 했다. 「가종 후보」와
 * 「억부 木」을 함께 본 사람이 어느 쪽으로 읽을지는 그때그때 달랐고, 그것은 우리가
 * 정하지 않은 것이 아니라 **정해 놓고 안 알려 준 것**이다.
 *
 * 값은 엔진이 든다(`analysis.precedence`). 화면이 스위치를 다시 적으면 정책만 바뀌고
 * 이 표가 안 따라오는 날이 온다 — 바로 위 칸이 종격 대조 성적으로 그 일을 겪었다.
 */
export function PrecedenceTable({ precedence }: { precedence: Saju['analysis']['precedence'] }) {
  const shaken = precedence.rows.filter((row) => row.disagrees === true);

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={FACT_TAG}>
          사실
        </span>
        <span className="text-xs text-muted">판정이 어긋날 때</span>
        <span className="text-sm font-medium">
          {JUDGEMENT_KO[precedence.primary]}를 봅니다
        </span>
        {shaken.length > 0 && (
          <span className="text-sm text-secondary">
            지금 어긋나는 것 {shaken.map((row) => row.ko).join(' · ')}
          </span>
        )}
      </div>

      <ul className="mt-2 flex flex-col gap-1 text-xs">
        {precedence.rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-baseline gap-x-2">
            <span className={`w-8 shrink-0 ${row.key === precedence.primary ? 'font-medium' : 'text-secondary'}`}>
              {row.ko}
            </span>
            <span className={row.overrides ? 'text-accent' : 'text-muted'}>
              {row.overrides ? '기준' : '안 뒤집음'}
            </span>
            <span className="text-muted">{PRECEDENCE_REASON_KO[row.reason]}</span>
            {/*
              **「어긋나지 않는다」와 「견줄 수 없다」를 가른다.** 격국은 상신을 오행으로
              내지 않고 통관은 판정이 없다 — 빈 값을 「같다」로 적으면 안 재 본 것이
              잰 것처럼 보인다.
            */}
            <span className="text-secondary">
              {row.disagrees === null
                ? '견줄 수 없음'
                : row.disagrees
                  ? '지금 억부와 어긋남'
                  : ''}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-muted">
        <Rich parts={PRECEDENCE_NOTE} />
      </p>
    </div>
  );
}


/**
 * 통관 재료 — **판정이 아니라 맞선 두 세력의 사실이다.**
 *
 * 억부는 언제나 답을 하나 낸다. 「무엇이 가장 무거운가」로 한쪽을 고르고 그 반대편을
 * 권하는데, **두 세력이 팽팽히 맞선 명식에서는 그 물음이 답을 못 낸다** — 어느 쪽을
 * 눌러도 나머지가 그대로 남는다. 고전이 그 자리에 쓰라고 한 것이 통관이고, 이 칸은
 * 그 자리인지 아닌지를 **읽는 사람이 판단할 재료**를 편다.
 *
 * 다섯 쌍을 다 내지 않고 가장 팽팽한 하나만 세운다. 다섯 줄을 세우면 이 칸이 화면에서
 * 가장 큰 자리를 차지하는데, 판정도 아닌 것이 그럴 자리는 아니다. 나머지 넷은 자료에
 * 그대로 실린다(`analysis.tonggwan`).
 */
export function TonggwanFacts({ tonggwan }: { tonggwan: Saju['analysis']['tonggwan'] }) {
  const { tightest } = tonggwan;
  const percent = percent1;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={FACT_TAG}>
          사실
        </span>
        <span className="text-xs text-muted">가장 팽팽한 대치</span>
        <span className="glyph text-lg font-medium">
          {tightest.controller} → {tightest.controlled}
        </span>
        <span className="text-sm text-secondary">
          {ELEMENT_KO[tightest.controller]}{' '}
          <span className="tabular-nums">{percent(tightest.shares.controller)}</span> ↔{' '}
          {ELEMENT_KO[tightest.controlled]}{' '}
          <span className="tabular-nums">{percent(tightest.shares.controlled)}</span>
        </span>
        {/*
          **기준을 칸 안에 적는다.** 위의 오행 분포 표는 여덟 글자를 그대로 센 개수 %
          이고 여기는 지장간까지 편 점수 % 다. 한 페이지에서 같은 오행이 13% 와 15.4%
          로 두 번 나오는데 어느 자로 잰 것인지가 이 칸에는 없었다.
        */}
        <span className="text-xs text-muted">점수 기준(지장간·국 반영)</span>
      </div>

      <p className="mt-1.5 text-xs text-secondary">
        <Rich parts={tonggwanBridgeNote(tightest)} />
      </p>

      <p className="mt-2 text-xs text-muted">
        <Rich parts={tonggwanNote(tightest)} />
      </p>
    </div>
  );
}

/**
 * 종격 후보의 조건 — 판정이 아니라 재료다.
 *
 * "종격 여부를 아직 판정하지 않는다"고만 적어 두면 무엇이 막혔는지 알 수 없다.
 * 어느 계통이든 종을 말하려면 먼저 보는 넷을 그대로 보여주고, 여기에 어디서
 * 선을 긋느냐가 계통 선택이라는 것까지 적는다.
 */
export function FollowingCandidacyNote({ saju }: { saju: Saju }) {
  const { followingCandidacy: candidacy, following } = saju.analysis;
  const percent = percent1;
  /** 문턱과 대조 성적은 **재는 자리가 들고 있는 값**을 그대로 읽는다 — 아래 주석 참조 */
  const { dominance } = FOLLOWING_PATTERN_POLICY;
  const { externalCheck } = dominance;
  const share = percentOfRatio;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={FACT_TAG}>
          시험
        </span>
        <span className="text-xs text-muted">종격</span>
        <span className="text-lg font-medium">
          {FOLLOWING_PATTERN_STATUS_KO[following.verdict]}
        </span>
        <span className="text-sm text-secondary">
          자당(비겁·인성) 몫{' '}
          <span className="tabular-nums">{percent(following.selfShare)}</span>
          <span className="text-muted">
            {' '}
            (밖으로 종 ≤{share(dominance.outwardMaxSelfShare)} · 안으로 종 ≥
            {share(dominance.inwardMinSelfShare)})
          </span>
          {following.direction && (
            <span className="ml-1.5">{FOLLOWING_DIRECTION_KO[following.direction]}</span>
          )}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={FACT_TAG}>
          사실
        </span>
        <span className="text-xs text-muted">판정의 재료</span>
        <span className="text-sm">
          일간 {candidacy.dayMasterRootless ? '무근' : '유근'}
          <span className="mx-1.5 text-muted">·</span>
          가장 무거운 세력 {ELEMENT_ROLE_KO[candidacy.dominant.role]}{' '}
          <span className="tabular-nums">{percent(candidacy.dominant.ratio)}</span>
          <span className="mx-1.5 text-muted">·</span>
          월령 {candidacy.monthCommandsDominant ? '그 세력이 잡음' : '다른 세력'}
          <span className="mx-1.5 text-muted">·</span>
          투간한 생부{' '}
          {candidacy.supportStems.length === 0 ? (
            '없음'
          ) : (
            <span className="glyph">
              {candidacy.supportStems.map((support) => support.stem).join(' ')}
            </span>
          )}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted">
        <Rich parts={followingNote(externalCheck)} />
      </p>
    </div>
  );
}
