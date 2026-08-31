'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  EXCLUDED_PATHS,
  INCLUDED_PATHS,
  PROMPTS,
  evidenceOf,
  promptHeadOf,
  promptWithEvidence,
  type Evidence,
  type PromptKind,
  type Saju,
} from '@/src/lib/saju';
import type { Relation } from '@/src/lib/people';

import { CARD } from './card';

/**
 * 넘길 자료를 **눈으로 보는 자리.**
 *
 * `evidenceOf` 는 만들어 놓고 부르는 곳이 테스트뿐이었다. 이 저장소에서 그것은
 * 표현 못 한 축의 흔적이고, 실제로 이 화면을 붙이기 전에는 `id` 구분자가 깨져
 * 있는 것도 골든에 찍고 나서야 보였다.
 *
 * **전체를 화면에 펼치지 않는다.** 두 사람짜리가 들여쓴 JSON 으로 460KB 라
 * `<pre>` 에 넣으면 브라우저가 앓는다. 그보다, 계산 값은 이미 이 화면 곳곳에
 * 표로 서 있다 — 여기서 새로 보아야 하는 것은 **계약과 상한 표**다. 그 둘만
 * 화면에 놓고 전체는 파일로 내린다.
 *
 * **열기 전에는 만들지 않는다.** 자료를 만드는 것이 공짜가 아니고(운 셋이 절반이
 * 넘는다) 대부분의 방문은 이 칸을 안 연다.
 *
 * **자료만 복사하면 계약이 읽히지 않는다.** 계약은 자료 안에 있지만, 받는 쪽이
 * 모델이면 값으로 실려 있다는 것만으로는 읽히지 않는다. 그래서 프롬프트를 함께
 * 복사한다 — 문구는 `evidence/prompt.ts` 가 계약에서 지어 내고 이 화면은 **어느
 * 것을 고를지와 어디에 놓을지**만 안다.
 *
 * **여기서 상한은 입을 막지 않는다.** 우리 문장은 이미 계약에 걸려서 나오고
 * (`corpus.ts`), 자료를 밖으로 넘기는 까닭은 우리가 안 하는 것을 시켜 보려는
 * 것이다. 프롬프트는 층을 딱지로 붙이게 할 뿐 말을 막지 않는다 — 조인 쪽은
 * 견줄 짝으로 따로 있다(`strict`).
 */
