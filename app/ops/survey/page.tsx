import { notFound, redirect } from 'next/navigation';

import {
  FEEDBACK_QUESTIONS,
  FELT_LENGTH_LABEL,
  ISSUE_TAG_LABEL,
  type FeltLength,
} from '@/src/lib/reading';
import { PRICE_LABEL, SURVEY_QUESTION_TITLE, choiceLabel, type PriceOption } from '@/src/lib/survey';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { readingDate } from '../../me/reading/line';
import {
  DENIED,
  operatorSurvey,
  type CommentRow,
  type ServiceCount,
  type ServiceOverview,
  type ServiceText,
  type SurveyOverview,
  type TagRow,
  type VersionRow,
} from './read';

export const metadata = {
  title: '설문 요약 — 만세력',
  description: '풀이마다 받은 답을 판본별로 봅니다.',
};

/**
 * **운영자가 답을 읽는 자리.**
 *
 * 여덟 달 동안 이 자료를 읽는 길은 운영 DB 의 SQL Editor 하나였다(ADR 0061). 읽기만
 * 하는 일에 매번 쓰기 권한이 있는 자리로 들어가야 했고, 집계 질의는 문서에만 있어서
 * 아무도 재지 않았다.
 *
 * ## `/me` 아래가 아니다
 *
 * 관문이 종료일 뒤의 `/me` 를 전부 `/closed` 로 돌린다(`gateFor`). 그런데 **답을 읽는
 * 것은 끝난 뒤에 하는 일이다** — 테스트가 끝나야 판본별 답이 다 모인다. 회원 화면이
 * 아니기도 하다: 여기 서는 수는 서비스에 대한 것이지 이 사람에 대한 것이 아니다.
 *
 * ## 문은 하나다
 *
 * 이 화면은 「나는 운영자인가」를 안 묻는다. 자료를 청하고 **거절당하면 없는 화면이
 * 된다**(`notFound`). 화면이 따로 판정하면 그 판정과 DB 의 판정이 갈리는 날이 오고,
 * 둘 중 넓은 쪽이 이 화면의 실제 경계가 된다.
 *
 * 메뉴에도 안 세운다. 헤더는 브라우저에서 세션만 읽으므로 운영자인지 알 수 없고,
 * 알려면 「나는 운영자인가」를 열어야 한다 — 위에서 안 열기로 한 그 문이다. 주소는
 * 운영 절차서가 든다(`docs/ops/runbook.md`).
 */
export default async function OperatorSurveyPage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const survey = await operatorSurvey();
  if (survey === DENIED) notFound();

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-6 py-9 sm:py-12">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">운영</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">설문 요약</h1>
        <p className="mt-1 text-sm text-secondary">
          설문 둘을 한 화면에서 봅니다 — 풀이 하나에 대한 답과, 서비스 전체에 대한 답.
        </p>
      </header>

      {survey === null ? (
        <p role="alert" className={`${CARD} text-sm text-danger`}>
          설문을 읽지 못했습니다. 잠시 뒤에 새로고침해 주세요.
        </p>
      ) : (
        <>
          <Head
            title="풀이 설문"
            note="풀이를 읽은 그 자리에서 남긴 답입니다. 답이 그 글을 만든 시도에 매여 있어 판본과 모델이 옆에 섭니다."
          />
          <Overview counts={survey.overview} />
          {survey.overview.answers === 0 ? (
            <Nothing counts={survey.overview} />
          ) : (
            <>
              <Versions rows={survey.versions} />
              <Tags rows={survey.tags} />
              <Comments rows={survey.comments} />
            </>
          )}

          <Head
            title="서비스 설문"
            note="탭에서 언제든 받는 답입니다. 제출한 것만 셉니다 — 쓰다 만 초안은 안 듭니다."
          />
          <Service
            counts={survey.service}
            picks={survey.serviceCounts}
            texts={survey.serviceTexts}
          />
        </>
      )}
    </main>
  );
}

/** 두 설문을 가르는 줄 — 같은 화면에 서지만 다른 것을 잰다 */
function Head({ title, note }: { title: string; note: string }) {
  return (
    <div className="mt-3 border-b border-border pb-3 first:mt-0">
      <h2 className="text-lg font-bold tracking-[-0.03em]">{title}</h2>
      <p className="mt-1 text-sm text-secondary">{note}</p>
    </div>
  );
}

