import { won } from '../reading/bundle';
import { bundlePrice, refundOf } from './bundle-prices';
import { type BusinessInfo, businessInfoLines, contactPlace } from './business';
import { type LegalDocument, type LegalSection, bullets, para, table } from './legal-text';

/**
 * **환불정책 — 공개 주소 `/refund` 에 서는 글**(운영자 결정 2026-10-07 게시 · 2026-10-12 사업자 값은 환경변수, ADR 0172).
 *
 * 청약철회 기간이 지난 뒤 단순 변심 환불의 10% 환불수수료(생성 실패 · 정지 · 해지 · 서비스 종료는 공제하지 않는다)은 ADR 0192(운영자 결정 · 문구
 * 2026-10-20)다. 「얼마를 돌려받나요」의 「나눈 뒤 곱해요」는 설명 순서다 — 셈은 `refundOf` 대로 곱한 뒤 나눈다.
 * 유효기간(유료 5년 · 무료 1년 — 시행일 전에 받은 무료 몫은 시행일부터 1년)은 ADR 0173(운영자 결정 2026-10-12)이다. 원본은 `docs/legal/refund-policy.md` 의 「만날지도 환불정책」이고, 그 글은 약관 제12조 ~ 제17조의2 를 쉬운 말로 옮긴 것이다 —
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
                '산 풀이권의 유효기간은 산 날부터 5년이에요. 지나면 남은 유료 풀이권은 사라져요.',
                '안 쓴 유료 풀이권은 유효기간 안에 환불받을 수 있어요. 청약철회 기간(7일)이 지난 뒤 단순 변심으로 환불하면, 미사용분에 해당하는 금액의 90%를 돌려드려요.',
                '청약철회 기간은 계약내용을 받은 날부터 7일이에요. 풀이권을 그보다 늦게 제공받았다면 제공받은 날부터 계산해요.',
                '돌려드리는 돈은 낸 돈 × 안 쓴 장수 ÷ 산 장수예요.',
                '이미 받아 본 풀이는 마음이 바뀌었다는 이유로는 돌려드리지 않아요. 풀이가 안 만들어졌거나 안내와 다르면 다시 만들어 드리거나 돌려드려요.',
                '처음 받는 무료 풀이권은 받은 날부터 1년이 지나면 사라지고, 돈으로 바꿔 드리지 않아요. 이 정책의 시행일 전에 받은 무료 풀이권은 시행일부터 1년이에요.',
              ),
            ],
          },
          {
            title: '얼마를 돌려받나요',
            blocks: [
              para(
                '실제 결제한 금액을 구매한 유료 풀이권 수로 나눈 뒤, 환불할 장수를 곱해요. 사용한 풀이권을 낱장 가격으로 다시 계산하지 않아요. 청약철회 기간이 지난 뒤 단순 변심으로 환불하면, 이렇게 계산한 금액의 10%를 환불수수료로 공제해요.',
              ),
              para('풀이 생성 실패, 서비스 종료, 이용 정지·해지로 환불하는 경우에는 환불수수료를 공제하지 않아요.'),
              {
                kind: 'table',
                table: table(
                  ['이런 경우', '청약철회 기간 내', '기간 경과 후 단순 변심'],
                  ...([
                    [20, 3, `20장 묶음(${won(bundlePrice(20))})에서 3장 썼어요`],
                    [20, 12, `20장 묶음(${won(bundlePrice(20))})에서 12장 썼어요`],
                    [5, 1, `5장 묶음(${won(bundlePrice(5))})에서 1장 썼어요`],
                    [3, 1, `3장 묶음(${won(bundlePrice(3))})에서 1장 썼어요`],
                    [1, 0, `1장 묶음(${won(bundlePrice(1))})을 안 썼어요`],
                  ] as const).map(([credits, used, label]) => [
                    label,
                    won(refundOf(credits, used, false)),
                    won(refundOf(credits, used, true)),
                  ]),
                ),
              },
              para('여러 번 나눠 돌려받아도 한 번에 돌려받을 때와 합계가 같아요.'),
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
                '유효기간(산 날부터 5년)이 지나 사라진 풀이권',
                '인연 궁합 요청에 걸려 있는 풀이권 — 상대의 답을 기다리는 동안만이에요. 요청을 취소하면 바로 풀려서 돌려받을 수 있어요.',
              ),
            ],
          },
          {
            title: '이럴 땐 꼭 돌려드려요',
            blocks: [
              bullets(
                '풀이가 만들어지지 않았거나 안내와 다르게 나왔을 때 — 다시 만들어 드리거나 환불수수료를 공제하지 않고 돌려드려요. 만들다 실패한 풀이는 애초에 풀이권을 쓰지 않아요.',
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
                `탈퇴해도 돌려받을 권리는 사라지지 않아요. 그 묶음의 유효기간(산 날부터 5년) 안에 ${contact}로 주문 번호나 결제 내역을 알려 주시면 같은 계산으로 돌려드려요.`,
                '무료 풀이권은 탈퇴와 함께 사라져요.',
              ),
            ],
          },
          {
            title: '이용이 정지되거나 해지되었을 때',
            blocks: [para('남은 유료 풀이권은 같은 계산으로, 환불수수료를 공제하지 않고 돌려받을 수 있어요.')],
          },
          {
            title: '서비스가 끝날 때',
            blocks: [
              bullets(
                '끝나는 날의 30일 전까지 서비스 안과 이메일로 알려 드리고, 그날부터 풀이권을 팔지 않아요.',
                '안 쓴 유료 풀이권은 같은 계산으로, 환불수수료를 공제하지 않고 돌려드려요. 알림 기간이 지났다고 돌려받을 권리가 사라지지 않아요.',
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

/**
 * **환불을 어디로 어떻게 신청하나 — 결제 내역 화면의 환불 신청 칸**(G-21, ADR 0174).
 *
 * 전자상거래법 제13조②5 는 계약 전에 청약철회의 기한 · 방법 · 효과를 알리라고 한다 — 기한은 결제 화면의 유효기간 줄이, 효과는
 * 미사용분 · 사용분 줄이 말하고, 이 줄이 **방법**을 말한다. 내용은 위 「어떻게 신청하나요」와 같다(이메일로 · 3영업일 안에 ·
 * 결제한 수단으로). 이메일이 비면 주소 없이 「고객센터로」다 — 빈칸 표지를 내지 않는다.
 *
 * 결제 화면은 2026-10-12 부터 아래 `checkoutRefundLine` 의 합니다체 유의사항 줄을 싣는다(ADR 0175) — 이 줄은 결제 내역 화면에만 남았다.
 */
export function refundRequestLine(info: BusinessInfo): string {
  const where = info.email ? `이메일(${info.email})로` : '고객센터로';
  return `환불은 ${where} 신청하면 3영업일 안에 결제한 수단으로 돌려드려요.`;
}

/**
 * **결제 화면 유의사항의 둘째 줄 — 환불을 어디로 어떻게 신청하나**(운영자 승인 2026-10-12, ADR 0175 · 대장 credits-03).
 *
 * 리디 충전 화면의 작은 글씨 유의사항 꼴이다. 뜻은 위 `refundRequestLine` 과 같고(이메일로 · 3영업일 안에 · 결제한 수단으로),
 * 금전 고지라 합니다체다. 이메일이 비면 「고객센터로」 — #671 의 대체와 같은 말이다.
 */
export function checkoutRefundLine(info: BusinessInfo): string {
  const where = info.email ? `이메일(${info.email})로` : '고객센터로';
  return `환불은 ${where} 신청할 수 있으며, 3영업일 이내에 결제한 수단으로 환불합니다.`;
}
