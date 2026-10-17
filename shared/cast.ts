// The fictional companies and processors in the demo. None of them is a real business.
// Each one publishes its own party entity and notices from its own wallet. The app trusts an entity
// only if its $creator is one of these addresses; a "rupeeleaf" party from any other wallet is ignored.

export type CastSlug = "rupeeleaf" | "bazaarline" | "ledgerlight" | "recoverly" | "dakroute" | "pingwave"

export const FIDUCIARIES = [
  { slug: "rupeeleaf", name: "Rupeeleaf", blurb: "Instant personal loans", address: "0xcc3F2990437ded5f3182335219bC30bbF64A6460" },
  { slug: "bazaarline", name: "Bazaarline", blurb: "Groceries delivered", address: "0x08dEa599517ea7575b685Bc37807f312125B7991" },
] as const

export const PROCESSORS = [
  { slug: "ledgerlight", name: "Ledgerlight", blurb: "Credit bureau", honest: true, address: "0x7B6B8D2E5b82dE860048e6B9001d754b1fa89D3d" },
  { slug: "recoverly", name: "Recoverly", blurb: "Loan servicing and collections", honest: true, address: "0x28CF78c5975664052B830828ac51E2F85B0426c3" },
  { slug: "dakroute", name: "Dakroute", blurb: "Delivery partner", honest: true, address: "0xfe8c6C69e0c9f6aF951A68Ce0daE5cbA1E6f3bad" },
  // Pingwave never acknowledges a withdrawal. It shows what the cease clock exposes.
  { slug: "pingwave", name: "Pingwave", blurb: "Bulk SMS marketing", honest: false, address: "0x90dB0Cd8619D2Ae921B51883947113Ff5614d9D9" },
] as const

const lower = (a: string) => a.toLowerCase()
export const COMPANY_ADDRS = new Set<string>(FIDUCIARIES.map((f) => lower(f.address)))
export const VENDOR_ADDRS = new Set<string>(PROCESSORS.map((p) => lower(p.address)))
export const isCompany = (a: string) => COMPANY_ADDRS.has(lower(a))
export const isVendor = (a: string) => VENDOR_ADDRS.has(lower(a))

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
