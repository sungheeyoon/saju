import { describe, expect, it } from 'vitest';

import { computeSaju } from '..';
import { CLAIM_STRENGTH_KO, CLAIM_STRENGTH_ORDER } from '../text/policy';
import { EVIDENCE_CONTRACT, evidenceOf } from '.';
import {
  PROMPTS,
  PROMPT_POLICY,
  promptBodyOf,
  promptWithEvidence,
  type PromptKind,
} from './prompt';

/**
 * 프롬프트 테스트.
 *
 * 틀리는 방식이 둘이다.
 *
 * 1. **계약이 바뀌었는데 프롬프트가 안 따라온다.** 자료는 새 규칙을 들고 나가는데
 *    받는 쪽은 옛 규칙을 읽는다.
 * 2. **해석용이 조용히 다시 조여진다.** 상한을 눈금으로 쓰는 문장은 한 줄만 흘러
 *    들어와도 모델이 입을 닫고, 그러면 넘길 이유가 사라진다. 해석용과 엄격용이
 *    **서로 반대 방향인지**를 여기서 잠근다.
 */

const saju = () =>
  computeSaju({
    year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'male',
  });

const other = () =>
  computeSaju({
    year: 1992, month: 11, day: 17, hour: 5, minute: 20, second: 0, gender: 'female',
  });

const KINDS: readonly PromptKind[] = ['reading', 'now', 'compat', 'strict', 'audit'];

/** 자료를 읽히는 셋 — 조이는 쪽(`strict`)과 되짚는 쪽(`audit`)은 성질이 다르다 */
const READING_KINDS = ['reading', 'now', 'compat'] as const;

describe('계약을 되풀이하지 않고 가리킨다', () => {
  /**
   * 사다리에 칸이 하나 생기면 이 테스트가 먼저 실패한다. 말투를 안 적으면 타입이
   * 막고(`SPEAKING_RULE`), 적었는데 프롬프트에 안 실리면 여기가 막는다.
   */
  it('사다리의 모든 칸이 이름과 우리말로 프롬프트에 선다', () => {
    // 되짚기(`audit`)는 사다리 대신 세 갈래(자료·읽기·자료 밖)를 쓴다 — 무엇을
    // 말해도 되는가가 아니라 어디서 왔는가를 묻는 자리라서다.
    for (const kind of [...READING_KINDS, 'strict'] as const) {
      const body = promptBodyOf(kind);

      for (const strength of CLAIM_STRENGTH_ORDER) {
        expect(body).toContain(`\`${strength}\``);
        expect(body).toContain(CLAIM_STRENGTH_KO[strength]);
      }
    }
  });

  /** 계약의 값이 손으로 적힌 것이 아니라 계약에서 온 것임을 잠근다 */
  it('계약 값이 프롬프트 안에 그대로 실린다', () => {
    for (const kind of [...READING_KINDS, 'strict'] as const) {
      expect(promptBodyOf(kind)).toContain(EVIDENCE_CONTRACT.version);
    }

    // 점수를 다루는 둘만 규칙 묶음 이름을 든다 — 한쪽은 막으려고, 한쪽은
    // "우리가 안 하는 것이지 네가 못 할 일이 아니다" 를 말하려고.
    expect(promptBodyOf('compat')).toContain(EVIDENCE_CONTRACT.ruleSets.compatibility);
    expect(promptBodyOf('compat')).toContain(EVIDENCE_CONTRACT.scoring);
    expect(promptBodyOf('strict')).toContain(EVIDENCE_CONTRACT.scoring);
    expect(promptBodyOf('strict')).toContain(EVIDENCE_CONTRACT.fortune);
  });

  it('바뀔 수 있는 판단이 값으로 적혀 있다', () => {
    expect(PROMPT_POLICY.ruleSet).toBe('evidence-prompt-v1');
    expect(PROMPT_POLICY.ceiling).toBe('label-in-reading-limit-in-strict');
    expect(PROMPT_POLICY.hardRule).toBe('no-invented-facts');
  });
});

