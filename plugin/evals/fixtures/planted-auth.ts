// Planted auth bug for review evals.
export function rateLimitKey(req: { headers: Record<string, string>; ip: string }): string {
  return req.headers["x-api-key"] ?? req.ip;
}