/**
 * 개요 — **비어 있을 때 그 까닭까지 말한다.**
 *
 * 설문 전체가 개선 활용 동의 뒤에 있으므로, 「답 0」은 아무도 안 답한 것일 수도 있고
 * 아무도 동의하지 않은 것일 수도 있다. 그 둘은 할 일이 다르다.
 */
function Overview({ counts }: { counts: SurveyOverview }) {
  return (
    <section className={`${CARD} flex flex-col gap-4`}>
      <h2 className="text-base font-bold">들어온 답</h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Figure label="답" value={counts.answers} />
        <Figure label="답한 사람" value={counts.respondents} />
        <Figure label="답이 달린 풀이" value={counts.answeredRuns} />
        <Figure label="완성된 풀이" value={counts.succeededRuns} />
      </dl>
      {/*
        **비율을 안 적는다.** 완성된 풀이에는 동의하지 않은 사람의 것이 섞여 있어서
        「답 ÷ 완성」은 답할 수 있었던 사람 중 몇이 답했는가가 아니다. 나누는 것은
        나눌 수 있게 된 다음의 일이다.
      */}
      <p className="border-t border-border pt-4 text-xs leading-5 text-muted">
        설문은 <strong className="font-semibold text-secondary">풀이 개선에 동의한 사람</strong>
        에게만 열립니다 — 동의 {counts.consented} · 거절 {counts.declined} · 아직 안 물어봄{' '}
        {counts.unasked}.
      </p>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums tracking-[-0.03em]">{value}</dd>
    </div>
  );
}

/**
 * 아직 아무 답도 없을 때 — **다음에 할 일을 가리킨다.**
 *
 * 동의한 사람이 하나도 없는 것과, 동의는 했는데 아무도 안 적은 것은 고칠 자리가 다르다.
 */
function Nothing({ counts }: { counts: SurveyOverview }) {
  return (
    <section className={`${CARD} flex flex-col gap-2`}>
      <h2 className="text-base font-bold">아직 답이 없습니다</h2>
      <p className="text-sm leading-6 text-secondary">
        {counts.consented === 0
          ? '개선 활용에 동의한 사람이 아직 없습니다. 동의하기 전에는 풀이 아래에 설문이 서지 않습니다.'
          : counts.succeededRuns === 0
            ? '완성된 풀이가 아직 없습니다. 설문은 완성된 풀이 아래에 섭니다.'
            : '동의한 분들이 아직 답을 남기지 않았습니다. 설문은 풀이를 읽은 그 자리에 섭니다.'}
      </p>
    </section>
  );
}

/**
 * 판본별 — **개수를 먼저 세운다.**
 *
 * 표본이 적을 때 평균은 한 사람의 기분이다. 그래서 차례도 개수 순이고(DB 가 정한다),
 * 답 수가 평균 왼쪽에 선다.
 */
