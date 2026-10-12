import { previewFor } from '../../preview';
import { SAJU_SHARE_EYEBROW, SAJU_SHARE_INVITATION } from '../../saju-share';
import { SharedReadingView } from '../../view';

export const metadata = previewFor('person');

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <SharedReadingView
      token={token}
      expect="person"
      eyebrow={SAJU_SHARE_EYEBROW}
      invitation={SAJU_SHARE_INVITATION}
    />
  );
}
