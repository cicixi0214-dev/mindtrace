// Token budget tracker
// In-memory for single-user. Resets daily/monthly.

const DAILY_LIMIT = Number(process.env.DAILY_TOKEN_LIMIT) || 50_000;
const MONTHLY_LIMIT = Number(process.env.MONTHLY_TOKEN_LIMIT) || 1_000_000;

let usageToday = 0;
let usageThisMonth = 0;
let lastResetDate = "";
let lastResetMonth = "";

function resetIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  if (today !== lastResetDate) { usageToday = 0; lastResetDate = today; }
  if (month !== lastResetMonth) { usageThisMonth = 0; lastResetMonth = month; }
}

export function record(prompt: number, completion: number) {
  resetIfNeeded();
  usageToday += prompt + completion;
  usageThisMonth += prompt + completion;
}

export function remaining(): {
  allowed: boolean;
  dailyRemaining: number;
  monthlyRemaining: number;
} {
  resetIfNeeded();
  return {
    allowed: usageToday < DAILY_LIMIT && usageThisMonth < MONTHLY_LIMIT,
    dailyRemaining: Math.max(0, DAILY_LIMIT - usageToday),
    monthlyRemaining: Math.max(0, MONTHLY_LIMIT - usageThisMonth),
  };
}

export function stats() {
  resetIfNeeded();
  return {
    today: usageToday,
    dailyLimit: DAILY_LIMIT,
    dailyPercent: Math.min(100, Math.round((usageToday / DAILY_LIMIT) * 100)),
    month: usageThisMonth,
    monthlyLimit: MONTHLY_LIMIT,
    monthPercent: Math.min(100, Math.round((usageThisMonth / MONTHLY_LIMIT) * 100)),
  };
}