function Versions({ rows }: { rows: readonly VersionRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className={`${CARD} flex flex-col gap-4`}>
      <div>
        <h2 className="text-base font-bold">판본별</h2>
        <p className="mt-1 text-sm text-secondary">
          답은 그 글을 만든 시도에 매여 있어 판본을 바꾼 뒤의 답과 그 전의 답이 섞이지
          않습니다.
        </p>
      </div>

      <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold text-muted">
              <th className="py-2 pr-3 font-semibold">판본</th>
              <th className="py-2 pr-3 font-semibold">모델</th>
              <th className="py-2 pr-3 font-semibold">종류</th>
              <th className="py-2 pr-3 text-right font-semibold">답</th>
              <th className="py-2 pr-3 text-right font-semibold">도움</th>
              <th className="py-2 pr-3 text-right font-semibold">체감 적합성</th>
              <th className="py-2 font-semibold">분량</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.promptVersion}:${row.model}:${row.kind}`}
                className="border-b border-border last:border-0"
              >
                <td className="py-2.5 pr-3 font-semibold">{row.promptVersion ?? '판본 없음'}</td>
                <td className="py-2.5 pr-3 text-secondary">{row.model ?? '모델 없음'}</td>
                <td className="py-2.5 pr-3 text-secondary">{KIND_LABEL[row.kind] ?? row.kind}</td>
                <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{row.answers}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{row.usefulness.toFixed(2)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {row.perceivedFit.toFixed(2)}
                </td>
                <td className="py-2.5 text-secondary">{feltIn(row.felt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border pt-4 text-xs leading-5 text-muted">
        「도움」은 {FEEDBACK_QUESTIONS.usefulness.label} 「체감 적합성」은{' '}
        {FEEDBACK_QUESTIONS.perceivedFit.label} 둘 다 5점이 높은 쪽입니다.{' '}
        <strong className="font-semibold text-secondary">
          체감 적합성만 보고 판단하지 않습니다
        </strong>{' '}
        — 바넘 문장은 근거 없이도 「내 얘기 같다」를 만듭니다. 이 값만 오르고 근거 밀착성이
        떨어지면 그것은 개선이 아니라 바넘화입니다.
      </p>
    </section>
  );
}

/** 분량은 셋 중 하나라 값이 있는 것만 적는다 — 「짧다 0」 세 개는 읽을 것이 없다 */
function feltIn(felt: Record<FeltLength, number>): string {
  const said = (Object.entries(felt) as [FeltLength, number][])
    .filter(([, count]) => count > 0)
    .map(([length, count]) => `${FELT_LENGTH_LABEL[length]} ${count}`);

  return said.length === 0 ? '—' : said.join(' · ');
}

/**
 * 아쉬운 점 — **판본마다 따로 센다.**
 *
 * 전체 합을 세우면 판본을 고친 효과가 옛 답에 묻힌다. 고칠 자리를 찾는 표라서, 어느
 * 판본에서 무엇이 늘었는지가 보여야 한다.
 */
function Tags({ rows }: { rows: readonly TagRow[] }) {
  if (rows.length === 0) return null;

  const versions = [...new Set(rows.map((row) => row.promptVersion))];
  const most = Math.max(...rows.map((row) => row.answers));

  return (
    <section className={`${CARD} flex flex-col gap-4`}>
      <div>
        <h2 className="text-base font-bold">아쉬운 점</h2>
        <p className="mt-1 text-sm text-secondary">
          답 하나가 여러 개를 고를 수 있어 답 수보다 많을 수 있습니다.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {versions.map((version) => (
          <div key={version ?? 'none'} className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted">{version ?? '판본 없음'}</p>
            {rows
              .filter((row) => row.promptVersion === version)
              .map((row) => (
                <div key={row.tag} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-sm">{ISSUE_TAG_LABEL[row.tag]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-soft">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${Math.round((row.answers / most) * 100)}%` }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {row.answers}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * 적어 주신 글 — **점수와 함께 선다.**
 *
 * 글만 떼어 보면 「너무 단정적이에요」에 5를 준 사람과 2를 준 사람이 같은 말로 읽힌다.
 *
 * 누가 썼는지는 없다. 함수가 안 내주고(`operator_survey_comments`), 그래서 여기 그릴
 * 수도 없다.
 */
