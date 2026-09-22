/**
 * Live time-zone telemetry.
 *
 *   [data-clock="America/New_York"]        → "10:42:07 AM", ticking
 *   [data-clock-offset="America/New_York"] → "SP +1h" (São Paulo relative to it)
 *   [data-office-status]                   → "Open now · closes in 3h 12m"
 *
 * Server-side the elements carry "--:--" placeholders, so nothing depends on
 * this file to be visible.
 */

const HOME = 'America/Sao_Paulo';
const OPEN = 9;
const CLOSE = 18;

function offsetMinutes(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}

function fmtDelta(mins: number): string {
  const sign = mins > 0 ? '+' : mins < 0 ? '−' : '±';
  const abs = Math.abs(mins);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;
  return `${sign}${hh}${mm ? `:${String(mm).padStart(2, '0')}` : ''}h`;
}

export function initClocks(): void {
  const clocks = Array.from(document.querySelectorAll<HTMLElement>('[data-clock]'));
  const offsets = Array.from(document.querySelectorAll<HTMLElement>('[data-clock-offset]'));
  const statuses = Array.from(document.querySelectorAll<HTMLElement>('[data-office-status]'));
  if (!clocks.length && !offsets.length && !statuses.length) return;

  const formatters = new Map<string, Intl.DateTimeFormat>();
  const fmtFor = (tz: string) => {
    let f = formatters.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
      formatters.set(tz, f);
    }
    return f;
  };

  const tick = () => {
    const now = new Date();

    for (const el of clocks) {
      const tz = el.dataset.clock || HOME;
      try {
        el.textContent = fmtFor(tz).format(now);
      } catch {
        el.textContent = '--:--';
      }
    }

    if (offsets.length || statuses.length) {
      const home = offsetMinutes(HOME, now);
      for (const el of offsets) {
        const tz = el.dataset.clockOffset || HOME;
        try {
          el.textContent = fmtDelta(home - offsetMinutes(tz, now));
        } catch {
          el.textContent = '';
        }
      }

      if (statuses.length) {
        const local = new Date(now.getTime() + home * 60000); // wall clock in São Paulo, as UTC fields
        const day = local.getUTCDay();
        const hour = local.getUTCHours() + local.getUTCMinutes() / 60;
        const weekday = day >= 1 && day <= 5;
        const open = weekday && hour >= OPEN && hour < CLOSE;
        let text: string;
        if (open) {
          const left = CLOSE - hour;
          const h = Math.floor(left);
          const m = Math.round((left - h) * 60);
          text = `Open now · closes in ${h}h ${String(m).padStart(2, '0')}m`;
        } else {
          // hours until next opening
          let until = 0;
          if (weekday && hour < OPEN) until = OPEN - hour;
          else {
            let d = day;
            let add = 0;
            do {
              d = (d + 1) % 7;
              add++;
            } while (d === 0 || d === 6);
            until = add * 24 - hour + OPEN;
          }
          const h = Math.floor(until);
          text = h >= 24 ? `Closed · opens in ${Math.round(h / 24)} day${h >= 48 ? 's' : ''}` : `Closed · opens in ${h}h`;
        }
        for (const el of statuses) {
          el.textContent = text;
          el.classList.toggle('is-open', open);
        }
      }
    }
  };

  tick();
  const id = window.setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
  window.addEventListener('pagehide', () => window.clearInterval(id), { once: true });
}
