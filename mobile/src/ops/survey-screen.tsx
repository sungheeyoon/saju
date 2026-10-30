import { View } from 'react-native';

import { surveyDate, type CommentRow, type ServiceCount, type ServiceOverview, type ServiceText, type SurveyOverview, type TagRow, type VersionRow } from '@ops/survey';
import { FELT_LENGTH_LABEL, ISSUE_TAG_LABEL, feedbackQuestions, usefulnessLabel, type FeltLength } from '@reading/feedback';
import { PRICE_LABEL, SURVEY_QUESTION_TITLE, choiceLabel, type PriceOption } from '@survey';

import { Panel } from '@/ui/parts';

import { Bar, Body, FailureLine, Figure, Figures, Fine, Note, OpsAbsent, OpsShell, OpsWaiting, PageHead, SPACE, SectionTitle, Strong, Tag, Tags, useOpsRead } from './parts';
import { operatorSurvey } from './read';

const KIND_LABEL: Record<string, string> = {
  self: '내 사주',
  person: '저장한 사람 사주',
  private: '두 사람 궁합',
  match: '인연 궁합',
};

/** 설문 요약 — 세는 것은 DB 의 문 일곱이다. 판본별 표는 폰에서 줄마다 한 칸으로 선다 */
export default function SurveyScreen() {
  const state = useOpsRead('survey.overview', '/ops/survey', operatorSurvey);
  if (state.kind === 'waiting') return <OpsWaiting />;
  if (state.kind === 'absent') return <OpsAbsent />;
  const answered = state.value;
  return (
    <OpsShell>
      <PageHead title="설문 요약" note="설문 둘을 한 화면에서 봅니다 — 풀이 하나에 대한 답과, 서비스 전체에 대한 답." />
      {!answered.ok ? (
        <FailureLine onRetry={state.reload}>설문을 읽지 못했습니다.</FailureLine>
      ) : (
        <>
          <Head title="풀이 설문" note="풀이를 읽은 그 자리에서 남긴 답입니다. 답이 그 글을 만든 시도에 매여 있어 판본과 모델이 옆에 함께 보입니다." />
          <Overview counts={answered.value.overview} />
          {answered.value.overview.answers === 0 ? (
            <Nothing counts={answered.value.overview} />
          ) : (
            <>
              <Versions rows={answered.value.versions} />
              <Tagged rows={answered.value.tags} />
              <Comments rows={answered.value.comments} />
            </>
          )}
          <Head title="서비스 설문" note="탭에서 언제든 받는 답입니다. 제출한 것만 셉니다 — 쓰다 만 초안은 안 듭니다." />
          <Service counts={answered.value.service} picks={answered.value.serviceCounts} texts={answered.value.serviceTexts} />
        </>
      )}
    </OpsShell>
  );
}

function Head({ title, note }: { title: string; note: string }) {
  return (
    <View style={SPACE.stack}>
      <SectionTitle>{title}</SectionTitle>
      <Note>{note}</Note>
    </View>
  );
}

function Overview({ counts }: { counts: SurveyOverview }) {
  return (
    <Panel style={SPACE.card}>
      <SectionTitle>들어온 답</SectionTitle>
      <Figures>
        <Figure label="답" value={String(counts.answers)} />
        <Figure label="답한 사람" value={String(counts.respondents)} />
        <Figure label="답이 달린 풀이" value={String(counts.answeredRuns)} />
        <Figure label="완성된 풀이" value={String(counts.succeededRuns)} />
      </Figures>
      <Note>
        설문은 <Strong>풀이 개선에 동의한 사람</Strong>에게만 열립니다 — 동의 {counts.consented} · 거절 {counts.declined} · 아직 안 물어봄 {counts.unasked}.
      </Note>
    </Panel>
  );
}