describe('해석용은 막지 않고 딱지만 붙인다', () => {
  /**
   * **이 저장소가 가장 되돌리기 쉬운 자리다.** 상한을 지키는 습관이 손에 배어 있어서,
   * 해석용 프롬프트에도 「말하지 마라」가 한 줄씩 흘러든다. 그러면 모델이 입을 닫고
   * 자료를 넘길 이유가 사라진다.
   */
  it('해석용 셋은 끝까지 읽으라고 말한다', () => {
    for (const kind of READING_KINDS) {
      const body = promptBodyOf(kind);

      expect(body).toContain('막지 않는다');
      expect(body).toContain('끝까지');
      // 얕은 근거에서 멈추지 않게 한다 — 여기서 멈추면 넘긴 보람이 없다.
      expect(body).toContain('얕');
    }
  });

  /** 딱 하나만 금지다 — 조심성이 아니라 참·거짓의 문제라서다 */
  it('해석용이 금지하는 것은 지어내는 것 하나뿐이다', () => {
    for (const kind of READING_KINDS) {
      const body = promptBodyOf(kind);

      expect(body).toContain('없는 것을 지어내지 마라');
      expect(body).toContain('참·거짓의 문제');
      // 길흉·조언을 막지 않는다고 명시한다.
      expect(body).toContain('길흉도');
    }
  });

  /**
   * 점수는 이제 거절이 아니라 **분해**를 요구한다. 자료가 안 내는 것을 모델이 내는
   * 것 자체는 실험이고, 숨기는 것이 문제다.
   */
  it('궁합은 점수를 내되 배점의 출처를 밝히게 한다', () => {
    const body = promptBodyOf('compat');

    expect(body).toContain('**내 봐라.**');
    expect(body).toContain('한 덩어리 숫자로 내지 마라');
    expect(body).toContain('네가 만든 것이다');
  });

  /**
   * **딱지는 사라지지 않고 자리를 옮긴다.**
   *
   * 문장마다 `[사실 · charts.a.pillars]` 가 붙은 글은 읽히지 않는다 — 처음 나온 결과가
   * 그랬고 「테스터한테 못 보여주겠다」가 그 말이었다. 그렇다고 없애면 어디서 온
   * 말인지 알 수 없어 실험의 절반이 날아간다. 본문에서 빼고 맨 끝에 모은다.
   */
  it('딱지를 본문에서 빼고 맨 끝에 모은다', () => {
    for (const kind of READING_KINDS) {
      const body = promptBodyOf(kind);

      expect(body).toContain('본문에 달지 말고');
      expect(body).toContain('### 근거 (검사용)');
    }

    // 조이는 쪽은 여전히 문장마다 단다 — 두 프롬프트가 같으면 견줄 것이 없다.
    expect(promptBodyOf('strict')).toContain('[강도 · 근거경로]');
  });
});

/**
 * 말투와 뼈대.
 *
 * 처음 나온 결과는 딱지도 층도 다 맞았는데 **읽고 나면 「그래서 뭔데?」가 남았다.**
 * 자료를 우리말로 옮겨 적은 것이지 해석이 아니었기 때문이다. 여기서 잠그는 것은
 * 그 두 가지 — 용어를 풀게 하는가, 「그래서」를 요구하는가.
 */
