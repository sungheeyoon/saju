'use client';

import { useState } from 'react';

/**
 * 세는 일은 화면 밖에 있다 — 실호출 검사가 **같은 자**를 써야 하기 때문이다.
 *
 * 입구(`@/src/lib/reading`)가 아니라 모듈을 곧바로 가리킨다. 입구는 사주 엔진과 고정
 * 사례까지 끌고 오는데, 이 화면에 필요한 것은 순수한 계산 하나뿐이다.
 */
import { measureText } from '@/src/lib/reading/measure';

import { CopyText } from './copy-text';
import {
  nowGeneration,
  overLength,
  runRecordFrom,
  runsOf,
  sameGeneration,
  scoresFrom,
  withRun,
  type RunRecord,
  type RunScore,
  type Score,
} from './round-state';

/**
 * **가린 채로 매기는 채점표.**
 *
 * 평가하는 사람이 「이건 control 이니까」를 알고 점수를 매기면 재는 것이 글이 아니라
 * 기대가 된다. 그래서 화면에는 `Q01-A` 만 서고, **짝은 여기서 나가는 어떤 파일에도
 * 들어가지 않는다** — 사례별 백업에 짝을 실으면 첫 사례를 끝내는 순간 남은 변형의
 * 블라인드가 깨진다. 짝은 전부 채점한 뒤 따로 연다.
 *
 * **가린 것이 지키는 것은 기대이지 정체가 아니다.** 변형을 직접 쓴 사람이 혼자
 * 채점하는 한, 절이 넷이면 「지금만」이고 항목이 셋이면 「근거만큼만」인 것을 글만 보고
 * 안다. 그것도 나쁜 쪽으로 새는데, **그 변형이 실제로 일했을 때만** 드러나기 때문이다.
 * 못 고치는 한계이므로 여기 적어 둔다 — 이 채점의 결론을 읽을 때 함께 읽을 것.
 *
 * ## 덮어쓰기를 막는 것이 저장보다 먼저다
 *
 * 저장해 둔 사례로 돌아오면 화면은 비어 있다. 그 상태에서 한 칸이라도 적으면 빈 것을
 * 바탕으로 통째로 다시 저장되어 **한 시간 채점한 것이 한 줄로 덮인다.** 그래서 무엇을
 * 할지 고르기 전에는 칸을 잠근다 — 이어서 할지, 버리고 새로 할지.
 *
 * ## 셀 수 있는 것은 세지 않는다
 *
 * 본문 길이·`score` 가 null 인지·소제목 개수는 출력 원문에서 나온다. 사람이 손으로
 * 세면 전체 출력 중 몇 개는 틀리고, 틀린 줄을 나중에 가려낼 방법이 없다.
 *
 * ## 한 칸을 여러 번 돌린다
 *
 * 칸마다 한 번씩만 받으면 **같은 프롬프트가 매번 같은 글을 내는지** 알 수 없다. 그러면
 * 두 변형의 차이가 변형 때문인지 그날 한 번의 운이었는지 못 가른다. 회차는 각자
 * 채점한다 — 손으로 평균을 내 한 숫자로 적으면 회차를 늘려 얻으려던 것이 그 자리에서
 * 사라진다.
 *
 * ## DB 를 만들지 않는다
 *
 * 첫 라운드가 정하는 것은 **다음에 무엇을 잴지**다. 표를 먼저 만들면 아직 모르는
 * 축을 스키마로 굳히게 된다. 합성 고정 사례라 사용자 Reading 이력을 남기지 않는 규율과도
 * 부딪히지 않는다.
 */

/**
 * PRD 가 정한 게이트 축 셋. **여기에 넣고 빼는 것은 게이트를 바꾸는 일이다.**
 */
const GATE_RATINGS = [
  ['concreteness', '구체성'],
  ['grounding', '근거 밀착성'],
  ['usefulness', '실용성'],
] as const;

/**
 * 이번 라운드에만 붙는 축 — **게이트 축이 아니다.**
 *
 * 이 라운드의 물음은 「좁힌 출력이 품질을 지키는가」인데, 위의 셋은 그것을 안 묻는다.
 * 채점표가 못 묻는 것은 실험이 답할 수 없으므로 축을 하나 붙인다. 대신 **게이트 셋과
 * 섞지 않는다** — PRD 의 공개 판정은 여전히 위의 셋이고, 이 축은 다음에 무엇을 잴지를
 * 고르는 데만 쓴다.
 */
const ROUND_RATING = ['answerUpFront', '첫 문단에서 답이 나오는가'] as const;

