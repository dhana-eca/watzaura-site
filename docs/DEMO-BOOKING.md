# Demo booking: switching it on, and where prices live

The demo page is off until `CALCOM_LINK` is set on the Render service `watzaura-site`. It is read when the site is **built**, so a change needs a redeploy, not just a restart. While it is unset, /demo offers email and phone instead of a calendar.

## Prices

Plan prices are in `src/lib/pricing.ts`, in AUD excluding GST. The page adds 10% GST to show the including-GST amount. They were confirmed by Dhana on 25 Oct 2026 (console tasks T-32 and T-33). Existing academies get 60 days' notice of a price change.

## Cal.com (owner steps)

Cal.com's free plan is enough. Create the account under hello@watzaura.com — Claude does not create accounts.

1. **Event type:** "Academy demo", 30 minutes, video via Google Meet, slug `academy-demo`. The link path is then `<username>/academy-demo`; that string is `CALCOM_LINK`.
2. **Availability:** your demo hours in Australia/Melbourne. Add a 15-minute buffer and a minimum notice of 12 hours.
3. **Booking questions** (Event type → Advanced → Booking questions). The console reads them by these identifiers:

   | Identifier | Label | Type | Required |
   | --- | --- | --- | --- |
   | `name` | Your name | (built in) | yes |
   | `email` | Email | (built in) | yes |
   | `academy` | Academy name | Short text | yes |
   | `centres` | How many centres? | Number | no |
   | `current-system` | What do you use now for bookings? | Short text | no |
   | `country` | Country | Short text | no |
   | `notes` | Anything we should know? | Long text | no |

4. **Webhook** (Settings → Developer → Webhooks → New):
   - Subscriber URL: `https://ops.watzaura.com/leads/calcom`
   - Events: Booking created, Booking rescheduled, Booking cancelled
   - Secret: generate a long random string. Put the **same value** on the Render service `watzaura-console` as `CALCOM_WEBHOOK_SECRET`.
   - Use Cal.com's "Ping test" button: the console answers 200 and records nothing.
5. **Site:** set `CALCOM_LINK` on `watzaura-site` and redeploy. Open `/demo`, click **Show available times**, and book a test slot with your own email.
6. **Check the console:** CRM → Accounts shows the academy with a deal at *Demo booked*, next step *Demo* at the booked time, and a meeting in its timeline. Cancel the test booking; the deal's next step becomes *Demo cancelled: follow up*.

## What the console does with a booking

Contact by email (new, or the existing one). Account: the contact's own, else one with the same academy name, else a new lead. Deal: the account's open deal moves to *Demo booked* (unless it is already past that stage), or a new deal is opened. Fields people have filled in are never overwritten, and a retried delivery changes nothing. See `src/crm/demo-bookings.controller.ts` in watzaura-console.