describe('사주를 모르는 사람이 읽는다', () => {
  it('용어를 그 자리에서 풀게 한다', () => {
    for (const kind of READING_KINDS) {
      const body = promptBodyOf(kind);

      expect(body).toContain('읽는 사람은 **사주를 모른다.**');
      expect(body).toContain('용어는 그 자리에서 풀어라');
      // 한자 괄호로 때우는 것을 막는다 — 가장 흔한 빠져나갈 구멍이다.
      expect(body).toContain('한자를 괄호에 넣는 것은 푼 것이 아니다');
    }
  });

  it('문단마다 「그래서」를 요구한다', () => {
    for (const kind of READING_KINDS) {
      const body = promptBodyOf(kind);

      expect(body).toContain('그래서 뭔데?');
      expect(body).toContain('그래서 무엇을 하면 되는가');
    }
  });

  /** 「유연함이 핵심입니다」는 아무 말도 아니다 — 그 자리를 이름으로 막는다 */
  it('빈말을 이름으로 막는다', () => {
    for (const kind of READING_KINDS) {
      const body = promptBodyOf(kind);

      expect(body).toContain('조율이 필요합니다');
      expect(body).toContain('언제, 어떤 상황에서, 무엇을 하라');
    }
  });

  /** 「金이 33.12%」는 읽는 사람에게 아무 뜻이 없다 */
  it('숫자를 셀 수 있는 말로 바꾸게 한다', () => {
    for (const kind of READING_KINDS) {
      expect(promptBodyOf(kind)).toContain('셀 수 있는 말로 바꿔라');
    }
  });

  /** 뼈대가 없으면 모델이 절 이름부터 지어내고, 그러면 견줄 수가 없다 */
  it('세 프롬프트가 저마다 절 이름을 못박는다', () => {
    expect(promptBodyOf('reading')).toContain('**3. 잘하는 것 다섯**');
    expect(promptBodyOf('reading')).toContain('**4. 걸리는 것 넷**');
    expect(promptBodyOf('now')).toContain('**4. 이번 달**');
    expect(promptBodyOf('now')).toContain('밀어붙일 것 하나, 미룰 것 하나');
    expect(promptBodyOf('compat')).toContain('**4. 부딪히는 지점 셋**');
  });

  /**
   * **셋에서 멈추면 뻔한 것만 남는다.** 처음 나온 글이 강점 셋·약점 셋이었고,
   * 그 여섯 줄은 어느 명식에 갖다 붙여도 크게 안 틀릴 말이었다. 개수를 늘리면
   * 모델이 자료를 더 깊이 뒤져야 한다.
   */
  it('강점과 약점을 셋에서 멈추지 않게 한다', () => {
    const body = promptBodyOf('reading');

    expect(body).toContain('다섯을 채워라');
    expect(body).toContain('셋에서 멈추면 뻔한 것만 남는다');
  });

  /**
   * **살림법이 이 글에서 가장 손에 잡히는 자리다.**
   *
   * 「목이 용신이다」로 끝나면 읽는 사람은 무엇을 해야 할지 모른다. 신살과 없는
   * 오행과 조후를 함께 보고 **오늘부터 할 수 있는 것**까지 가야 한다.
   */
  it('살림법 절이 신살과 부족한 오행을 함께 읽게 한다', () => {
    const body = promptBodyOf('reading');

    expect(body).toContain('**8. 살림법 — 무엇을 늘리고 무엇을 줄일까**');
    expect(body).toContain('오늘부터 할 수 있는 것');
    expect(body).toContain('charts.a.sinsal.stars');
    expect(body).toContain('analysis.elements.missing');
    // 걸리지도 않은 신살을 끌어오는 것이 이 절에서 가장 쉬운 거짓말이다.
    expect(body).toContain('없는 신살을 끌어오지 마라');
    // 지금 도는 운 쪽에도 그 달의 살림법이 있다.
    expect(promptBodyOf('now')).toContain('**7. 이번 달 살림법**');
  });

  /** 사람들이 실제로 들고 오는 물음을 자료가 닿는 데까지 다룬다 */
  it('자주 묻는 것을 다루되 못 가는 곳은 못 간다고 말하게 한다', () => {
    const body = promptBodyOf('reading');

    expect(body).toContain('**10. 자주 묻는 것**');
    expect(body).toContain('이 자료로는 거기까지 못 간다');
    // 날짜 점치기가 이 자리에서 가장 흔한 미끄러짐이다.
    expect(body).toContain('특정 사건의 날짜는 이 자료로 못 짚는다');
  });

  /**
   * 살(殺) 이름으로 겁주는 것과 귀인 이름으로 안심시키는 것은 같은 잘못이다 —
   * 둘 다 이름을 판정으로 바꾼다.
   */
  it('신살 이름으로 겁주지 않게 한다', () => {
    for (const kind of READING_KINDS) {
      expect(promptBodyOf(kind)).toContain('살(殺)은 저주가 아니라 조건이다');
    }
  });

  /**
   * **신살이 성격을 정하지 않는다.**
   *
   * 처음 나온 글의 「천을귀인·문창귀인을 깔고 앉아 두뇌 회전이 빠르고」가 그 자리다.
   * 딱지는 제대로 달려 있었는데 그 문장을 쓴 것은 자료가 아니라 신살 이름이었고,
   * 같은 신살을 가진 사람이 수천만이라 누구에게 붙여도 맞는 말이 된다.
   *
   * 성격을 다루는 둘(`reading`·`compat`)에만 붙인다 — `now` 는 성격을 안 읽는다.
   */
  it('성격은 신살보다 원국 구조를 먼저 보게 한다', () => {
    for (const kind of ['reading', 'compat'] as const) {
      const body = promptBodyOf(kind);

      expect(body).toContain('**신살이 성격을 정하지 않는다.**');
      expect(body).toContain('신살 하나로 성격을 단정하지 않는다');
      // 개수로 세기는 관계에서 막은 것과 같은 잘못이다.
      expect(body).toContain('여러 자리에 걸렸다고 그 성향이 몇 배가 되지 않는다');
      // 순서의 처음과 끝이 뒤집히면 이 절이 아무것도 안 한다.
      expect(body.indexOf('일간과 월령')).toBeLessThan(body.indexOf('신살과 길성'));
    }

    expect(promptBodyOf('now')).not.toContain('**신살이 성격을 정하지 않는다.**');
  });

  /**
   * 어긋나는 자리를 **긴장**으로 읽게 하는 것이 이 규칙에서 값을 내는 대목이다.
   * 신살로 앞을 뒤집으면 아무 말이나 되고, 신살을 버리면 밋밋해진다.
   */
  it('신살이 구조와 어긋나면 긴장으로 읽게 한다', () => {
    for (const kind of ['reading', 'compat'] as const) {
      const body = promptBodyOf(kind);

      expect(body).toContain('신살로 앞을 뒤집지 말고');
      expect(body).toContain('긴장');
    }
  });

  /**
   * **완충이 애매함의 허가가 되면 글이 물러진다.** 근거 하나면 「~경향이 있다」로
   * 쓰라는 규칙이 그렇게 읽히기 쉬워서, 구체성은 그대로라는 줄을 함께 단다.
   */
  it('완충한 문장도 구체적이어야 한다고 못박는다', () => {
    for (const kind of ['reading', 'compat'] as const) {
      const body = promptBodyOf(kind);

      expect(body).toContain('불확실함의 표시이지 애매하게 말해도 된다는 허가가 아니다');
      expect(body).toContain('그 하나가 무엇인지 밝혀라');
    }
  });

  /** 상한과 성격 순서는 다른 축이다 — 섞이면 둘 다 흐려진다 */
  it('성격 순서가 상한과 다른 축임을 밝힌다', () => {
    expect(promptBodyOf('reading')).toContain('`claims` 의 상한과 **다른 축**이다');
  });

  /**
   * 오행의 시간대·방위·색 대응은 자료에 없다. 가져다 쓰는 것은 되고, 자료가
   * 준 것처럼 말하는 것은 안 된다.
   */
  it('자료에 없는 대응표는 자료 밖이라고 적게 한다', () => {
    for (const kind of READING_KINDS) {
      const body = promptBodyOf(kind);

      expect(body).toContain('어느 시간대·방위·색·계절에 붙는지는 이 자료에 없다');
      expect(body).toContain('자료가 준 것처럼 말하는 것은 안 된다');
      // 적는 자리는 **절**이다 — 근거 칸이 절마다 한 줄이므로 문단이라고 적으면 단위가 갈린다.
      expect(body).toContain('절의 근거 줄에');
    }
  });

  /**
   * **층과 갈래 수가 같은 것을 두고 다투고 있었다.**
   *
   * 사다리는 층마다 말투를 정하고(`fact: 단정해서 써라`) 「얼마나 세게 말할까」는
   * 근거 개수로 말투를 정한다(`근거가 하나면 ~경향이 있다`). 층이 `사실` 인데 근거가
   * 하나인 값에서 둘이 정확히 반대를 가리켰다 — 모델이 그때마다 하나를 골라야 하고,
   * 고르는 기준이 없으면 같은 글 안에서도 갈린다.
   *
   * 관계를 못박는다: **층은 천장이고 갈래 수가 그 아래의 실제 강도다.** 다투면 낮은 쪽.
   */
  it('층은 천장이고 갈래 수가 그 아래를 정한다', () => {
    // 엄격용은 빠진다. 거기서는 사다리가 **눈금**이라 천장이 곧 답이고
    // (`CEILING_RULE`), 갈래 수와 다툴 자리 자체가 없다.
    for (const kind of READING_KINDS) {
      const body = promptBodyOf(kind);

      expect(body).toContain('층은 천장이다');
      expect(body).toContain('낮은 쪽');
    }
  });

  /**
   * **원국의 관계와 운의 관계는 다른 것을 말한다.**
   *
   * 자료는 이미 `chartId` 로 갈라 놓았는데(`natal`·`decade`·`annual`·`monthly`)
   * 섞지 말라는 말이 없었다. 원국의 충을 「올해 생긴 일」로 옮기면 그 문장은 해마다
   * 참이 되어 아무것도 말하지 않고, 올해 걸린 것을 타고난 성향으로 적으면 내년에
   * 거짓이 된다.
   */
  it('원국 관계와 운의 관계를 섞지 못하게 한다', () => {
    // 엄격용은 제 규칙으로 같은 것을 든다 — 「누구의, 어느 판의 글자인지 밝힌다」.
    for (const kind of READING_KINDS) {
      const body = promptBodyOf(kind);

      expect(body).toContain('어느 칸의 관계인지 섞지 마라');
      // 운이 하는 일이 무엇인지까지 적어야 「그럼 어떻게 쓰나」가 남지 않는다.
      expect(body).toContain('운은 없던 성질을 만들지 않는다');
    }
  });

  /** 직업 이름을 못박으면 틀렸을 때 통째로 틀린다 — 조건으로 말하게 한다 */
  it('직업을 이름이 아니라 조건으로 말하게 한다', () => {
    expect(promptBodyOf('reading')).toContain('직업 이름을 못박지 말고 조건으로');
  });
});

