import { OUR_WORDS_PHRASES } from "./data/our-words";
import { WORD_LEARNING_PHRASES } from "./data/word-learning";
import type { GameKind } from "./engine";

export const GAME_KINDS: readonly { kind: GameKind; label: string }[] = [
  { kind: "word-learning", label: "단어 학습" },
  { kind: "our-words", label: "우리말 학습" },
];

export function phrasesFor(kind: GameKind): readonly string[] {
  return kind === "word-learning" ? WORD_LEARNING_PHRASES : OUR_WORDS_PHRASES;
}
