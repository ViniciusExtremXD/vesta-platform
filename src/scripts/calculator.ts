/**
 * Revenue-bleed calculator. Every input is the visitor's own number; the only
 * external figure is Google's 2017 finding that 53% of mobile visits abandon
 * a page that takes longer than 3 s to load. Between 1 s and 3 s we
 * interpolate linearly; past 3 s we hold at 53% (the study gives no more).
 *
 * The formula is printed on the page. The server renders the default result,
 * so the numbers exist without JavaScript.
 */

export interface CalcInput {
  spend: number; // $/month
  cpc: number; // $
  mobileShare: number; // 0..1
  loadTime: number; // seconds
  convRate: number; // 0..1 visits → leads
  closeRate: number; // 0..1 leads → jobs
  jobValue: number; // $
}

export interface CalcOutput {
  clicks: number;
  mobileClicks: number;
  abandonShare: number;
  lostVisits: number;
  wastedSpend: number;
  lostLeads: number;
  lostJobs: number;
  lostRevenue: number;
}

export const ABANDON_AT_3S = 0.53;

export function abandonShare(loadTime: number): number {
  if (loadTime <= 1) return 0;
  if (loadTime >= 3) return ABANDON_AT_3S;
  return (ABANDON_AT_3S * (loadTime - 1)) / 2;
}

export function compute(i: CalcInput): CalcOutput {
  const clicks = i.cpc > 0 ? i.spend / i.cpc : 0;
  const mobileClicks = clicks * i.mobileShare;
  const share = abandonShare(i.loadTime);
  const lostVisits = mobileClicks * share;
  const wastedSpend = lostVisits * i.cpc;
  const lostLeads = lostVisits * i.convRate;
  const lostJobs = lostLeads * i.closeRate;
  const lostRevenue = lostJobs * i.jobValue;
  return { clicks, mobileClicks, abandonShare: share, lostVisits, wastedSpend, lostLeads, lostJobs, lostRevenue };
}

export const money = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits, minimumFractionDigits: digits });
export const int = (n: number) => Math.round(n).toLocaleString('en-US');
export const pct = (n: number) => `${Math.round(n * 100)}%`;

export function initCalculator(): void {
  const form = document.querySelector<HTMLFormElement>('[data-calc]');
  if (!form) return;

  const field = (name: string) => form.querySelector<HTMLInputElement>(`[name="${name}"]`);
  const out = (name: string) => form.querySelector<HTMLElement>(`[data-out="${name}"]`);
  const label = (name: string) => form.querySelector<HTMLElement>(`[data-label="${name}"]`);

  const read = (): CalcInput => ({
    spend: Number(field('spend')?.value ?? 0),
    cpc: Number(field('cpc')?.value ?? 0),
    mobileShare: Number(field('mobile')?.value ?? 0) / 100,
    loadTime: Number(field('load')?.value ?? 0),
    convRate: Number(field('conv')?.value ?? 0) / 100,
    closeRate: Number(field('close')?.value ?? 0) / 100,
    jobValue: Number(field('job')?.value ?? 0),
  });

  const paint = () => {
    const i = read();
    const o = compute(i);

    const set = (name: string, value: string) => {
      const el = out(name);
      if (el) el.textContent = value;
    };
    set('clicks', int(o.clicks));
    set('mobile', int(o.mobileClicks));
    set('abandon', pct(o.abandonShare));
    set('lost', int(o.lostVisits));
    set('wasted', money(o.wastedSpend));
    set('leads', o.lostLeads.toLocaleString('en-US', { maximumFractionDigits: 1 }));
    set('jobs', o.lostJobs.toLocaleString('en-US', { maximumFractionDigits: 1 }));
    set('revenue', money(o.lostRevenue));
    set('yearly', money(o.lostRevenue * 12));

    const l = (name: string, value: string) => {
      const el = label(name);
      if (el) el.textContent = value;
    };
    l('spend', money(i.spend));
    l('cpc', money(i.cpc, 2));
    l('mobile', pct(i.mobileShare));
    l('load', `${i.loadTime.toFixed(1)} s`);
    l('conv', pct(i.convRate));
    l('close', pct(i.closeRate));
    l('job', money(i.jobValue));

    // range fill
    form.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((r) => {
      const min = Number(r.min);
      const max = Number(r.max);
      const p = ((Number(r.value) - min) / (max - min)) * 100;
      r.style.setProperty('--fill', `${p.toFixed(1)}%`);
    });

    form.classList.toggle('is-hot', o.abandonShare > 0);
  };

  form.addEventListener('input', paint);
  form.addEventListener('submit', (e) => e.preventDefault());
  paint();
}
