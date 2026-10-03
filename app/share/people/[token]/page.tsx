import { previewFor } from '../../preview';
import { SharedReadingView } from '../../view';

export const metadata = previewFor('person');

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <SharedReadingView
      token={token}
      expect="person"
      eyebrow="공유받은 사주풀이"
      invitation={{
        heading: '나는 어떤 사주일까요?',
        note: '생일만 넣으면 내 여덟 글자와 오행을 지금 바로 볼 수 있어요.',
      }}
    />
  );
}