describe('견줄 짝과 되짚는 자리', () => {
  /** 조인 것과 푼 것을 같은 자료로 돌려 봐야 무엇이 상한 덕인지 갈린다 */
  it('엄격용은 옛 규율을 그대로 든다', () => {
    const body = promptBodyOf('strict');

    expect(body).toContain('점수도 등급도 만들지 않는다');
    expect(body).toContain('길흉을 말하지 않는다');
    expect(body).toContain('용신을 확정하지 않는다');
    expect(body).toContain('상한에 막혀 못 쓴 것');
  });

  it('되짚기는 붙여 넣을 자리를 두고 해석 자체를 문제 삼지 않는다', () => {
    const body = promptBodyOf('audit');

    expect(body).toContain('<<<');
    expect(body).toContain('>>>');
    // 세 갈래로 가른다 — 「틀렸다」가 아니라 「어디서 왔나」다.
    expect(body).toContain('자료 밖');
    expect(body).toContain('없는 문제를 만들지 마라');
  });
});

describe('자료와 한 덩어리로 나간다', () => {
  it('역할 · 한눈에 · 규칙 · 자료 순서로 선다', () => {
    const evidence = evidenceOf({ a: saju() }, new Date('2026-08-23T04:00:00Z'));
    const text = promptWithEvidence('reading', evidence);

    const order = ['# 역할', '## 한눈에', '## 사실에 관한 단 하나의 금지', '## 자료', '```json'];
    const at = order.map((mark) => text.indexOf(mark));

    for (const index of at) expect(index).toBeGreaterThan(-1);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
  });

  /**
   * 머리를 끼우는 자리가 **암묵**이다 — 역할 문단과 첫 절 사이. 프롬프트를 새로
   * 쓰면서 `# 역할` 로 안 열면 머리가 엉뚱한 데 들어가는데, 그것은 눈으로만 보인다.
   */
  it('다섯 프롬프트가 모두 역할 문단으로 열고 그다음이 절이다', () => {
    for (const kind of KINDS) {
      const [role, ...rest] = promptBodyOf(kind).split(/\n\n(?=## )/);

      expect(role.startsWith('# 역할')).toBe(true);
      expect(rest.length).toBeGreaterThan(0);
    }
  });

  /**
   * 머리는 **다시 세지 않는다.** 여기서 간지를 새로 구하면 머리와 자료가 언젠가
   * 어긋나고, 어긋난 날 어느 쪽이 맞는지 알 수 없다.
   */
  it('한눈에가 자료의 값을 그대로 옮긴다', () => {
    const evidence = evidenceOf({ a: saju() }, new Date('2026-08-23T04:00:00Z'));
    const text = promptWithEvidence('reading', evidence);
    const { pillars, now } = evidence.charts.a;

    for (const pillar of [pillars.year, pillars.month, pillars.day, pillars.hour]) {
      expect(text).toContain(pillar!.name);
    }
    expect(text).toContain(`일간 ${pillars.dayMaster}`);
    expect(text).toContain(pillars.meta.monthTerm.name);
    expect(text).toContain(now.saeun.pillar.name);
    expect(text).toContain(evidence.viewedAt);
    // 사람을 이름으로 부르지 않는다 — 모델이 아래 JSON 에서 찾아갈 이름을 적는다.
    expect(text).toContain('`charts.a`');
  });

  /** 두 사람이면 두 벌이 서고, 한 사람이면 한 벌이다 */
  it('한눈에가 사람 수를 따라간다', () => {
    const at = new Date('2026-08-23T04:00:00Z');

    expect(promptWithEvidence('reading', evidenceOf({ a: saju() }, at))).not.toContain(
      '`charts.b`',
    );
    expect(
      promptWithEvidence('compat', evidenceOf({ a: saju(), b: other() }, at)),
    ).toContain('`charts.b`');
  });

  /** 시각을 모르면 시주 자리가 비었다고 적힌다 — 빈칸으로 두면 안 적은 것과 같다 */
  it('시간 미상이면 시주 자리가 그렇다고 말한다', () => {
    const hourless = computeSaju({ year: 1990, month: 5, day: 15, hour: null, gender: 'male' });
    const text = promptWithEvidence('reading', evidenceOf({ a: hourless }, new Date()));

    expect(text).toContain('시간 미상');
  });

  /**
   * 들여쓰면 두 사람짜리가 네 배가 된다. 붙여 넣는 자리에서 그것은 읽기 좋음이
   * 아니라 무게다 — 자료를 눈으로 볼 자리는 화면에 따로 있다.
   */
  it('자료는 들여쓰지 않고 실린다', () => {
    const evidence = evidenceOf({ a: saju(), b: other() }, new Date('2026-08-23T04:00:00Z'));
    const text = promptWithEvidence('compat', evidence);

    expect(text).toContain(JSON.stringify(evidence));
    expect(text).not.toContain(JSON.stringify(evidence, null, 2));
  });

  /** 궁합만 두 사람이 있어야 뜻이 있다 — 화면이 그 값으로 고른다 */
  it('두 사람이 필요한 프롬프트가 값으로 표시된다', () => {
    const byKind = Object.fromEntries(PROMPTS.map((p) => [p.kind, p.needsTwo]));

    expect(byKind.compat).toBe(true);
    expect(byKind.reading).toBe(false);
    expect(byKind.strict).toBe(false);
    expect(PROMPTS.map((p) => p.kind).sort()).toEqual([...KINDS].sort());
  });
});
