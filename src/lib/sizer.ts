// Appliance-based solar system sizer. Pure functions shared by /tools/system-sizer/ and /spec/.
// All figures are rough planning estimates in JMD — confirm against installer quotes and tariffs before relying on them.

export const SIZER = {
  rate: 47,            // J$/kWh all-in residential (matches the payback calculator default)
  sunHours: 5,         // peak sun hours/day
  derate: 0.8,         // system losses
  panelW: 620,         // typical panel used to count panels
  netCapKw: 10,        // residential net billing cap
  // installed price model, calibrated loosely to 2026 Jamaican package prices (incl. battery)
  price: { base: 200000, perPvKw: 60000, perBatKwh: 25000, perInvKw: 30000, low: 0.9, high: 1.3 },
  invSizes: [5, 6, 8, 10, 12, 15],
  taxCredit: { pct: 0.3, cap: 1200000 },
};

export type Answers = {
  parish: string; own: 'own' | 'rent'; nht: 'yes' | 'no' | 'unsure';
  roof: 'concrete' | 'zinc' | 'tile' | 'none'; shade: 'none' | 'some' | 'heavy';
  beds: 1 | 2 | 3 | 4; fridges: number; fridgeAge: 'new' | 'old'; freezers: number;
  heater: 'none' | 'elec'; pump: boolean; stove: boolean; dryer: boolean;
  acs: number; acSize: '12' | '18'; acType: 'inv' | 'std'; acHours: number;
  ev: number; goal: 'bill' | 'backup' | 'both'; hours: number;
  bBase: boolean; bFridge: boolean; bFreezer: boolean; bPump: boolean; bAc: '0' | '1' | 'all';
  net: 'yes' | 'no' | 'unsure'; bill: number;
};

export const DEFAULT_ANSWERS: Answers = {
  parish: 'St. Andrew', own: 'own', nht: 'yes', roof: 'concrete', shade: 'none',
  beds: 3, fridges: 1, fridgeAge: 'new', freezers: 1, heater: 'none', pump: true, stove: false, dryer: false,
  acs: 2, acSize: '12', acType: 'inv', acHours: 8, ev: 0, goal: 'both', hours: 8,
  bBase: true, bFridge: true, bFreezer: true, bPump: true, bAc: '1', net: 'unsure', bill: 0,
};

export type Note = { tone: 'warn' | 'info'; title?: string; text: string };
export type Result = {
  dailyKwh: number; applianceKwh: number; loads: [string, number][];
  pvKw: number; panels: number; roofM2: number; batteryKwh: number; inverterKw: number | null;
  priceLow: number; priceHigh: number; savingMonth: number; paybackYrs: number;
  overCap: boolean; notes: Note[];
};

const roundTo = (x: number, s: number) => Math.round(x / s) * s;

