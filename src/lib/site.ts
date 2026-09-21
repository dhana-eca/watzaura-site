/**
 * Company facts. Every one of these is verified — do not add a figure here
 * that cannot be evidenced. Copy lives in src/content; this file is for the
 * handful of facts that components (footer, JSON-LD, meta) need directly.
 */
export const site = {
  name: 'Watzaura',
  legalName: 'Watzaura Infotech Pty Ltd',
  abn: '32 702 553 857',
  acn: '702 553 857',
  registered: 'September 2026',
  headOffice: 'Melbourne, Victoria, Australia',
  domain: 'watzaura.com',
  url: 'https://watzaura.com',
  email: 'hello@watzaura.com',
  product: {
    name: 'Plinth',
    tagline: 'Run your academy. Develop every athlete.',
    description:
      'Plinth is an operating system for performance-focused sports academies: bookings, memberships, payments and every athlete’s development, held as one record.',
  },
  /** Default social image, 1200×630, generated at build from public/. */
  ogImage: '/og/default.png',
} as const;

export const nav = {
  product: [
    { href: '/product', label: 'Overview', blurb: 'One record from the booking to the development plan' },
    { href: '/product/operations', label: 'Operations', blurb: 'Bookings, resources, programs, memberships, payments' },
    { href: '/product/development', label: 'Development', blurb: 'Assessment, coach reports, development plans, progression' },
    { href: '/product/mobile', label: 'Mobile', blurb: 'Parent, athlete and coach apps' },
  ],
  primary: [
    { href: '/who-its-for', label: 'Who it’s for' },
    { href: '/switch', label: 'Switch' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/company', label: 'Company' },
  ],
  cta: { href: '/early-access', label: 'Request early access' },
  footer: {
    Product: [
      { href: '/product', label: 'Overview' },
      { href: '/product/operations', label: 'Operations' },
      { href: '/product/development', label: 'Development' },
      { href: '/product/mobile', label: 'Mobile' },
      { href: '/pricing', label: 'Pricing' },
    ],
    Academies: [
      { href: '/who-its-for', label: 'Who it’s for' },
      { href: '/built-at-elite', label: 'Built at Elite' },
      { href: '/switch', label: 'Switching to Plinth' },
      { href: '/early-access', label: 'Early access' },
    ],
    Company: [
      { href: '/company', label: 'About Watzaura' },
      { href: 'mailto:hello@watzaura.com', label: 'hello@watzaura.com' },
      { href: '/legal/privacy', label: 'Privacy' },
      { href: '/legal/terms', label: 'Terms' },
      { href: '/legal/account-deletion', label: 'Account deletion' },
    ],
  },
} as const;
