import {
  Fold,
} from './fold';
import {
  type Saju,
} from '@/src/lib/saju';
import {
  HIT_POSITION_KO,
  PILLAR_COLUMNS,
  missingSpiritNotes,
  starNamesByNature,
  starsAt,
} from '@/src/lib/saju/view';
import { STAR_BASIS_NOTE, STAR_NATURE_NOTE } from '@/src/lib/saju/view/notes';
import { Rich } from './rich';
import {
  DISCLOSURE_SUMMARY,
} from '../ui/surfaces';


/**
 * 신살 — 어느 자리에 걸렸는지가 본론이므로 기둥별 카드로 놓는다.
 *
 * 네 기둥을 작은 화면의 네 열에 밀어 넣으면 이름과 기준이 잘린다. 모바일에서는
 * 한 기둥씩 세로로, 넓은 화면에서는 네 기둥을 나란히 놓는다. 각 항목은 「일간 庚」,
 * 「년간 庚」처럼 자리·대상·글자를 한 덩어리로 적는다 — 카드 머리만 보고 자리를
 * 추론하게 하면 같은 신살이 두 번 찍힌 버그처럼 보인다.
 *
 * 길신·흉신은 항목의 점수나 판정이 아니다. 개수 칩과 항목 딱지는 점수판처럼 읽히므로
 * 본문에는 섞지 않고, 전통 분류 이름만 아래 상세 정보에 둔다.
 */
export function StarTable({ saju }: { saju: Saju }) {
  const { stars } = saju.sinsal;
  const missingSpirits = missingSpiritNotes(saju);

  return (
    <Fold
      id="stars"
      title="신살"
      meta={stars.length > 0 ? `${stars.length}개` : undefined}
      note="어떤 신살이 어느 자리에 걸렸는지 모아봅니다"
    >

      {stars.length === 0 ? (
        <div className="rounded-card bg-surface-soft px-4 py-5 text-center text-sm text-secondary">
          걸린 신살이 없습니다
        </div>
      ) : (
        <div className="grid items-start gap-2 lg:grid-cols-4">
          {PILLAR_COLUMNS.map(({ key, label }) => {
            const found = starsAt(saju, key);
            return (
              <section
                key={key}
                aria-label={`${label}에 걸린 신살`}
                className={`min-w-0 rounded-card border p-3 ${
                  key === 'day' ? 'border-border-strong bg-cream' : 'border-transparent bg-surface-soft'
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between gap-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    {label}
                  </h3>
                  <span className="text-xs text-secondary">{found.length}개</span>
                </div>

                {found.length === 0 ? (
                  <p className="py-3 text-center text-small text-secondary">걸린 항목 없음</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {found.map(({ star, hit }) => (
                      <li key={`${star.id}:${hit.target}:${hit.char}`} className="rounded-cell bg-surface-raised px-3 py-2 shadow-soft">
                        <span className="text-sm font-semibold text-foreground">{star.ko}</span>
                        <p className="mt-0.5 text-xs leading-5 text-secondary">
                          {HIT_POSITION_KO[hit.position][hit.target]} <span className="glyph">{hit.char}</span>
                          {star.basis && <> · {star.basis.label} <span className="glyph">{star.basis.char}</span></>}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/*
        **길흉 고지는 낱말을 따라 접이칸으로 갔다.** 개수 칩과 항목 딱지를 걷고 나니
        본문에 「길신」·「흉신」이 한 번도 안 나오는데, 그것이 판정이 아니라는 해명만
        본문에 남아 있었다 — 없는 것을 해명하는 문장이다. 그 낱말이 실제로 서는 자리가
        아래 접이칸이므로 고지도 거기 선다.

        시주 이야기는 남는다. 저 위 시주 카드가 실제로 비어 있고, 이 줄이 그 빈 칸의
        까닭이다 — 시각을 아는 명식에서는 아예 안 선다.
      */}
      {!saju.meta.hourKnown && (
        <p className="mt-3 text-xs text-muted">
          시주를 몰라 시주에 걸린 신살은 빠져 있습니다.
        </p>
      )}

      <details className="group mt-4 border-t border-border pt-1">
        <summary className={DISCLOSURE_SUMMARY}>
          전통 분류와 산출 기준
          <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="pb-2 pt-2 text-xs leading-5 text-secondary">
          <dl className="mb-3 flex flex-col gap-1 rounded-cell bg-surface-soft p-3">
            {starNamesByNature(saju).map(({ nature, ko, named }) => (
              <div key={nature} className="flex gap-2">
                <dt className="w-8 shrink-0 text-muted">{ko}</dt>
                <dd>{named}</dd>
              </div>
            ))}
          </dl>
          <p className="mb-3">
            {STAR_NATURE_NOTE}
          </p>
          {missingSpirits.length > 0 && (
            <ul className="mb-3 flex flex-col gap-0.5 rounded-cell bg-surface-soft p-3">
              {missingSpirits.map((note) => <li key={note}>{note}</li>)}
            </ul>
          )}
          <p>
            <Rich parts={STAR_BASIS_NOTE} />
          </p>
        </div>
      </details>
    </Fold>
  );
}
