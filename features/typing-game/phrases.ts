import { COMMON_WORD_PHRASES } from "./data/common-words";
import { MEANING_PAIR_PHRASES } from "./data/meaning-pairs";
import type { GameKind } from "./engine";

export const GAME_KINDS: readonly { kind: GameKind; label: string }[] = [
  { kind: "word-learning", label: "단어" },
  { kind: "our-words", label: "우리말" },
];

export function phrasesFor(kind: GameKind): readonly string[] {
  return kind === "word-learning" ? COMMON_WORD_PHRASES : MEANING_PAIR_PHRASES;
}