type Gate = 'asking' | 'starting' | 'ready';
type Storage = 'ok' | 'blocked';

/**
 * 저장 형식의 판본 — **자리 이름에 박는다.**
 *
 * 형식이 바뀌면 옛 기록을 되살릴 때 없는 칸이 나온다(`output` 이 없던 판이 그랬다 —
 * 그대로 읽으면 `undefined.trim()` 으로 던진다). 자리 이름을 올리면 옛 것이 아예 안
 * 보이고, 그래도 읽는 쪽은 **늘 빈 회차와 합쳐서** 받는다(`scoresFrom`). 둘 다 한다.
 */
const SCHEMA = 'rubric-v3';

/**
 * 「같은 모델 설정으로 비교했다」가 참이려면 설정이 기록에 함께 있어야 한다.
 *
 * 셋은 **코드에 이미 값으로 있다**(`GENERATION`). 그것을 사람이 옮겨 적게 두면 오타
 * 하나로 그 문장이 거짓이 되고, 나중에 그것이 오타였다는 것조차 알 수 없다. 사람이
 * 적는 것은 **코드가 모르는 것 하나**뿐이다 — 이 라운드를 언제 돌렸는지.
 *
 * ## 읽어 오는 것만으로는 모자라고, 얼리는 시점도 아무 데나가 아니다
 *
 * 내보낼 때마다 지금 값을 다시 읽으면, 라운드 도중에 모델을 바꾼 뒤 옛 기록을 복원했을
 * 때 **옛 출력이 새 설정으로 만들어진 것처럼** 나간다. 그래서 찍어 둔다.
 *
 * 그런데 찍는 시점이 「run id 를 처음 적을 때」면 여전히 샌다 — 모델 A 로 만들어 놓고,
 * 설정을 B 로 바꾼 뒤, 그제야 채점하러 들어와 id 를 적으면 **B 가 찍히고 아무도 다르다고
 * 말하지 않는다.** 그래서 **얼리는 것이 프롬프트를 여는 것보다 먼저** 오게 했다:
 * 라운드를 시작해야 프롬프트가 열리고, 프롬프트를 열어야 생성할 수 있다. 순서가 코드로
 * 강제되면 「생성 전에 찍혔는가」를 사람이 기억하지 않아도 된다.
 *
 * ## 그리고 달라졌으면 말한다
 *
 * 얼려 두기만 하면 이번에는 반대쪽으로 조용해진다 — 도중에 설정이 바뀐 것은 「옛 값을
 * 지켜야 할 일」이 아니라 **그 라운드가 깨졌다는 사실**이다.
 */
