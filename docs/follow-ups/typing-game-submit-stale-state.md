# 입력 제출이 렌더 시점의 낡은 상태를 기준으로 계산됨

- 증상: `features/typing-game/typing-game.tsx`의 `submit`이 렌더에 캡처된 `game`으로 `submitInput`을 계산한 뒤 `setGame(state)`로 통째로 덮어씁니다. 같은 프레임의 tick 결과가 되돌려질 수 있습니다.
- 근거: 코드 리뷰(low)가 지적했고, 실제 재현은 하지 않았습니다. 영향 범위는 한 프레임(약 16ms) 안의 낙하와 놓침입니다.
- 의심 원인: 함수형 갱신(`setGame((current) => ...)`)을 쓰지 않은 것.
- 다음 단계: 함수형 갱신으로 바꾸되, 제거된 문구(`removed`)는 갱신 안에서 받아 burst에 넘기는 방식을 정합니다.
