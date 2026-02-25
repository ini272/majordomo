import { expect, test } from "@playwright/test";

test("landing page shows app branding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "MAJORDOMO" })).toBeVisible();
});

test("board route is reachable", async ({ page }) => {
  await page.goto("/board");
  await expect(page).toHaveURL(/\/board$/);
});
