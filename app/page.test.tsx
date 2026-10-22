import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import Home from "@/app/page";

test("홈 화면은 타자 연습 게임의 제목과 시작 버튼을 보여준다", () => {
  render(<Home />);

  expect(
    screen.getByRole("heading", { level: 1, name: "우리말 타자 연습" })
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "게임 시작" })).toBeInTheDocument();
});