export function compute(a: Answers): Result {
  const base = ({ 1: 3, 2: 4, 3: 5, 4: 7 } as Record<number, number>)[a.beds] ?? 5;
  const fridgeEach = a.fridgeAge === 'new' ? 0.8 : 1.5;
  const big = a.acSize === '18', inv = a.acType === 'inv';
  const acPerHr = big ? (inv ? 1.1 : 1.7) : (inv ? 0.7 : 1.1);
  const acRunKw = big ? (inv ? 1.7 : 2.0) : (inv ? 1.1 : 1.3);
  const loads = ([
    ['Lights, fans, TV, Wi-Fi', base],
    ['Fridges', a.fridges * fridgeEach],
    ['Freezers', a.freezers * 1.0],
    ['Air conditioning', a.acs * acPerHr * a.acHours],
    ['Water heater', a.heater === 'elec' ? 3 : 0],
    ['Water pump', a.pump ? 0.7 : 0],
    ['Electric stove', a.stove ? 2 : 0],
    ['Dryer', a.dryer ? 1.5 : 0],
    ['EV charging', a.ev * 0.15],
  ] as [string, number][]).filter(l => l[1] > 0).sort((x, y) => y[1] - x[1]);
  const applianceKwh = loads.reduce((s, l) => s + l[1], 0);
  let daily = applianceKwh;
  const notes: Note[] = [];

  if (a.bill) {
    const billDaily = a.bill / SIZER.rate / 30, diff = (billDaily - daily) / daily;
    if (diff > 0.3) { notes.push({ tone: 'warn', text: `Your bill suggests about ${Math.round(billDaily)} kWh a day, more than the ${Math.round(daily)} kWh from your appliance list. We've sized to the bill. Check AC hours and older appliances.` }); daily = billDaily; }
    else if (diff < -0.3) notes.push({ tone: 'info', text: `Your bill suggests lower use (about ${Math.round(billDaily)} kWh a day) than your appliance list. An installer site visit will settle it.` });
  }

  const wantBackup = a.goal !== 'bill';
  let batteryKwh = 0;
  if (wantBackup) {
    const h = a.hours; let e = 0;
    if (a.bBase) e += base / 24 * 1.2 * h;
    if (a.bFridge) e += a.fridges * fridgeEach / 24 * h;
    if (a.bFreezer) e += a.freezers / 24 * h;
    if (a.bPump && a.pump) e += 0.7 / 24 * h * 2;
    const n = a.bAc === 'all' ? a.acs : Math.min(Number(a.bAc), a.acs);
    e += n * acPerHr * Math.min(h, a.acHours);
    batteryKwh = Math.max(5, Math.ceil(e / 0.9 / 5) * 5);
  }

  const selfUse = a.net === 'yes' || batteryKwh > 0;
  const shadeF = { none: 1, some: 0.85, heavy: 0.65 }[a.shade];
  const rawKw = Math.max(1.2, daily * (selfUse ? 0.9 : 0.65) / (SIZER.sunHours * SIZER.derate));
  const panels = Math.ceil(rawKw * 1000 / SIZER.panelW);
  const pvKw = Math.round(panels * SIZER.panelW / 100) / 10;

  const peak = 1.5 + a.fridges * 0.2 + a.freezers * 0.15 + (a.pump ? 0.75 : 0) + a.acs * acRunKw * 0.8 + (a.stove ? 1.5 : 0);
  const need = Math.max(peak * 1.2, pvKw / 1.3);
  const inverterKw = SIZER.invSizes.find(s => s >= need) ?? null;

  const P = SIZER.price;
  const mid = P.base + pvKw * P.perPvKw + batteryKwh * P.perBatKwh + (inverterKw ?? 16) * P.perInvKw;
  const priceLow = roundTo(mid * P.low, 50000), priceHigh = roundTo(mid * P.high, 50000);

  const pvMonth = pvKw * SIZER.sunHours * SIZER.derate * 30 * shadeF;
  const used = Math.min(pvMonth, daily * 30) * (selfUse ? 0.95 : 0.75);
  const savingMonth = used * SIZER.rate;
  const paybackYrs = savingMonth > 0 ? (priceLow + priceHigh) / 2 / (savingMonth * 12) : Infinity;
  const overCap = pvKw > SIZER.netCapKw;

  if (overCap && a.net !== 'no') notes.unshift({ tone: 'warn', title: 'Over the 10 kW net billing cap', text: `This spec is ${pvKw.toFixed(1)} kW. Homes can only sell power back to JPS on systems up to 10 kW. To stay eligible, trim the load (fewer AC hours, a solar water heater, replacing older ACs), or ask about an export-limited (auxiliary) setup.` });
  else if (overCap) notes.unshift({ tone: 'warn', title: 'Over 10 kW', text: 'That is fine without net billing, but you will not be able to join net billing later at this size.' });
  if (a.roof === 'none') notes.push({ tone: 'warn', text: 'No usable roof: ask installers about a ground mount or carport, or a battery-only backup system.' });
  if (a.roof === 'tile') notes.push({ tone: 'info', text: 'Clay and concrete tile roofs usually need a site study for mounting and waterproofing, which affects price.' });
  if (a.roof === 'zinc') notes.push({ tone: 'info', text: 'Zinc roofs need rail mounting rated for hurricane winds. Ask for the wind rating in writing.' });
  if (a.shade !== 'none') notes.push({ tone: 'info', text: 'Shade cuts output. You may need a few more panels than shown; an installer will check placement.' });
  if (a.heater === 'elec') notes.push({ tone: 'info', text: 'Switching your electric water heater to a solar water heater cuts about 3 kWh a day and shrinks the system you need.' });
  if (a.acs && a.acType === 'std') notes.push({ tone: 'info', text: 'Older non-inverter ACs use about 40% more power. Replacing one is often cheaper than the extra panels.' });
  if (a.ev) notes.push({ tone: 'info', text: 'Charge the EV during the day so it runs on solar instead of the battery.' });
  if (!inverterKw) notes.push({ tone: 'warn', text: 'This load is above a typical single home inverter. Expect two inverters or a commercial-scale design.' });

  return { dailyKwh: daily, applianceKwh, loads, pvKw, panels, roofM2: Math.round(panels * 2.7), batteryKwh, inverterKw,
    priceLow, priceHigh, savingMonth, paybackYrs, overCap, notes };
}

