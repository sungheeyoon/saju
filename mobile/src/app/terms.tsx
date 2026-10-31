import { SERVICE_NAME } from '@brand';
import { termsFor } from '@brand/terms';

import { appBusinessInfo } from '@/info/business';
import { InfoLine, InfoScreen, LegalHead } from '@/info/frame';
import { HomeButton } from '@/info/home-button';
import { LegalBody } from '@/info/legal-body';
import { Card } from '@/ui/surfaces';

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;

/** 이용약관 — 웹의 `/terms` 와 같은 `termsFor` 다. 약관 제1조가 서비스 주소를 적으므로 주소가 없는 빌드에는 글을 세우지 않는다 */
export default function TermsScreen() {
  const terms = SITE_URL ? termsFor(appBusinessInfo(), new URL(SITE_URL).origin) : null;
  return (
    <InfoScreen title="이용약관" fallback="/">
      <LegalHead title={`${SERVICE_NAME} 이용약관`} note={terms?.effectiveDate ? '시행일 ' + terms.effectiveDate : null} />
      {terms === null ? (
        <Card>
          <InfoLine>화면을 불러오지 못했어요</InfoLine>
        </Card>
      ) : (
        <LegalBody document={terms} />
      )}
      <HomeButton />
    </InfoScreen>
  );
}
