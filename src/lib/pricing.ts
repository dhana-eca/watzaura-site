/**
 * Plan prices for /pricing, in Australian dollars excluding GST.
 *
 * NOT CONFIRMED. These are the go-to-market plan's proposed prices; Dhana
 * confirms them under task T-32. The page shows them only in a build with
 * PRICING_PUBLISHED=true (set on Render, then redeploy). Without it, /pricing
 * keeps saying pricing is not yet published and no price reaches the HTML.
 */
export const pricingPublished = process.env.PRICING_PUBLISHED === 'true';

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
  price: string;
  body: string;
}

export const addOns: AddOn[] = [
  { name: 'Onboarding', price: '$750 once', body: 'Set-up of your centres, programs and prices, the import of your families, and training for your staff.' },
  { name: 'Branded app', price: '$3,000 set-up + $199 a month', body: 'Your academy’s own app in the App Store and Google Play, under your name and colours.' },
];

/** "$149" — whole dollars, no cents. */
export const aud = (n: number) => '$' + n.toLocaleString('en-AU', { maximumFractionDigits: 0 });
/** The same amount with 10% GST added, to the cent: "$163.90". */
export const audIncGst = (n: number) => '$' + (Math.round(n * (1 + GST) * 100) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