// ---- teaser (shown before email) ----
export function sizeBand(kw: number) {
  if (kw < 4) return 'Small (under 4 kW)';
  if (kw < 7) return 'Medium (4–7 kW)';
  if (kw <= 10) return 'Large (7–10 kW)';
  return 'Extra large (over 10 kW)';
}
export function priceBand(lo: number, hi: number) {
  const f = (x: number) => (x / 1e6).toFixed(1).replace(/\.0$/, '');
  return `J$${f(Math.floor(lo / 500000) * 500000)}M – J$${f(Math.ceil(hi / 500000) * 500000)}M`;
}

// ---- financing ----
export const pmt = (rate: number, years: number, amt: number) => {
  const r = rate / 12, n = years * 12; return r === 0 ? amt / n : amt * r / (1 - Math.pow(1 + r, -n));
};
export type FinOption = { name: string; rate: string; term: string; monthly: string; note: string; best?: boolean };
export function financing(a: Answers, r: Result): { amount: number; options: FinOption[] } {
  const amount = Math.min(2500000, roundTo((r.priceLow + r.priceHigh) / 2, 50000));
  const m = (x: number) => 'J$' + Math.round(x).toLocaleString('en-US');
  const opts: FinOption[] = [];
  const nhtOk = a.nht === 'yes' && a.own === 'own';
  opts.push({ name: 'NHT Smart Energy Loan', rate: '0–5%', term: 'up to 10 yrs', best: nhtOk,
    monthly: `${m(pmt(0, 10, amount))} – ${m(pmt(0.05, 10, amount))}`,
    note: a.nht === 'yes' ? 'For NHT contributors, up to J$2.5M. Rate depends on income. Paid direct to the installer.' : 'Only for NHT contributors, up to J$2.5M. Rate depends on income.' });
  opts.push({ name: 'Bank or credit union solar loan', rate: '8–12%', term: '5–7 yrs', best: !nhtOk && a.own === 'own',
    monthly: `${m(pmt(0.08, 7, amount))} – ${m(pmt(0.12, 5, amount))}`,
    note: 'E.g. JMMB, Sagicor, First Global, C&WJ / COK, First Heritage. Illustrative rates; confirm with the lender.' });
  opts.push({ name: 'Installer or hire-purchase financing', rate: 'varies', term: 'varies', monthly: 'ask', note: 'E.g. Dolla Financial, ATL / FosRich. Check whether the rate is per month or per year.' });
  opts.push({ name: 'Cash', rate: '—', term: '—', monthly: '—', note: isFinite(r.paybackYrs) ? `Rough payback about ${r.paybackYrs.toFixed(1)} years. Ask for a cash discount.` : 'Ask for a cash discount.' });
  return { amount, options: opts };
}

// ---- encoding answers into a shareable URL (no personal data) ----
export function encodeAnswers(a: Answers): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(a)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeAnswers(s: string): Answers | null {
  try {
    const json = decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
    return { ...DEFAULT_ANSWERS, ...JSON.parse(json) };
  } catch { return null; }
}
export function newSpecId() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(5));
  return 'JS-' + Array.from(b, x => c[x % c.length]).join('');
}

export const jm = (x: number) => x >= 1e6 ? 'J$' + (x / 1e6).toFixed(2).replace(/0$/, '') + 'M' : 'J$' + Math.round(x / 1000) + 'k';
export const money = (x: number) => 'J$' + Math.round(x).toLocaleString('en-US');