export function RubricSheet({
  caseId,
  setVersion,
  roundId,
  runsPerCell,
  viewedAt,
  evidenceDigest,
  promptVersion,
  rows,
  children,
}: {
  caseId: string;
  setVersion: string;
  roundId: string;
  /** 칸마다 몇 번 돌리는가 — 화면이 그만큼 칸을 연다 */
  runsPerCell: number;
  viewedAt: string;
  evidenceDigest: string;
  promptVersion: string;
  /**
   * 가린 차례 그대로 — **`variant` 는 여기 오지 않는다.**
   *
   * `sections` 와 `length` 는 온다. 눈금이 그 값에서 나와야 하고(0~8이 못박혀 있으면 네
   * 절짜리 변형에서 잘못된 것을 잰다), 절이 몇이고 글이 얼마나 긴지는 붙여 넣은 출력에
   * 이미 보이므로 이 값이 블라인드를 더 깎지는 않는다.
   *
   * **분량 초과는 막지 않고 보인다.** 첫 실측에서 다섯 변형이 전부 자기 밴드를 넘겼고,
   * 그 밴드는 모델에 대고 검증한 적이 없는 숫자다. 채점하는 사람은 그것이 얼마나
   * 넘쳤는지 알고 매겨야 한다 — 안 보이면 「길어서 좋다/나쁘다」가 채점에 조용히 섞인다.
   */
  rows: readonly {
    blind: string;
    promptDigest: string;
    sections: number;
    length: { min: number; max: number };
  }[];
  /**
   * 프롬프트들 — **라운드를 시작한 뒤에만 선다.**
   *
   * 여기 children 으로 받는 까닭이 그것이다. 화면 다른 자리에 두면 얼리기 전에도 복사할
   * 수 있고, 그러면 「생성 전에 설정을 찍었다」가 사람의 기억에만 남는다.
   */
  children: React.ReactNode;
}) {
  const key = `saju:${SCHEMA}:${setVersion}:${roundId}:${caseId}`;
  /** 라운드 설정은 **세트 단위**다 — 사례들이 같은 설정으로 돌아야 견줄 수 있다 */
  const runKey = `saju:${SCHEMA}:${setVersion}:${roundId}:run`;

  const [gate, setGate] = useState<Gate>('asking');
  const [storage, setStorage] = useState<Storage>('ok');
  const [scores, setScores] = useState<Record<string, Score>>({});
  const [run, setRun] = useState<RunRecord | null>(null);
  const [startingId, setStartingId] = useState('');

  const open = (keepSaved: boolean) => {
    try {
      if (!keepSaved) {
        /**
         * **버린다고 했으면 실제로 지운다.** 화면만 비우면 아무것도 안 적고 나갔을 때
         * 다음 복원에서 버렸던 기록이 되살아난다 — 사용자는 지운 줄 알고 있다.
         */
        window.localStorage.removeItem(key);
        setScores({});
      } else {
        setScores(scoresFrom(window.localStorage.getItem(key)));
      }

      const record = runRecordFrom(window.localStorage.getItem(runKey));
      setRun(record);
      // 얼린 것이 없으면 **프롬프트를 열기 전에** 얼린다.
      setGate(record === null ? 'starting' : 'ready');
    } catch {
      setScores({});
      setStorage('blocked');
      setGate('starting');
    }
  };

  /** 라운드를 연다 — **지금 설정을 찍고 나서** 프롬프트가 선다 */
  const startRound = (id: string) => {
    const record: RunRecord = { id: id.trim(), ...nowGeneration() };
    setRun(record);
    setGate('ready');
    try {
      window.localStorage.setItem(runKey, JSON.stringify(record));
    } catch {
      setStorage('blocked');
    }
  };

  const put = (blind: string, at: number, patch: Partial<RunScore>) => {
    const next = withRun(scores, blind, at, patch, runsPerCell);
    setScores(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setStorage('blocked');
    }
  };

  const generationNow = nowGeneration();
  /** 찍어 둔 것과 지금 것이 다르면 이 라운드는 한 설정으로 돈 것이 아니다 */
  const generationMismatch = run !== null && !sameGeneration(run, generationNow);

  /** 사례별 백업 — **짝이 없다.** 남은 사례를 가린 채로 두려면 여기서 새면 안 된다 */
  const backup = JSON.stringify(
    {
      setVersion,
      roundId,
      caseId,
      viewedAt,
      evidenceDigest,
      promptVersion,
      /** 라운드를 **열 때** 찍은 값 — 지금 값이 아니다 */
      run: run ?? { id: '', ...generationNow },
      generationNow,
      generationMismatch,
      recordedAt: new Date().toISOString(),
      rows: rows.map((row) => ({
        blind: row.blind,
        promptDigest: row.promptDigest,
        sections: row.sections,
        runs: runsOf(scores, row.blind, runsPerCell).map((run) => {
          const read = measureText(run.output);

          return {
            /** 안 돌린 칸을 0자로 적지 않는다 — 「안 받았다」와 「0자로 나왔다」는 다르다 */
            received: read.received,
            output: run.output,
            /** 근거 칸을 뺀 길이 — 프롬프트가 계약한 값 */
            length: read.length,
            /** 근거 칸까지 넣은 길이 — 둘이 같으면 근거 칸이 아예 없었다는 뜻이다 */
            wholeLength: read.whole,
            /** 첫 절의 길이. 「답까지 읽는 양」이 아니라 첫 소제목 아래의 길이다 */
            leadLength: read.lead,
            /** 그 변형이 계약한 분량과, 벗어났으면 얼마나 — **막지 않고 적는다** */
            lengthContract: row.length,
            lengthOver: read.received ? overLength(read.length, row.length) : null,
            headings: read.headings,
            scoreIsNull: read.scoreIsNull,
            missingSections: run.missingSections,
            hardFail: run.hardFail,
            concreteness: run.concreteness,
            grounding: run.grounding,
            usefulness: run.usefulness,
            answerUpFront: run.answerUpFront,
            note: run.note,
          };
        }),
      })),
    },
    null,
    2,
  );

  if (gate === 'asking') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">채점 — 시작하기 전에 고릅니다</p>
        <p className="text-sm leading-6 text-secondary">
          이 사례에 저장해 둔 채점이 있을 수 있습니다. 확인하기 전에 칸을 열면 적는 순간
          예전 기록이 <strong className="font-medium">한 줄로 덮입니다.</strong>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => open(true)}
            className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-strong"
          >
            저장된 채점 이어서
          </button>
          <button
            type="button"
            onClick={() => open(false)}
            className="h-10 rounded-xl border border-border-strong bg-surface px-4 text-sm font-semibold hover:border-danger hover:text-danger"
          >
            버리고 새로 시작
          </button>
        </div>
      </div>
    );
  }

  if (gate === 'starting' || run === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">라운드를 먼저 엽니다</p>
        <p className="text-sm leading-6 text-secondary">
          여는 순간 <strong className="font-medium">지금 모델 설정을 찍어 둡니다.</strong> 그
          뒤에 프롬프트가 열립니다 — 만들고 나서 적으면, 그 사이에 설정이 바뀌었어도 아무도
          다르다고 말해 주지 못합니다.
        </p>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            <dt className="inline">모델</dt>{' '}
            <dd className="inline text-foreground">{generationNow.model}</dd>
          </span>
          <span>
            <dt className="inline">provider</dt>{' '}
            <dd className="inline text-foreground">{generationNow.provider}</dd>
          </span>
          <span>
            <dt className="inline">설정</dt>{' '}
            <dd className="inline text-foreground">{generationNow.settings}</dd>
          </span>
        </dl>
        <div className="flex flex-wrap items-end gap-2">
          <Text
            label="run id (언제 돌렸는지)"
            value={startingId}
            onChange={setStartingId}
          />
          <button
            type="button"
            disabled={startingId.trim() === ''}
            onClick={() => startRound(startingId)}
            className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-50"
          >
            이 설정으로 라운드 열기
          </button>
        </div>
        {storage === 'blocked' && (
          <p role="alert" className="rounded-lg bg-warning-wash px-3 py-2 text-xs text-warning">
            이 브라우저가 저장을 막고 있어 새로고침하면 사라집니다. 끝내기 전에 기록을 복사해
            두세요.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">채점 — 어느 변형인지는 여기 없습니다</p>
        <CopyText text={backup} label="이 사례 기록 복사 (JSON)" />
      </div>

      {storage === 'blocked' && (
        <p role="alert" className="rounded-lg bg-warning-wash px-3 py-2 text-xs text-warning">
          이 브라우저가 저장을 막고 있어 새로고침하면 사라집니다. 끝내기 전에 위 버튼으로
          복사해 두세요.
        </p>
      )}

      {/*
        **어떤 설정으로 돌렸는지가 없으면 그 결과는 되짚을 수 없다.** 셋은 코드가 들고,
        사람은 코드가 모르는 것 하나만 적는다.
      */}
      {/* 얼린 값이다 — 적는 자리가 아니라 무엇으로 열었는지 보이는 자리 */}
      <dl className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-border p-3 text-xs text-muted">
        <span>
          <dt className="inline">run id</dt> <dd className="inline text-foreground">{run.id}</dd>
        </span>
        <span>
          <dt className="inline">모델</dt> <dd className="inline text-foreground">{run.model}</dd>
        </span>
        <span>
          <dt className="inline">provider</dt>{' '}
          <dd className="inline text-foreground">{run.provider}</dd>
        </span>
        <span>
          <dt className="inline">설정</dt> <dd className="inline text-foreground">{run.settings}</dd>
        </span>
      </dl>

      {/* 라운드를 연 뒤에야 프롬프트가 선다 — 얼리는 것이 만드는 것보다 먼저다 */}
      {children}

      {/*
        도중에 설정이 바뀐 것은 옛 값을 조용히 지킬 일이 아니라 **그 라운드가 깨졌다는
        사실**이다. 화면이 말하고 기록에도 `generationMismatch` 로 남는다.
      */}
      {generationMismatch && (
        <p role="alert" className="rounded-lg bg-warning-wash px-3 py-2 text-xs leading-5 text-warning">
          이 라운드를 시작할 때 찍어 둔 설정과 지금 설정이 다릅니다. 라운드 도중에 모델
          설정이 바뀌었다면 <strong className="font-semibold">이 라운드는 한 설정으로 돈 것이
          아닙니다.</strong> 찍어 둔 것은 <code>{run.model}</code> · <code>{run.settings}</code>,
          지금은 <code>{generationNow.model}</code> · <code>{generationNow.settings}</code> 입니다.
        </p>
      )}

      {rows.map((row) => (
        <fieldset key={row.blind} className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-bold">{row.blind}</legend>

          {runsOf(scores, row.blind, runsPerCell).map((run, at) => {
            const read = measureText(run.output);

            return (
              <div key={at} className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
                <p className="text-xs font-semibold text-secondary">{at + 1}회차</p>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-secondary">
                    모델이 낸 것 그대로 (JSON 이면 그대로 붙여 넣으세요)
                  </span>
                  <textarea
                    value={run.output}
                    onChange={(event) => put(row.blind, at, { output: event.target.value })}
                    rows={4}
                    className="rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash"
                  />
                </label>

                {/* 셀 수 있는 것은 세어서 보인다 — 사람이 세면 전체 출력 중 몇은 틀린다 */}
                <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>
                    <dt className="inline">본문</dt>{' '}
                    <dd
                      className={`inline ${
                        read.received && overLength(read.length, row.length) !== null
                          ? 'text-warning'
                          : 'text-foreground'
                      }`}
                    >
                      {read.length}자 ({row.length.min}~{row.length.max}
                      {read.received && overLength(read.length, row.length) !== null
                        ? ` · ${overLength(read.length, row.length)}`
                        : ''}
                      )
                    </dd>
                  </span>
                  <span>
                    <dt className="inline">근거 포함</dt>{' '}
                    <dd className="inline text-foreground">{read.whole}자</dd>
                  </span>
                  <span>
                    <dt className="inline">첫 절</dt>{' '}
                    <dd className="inline text-foreground">{read.lead}자</dd>
                  </span>
                  <span>
                    <dt className="inline">소제목</dt>{' '}
                    <dd className="inline text-foreground">
                      {read.headings}개 / {row.sections}
                    </dd>
                  </span>
                  <span>
                    <dt className="inline">score</dt>{' '}
                    <dd className="inline text-foreground">
                      {read.scoreIsNull === 'unknown'
                        ? '모름 (JSON 이 아님)'
                        : read.scoreIsNull === 'yes'
                          ? 'null'
                          : 'null 아님'}
                    </dd>
                  </span>
                </dl>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Number
                    label="빠진 절 수"
                    value={run.missingSections}
                    min={0}
                    max={row.sections}
                    onChange={(v) => put(row.blind, at, { missingSections: v })}
                  />
                  <Text
                    label="hard fail · 근거 밖 주장"
                    value={run.hardFail}
                    onChange={(v) => put(row.blind, at, { hardFail: v })}
                  />
                </div>

                <div className="flex flex-wrap gap-4">
                  {GATE_RATINGS.map(([field, label]) => (
                    <Number
                      key={field}
                      label={`${label} (1~5)`}
                      value={run[field]}
                      min={1}
                      max={5}
                      width="w-20"
                      onChange={(v) => put(row.blind, at, { [field]: v })}
                    />
                  ))}
                  <Number
                    label={`${ROUND_RATING[1]} (1~5)`}
                    value={run[ROUND_RATING[0]]}
                    min={1}
                    max={5}
                    width="w-20"
                    onChange={(v) => put(row.blind, at, { [ROUND_RATING[0]]: v })}
                  />
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-secondary">판단 근거</span>
                  <textarea
                    value={run.note}
                    onChange={(event) => put(row.blind, at, { note: event.target.value })}
                    rows={2}
                    className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash"
                  />
                </label>
              </div>
            );
          })}
        </fieldset>
      ))}

      <p className="text-xs leading-5 text-muted">
        앞의 세 축은 PRD 가 정한 게이트 축이고, 「첫 문단에서 답이 나오는가」는 이 라운드가
        다음에 무엇을 잴지 고르려고 붙인 축입니다. 게이트 판정에 섞지 않습니다.
      </p>
    </div>
  );
}

const FIELD =
  'h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash';

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-secondary">{label}</span>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} className={`${FIELD} w-full`} />
    </label>
  );
}

/** 1~5 를 적는 칸에 7 이 들어가면 그 줄은 나중에 못 쓴다 — 범위를 칸이 든다 */
function Number({
  label,
  value,
  min,
  max,
  onChange,
  width = 'w-full',
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  onChange: (next: string) => void;
  width?: string;
}) {
  const over = value !== '' && (globalThis.Number(value) < min || globalThis.Number(value) > max);

  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-secondary">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        aria-invalid={over || undefined}
        placeholder={`${min}~${max}`}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 2))}
        className={`${FIELD} ${width} text-center tabular-nums aria-invalid:border-danger aria-invalid:focus:border-danger`}
      />
    </label>
  );
}
