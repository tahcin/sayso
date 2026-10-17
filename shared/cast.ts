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

// Publishes a dated snapshot of RBI's public directory of digital lending apps (minimal facts only).
export const MIRROR = { name: "Say So RBI mirror", address: "0x822BB671e6Ce0F2b69A500344764D9fedE31E725" } as const
export const DLA_SNAPSHOT = "2026-10-17"

const lower = (a: string) => a.toLowerCase()
export const COMPANY_ADDRS = new Set<string>(FIDUCIARIES.map((f) => lower(f.address)))
export const VENDOR_ADDRS = new Set<string>(PROCESSORS.map((p) => lower(p.address)))
export const isCompany = (a: string) => COMPANY_ADDRS.has(lower(a))
export const isVendor = (a: string) => VENDOR_ADDRS.has(lower(a))

// Fictional contacts on the reserved .example domain (RFC 2606): no real inbox, no real person.
export const CONTACT: Record<string, string> = { rupeeleaf: "dpo@rupeeleaf.example", bazaarline: "dpo@bazaarline.example" }

// Notices are readonly, so changing a notice means publishing a new version; the app reads the newest.
export const NOTICE_VERSION = 3

const MIN = 60
const DAY = 24 * 60 * MIN

export const NOTICES: Record<
  (typeof FIDUCIARIES)[number]["slug"],
  {
    purpose: string
    periodSeconds: number
    processor: CastSlug
    title: string
    text: string
    dataItems: string[]
    hi: { title: string; text: string; dataItems: string[] }
  }[]
> = {
  rupeeleaf: [
    {
      purpose: "credit_check",
      periodSeconds: 10 * MIN,
      processor: "ledgerlight",
      title: "Check your credit score for this application",
      text: "Ledgerlight pulls your credit report once so that Rupeeleaf can decide this loan. The permission ends 10 minutes after you give it, because the check is done by then.",
      dataItems: ["Name", "PAN", "Date of birth"],
      hi: {
        title: "इस आवेदन के लिए आपका क्रेडिट स्कोर जाँचना",
        text: "Ledgerlight एक बार आपकी क्रेडिट रिपोर्ट निकालता है, ताकि Rupeeleaf इस लोन पर फ़ैसला कर सके। अनुमति देने के 10 मिनट बाद यह अपने-आप ख़त्म हो जाती है, क्योंकि तब तक जाँच पूरी हो चुकी होती है।",
        dataItems: ["नाम", "पैन", "जन्म तिथि"],
      },
    },
    {
      purpose: "loan_servicing",
      periodSeconds: 365 * DAY,
      processor: "recoverly",
      title: "Run your loan: reminders, repayments and statements",
      text: "Recoverly sends repayment reminders and statements for as long as the loan runs, up to one year.",
      dataItems: ["Name", "Mobile number", "Loan account", "Repayment history"],
      hi: {
        title: "आपके लोन से जुड़ी सेवाएँ: रिमाइंडर, किस्तें और स्टेटमेंट",
        text: "Recoverly लोन चलने तक, ज़्यादा से ज़्यादा एक साल, किस्त के रिमाइंडर और स्टेटमेंट भेजता है।",
        dataItems: ["नाम", "मोबाइल नंबर", "लोन खाता", "भुगतान का रिकॉर्ड"],
      },
    },
    {
      purpose: "marketing",
      periodSeconds: 180 * DAY,
      processor: "pingwave",
      title: "Send you offers by SMS",
      text: "Pingwave sends you loan offers and promotions by SMS for up to six months. You can say no and still get the loan.",
      dataItems: ["Mobile number", "City"],
      hi: {
        title: "SMS से ऑफ़र भेजना",
        text: "Pingwave छह महीने तक SMS से लोन ऑफ़र और प्रमोशन भेजता है। आप मना करके भी लोन ले सकते हैं।",
        dataItems: ["मोबाइल नंबर", "शहर"],
      },
    },
  ],
  bazaarline: [
    {
      purpose: "delivery",
      periodSeconds: 90 * DAY,
      processor: "dakroute",
      title: "Deliver your orders",
      text: "Dakroute gets your name, address and phone number to deliver your orders. The permission lasts 90 days from when you give it, and you can renew it.",
      dataItems: ["Name", "Delivery address", "Mobile number"],
      hi: {
        title: "आपके ऑर्डर पहुँचाना",
        text: "Dakroute आपके ऑर्डर पहुँचाने के लिए आपका नाम, पता और फ़ोन नंबर लेता है। यह अनुमति देने के दिन से 90 दिन तक रहती है, और आप इसे आगे बढ़ा सकते हैं।",
        dataItems: ["नाम", "डिलीवरी का पता", "मोबाइल नंबर"],
      },
    },
    {
      purpose: "marketing",
      periodSeconds: 180 * DAY,
      processor: "pingwave",
      title: "Send you offers by SMS",
      text: "Pingwave sends you discounts and new arrivals by SMS for up to six months. You can say no and still shop.",
      dataItems: ["Mobile number", "Order history"],
      hi: {
        title: "SMS से ऑफ़र भेजना",
        text: "Pingwave छह महीने तक SMS से छूट और नए सामान की जानकारी भेजता है। आप मना करके भी ख़रीदारी कर सकते हैं।",
        dataItems: ["मोबाइल नंबर", "ऑर्डर का रिकॉर्ड"],
      },
    },
  ],
}

export const PURPOSE_LABEL: Record<string, string> = {
  credit_check: "Credit check",
  loan_servicing: "Loan servicing",
  marketing: "SMS offers",
  delivery: "Delivery",
}