export function EvidencePanel({
  a,
  b,
  viewedAt,
  relation = null,
}: {
  a: Saju;
  b?: Saju;
  /** 결과를 보는 기준 시각(ms). 운을 이 시각으로 짚는다 — 화면이 잡아서 넘긴다 */
  viewedAt: number;
  /**
   * 두 사람이 무슨 사이인가 — **복사해 가는 프롬프트에 실린다.**
   *
   * 익명 화면은 우리가 모델을 안 부르지만 프롬프트는 나간다. 그 글에도 같은 구멍이
   * 있었다 — 두 사람이 무슨 사이인지 안 적혀 있어서 모델이 사실상 연애로 읽는다.
   *
   * 저장하지 않는다. 이 화면은 계정이 없고 입력은 주소의 `#` 뒤에만 산다(ADR 0007).
   */
  relation?: Relation | null;
}) {
  const [opened, setOpened] = useState(false);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [kind, setKind] = useState<PromptKind>('reading');

  // 명식을 따로 받는다 — `{ a, b }` 를 호출부가 만들면 렌더마다 새 객체라
  // 아래 `useMemo` 가 매번 자료를 다시 만든다(두 사람이면 460KB 짜리다).
  const evidence = useMemo<Evidence | null>(
    () => (opened ? evidenceOf({ a, b }, new Date(viewedAt)) : null),
    [opened, a, b, viewedAt],
  );
  const json = useMemo(
    () => (evidence === null ? null : JSON.stringify(evidence, null, 2)),
    [evidence],
  );

  useEffect(() => {
    if (copy === 'idle') return;
    const timer = setTimeout(() => setCopy('idle'), 3000);
    return () => clearTimeout(timer);
  }, [copy]);

  return (
    <details
      className={CARD}
      onToggle={(event) => setOpened(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-base font-semibold">
        풀이에 넘기는 자료
        <span className="ml-2 text-xs font-normal text-muted">evidence-v0 · JSON</span>
      </summary>

      <p className="mt-2 text-sm text-secondary">
        위에 있는 것들을 <strong className="font-medium">해석 없이</strong> 구조로 모은
        자료입니다. 문장도 점수도 길흉도 들어 있지 않습니다. 값마다 「이 근거가 얼마나
        단단한가」가 함께 실리므로, 받는 쪽이 해석을 새로 쓰더라도 어느 문장이 무엇에
        기대고 있는지 짚을 수 있습니다.
      </p>

      {evidence === null || json === null ? null : (
        <EvidenceBody
          evidence={evidence}
          json={json}
          kind={kind}
          relation={relation}
          onPick={setKind}
          copy={copy}
          onCopy={async (text) => {
            try {
              await navigator.clipboard.writeText(text);
              setCopy('copied');
            } catch {
              setCopy('failed');
            }
          }}
        />
      )}
    </details>
  );
}

/** ISO 시각을 화면 말로 — 자료가 든 것과 같은 시각을 보인다 */
const whenKo = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

function EvidenceBody({
  evidence,
  json,
  kind,
  relation,
  onPick,
  copy,
  onCopy,
}: {
  evidence: Evidence;
  json: string;
  kind: PromptKind;
  /** 복사해 가는 프롬프트에 실릴 사이 — 자료에는 안 들어간다 */
  relation: Relation | null;
  onPick: (kind: PromptKind) => void;
  copy: 'idle' | 'copied' | 'failed';
  onCopy: (text: string) => void;
}) {
  const { contract, charts, compatibility } = evidence;
  const people = charts.b === null ? 1 : 2;

  /**
   * 두 사람이 있어야 뜻이 있는 프롬프트는 한 사람일 때 아예 안 보인다.
   *
   * 흐리게 두고 누르면 아무 일도 안 일어나게 하는 쪽이 더 나쁘다 — 누른 사람은
   * 자기가 뭘 잘못했는지 모른다. 고를 수 없는 것은 자리를 차지하지 않는다.
   */
  const choices = PROMPTS.filter((prompt) => people === 2 || !prompt.needsTwo);
  const picked = choices.find((prompt) => prompt.kind === kind) ?? choices[0];
  const promptText = promptWithEvidence(picked.kind, evidence, relation);

  /**
   * 넘어가는 것은 **들여쓰지 않은 쪽**이고, 세는 단위는 **바이트**다.
   *
   * `String.length` 로 세면 UTF-16 칸 수라 한자·한글이 하나로 세어지는데 UTF-8 로는
   * 세 배다. 이 자료는 거의 다 한자·한글이라 차이가 5% 가 아니라 두 배 가까이 난다.
   */
  const bytes = new TextEncoder().encode(JSON.stringify(evidence)).length;
  /** 붙여 넣는 것은 프롬프트까지다 — 자료만 재면 실제로 보내는 것보다 작게 적힌다 */
  const promptBytes = new TextEncoder().encode(promptText).length;

  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `saju-evidence-v0-${people === 1 ? '1인' : '2인'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4 flex flex-col gap-5">
      <section>
        <h3 className="text-sm font-medium">무엇을 시킬 것인가</h3>
        <p className="mt-1 text-xs text-muted">
          자료만 넘기면 계약은 값으로만 실려 있고, 받는 쪽이 모델이면 값은 읽히지 않은 채
          지나갑니다. 프롬프트가 그 계약을 <strong className="font-medium">문장으로</strong>{' '}
          한 번 더 짚어 줍니다. 다만 여기서 근거의 층은{' '}
          <strong className="font-medium">입을 막는 눈금이 아니라 딱지</strong>입니다 —
          얕은 것은 얕다고 밝히고 끝까지 읽게 합니다. 조여서 읽히는 쪽은 견줄 짝으로
          따로 있습니다.
        </p>

        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="프롬프트 고르기">
          {choices.map((choice) => {
            const on = choice.kind === picked.kind;
            return (
              <button
                key={choice.kind}
                type="button"
                aria-pressed={on}
                onClick={() => onPick(choice.kind)}
                className={`h-9 rounded-md border px-3 text-xs transition-colors ${
                  on
                    ? 'border-accent bg-accent-wash text-foreground'
                    : 'border-border text-secondary hover:border-border-strong hover:text-foreground'
                }`}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-muted">{picked.hint}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCopy(promptText)}
            className="h-9 rounded-md border border-accent bg-accent-wash px-3 text-xs font-medium transition-colors hover:border-border-strong"
          >
            프롬프트 + 자료 복사
          </button>
          <button
            type="button"
            onClick={() => onCopy(json)}
            className="h-9 rounded-md border border-border px-3 text-xs text-secondary transition-colors hover:border-border-strong hover:text-foreground"
          >
            자료만 복사
          </button>
          <button
            type="button"
            onClick={download}
            className="h-9 rounded-md border border-border px-3 text-xs text-secondary transition-colors hover:border-border-strong hover:text-foreground"
          >
            JSON 내려받기
          </button>
          <span className="text-xs text-muted">
            {copy === 'copied'
              ? '복사했습니다.'
              : copy === 'failed'
                ? '복사에 실패했습니다. 내려받기를 쓰세요.'
                : `붙여 넣을 분량 ${Math.round(promptBytes / 1024)}KB · 자료만 ${Math.round(
                    bytes / 1024,
                  )}KB · ${people}인 · 관계 ${
                    compatibility === null
                      ? charts.a.relations.length
                      : compatibility.relations.length
                  }건`}
          </span>
        </div>

        {/*
          접어 둔다. 보내기 전에 무엇을 보내는지 볼 수 있어야 하지만, 펼쳐 두면 이
          칸이 자료 설명보다 길어져 본론을 밀어낸다.
        */}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-secondary">
            프롬프트 미리 보기
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-border bg-surface-sunken p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-secondary">
            {promptHeadOf(picked.kind, evidence, relation)}
          </pre>
          <p className="mt-1.5 text-xs text-muted">
            복사하면 이 아래에 자료가 <code>json</code> 블록으로 붙습니다.
            {picked.kind === 'audit' && ' 검사할 해설은 표시된 자리에 직접 넣으세요.'}
          </p>
        </details>
      </section>

      <section>
        <h3 className="text-sm font-medium">무엇까지 말해도 되는가</h3>
        <p className="mt-1 text-xs text-muted">
          값마다 이 표를 가리킵니다. 「있다」와 「없다」의 상한이 다릅니다 — 시각을
          모르면 흔들리는 근거는 있다는 쪽이 한 칸 내려가고 없다는 쪽은 아예 잠깁니다.
        </p>

        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="pb-1.5 font-normal whitespace-nowrap">근거</th>
                <th className="pb-1.5 pl-3 font-normal whitespace-nowrap">있다</th>
                <th className="pb-1.5 pl-3 font-normal whitespace-nowrap">없다</th>
              </tr>
            </thead>
            <tbody>
              {INCLUDED_PATHS.map((path) => {
                const note = charts.a.claims[path];

                return (
                  <tr key={path} className="border-t border-border">
                    <td className="py-1 whitespace-nowrap text-secondary">{path}</td>
                    <td className="py-1 pl-3 whitespace-nowrap">
                      {contract.strengthKo[note.presence]}
                    </td>
                    <td className="py-1 pl-3 whitespace-nowrap text-secondary">
                      {contract.strengthKo[note.absence]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/*
          두 사람이면 상한이 갈릴 수 있다 — 한쪽만 보이면 다른 쪽을 가린 것이 된다.
          **사람을 이름으로 부르지 않는다.** 이 칸이 말하는 것은 자료의 모양이고,
          자료 안에서 그 사람은 `charts.a` 라고 불린다.
        */}
        {charts.b !== null && (
          <p className="mt-2 text-xs text-muted">
            위 표는 자료의 <code>charts.a</code> 것입니다. 시각을 아는지가 갈리면 두 사람의
            상한도 갈리므로, 자료에는 사람마다 한 벌씩 실립니다.
          </p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium">지금 도는 운</h3>
        <p className="mt-1 text-xs text-muted">
          운은 표가 아니라 지금 도는 칸으로 실립니다. 「지금」은{' '}
          <strong className="font-medium text-secondary">{whenKo(evidence.viewedAt)}</strong> 이고,
          자료도 그 시각을 함께 들고 나갑니다 — 내일 열어도 무엇을 기준으로 짚은 값인지
          알 수 있어야 합니다.
        </p>
        <ul className="mt-1.5 flex flex-col gap-1 text-xs text-secondary">
          <li>
            대운{' '}
            {charts.a.now.daeun === null
              ? `없음 (${charts.a.now.daeunAbsence})`
              : `${charts.a.now.daeun.pillar.name} · ${charts.a.now.daeun.startAge}세부터`}
          </li>
          <li>세운 {charts.a.now.saeun.pillar.name} · {charts.a.now.saeun.year}년</li>
          <li>월운 {charts.a.now.wolun.pillar.name} · {charts.a.now.wolun.startTerm.name}</li>
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-medium">싣지 않는 것</h3>
        <ul className="mt-1.5 flex flex-col gap-1 text-xs text-secondary">
          {Object.entries(EXCLUDED_PATHS).map(([path, reason]) => (
            <li key={path}>
              <code className="text-muted">{path}</code> — {reason}
            </li>
          ))}
        </ul>
      </section>

      <p className="border-t border-border pt-3 text-xs text-muted">
        규칙 묶음 <code>{contract.ruleSets.relations}</code>
        {compatibility !== null && <> · <code>{contract.ruleSets.compatibility}</code></>} · 점수{' '}
        <code>{contract.scoring}</code> · 시각 <code>{contract.serialization}</code>. 이 계약은
        자료 안에도 그대로 실립니다.
      </p>
    </div>
  );
}