function Nothing({ counts }: { counts: SurveyOverview }) {
  return (
    <Panel style={SPACE.card}>
      <SectionTitle>아직 답이 없습니다</SectionTitle>
      <Note>
        {counts.consented === 0
          ? '개선 활용에 동의한 사람이 아직 없습니다. 동의하기 전에는 풀이 아래에 설문이 표시되지 않습니다.'
          : counts.succeededRuns === 0
            ? '완성된 풀이가 아직 없습니다. 설문은 완성된 풀이 아래에 표시됩니다.'
            : '동의한 분들이 아직 답을 남기지 않았습니다. 설문은 풀이를 읽은 그 자리에 표시됩니다.'}
      </Note>
    </Panel>
  );
}

const feltIn = (felt: Record<FeltLength, number>): string => {
  const said = (Object.entries(felt) as [FeltLength, number][]).filter(([, count]) => count > 0).map(([length, count]) => `${FELT_LENGTH_LABEL[length]} ${count}`);
  return said.length === 0 ? '—' : said.join(' · ');
};

function Versions({ rows }: { rows: readonly VersionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Panel style={SPACE.card}>
      <SectionTitle>판본별</SectionTitle>
      <Note>답은 그 글을 만든 시도에 매여 있어 판본을 바꾼 뒤의 답과 그 전의 답이 섞이지 않습니다.</Note>
      {rows.map((row) => (
        <View key={`${row.promptVersion}:${row.model}:${row.kind}`} style={SPACE.line}>
          <Body>
            {row.promptVersion ?? '판본 없음'} · {row.model ?? '모델 없음'}
          </Body>
          <Figures>
            <Figure label="답" value={String(row.answers)} note={KIND_LABEL[row.kind] ?? row.kind} />
            <Figure label="도움" value={row.usefulness.toFixed(2)} />
            <Figure label="체감 적합성" value={row.perceivedFit.toFixed(2)} />
            <Figure label="분량" value={feltIn(row.felt)} />
          </Figures>
        </View>
      ))}
      <Fine>
        「도움」은 {usefulnessLabel('self')} — 대상은 종류마다 다릅니다(저장한 사람은 「이 사람을」, 궁합풀이 · 인연 궁합은 「두 사람을」). 같은 열이므로 종류로 나눠 읽습니다. 「체감 적합성」은 {feedbackQuestions('self').perceivedFit.label} 둘 다 5점이 높은 쪽입니다. <Strong>체감 적합성만 보고 판단하지 않습니다</Strong> — 바넘 문장은 근거 없이도 「내 얘기 같다」를 만듭니다. 이 값만 오르고 근거 밀착성이 떨어지면 그것은 개선이 아니라 바넘화입니다.
      </Fine>
    </Panel>
  );
}

function Tagged({ rows }: { rows: readonly TagRow[] }) {
  if (rows.length === 0) return null;
  const versions = [...new Set(rows.map((row) => row.promptVersion))];
  const most = Math.max(...rows.map((row) => row.answers));
  return (
    <Panel style={SPACE.card}>
      <SectionTitle>아쉬운 점</SectionTitle>
      <Note>답 하나가 여러 개를 고를 수 있어 답 수보다 많을 수 있습니다.</Note>
      {versions.map((version) => (
        <View key={version ?? 'none'} style={SPACE.stack}>
          <Body>{version ?? '판본 없음'}</Body>
          {rows
            .filter((row) => row.promptVersion === version)
            .map((row) => (
              <Bar key={row.tag} label={ISSUE_TAG_LABEL[row.tag]} count={row.answers} most={most} />
            ))}
        </View>
      ))}
    </Panel>
  );
}

