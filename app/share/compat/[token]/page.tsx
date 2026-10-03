import { previewFor } from '../../preview';
import { SharedReadingView } from '../../view';

export const metadata = previewFor('private');

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <SharedReadingView
      token={token}
      expect="private"
      eyebrow="공유받은 궁합풀이"
      invitation={{
        heading: '우리 둘은 어떤 궁합일까요?',
        note: '첫 화면의 「궁합 보기」에서 두 사람의 생일을 넣으면 궁합의 첫 신호를 바로 볼 수 있어요.',
      }}
    />
  );
}
