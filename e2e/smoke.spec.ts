import { expect, test } from "@playwright/test";

test("홈 화면이 열리고 게임 시작 버튼이 보인다", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("우리말 타자 연습");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "우리말 타자 연습"
  );
  await expect(page.getByRole("button", { name: "게임 시작" })).toBeVisible();
});