function Comments({ rows }: { rows: readonly CommentRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Panel style={SPACE.card}>
      <SectionTitle>적어 주신 글</SectionTitle>
      <Note>최근에 남긴 것부터 보입니다.</Note>
      {rows.map((row) => (
        <View key={`${row.submittedAt}:${row.comment}`} style={SPACE.line}>
          <Body>{row.comment}</Body>
          <Tags>
            <Tag>{KIND_LABEL[row.kind] ?? row.kind}</Tag>
            <Tag>{row.promptVersion ?? '판본 없음'}</Tag>
          </Tags>
          <Fine>
            도움 {row.usefulness} · 체감 {row.perceivedFit} · {FELT_LENGTH_LABEL[row.feltLength]}
            {row.issueTags.length > 0 ? ` · ${row.issueTags.map((tag) => ISSUE_TAG_LABEL[tag]).join(', ')}` : ''} · {surveyDate(row.submittedAt)}
          </Fine>
        </View>
      ))}
    </Panel>
  );
}

function Service({ counts, picks, texts }: { counts: ServiceOverview; picks: readonly ServiceCount[]; texts: readonly ServiceText[] }) {
  const asked = new Set(picks.map((row) => row.question));
  const questions = [...Object.keys(SURVEY_QUESTION_TITLE).filter((one) => asked.has(one)), ...[...asked].filter((one) => !(one in SURVEY_QUESTION_TITLE))];
  return (
    <>
      <Panel style={SPACE.card}>
        <SectionTitle>참여</SectionTitle>
        <Figures>
          <Figure label="제출" value={String(counts.submitted)} />
          <Figure label="쓰는 중 (초안)" value={String(counts.drafts)} />
          <Figure label="사주풀이 값" value={String(counts.pricedSolo)} />
          <Figure label="궁합 값" value={String(counts.pricedPair)} />
        </Figures>
        <Fine>
          답을 고쳐 다시 제출한 사람 {counts.updated}명. 고쳐도 한 사람은 한 줄이라 제출 수는 안 늡니다. <Strong>값은 지불 의향이지 실제 구매가 아닙니다</Strong> — 가격 후보를 좁히는 참고 자료로 쓰고, 판매 가격의 적절성은 실제 구매·이탈 결과와 함께 판단합니다.
        </Fine>
      </Panel>
      {counts.submitted === 0 ? (
        <Panel style={SPACE.card}>
          <SectionTitle>아직 제출된 답이 없습니다</SectionTitle>
          <Note>{counts.drafts > 0 ? `쓰다 만 초안이 ${counts.drafts}건 있습니다. 제출하기 전까지는 여기에 세지 않습니다.` : '설문은 메뉴의 「서비스 설문」에 늘 열려 있습니다.'}</Note>
        </Panel>
      ) : (
        <>
          <Panel style={SPACE.card}>
            {questions.map((question) => {
              const rows = picks.filter((row) => row.question === question);
              const most = Math.max(...rows.map((row) => row.answers));
              return (
                <View key={question} style={SPACE.stack}>
                  <Body>{SURVEY_QUESTION_TITLE[question] ?? question}</Body>
                  {rows.map((row) => (
                    <Bar key={row.choice} label={choiceLabel(row.question, row.choice)} count={row.answers} most={most} />
                  ))}
                </View>
              );
            })}
          </Panel>
          {texts.length > 0 && (
            <Panel style={SPACE.card}>
              <SectionTitle>적어 주신 글</SectionTitle>
              {texts.map((row) => (
                <View key={`${row.submittedAt}:${row.improveText ?? ''}:${row.freeText ?? ''}`} style={SPACE.line}>
                  {row.improveText !== null && (
                    <Body>
                      <Strong>개선</Strong> {row.improveText}
                    </Body>
                  )}
                  {row.freeText !== null && (
                    <Body>
                      <Strong>그 밖에</Strong> {row.freeText}
                    </Body>
                  )}
                  <Fine>
                    {[
                      row.priceSolo !== null ? `사주풀이 ${PRICE_LABEL[row.priceSolo as PriceOption]}` : null,
                      row.pricePair !== null ? `궁합 ${PRICE_LABEL[row.pricePair as PriceOption]}` : null,
                      surveyDate(row.submittedAt),
                    ]
                      .filter((one) => one !== null)
                      .join(' · ')}
                  </Fine>
                </View>
              ))}
            </Panel>
          )}
        </>
      )}
    </>
  );
}
