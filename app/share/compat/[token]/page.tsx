import { previewFor } from '../../preview';
import { SharedReadingView } from '../../view';

export const metadata = previewFor('private');

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <SharedReadingView
      token={token}
      expect="private"
      eyebrow="공유받은 궁합 풀이"
      invitation={{
        heading: '우리 사이도 읽어 보세요',
        note: '두 사람의 생년월일시를 넣으면 명식을 나란히 세우고, 그 근거로 궁합 풀이를 받습니다.',
      }}
    />
  );
}
