/**
 * 계획이 **조용히 건너뛰지 않는가.**
 *
 * 선택 실행의 위험은 빨간불이 아니라 **초록인데 안 잰 것**이다. 그래서 여기서 재는 것은
 * 「문서만 바뀌면 건너뛰는가」보다 「모르는 파일이 하나라도 있으면 전부 도는가」와
 * 「라벨이 검사를 뺄 수 없는가」다.
 */
import { describe, expect, it } from 'vitest';

import { ENGINE_DB_FACING, FULL_LABEL, planFor, summaryOf } from './ci-plan.mjs';

const pr = (files: string[], labels: string[] = []) => planFor({ files, labels, event: 'pull_request' });

describe('CI 계획', () => {
  it('정책만 바뀌면 policy 차선만 돈다 — 문서도 scripts 시험이 읽으므로 아무것도 안 도는 단계는 없다', () => {
    const plan = pr(['docs/adr/0082-x.md', 'CONTEXT.md', 'docs/prd.md']);

    expect(plan.tier).toBe('policy');
    expect(plan.lanes).toEqual({ policy: true, verify: false, authed: false, flow: false });
  });

  it('도구 설정 · 이슈와 PR 틀 · scripts 의 시험 파일도 정책이다 (#141 은 설정 하나로 전부를 돌았다)', () => {
    for (const file of [
      '.claude/settings.json',
      '.github/ISSUE_TEMPLATE/ready-for-agent.md',
      '.github/pull_request_template.md',
      'scripts/code-rules.test.ts',
    ]) {
      expect(pr(['docs/agents/delegation.md', file]).tier, file).toBe('policy');
    }
  });

  it('scripts 의 시험이 아닌 파일과 더 깊은 자리의 시험은 정책이 아니다', () => {
    for (const file of ['scripts/ci-plan.mjs', 'scripts/checks.mjs', 'scripts/nested/x.test.ts', 'src/lib/chat/index.test.ts']) {
      expect(pr([file]).tier, file).toBe('full');
    }
  });

  it('어느 단계든 scripts 시험은 돈다 — policy 가 꺼진 단계는 verify 의 npm test 가 돈다', () => {
    for (const files of [['docs/prd.md'], ['src/lib/saju/strength/index.ts'], ['app/page.tsx']]) {
      const { lanes } = pr(files);
      expect(lanes.policy || lanes.verify, files[0]).toBe(true);
    }
  });

  it('엔진과 그것을 그리는 칸만 바뀌면 verify 만 돈다', () => {
    const plan = pr(['src/lib/saju/strength/index.ts', 'app/saju/fortune.tsx', 'docs/prd.md']);

    expect(plan.tier).toBe('engine');
    expect(plan.lanes).toEqual({ policy: false, verify: true, authed: false, flow: false });
  });

  it('모르는 파일이 하나라도 섞이면 전부 돈다', () => {
    for (const stranger of [
      'app/page.tsx',
      'app/birth-form.tsx',
      'scripts/ci-plan.mjs',
      'package.json',
      '.github/workflows/verify.yml',
      'supabase/migrations/20260101000000_x.sql',
      'e2e/match.spec.ts',
    ]) {
      const plan = pr(['src/lib/saju/strength/index.ts', stranger]);

      expect(plan.tier, stranger).toBe('full');
      expect(plan.lanes, stranger).toEqual({ policy: false, verify: true, authed: true, flow: true });
    }
  });

  it('DB 검사식이 보는 엔진 파일은 엔진 단계에 안 든다', () => {
    /** 저장되는 여덟 글자의 모양과 판본 — 로그인 뒤 자리만 빨개지는 유일한 엔진 변경 */
    for (const file of ENGINE_DB_FACING) expect(pr([file]).tier, file).toBe('full');
  });

  it('diff 를 못 받았으면 모르는 것이므로 전부 돈다', () => {
    expect(pr([]).tier).toBe('full');
    expect(pr(['', '  ']).tier).toBe('full');
  });

  it('라벨은 더할 수만 있고 뺄 수 없다', () => {
    expect(pr(['docs/prd.md'], [FULL_LABEL]).tier).toBe('full');
    /** 전부 도는 변경은 어떤 라벨로도 안 줄어든다 */
    expect(pr(['app/page.tsx'], ['docs-only', 'skip-ci', 'engine']).tier).toBe('full');
    expect(pr(['docs/prd.md'], ['docs-only']).tier).toBe('policy');
  });

  it('main 푸시 · 일정 · 손으로 켠 실행은 계획을 안 본다', () => {
    for (const event of ['push', 'schedule', 'workflow_dispatch']) {
      expect(planFor({ files: ['docs/prd.md'], event }).tier, event).toBe('full');
    }
  });

  it('요약은 단계와 차선을 사람이 읽게 적는다', () => {
    const files = ['docs/prd.md'];
    const text = summaryOf(pr(files), files);

    expect(text).toContain('`policy`');
    expect(text).toContain('| `authed` | 건너뛴다 |');
    expect(text).toContain('바뀐 파일 1개');
  });
});
