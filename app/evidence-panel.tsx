'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  EXCLUDED_PATHS,
  INCLUDED_PATHS,
  evidenceOf,
  type Evidence,
  type Saju,
} from '@/src/lib/saju';

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
 */
export function EvidencePanel({
  a,
  b,
  viewedAt,
}: {
  a: Saju;
  b?: Saju;
  /** 결과를 보는 기준 시각(ms). 운을 이 시각으로 짚는다 — 화면이 잡아서 넘긴다 */
  viewedAt: number;
}) {
  const [opened, setOpened] = useState(false);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');

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
        AI 에 넘길 자료
        <span className="ml-2 text-xs font-normal text-muted">evidence-v0 · JSON</span>
      </summary>

      <p className="mt-2 text-sm text-secondary">
        위에 있는 것들을 <strong className="font-medium">해석 없이</strong> 구조로 모은
        자료입니다. 문장도 점수도 길흉도 들어 있지 않습니다. 값마다 「이 근거로 얼마나
        세게 말해도 되는가」가 함께 실리므로, 받는 쪽이 문장을 새로 쓰더라도 근거보다
        세게 말할 자리가 없습니다.
      </p>

      {evidence === null || json === null ? null : (
        <EvidenceBody
          evidence={evidence}
          json={json}
          copy={copy}
          onCopy={async () => {
            try {
              await navigator.clipboard.writeText(json);
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
  copy,
  onCopy,
}: {
  evidence: Evidence;
  json: string;
  copy: 'idle' | 'copied' | 'failed';
  onCopy: () => void;
}) {
  const { contract, charts, compatibility } = evidence;
  const people = charts.b === null ? 1 : 2;

  /**
   * 넘어가는 것은 **들여쓰지 않은 쪽**이고, 세는 단위는 **바이트**다.
   *
   * `String.length` 로 세면 UTF-16 칸 수라 한자·한글이 하나로 세어지는데 UTF-8 로는
   * 세 배다. 이 자료는 거의 다 한자·한글이라 차이가 5% 가 아니라 두 배 가까이 난다.
   */
  const bytes = new TextEncoder().encode(JSON.stringify(evidence)).length;

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
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={download}
          className="h-9 rounded-md border border-border px-3 text-xs text-secondary transition-colors hover:border-border-strong hover:text-foreground"
        >
          JSON 내려받기
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="h-9 rounded-md border border-border px-3 text-xs text-secondary transition-colors hover:border-border-strong hover:text-foreground"
        >
          {copy === 'copied' ? '복사했습니다' : '클립보드로 복사'}
        </button>
        <span className="text-xs text-muted">
          {copy === 'failed'
            ? '복사에 실패했습니다. 내려받기를 쓰세요.'
            : `${people}인 · ${Math.round(bytes / 1024)}KB · 관계 ${
                compatibility === null ? charts.a.relations.length : compatibility.relations.length
              }건`}
        </span>
      </div>

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
