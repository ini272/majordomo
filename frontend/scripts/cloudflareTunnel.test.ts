import { describe, expect, test } from "bun:test";

import { extractTryCloudflareUrl } from "./cloudflareTunnel";

describe("extractTryCloudflareUrl", () => {
  test("extracts URL from quick tunnel output line", () => {
    const line =
      "2026-02-15T22:18:42Z INF +--------------------------------------------------------------------------------------------+";
    expect(extractTryCloudflareUrl(line)).toBeNull();
  });

  test("extracts trycloudflare URL when present", () => {
    const line =
      "2026-02-15T22:18:42Z INF |  https://regards-oakland-believed-coverage.trycloudflare.com                                     |";
    expect(extractTryCloudflareUrl(line)).toBe("https://regards-oakland-believed-coverage.trycloudflare.com");
  });

  test("returns null when no URL is present", () => {
    const line = "2026-02-15T22:18:42Z INF Initial protocol quic";
    expect(extractTryCloudflareUrl(line)).toBeNull();
  });
});
