import { type BusinessInfo, businessInfoLines, contactPlace } from './business';
import { type LegalDocument, type LegalSection, bullets, para, table } from './legal-text';

/**
 * **환불정책 — 공개 주소 `/refund` 에 서는 글**(운영자 결정 2026-10-07 게시 · 2026-10-12 사업자 값은 환경변수, ADR 0172).
 *
 * 원본은 `docs/legal/refund-policy.md` 의 「만날지도 환불정책」이고, 그 글은 약관 제12조 ~ 제17조의2 를 쉬운 말로 옮긴 것이다 —
 * 새 규칙을 만들지 않는다. 사업자 빈칸은 `BusinessInfo` 에서 채우고, 값이 없으면 그 말을 빼거나 「판매자 정보의 연락처」로 가리킨다.
 * 「［서비스 안 결제 내역에 신청 칸이 생기면 …］」처럼 화면이 아직 없는 길은 싣지 않았다.
 */
export const REFUND_EFFECTIVE_DATE: string | null = null;

export function refundPolicyFor(info: BusinessInfo): LegalDocument {
  const seller = businessInfoLines(info).map((line) => `${line.label} ${line.value}`);
  const contact = contactPlace(info, '아래 판매자 정보의 연락처');

  const sellerSection: LegalSection[] =
    seller.length > 0 ? [{ title: '판매자 정보', blocks: [bullets(...seller)] }] : [];

  return {
    effectiveDate: REFUND_EFFECTIVE_DATE,
    parts: [
      {
        title: null,
        sections: [
          {
            title: '한눈에',
            blocks: [
              bullets(
                '산 풀이권은 기한이 없어요. 자동으로 사라지지 않아요.',
                '안 쓴 유료 풀이권은 언제든 돌려드려요. 산 지 7일이 지나도 똑같이, 수수료 없이요.',
                '돌려드리는 돈은 낸 돈 × 안 쓴 횟수 ÷ 산 횟수예요.',
                '이미 받아 본 풀이는 마음이 바뀌었다는 이유로는 돌려드리지 않아요. 풀이가 안 만들어졌거나 안내와 다르면 다시 만들어 드리거나 돌려드려요.',
                '처음 받는 무료 풀이권은 돈으로 바꿔 드리지 않아요.',
              ),
            ],
          },
          {
            title: '얼마를 돌려받나요',
            blocks: [
              para(
                '묶음마다 실제로 낸 돈 × 안 쓴 유료 횟수 ÷ 그 묶음의 유료 횟수예요. 쓴 횟수를 1회권 값으로 다시 계산하지 않고, 수수료도 떼지 않아요.',
              ),
              {
                kind: 'table',
                table: table(
                  ['이런 경우', '돌려드리는 돈'],
                  ['20회권(59,000원)에서 3회 썼어요', '50,150원'],
                  ['20회권(59,000원)에서 12회 썼어요', '23,600원'],
                  ['5회권(19,900원)에서 1회 썼어요', '15,920원'],
                  ['3회권(12,900원)에서 1회 썼어요', '8,600원'],
                  ['1회권(4,900원)을 안 썼어요', '4,900원'],
                ),
              },
              para('여러 번 나눠 돌려받아도, 묶음을 다 돌려받으면 합계가 낸 돈과 같아요(원 아래는 버려요).'),
            ],
          },
          {
            title: '어떤 풀이권부터 쓴 걸로 보나요',
            blocks: [
              para(
                '무료 풀이권 → 운영자가 따로 드린 풀이권 → 먼저 산 묶음 순서로 쓴 걸로 봐요. 그래서 안 쓴 무료 풀이권이 돈으로 바뀌는 일은 없어요.',
              ),
            ],
          },
          {
            title: '돌려드리지 않는 것',
            blocks: [
              bullets(
                '이미 정상으로 받아 본 풀이 — 사기 전에 무료 풀이권으로 한 편을 먼저 받아 볼 수 있고, 결제 화면에서 이 점을 알려 드려요.',
                '무료 풀이권과 운영자가 따로 드린 풀이권 — 돈을 받지 않고 드린 것이라서요.',
                '인연 궁합 요청에 걸려 있는 풀이권 — 상대의 답을 기다리는 동안만이에요. 요청을 거두면 바로 풀려서 돌려받을 수 있어요.',
              ),
            ],
          },
          {
            title: '이럴 땐 꼭 돌려드려요',
            blocks: [
              bullets(
                '풀이가 만들어지지 않았거나 안내와 다르게 나왔을 때 — 다시 만들어 드리거나 그 횟수를 돌려드려요. 만들다 실패한 풀이는 애초에 풀이권을 쓰지 않아요.',
                '받은 날부터 3개월 안, 다르다는 걸 안 날부터 30일 안에는 쓴 것까지 돌려받을 수 있어요(전자상거래법 제17조③).',
              ),
            ],
          },
          {
            title: '어떻게 신청하나요',
            blocks: [
              bullets(
                `${contact}로 주문 번호나 결제 내역을 알려 주세요.`,
                '신청을 받은 날부터 3영업일 안에 결제한 방법으로 돌려드려요. 카드 결제는 카드사에 취소를 요청해요.',
              ),
            ],
          },
          {
            title: '탈퇴할 때',
            blocks: [
              bullets(
                '탈퇴하기 전에 남은 유료 풀이권 수와 환불 신청 방법을 보여 드려요.',
                `탈퇴해도 돌려받을 권리는 사라지지 않아요. 결제 기록을 보관하는 동안(마지막 결제·환불일부터 5년) ${contact}로 주문 번호나 결제 내역을 알려 주시면 같은 금액을 돌려드려요.`,
                '무료 풀이권은 탈퇴와 함께 사라져요.',
              ),
            ],
          },
          {
            title: '이용이 정지되거나 해지되었을 때',
            blocks: [para('남은 유료 풀이권은 같은 계산으로 돌려받을 수 있어요.')],
          },
          {
            title: '서비스가 끝날 때',
            blocks: [
              bullets(
                '끝나는 날의 30일 전까지 서비스 안과 이메일로 알려 드리고, 그날부터 풀이권을 팔지 않아요.',
                '안 쓴 유료 풀이권은 같은 계산으로, 수수료 없이 돌려드려요. 알림 기간이 지났다고 돌려받을 권리가 사라지지 않아요.',
              ),
            ],
          },
          ...sellerSection,
        ],
      },
    ],
  };
}

/** 환불정책 끝의 한 줄 — 화면이 「이용약관」 글자에 `/terms` 링크를 건다 */
export const REFUND_TERMS_POINTER = { before: '자세한 내용은 ', link: '이용약관', after: '의 제12조 ~ 제17조의2 를 따라요.' } as const;
