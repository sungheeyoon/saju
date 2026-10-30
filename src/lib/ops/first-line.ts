/** 메모 · 판단 근거의 첫 줄 — 확인창의 사유 칸에 선다(신고 처분 · 무상 지급 · 이용 정지가 함께 쓴다, G-114) */
export const firstLine = (note: string): string => note.trim().split('\n')[0]?.trim() ?? '';
