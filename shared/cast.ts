// The fictional companies and processors in the demo. None of them is a real business.
// Each one publishes its own party entity and notices from its own wallet, so $creator is the proof.

export type CastSlug = "rupeeleaf" | "bazaarline" | "ledgerlight" | "recoverly" | "dakroute" | "pingwave"

export const FIDUCIARIES = [
  { slug: "rupeeleaf", name: "Rupeeleaf", blurb: "Instant personal loans" },
  { slug: "bazaarline", name: "Bazaarline", blurb: "Groceries delivered" },
] as const

export const PROCESSORS = [
  { slug: "ledgerlight", name: "Ledgerlight", blurb: "Credit bureau", honest: true },
  { slug: "recoverly", name: "Recoverly", blurb: "Loan servicing and collections", honest: true },
  { slug: "dakroute", name: "Dakroute", blurb: "Delivery partner", honest: true },
  // Pingwave never acknowledges a withdrawal. It shows what the cease clock exposes.
  { slug: "pingwave", name: "Pingwave", blurb: "Bulk SMS marketing", honest: false },
] as const

const MIN = 60
const DAY = 24 * 60 * MIN

export const NOTICES: Record<
  (typeof FIDUCIARIES)[number]["slug"],
  { purpose: string; periodSeconds: number; processor: CastSlug; title: string; text: string; dataItems: string[] }[]
> = {
  rupeeleaf: [
    {
      purpose: "credit_check",
      periodSeconds: 10 * MIN,
      processor: "ledgerlight",
      title: "Check your credit score for this application",
      text: "Ledgerlight pulls your credit report once to decide this loan. The permission ends 10 minutes after you give it, because the check is done by then.",
      dataItems: ["Name", "PAN", "Date of birth"],
    },
    {
      purpose: "loan_servicing",
      periodSeconds: 365 * DAY,
      processor: "recoverly",
      title: "Run your loan: reminders, repayments and statements",
      text: "Recoverly sends repayment reminders and statements for as long as the loan runs, up to one year.",
      dataItems: ["Name", "Mobile number", "Loan account", "Repayment history"],
    },
    {
      purpose: "marketing",
      periodSeconds: 180 * DAY,
      processor: "pingwave",
      title: "Send you offers by SMS",
      text: "Pingwave sends you loan offers and promotions by SMS for up to six months. You can say no and still get the loan.",
      dataItems: ["Mobile number", "City"],
    },
  ],
  bazaarline: [
    {
      purpose: "delivery",
      periodSeconds: 90 * DAY,
      processor: "dakroute",
      title: "Deliver your orders",
      text: "Dakroute gets your address and phone number to deliver orders, for up to 90 days after your last order.",
      dataItems: ["Name", "Delivery address", "Mobile number"],
    },
    {
      purpose: "marketing",
      periodSeconds: 180 * DAY,
      processor: "pingwave",
      title: "Send you offers by SMS",
      text: "Pingwave sends you discounts and new arrivals by SMS for up to six months. You can say no and still shop.",
      dataItems: ["Mobile number", "Order history"],
    },
  ],
}

export const PURPOSE_LABEL: Record<string, string> = {
  credit_check: "Credit check",
  loan_servicing: "Loan servicing",
  marketing: "SMS offers",
  delivery: "Delivery",
}
