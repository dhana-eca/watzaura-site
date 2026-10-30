/**
 * Company facts. Every one of these is verified — do not add a figure here
 * that cannot be evidenced. Copy lives in src/content; this file is for the
 * handful of facts that components (footer, JSON-LD, meta) need directly.
 */
export const site = {
  name: 'Watzaura',
  legalName: 'Watzaura Infotech Pty Limited',
  abn: '32 702 553 857',
  acn: '702 553 857',
  registered: 'September 2026',
  headOffice: 'Melbourne, Victoria, Australia',
  /** Registrable domain, without a host. Used to allow both hosts on POSTs. */
  domain: 'watzaura.com',
  /** Canonical origin — www. The apex 301s here at Render's edge. */
  url: 'https://www.watzaura.com',
  email: 'hello@watzaura.com',
  /** Company line (mobile), shown as written in Australia; `phoneIntl` for tel: links and JSON-LD. */
  phone: '0452 551 758',
  phoneIntl: '+61 452 551 758',
  product: {
    name: 'Arenzo',
    tagline: 'Run your academy. Develop every athlete.',
    description:
      'Arenzo is an operating system for performance-focused sports academies: bookings, memberships, payments and every athlete’s development, held as one record.',
  },
  /** Default social image, 1200×630, generated at build from public/. */
  ogImage: '/og/default.png',
} as const;

export const nav = {
  product: [
    { href: 'https://arenzo.app/product', label: 'Overview', blurb: 'One record from the booking to the development plan' },
    { href: 'https://arenzo.app/product/operations', label: 'Operations', blurb: 'Bookings, resources, programs, memberships, payments' },
    { href: 'https://arenzo.app/product/development', label: 'Development', blurb: 'Assessment, coach reports, development plans, progression' },
    { href: 'https://arenzo.app/product/mobile', label: 'Mobile', blurb: 'Parent, athlete and coach apps' },
  ],
  primary: [
    { href: 'https://arenzo.app/who-its-for', label: 'Who it’s for' },
    { href: 'https://arenzo.app/switch', label: 'Switch' },
    { href: 'https://arenzo.app/pricing', label: 'Pricing' },
    { href: '/', label: 'Company' },
  ],
  cta: { href: 'https://arenzo.app/early-access', label: 'Request early access' },
  footer: {
    Product: [
      { href: 'https://arenzo.app/product', label: 'Overview' },
      { href: 'https://arenzo.app/product/operations', label: 'Operations' },
      { href: 'https://arenzo.app/product/development', label: 'Development' },
      { href: 'https://arenzo.app/product/mobile', label: 'Mobile' },
      { href: 'https://arenzo.app/pricing', label: 'Pricing' },
    ],
    Academies: [
      { href: 'https://arenzo.app/who-its-for', label: 'Who it’s for' },
      { href: 'https://arenzo.app/built-at-elite', label: 'Built at Elite' },
      { href: 'https://arenzo.app/switch', label: 'Switching to Arenzo' },
      { href: 'https://arenzo.app/early-access', label: 'Early access' },
      { href: 'https://arenzo.app/demo', label: 'Book a demo' },
    ],
    Company: [
      { href: '/', label: 'About Watzaura' },
      { href: 'https://arenzo.app/blog', label: 'Blog' },
      { href: 'mailto:hello@watzaura.com', label: 'hello@watzaura.com' },
      { href: '/legal/privacy', label: 'Privacy' },
      { href: '/legal/terms', label: 'Terms' },
      { href: '/legal/account-deletion', label: 'Account deletion' },
    ],
  },
} as const;

/**
 * Elite One Cricket, Elite Cricket Academy's edition of the Arenzo app.
 * Submitted to both stores 30 Oct 2026; flip `live` once both approve.
 */
export const eliteOne = {
  live: false,
  appStore: 'https://apps.apple.com/au/app/elite-one-cricket/id6824725254',
  googlePlay: 'https://play.google.com/store/apps/details?id=com.watzaura.plinth',
  post: '/blog/elite-one-cricket-submitted',
} as const;
