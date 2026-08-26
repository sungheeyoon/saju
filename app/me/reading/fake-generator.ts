import type { ModelCall, ReadingGeneration, ReadingGenerator } from './generator';

const FAKE_GENERATION: ReadingGeneration = {
  model: 'fake/reading',
  provider: 'fake',
  settings: {},
};

/** 테스트가 실제 redaction·prompt·검사를 지나면서 모델 호출만 바꿔 끼우는 fake. */
export class FakeReadingGenerator implements ReadingGenerator {
  readonly prompts: string[] = [];

  constructor(
    private next: ModelCall,
    readonly generation: ReadingGeneration = FAKE_GENERATION,
  ) {}

  respondWith(next: ModelCall): void {
    this.next = next;
  }

  async generate(prompt: string): Promise<ModelCall> {
    this.prompts.push(prompt);
    return this.next;
  }
}
