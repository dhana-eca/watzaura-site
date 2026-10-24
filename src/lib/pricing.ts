/**
 * Plan prices for /pricing, in Australian dollars excluding GST.
 * Confirmed by Dhana on 25 Oct 2026 (console tasks T-32, T-33). Change them
 * here only on a new decision; academies get 60 days' notice of a change.
 */
const GST = 0.1;

export interface Plan {
  key: string;
  name: string;
  /** AUD a month, excluding GST. */
  monthly: number;
  for: string;
  points: string[];
}

export const plans: Plan[] = [
  {
    key: 'starter',
    name: 'Starter',
    monthly: 149,
    for: 'One centre, up to about 150 active families.',
    points: ['Bookings, programs and memberships', 'Card and direct-debit payments to your own account', 'Parent and athlete app', 'Athlete development records'],
  },
  {
    key: 'academy',
    name: 'Academy',
    monthly: 349,
    for: 'Up to three centres.',
    points: ['Everything in Starter', 'Coach mode in the app', 'Holiday programs and session packs', 'Reports across your centres'],
  },
  {
    key: 'multi_centre',
    name: 'Multi-centre',
    monthly: 699,
    for: 'Four or more centres, or more than one country.',
    points: ['Everything in Academy', 'Any number of centres', 'Australian and Indian payments', 'A named contact for your rollout'],
  },
];

export interface AddOn {
  name: string;
  /** AUD excluding GST. */
  setup?: number;
  monthly?: number;
  body: string;
}

export const addOns: AddOn[] = [
  { name: 'Onboarding', setup: 750, body: 'Set-up of your centres, programs and prices, the import of your families, and training for your staff. Paid once.' },
  { name: 'Branded app', setup: 3000, monthly: 199, body: 'Your academy’s own app in the App Store and Google Play, under your name and colours.' },
];

/** "$149" — whole dollars, no cents. */
export const aud = (n: number) => '$' + n.toLocaleString('en-AU', { maximumFractionDigits: 0 });
/** The same amount with 10% GST added: "$163.90", or "$825" when it comes to whole dollars. */
export const audIncGst = (n: number) => {
  const v = Math.round(n * (1 + GST) * 100) / 100;
  const cents = Number.isInteger(v) ? 0 : 2;
  return '$' + v.toLocaleString('en-AU', { minimumFractionDigits: cents, maximumFractionDigits: cents });
};

/** "$3,000 set-up + $199 a month" excluding GST, and the same including GST. */
export function addOnPrice(a: AddOn) {
  const ex = [a.setup != null && aud(a.setup) + (a.monthly != null ? ' set-up' : ' once'), a.monthly != null && aud(a.monthly) + ' a month'].filter(Boolean).join(' + ');
  const inc = [a.setup != null && audIncGst(a.setup) + (a.monthly != null ? ' set-up' : ' once'), a.monthly != null && audIncGst(a.monthly) + ' a month'].filter(Boolean).join(' + ');
  return { ex: ex + ' + GST', inc: inc + ' including GST' };
}