function Comments({ rows }: { rows: readonly CommentRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className={`${CARD} flex flex-col gap-4`}>
      <div>
        <h2 className="text-base font-bold">적어 주신 글</h2>
        <p className="mt-1 text-sm text-secondary">최근에 남긴 것부터 섭니다.</p>
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={`${row.submittedAt}:${row.comment}`}
            className="rounded-2xl border border-border bg-surface-soft p-4"
          >
            <p className="text-sm leading-6">{row.comment}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span className="font-semibold text-secondary">
                {KIND_LABEL[row.kind] ?? row.kind}
              </span>
              <span>{row.promptVersion ?? '판본 없음'}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                도움 {row.usefulness} · 체감 {row.perceivedFit} ·{' '}
                {FELT_LENGTH_LABEL[row.feltLength]}
              </span>
              {row.issueTags.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{row.issueTags.map((tag) => ISSUE_TAG_LABEL[tag]).join(', ')}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{readingDate(row.submittedAt)}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * kind 를 부르는 말 — **`readingTitle` 과 다른 일을 한다.**
 *
 * 저 함수는 **대상**을 부른다(「어머니 사주」) — 이름이 있어야 서는 말이다. 여기서
 * 묶는 것은 대상이 아니라 kind 자체라, 이름이 들어올 자리가 없다.
 */
const KIND_LABEL: Record<string, string> = {
  self: '내 사주',
  person: '저장한 사람 사주',
  private: '두 사람 궁합',
  match: '인연 궁합',
};

/**
 * 서비스 설문 — **제출한 것만.**
 *
 * 초안을 빼는 것은 함수가 한다(`submitted_at is not null`). 화면이 걸러 내면 집계 화면이
 * 하나 더 생기는 날 새어 들고, 그때 작성 도중의 문장이 제출한 의견처럼 읽힌다.
 */
function Service({
  counts,
  picks,
  texts,
}: {
  counts: ServiceOverview;
  picks: readonly ServiceCount[];
  texts: readonly ServiceText[];
}) {
  /**
   * **묻는 차례로 세운다.** DB 는 이름 순으로 내주는데, 그러면 「남은 풀이권」이 「좋았던
   * 기능」보다 위에 서서 설문을 읽은 사람의 기억과 어긋난다. 차례를 아는 것은 문항의
   * 말을 든 쪽이다(`SURVEY_QUESTION_TITLE`).
   */
  const asked = new Set(picks.map((row) => row.question));
  const questions = [
    ...Object.keys(SURVEY_QUESTION_TITLE).filter((one) => asked.has(one)),
    ...[...asked].filter((one) => !(one in SURVEY_QUESTION_TITLE)),
  ];

  return (
    <>
      <section className={`${CARD} flex flex-col gap-4`}>
        <h3 className="text-base font-bold">참여</h3>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Figure label="제출" value={counts.submitted} />
          <Figure label="쓰는 중 (초안)" value={counts.drafts} />
          <Figure label="사주풀이 값" value={counts.pricedSolo} />
          <Figure label="궁합 값" value={counts.pricedPair} />
        </dl>
        <p className="border-t border-border pt-4 text-xs leading-5 text-muted">
          답을 고쳐 다시 제출한 사람 {counts.updated}명. 고쳐도 한 사람은 한 줄이라 제출 수는
          안 늡니다.{' '}
          <strong className="font-semibold text-secondary">
            값은 지불 의향이지 실제 구매가 아닙니다
          </strong>{' '}
          — 가격 후보를 좁히는 참고 자료로 쓰고, 판매 가격의 적절성은 실제 구매·이탈 결과와
          함께 판단합니다.
        </p>
      </section>

      {counts.submitted === 0 ? (
        <section className={`${CARD} flex flex-col gap-2`}>
          <h3 className="text-base font-bold">아직 제출된 답이 없습니다</h3>
          <p className="text-sm leading-6 text-secondary">
            {counts.drafts > 0
              ? `쓰다 만 초안이 ${counts.drafts}건 있습니다. 제출하기 전까지는 여기에 세지 않습니다.`
              : '설문은 메뉴의 「서비스 설문」에 늘 열려 있습니다.'}
          </p>
        </section>
      ) : (
        <>
          <section className={`${CARD} flex flex-col gap-5`}>
            {questions.map((question) => {
              const rows = picks.filter((row) => row.question === question);
              const most = Math.max(...rows.map((row) => row.answers));
              return (
                <div key={question} className="flex flex-col gap-2">
                  <p className="text-sm font-bold">
                    {SURVEY_QUESTION_TITLE[question] ?? question}
                  </p>
                  {rows.map((row) => (
                    <div key={row.choice} className="flex items-center gap-3">
                      <span className="w-52 shrink-0 text-sm text-secondary">
                        {choiceLabel(row.question, row.choice)}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-soft">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${Math.round((row.answers / most) * 100)}%` }}
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums">
                        {row.answers}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>

          {texts.length > 0 && (
            <section className={`${CARD} flex flex-col gap-4`}>
              <h3 className="text-base font-bold">적어 주신 글</h3>
              <ul className="flex flex-col gap-3">
                {texts.map((row) => (
                  <li
                    key={`${row.submittedAt}:${row.improveText ?? ''}:${row.freeText ?? ''}`}
                    className="rounded-2xl border border-border bg-surface-soft p-4"
                  >
                    {row.improveText !== null && (
                      <p className="text-sm leading-6">
                        <span className="mr-2 text-xs font-semibold text-muted">개선</span>
                        {row.improveText}
                      </p>
                    )}
                    {row.freeText !== null && (
                      <p className="mt-2 text-sm leading-6">
                        <span className="mr-2 text-xs font-semibold text-muted">그 밖에</span>
                        {row.freeText}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted">
                      {[
                        row.priceSolo !== null
                          ? `사주풀이 ${PRICE_LABEL[row.priceSolo as PriceOption]}`
                          : null,
                        row.pricePair !== null
                          ? `궁합 ${PRICE_LABEL[row.pricePair as PriceOption]}`
                          : null,
                        readingDate(row.submittedAt),
                      ]
                        .filter((one) => one !== null)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
