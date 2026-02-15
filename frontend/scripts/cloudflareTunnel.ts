const TRYCLOUDFLARE_URL_PATTERN = /(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i;

export function extractTryCloudflareUrl(line: string): string | null {
  const match = line.match(TRYCLOUDFLARE_URL_PATTERN);
  return match ? match[1] : null;
}
