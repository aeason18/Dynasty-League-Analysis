export function fmtPoints(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function fmtRecord(wins: number, losses: number, ties: number): string {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

export function fmtPct(wins: number, losses: number, ties: number): string {
  const total = wins + losses + ties;
  if (total === 0) return ".000";
  const pct = (wins + ties * 0.5) / total;
  return pct.toFixed(3).replace(/^0/, "");
}

export function sleeperAvatarUrl(avatar: string | null): string | null {
  if (!avatar) return null;
  return `https://sleepercdn.com/avatars/thumbs/${avatar}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
