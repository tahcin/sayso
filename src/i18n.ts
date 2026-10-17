// The person's screens in English and Hindi. A notice and a consent request must be available in
// English or any language in the Eighth Schedule (DPDP Act s.5(3), s.6(3)); Hindi is the first one.
import { createContext, useContext } from "react"

export type Lang = "en" | "hi"

/**
 * Which RBI Directions a withdrawal letter cites. Each kind of lender has its own Credit Facilities
 * Directions, 2025 (they replaced the Digital Lending Directions, 2025 on 28 Nov 2025), all with the same
 * paragraph numbers. Only rural co-operative banks escalate differently: to NABARD or RBI's Customer
 * Education and Protection Cell, not RBI's online Complaint Management System.
 */
export type Cite = { kind: "nbfc" | "cb" | "sfb" | "ucb" | "rcb" | "rrb" | "lab"; consent: string; share: string; phone: string; griev: string }
export type LoanLetter = { app: string; lender: string; purposeCode: string; purpose: string; when: Date; link: string; cite: Cite }

const EN_DIRECTIONS = {
  nbfc: "Reserve Bank of India (Non-Banking Financial Companies – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/347, 28 November 2025)",
  cb: "Reserve Bank of India (Commercial Banks – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/154, 28 November 2025)",
  sfb: "Reserve Bank of India (Small Finance Banks – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/185, 28 November 2025)",
  ucb: "Reserve Bank of India (Urban Co-operative Banks – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/277, 28 November 2025)",
  rcb: "Reserve Bank of India (Rural Co-operative Banks – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/302, 28 November 2025)",
  rrb: "Reserve Bank of India (Regional Rural Banks – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/253)",
  lab: "Reserve Bank of India (Local Area Banks – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/229)",
}

const EN_LOANASK: Record<string, string> = {
  beyond_loan: "Please do not use my personal data for anything other than servicing my existing loan, including offers and cross-selling.",
  third_party_sharing: "Please stop sharing my personal data with any third party, except where a law or regulation requires it.",
  phone_access: "Please stop reading my contacts, photos and files, and call logs, and delete whatever has been collected from them.",
  marketing_calls: "Please stop using my contact details for marketing calls and SMS.",
}

const en = {
  yourPhone: "Your apps",
  keysStay: "Your keys stay on this device",
  myConsents: "My consents",
  reading: "Reading the companies' notices from Arkiv…",
  ask: (co: string) => `Choose what ${co} may do with your data. Each one is separate, and none is ticked for you.`,
  sharedWith: (v: string) => `Shared with ${v}`,
  endsAfter: (d: string) => `ends after ${d}`,
  endsIn: (d: string) => `ends in ${d}`,
  endsOn: (date: string, d: string) => `ends ${date} (in ${d})`,
  notShared: (v: string) => `Not shared with ${v}`,
  agree: (n: number, m: number) => `Agree to ${n} of ${m}`,
  tick: "Tick what you agree to",
  noAll: "Say no to all of these",
  kept: "Your answer, yes or no, is kept as a receipt you own for seven years.",
  rights: (contact: string) =>
    `Your rights: withdraw any time under My consents, as easily as you agreed. Questions or complaints: ${contact}. If they are not resolved, you can complain to the Data Protection Board of India.`,
  answeredAll: (co: string) => `You have already answered every request from ${co}. Your answers are under My consents.`,
  nothingYet: "Nothing yet. Open Rupeeleaf or Bazaarline and choose what they may do. Every answer you give shows up here.",
  knowsYouAs: "knows you as",
  withdraw: "Withdraw",
  renew: "Renew",
  startOver: "Start over as a new person",
  backup: "Back up your recovery phrase",
  restore: "Restore",
  backupNote: "These 12 words are the only key to your consents. Keep them somewhere safe: with them you can withdraw from any browser. Anyone who has them can act as you.",
  restoreNote: "Paste your 12-word recovery phrase.",
  restoreBad: "That isn't a valid 12-word phrase.",
  startOverWarn: "This makes a new identity in this browser. Your current consents stay on Arkiv, but you can only withdraw them later if you've backed up your recovery phrase.",
  eachTap: "Each tap is one Arkiv transaction, signed in this browser.",
  relay: " Your network used up Arkiv's free read quota, so reads now go through Say So's read-only relay.",
  seeTx: "See the transaction",
  busy: (label: string) => `${label} on Arkiv…`,
  saved: "Saved on Arkiv.",
  saidNoBefore: "You said no to this earlier. You can still change your mind.",
  usually: "(usually 4 to 10 s)",
  saving: (n: number) => (n ? `Saving ${n} consent${n > 1 ? "s" : ""}` : "Saving your no"),
  withdrawing: (p: string) => `Withdrawing ${p}`,
  renewing: (p: string) => `Renewing ${p}`,
  renewed: "Renewed",
  keepLonger: "Keep longer",
  keepLongerTitle: "Keep this record for eight years from today",
  extended: "Extended",
  extending: "Extending your record",
  keptUntil: (date: string) => `kept until ${date}`,
  deleteRecord: "Delete",
  deleteConfirm: "Delete for good",
  deleteWarn: "This removes your proof from Arkiv, and the link in your message stops working.",
  deleting: "Deleting your record",
  ownAddress: "Own address",
  via: (co: string) => `via ${co}`,
  status: {
    using: "In use",
    pending: "Waiting for vendor",
    stopped: "Withdrawn · vendor stopped",
    ignoring: "Withdrawn · vendor has not stopped",
    released: "Withdrawn",
    ended: "Ended on its own",
    denied: "You said no",
  },
  vStopped: (v: string, d: string) => `${v} signed a stop note ${d} after you withdrew`,
  vIgnoring: (v: string, d: string) => `${v} still holds a lease, ${d} after you withdrew`,
  vReleased: (v: string) => `Waiting for ${v} to confirm it stopped`,
  vUsing: (v: string) => `${v} holds a lease that ends with this consent`,
  vPending: (v: string) => `${v} has not picked it up yet`,
  purpose: { credit_check: "Credit check", loan_servicing: "Loan servicing", marketing: "SMS offers", delivery: "Delivery" } as Record<string, string>,
  blurb: { rupeeleaf: "Instant personal loans", bazaarline: "Groceries delivered" } as Record<string, string>,
  anyApp: "Any app",
  recording: "Recording your withdrawal",
  otherApps: "Other apps",
  record: "record",
  anyIntro:
    "Withdrawing consent from a real app, bank or shop? Record it here first. You get a timestamped record on Arkiv that you own and the company cannot change, and a message to send them.",
  companyLabel: "Company",
  companyHint: "e.g. a loan app, bank or shop",
  otherCompany: "Another company…",
  otherName: "Its name, for your message",
  otherNote: "Only goes in your message. Arkiv records it as \"Another company\".",
  purposeLabel: "What you are withdrawing",
  anyPrivacy: "Only the company, from the list, and the purpose are written to Arkiv. Nothing you type is.",
  recordBtn: "Record my withdrawal",
  letterIntro: (co: string) =>
    `Send this to ${co}'s grievance officer or data protection contact. Their email is in the privacy policy on the company's app or website, or use the app's privacy or contact form:`,
  copy: "Copy message",
  theCompany: "the company",
  linkPending: "(the link to your record appears here once it is on Arkiv)",
  letterDraft: "Your message, ready once the record is on Arkiv",
  copied: "Copied",
  letter: (co: string, purpose: string, when: Date, link: string) =>
    `To ${co},\n\nI withdraw my consent for you to use my personal data for: ${purpose}, with effect from ${when.toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST. Please stop this processing and ask any vendor you share my data with to stop too.\n\nI have kept a timestamped record of this withdrawal on Arkiv's public testnet (Tiramisu). You cannot change it:\n${link}\n\nUnder the Digital Personal Data Protection Act, 2023, withdrawing consent must be as easy as giving it, and a company must then stop processing and make its vendors stop (section 6).`,
  anyPurpose: {
    marketing_calls: "Marketing calls and SMS",
    sharing_partners: "Sharing my data with partners",
    personalised_ads: "Personalised ads",
    contacts_photos: "Reading my contacts or photos",
    other: "Everything I consented to",
    beyond_loan: "Using my data for anything beyond my loan",
    third_party_sharing: "Sharing my data with third parties",
    phone_access: "Access to my contacts, photos and call logs",
  } as Record<string, string>,
  searchPlaceholder: "Search a company or loan app",
  searching: "Searching RBI's directory of loan apps on Arkiv…",
  searchFailed: "Could not search RBI's directory just now. You can still pick a company from the list.",
  rbiListed: "RBI-listed loan app",
  lenderCount: (n: number) => `${n} lenders`,
  otherTyped: (name: string) => `Another company: "${name}"`,
  otherTypedHint: "The name goes only in your message",
  pickFromList: "Pick a name from the list to continue.",
  notListedA: "We could not find this name in RBI's directory of digital lending apps. If it is a loan app, it may not be linked to any RBI-regulated lender. You can report it on RBI's Sachet portal, ",
  notListedB: ", or call the cyber crime helpline ",
  notListedC: ".",
  inDirectory: "In RBI's directory of digital lending apps",
  lenderIs: (lender: string, type: string) => `lender ${lender} (${type})`,
  lenderTypes: { NBFC: "NBFC", BANK: "Bank", "HOUSING FINANCE COMPANY": "Housing finance company" } as Record<string, string>,
  sourceA: (date: string) => `Source: RBI's directory of digital lending apps, snapshot ${date}. Say So is not affiliated with or endorsed by RBI. `,
  rbiHome: "rbi.org.in",
  lenderLabel: "Lender",
  yourLender: "[your lender, as named in your Key Facts Statement]",
  pickLender: "Choose your lender",
  lenderNote: (n: number) => `${n} lenders lend through this app. Pick the one named in your loan agreement or Key Facts Statement.`,
  pickLenderFirst: "Choose your lender to continue.",
  loanPrivacy: "Only the app and lender, as listed by RBI, and the purpose are written to Arkiv. Nothing you type is.",
  loanLetterIntro: (lender: string) =>
    `Send this to the Grievance Redressal Officer of ${lender}. Their name and email are in your Key Facts Statement, your loan agreement, the app's grievance or contact page, and ${lender}'s website:`,
  directions: EN_DIRECTIONS,
  loanAsk: EN_LOANASK,
  loanLetter: (o: LoanLetter) => {
    const c = o.cite
    const when = o.when.toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" })
    const phone =
      o.purposeCode === "phone_access"
        ? ` Paragraph ${c.phone} also says your app, and the app of any Lending Service Provider you work with, must not access phone resources such as files and media, the contact list and call logs.`
        : ""
    return `To the Grievance Redressal Officer,\n${o.lender}\n\nSubject: Withdrawal of consent for ${o.app}\n\nI borrow through ${o.app}, which RBI's directory of digital lending apps lists with you as the lender. With effect from ${when} IST, I withdraw the consent I gave for: ${o.purpose}. ${EN_LOANASK[o.purposeCode] ?? ""}\n\nUnder paragraph ${c.consent} of the ${EN_DIRECTIONS[c.kind]}, I can revoke consent I have given, restrict the disclosure of my data to third parties, and ask that it be deleted. Under paragraph ${c.share}, my personal information may not be shared with any third party without my explicit consent unless a law or regulation requires it.${phone}\n\nPlease confirm in writing that you, and any Lending Service Provider acting for you, have stopped, and delete the data you are not legally required to keep. I understand you may keep what is needed to service my existing loan and to meet legal and credit reporting requirements.\n\n${c.kind === "rcb" ? `If I do not get a reply within 30 days, or I am not satisfied with it, I can complain under paragraph ${c.griev} to NABARD or to the Customer Education and Protection Cell of the Reserve Bank of India.` : `If I do not get a reply within 30 days, or I am not satisfied with it, I can complain to the Reserve Bank of India under paragraph ${c.griev} through its Complaint Management System at https://cms.rbi.org.in.`}\n\nI have kept a timestamped record of this withdrawal on Arkiv's public testnet (Tiramisu). Neither you nor the app can change it:\n${o.link}`
  },
  whoHas: "Who has your data",
  vNone: "Not using your data",
  vHolding: "Holding a lease",
  vPicking: "Picking it up…",
  vWaiting: "Waiting for its stop note",
  vStoppedIn: (d: string) => `Stopped · ${d}`,
  vStillUsing: (d: string) => `Still using · ${d}`,
  vEnded: "Permission ended",
  onChain: "on Arkiv",
  liveTitle: "Subscribed to Arkiv entity events over a WebSocket",
  live: (n: number) => `Live · ${n} Arkiv events`,
  reconnecting: "Reconnecting",
  reconnectingTitle: "The live Arkiv event stream dropped; reconnecting. Reads still work.",
  vendorBlurb: { ledgerlight: "Credit bureau", recoverly: "Collections", dakroute: "Delivery", pingwave: "SMS marketing" } as Record<string, string>,
  units: { day: "day", days: "days", h: "h", min: "min", s: "s" },
}

const HI_DIRECTIONS = {
  nbfc: "Reserve Bank of India (Non-Banking Financial Companies – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/347, 28 नवंबर 2025)",
  cb: "Reserve Bank of India (Commercial Banks – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/154, 28 नवंबर 2025)",
  sfb: "Reserve Bank of India (Small Finance Banks – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/185, 28 नवंबर 2025)",
  ucb: "Reserve Bank of India (Urban Co-operative Banks – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/277, 28 नवंबर 2025)",
  rcb: "Reserve Bank of India (Rural Co-operative Banks – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/302, 28 नवंबर 2025)",
  rrb: "Reserve Bank of India (Regional Rural Banks – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/253)",
  lab: "Reserve Bank of India (Local Area Banks – Credit Facilities) Directions, 2025 (RBI/DOR/2025-26/229)",
}

const HI_LOANASK: Record<string, string> = {
  beyond_loan: "कृपया मेरे मौजूदा लोन की सेवा के अलावा किसी और काम में, ऑफ़र भेजने या दूसरे प्रोडक्ट बेचने में भी, मेरे निजी डेटा का इस्तेमाल न करें।",
  third_party_sharing: "कृपया मेरा निजी डेटा किसी भी तीसरे पक्ष के साथ साझा करना बंद करें, सिवाय वहाँ जहाँ कोई क़ानून या नियम ऐसा माँगे।",
  phone_access: "कृपया मेरे कॉन्टैक्ट, फ़ोटो और फ़ाइलें, और कॉल लॉग पढ़ना बंद करें, और इनसे जो भी डेटा लिया गया है, उसे मिटा दें।",
  marketing_calls: "कृपया मार्केटिंग कॉल और SMS के लिए मेरे संपर्क विवरण का इस्तेमाल बंद करें।",
}

const hi: typeof en = {
  yourPhone: "आपके ऐप",
  keysStay: "आपकी निजी कुंजी इसी डिवाइस पर रहती है",
  myConsents: "मेरी सहमतियाँ",
  reading: "Arkiv से कंपनियों की सूचनाएँ पढ़ी जा रही हैं…",
  ask: (co) => `चुनिए कि ${co} आपके डेटा के साथ क्या कर सकता है। हर अनुमति अलग है, और कोई भी पहले से टिक नहीं है।`,
  sharedWith: (v) => `${v} के साथ साझा`,
  endsAfter: (d) => `${d} बाद ख़त्म`,
  endsIn: (d) => `${d} में ख़त्म`,
  endsOn: (date, d) => `${date} को ख़त्म (${d} में)`,
  notShared: (v) => `${v} के साथ साझा नहीं`,
  agree: (n, m) => `${m} में से ${n} के लिए सहमति दें`,
  tick: "जिनके लिए सहमत हैं, उन्हें टिक करें",
  noAll: "इनमें से किसी के लिए नहीं",
  kept: "आपका जवाब, हाँ हो या ना, सात साल तक आपकी अपनी रसीद के रूप में रहता है।",
  rights: (contact) =>
    `आपके अधिकार: 'मेरी सहमतियाँ' में कभी भी, उतनी ही आसानी से सहमति वापस लें जितनी आसानी से दी थी। सवाल या शिकायत: ${contact}। हल न हो तो आप भारतीय डेटा संरक्षण बोर्ड से शिकायत कर सकते हैं।`,
  answeredAll: (co) => `आप ${co} के हर अनुरोध का जवाब दे चुके हैं। आपके जवाब 'मेरी सहमतियाँ' में हैं।`,
  nothingYet: "अभी कुछ नहीं। Rupeeleaf या Bazaarline खोलें और चुनें कि वे क्या कर सकते हैं। आपका हर जवाब यहाँ दिखेगा।",
  knowsYouAs: "आपको इस पते से जानता है:",
  withdraw: "सहमति वापस लें",
  renew: "आगे बढ़ाएँ",
  startOver: "नए व्यक्ति के रूप में फिर से शुरू करें",
  backup: "अपना रिकवरी फ़्रेज़ सहेजें",
  restore: "वापस लाएँ",
  backupNote: "ये 12 शब्द आपकी सहमतियों की इकलौती चाबी हैं। इन्हें सुरक्षित रखें: इनसे आप किसी भी ब्राउज़र से सहमति वापस ले सकते हैं। जिसके पास ये हों, वह आपकी तरह काम कर सकता है।",
  restoreNote: "अपना 12 शब्दों का रिकवरी फ़्रेज़ चिपकाएँ।",
  restoreBad: "यह 12 शब्दों का सही फ़्रेज़ नहीं है।",
  startOverWarn: "इससे इस ब्राउज़र में एक नई पहचान बनेगी। आपकी मौजूदा सहमतियाँ Arkiv पर रहेंगी, पर बाद में उन्हें वापस लेने के लिए आपको अपना रिकवरी फ़्रेज़ चाहिए होगा।",
  eachTap: "हर टैप एक Arkiv लेनदेन है, जिस पर इसी ब्राउज़र में हस्ताक्षर होते हैं।",
  relay: " आपके नेटवर्क ने Arkiv का मुफ़्त रीड कोटा इस्तेमाल कर लिया है, इसलिए अब डेटा Say So के रीड-ओनली रिले से पढ़ा जा रहा है।",
  seeTx: "लेनदेन देखें",
  busy: (label) => `Arkiv पर: ${label}…`,
  saved: "Arkiv पर सहेजा गया।",
  saidNoBefore: "आपने पहले इसके लिए मना किया था। आप अब भी अपना फ़ैसला बदल सकते हैं।",
  usually: "(आम तौर पर 4 से 10 सेकंड)",
  saving: (n) => (n === 0 ? "आपका 'ना' सहेजा जा रहा है" : n === 1 ? "1 सहमति सहेजी जा रही है" : `${n} सहमतियाँ सहेजी जा रही हैं`),
  withdrawing: (p) => `${p} की सहमति वापस ली जा रही है`,
  renewing: (p) => `${p} की सहमति आगे बढ़ाई जा रही है`,
  renewed: "आगे बढ़ाई गई",
  keepLonger: "और लंबे समय तक रखें",
  keepLongerTitle: "इस रिकॉर्ड को आज से आठ साल तक रखें",
  extended: "बढ़ा दिया गया",
  extending: "आपका रिकॉर्ड आगे बढ़ाया जा रहा है",
  keptUntil: (date) => `${date} तक रखा जाएगा`,
  deleteRecord: "मिटाएँ",
  deleteConfirm: "हमेशा के लिए मिटाएँ",
  deleteWarn: "इससे Arkiv से आपका सबूत हट जाएगा, और आपके संदेश का लिंक काम करना बंद कर देगा।",
  deleting: "आपका रिकॉर्ड मिटाया जा रहा है",
  ownAddress: "अलग पता",
  via: (co) => `${co} के ज़रिए`,
  status: {
    using: "इस्तेमाल में",
    pending: "वेंडर का इंतज़ार",
    stopped: "वापस ली गई · वेंडर ने रोक दिया",
    ignoring: "वापस ली गई · वेंडर ने नहीं रोका",
    released: "वापस ली गई",
    ended: "अपने-आप ख़त्म",
    denied: "आपने मना किया",
  },
  vStopped: (v, d) => `आपके सहमति वापस लेने के ${d} बाद ${v} ने इस्तेमाल बंद करने की पुष्टि पर हस्ताक्षर किए`,
  vIgnoring: (v, d) => `आपके सहमति वापस लेने के ${d} बाद भी ${v} ने इस्तेमाल बंद करने की पुष्टि नहीं की है`,
  vReleased: (v) => `${v} की ओर से इस्तेमाल बंद करने की पुष्टि का इंतज़ार`,
  vUsing: (v) => `${v} के पास इस्तेमाल की अनुमति (लीज़) है, जो इस सहमति के साथ ख़त्म होगी`,
  vPending: (v) => `${v} ने अभी इसे शुरू नहीं किया है`,
  purpose: { credit_check: "क्रेडिट जाँच", loan_servicing: "लोन सेवा", marketing: "SMS ऑफ़र", delivery: "डिलीवरी" },
  blurb: { rupeeleaf: "तुरंत पर्सनल लोन", bazaarline: "घर तक किराना" },
  anyApp: "कोई भी ऐप",
  recording: "आपकी सहमति वापसी दर्ज की जा रही है",
  otherApps: "दूसरे ऐप",
  record: "रिकॉर्ड",
  anyIntro:
    "किसी असली ऐप, बैंक या दुकान से सहमति वापस ले रहे हैं? पहले यहाँ दर्ज करें। आपको Arkiv पर समय के साथ एक रिकॉर्ड मिलेगा जो आपका है और जिसे कंपनी बदल नहीं सकती, और उन्हें भेजने के लिए एक संदेश।",
  companyLabel: "कंपनी",
  companyHint: "जैसे कोई लोन ऐप, बैंक या दुकान",
  otherCompany: "कोई और कंपनी…",
  otherName: "उसका नाम, आपके संदेश के लिए",
  otherNote: "यह सिर्फ़ आपके संदेश में जाता है। Arkiv पर \"Another company\" लिखा जाता है।",
  purposeLabel: "आप किस बात की सहमति वापस ले रहे हैं",
  anyPrivacy: "Arkiv पर सिर्फ़ सूची से चुनी गई कंपनी और मक़सद लिखा जाता है। आप जो टाइप करते हैं, वह नहीं।",
  recordBtn: "मेरी सहमति वापसी दर्ज करें",
  letterIntro: (co) =>
    `इसे ${co} के शिकायत अधिकारी या डेटा सुरक्षा संपर्क को भेजें। उनका ईमेल कंपनी के ऐप या वेबसाइट की प्राइवेसी पॉलिसी में होता है, या आप ऐप का प्राइवेसी या संपर्क फ़ॉर्म इस्तेमाल करें:`,
  copy: "संदेश कॉपी करें",
  theCompany: "कंपनी",
  linkPending: "(Arkiv पर रिकॉर्ड बनते ही आपके रिकॉर्ड का लिंक यहाँ आएगा)",
  letterDraft: "आपका संदेश, Arkiv पर रिकॉर्ड बनते ही तैयार",
  copied: "कॉपी हो गया",
  letter: (co, purpose, when, link) =>
    `${co} को,\n\nमैं ${when.toLocaleString("hi-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" })} (IST) से अपने निजी डेटा के इस इस्तेमाल के लिए अपनी सहमति वापस लेता/लेती हूँ: ${purpose}। कृपया यह इस्तेमाल बंद करें, और जिन वेंडरों के साथ आप मेरा डेटा साझा करते हैं, उनसे भी बंद करवाएँ।\n\nमैंने इस सहमति वापसी का समय के साथ एक रिकॉर्ड Arkiv के सार्वजनिक टेस्टनेट (Tiramisu) पर रखा है। आप इसे बदल नहीं सकते:\n${link}\n\nडिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के अनुसार सहमति वापस लेना उतना ही आसान होना चाहिए जितना देना, और उसके बाद कंपनी को इस्तेमाल बंद करना होता है और अपने वेंडरों से भी बंद करवाना होता है (धारा 6)।`,
  anyPurpose: {
    marketing_calls: "मार्केटिंग कॉल और SMS",
    sharing_partners: "मेरा डेटा पार्टनरों के साथ साझा करना",
    personalised_ads: "मेरे हिसाब से विज्ञापन",
    contacts_photos: "मेरे कॉन्टैक्ट या फ़ोटो पढ़ना",
    other: "जिस भी चीज़ के लिए मैंने सहमति दी थी",
    beyond_loan: "लोन के अलावा किसी और काम में मेरे डेटा का इस्तेमाल",
    third_party_sharing: "मेरा डेटा तीसरे पक्षों के साथ साझा करना",
    phone_access: "मेरे कॉन्टैक्ट, फ़ोटो और कॉल लॉग तक पहुँच",
  },
  searchPlaceholder: "कंपनी या लोन ऐप खोजें",
  searching: "Arkiv पर RBI की लोन ऐप सूची में खोज रहे हैं…",
  searchFailed: "अभी RBI की सूची में खोज नहीं हो पाई। आप फिर भी सूची से कोई कंपनी चुन सकते हैं।",
  rbiListed: "RBI की सूची में दर्ज लोन ऐप",
  lenderCount: (n) => `${n} लेंडर`,
  otherTyped: (name) => `कोई और कंपनी: "${name}"`,
  otherTypedHint: "यह नाम सिर्फ़ आपके संदेश में जाएगा",
  pickFromList: "आगे बढ़ने के लिए सूची से कोई नाम चुनें।",
  notListedA: "यह नाम RBI की डिजिटल लेंडिंग ऐप्स की सूची में नहीं मिला। अगर यह लोन ऐप है, तो हो सकता है कि यह RBI से नियंत्रित किसी भी लेंडर से जुड़ा न हो। आप इसकी शिकायत RBI के Sachet पोर्टल (",
  notListedB: ") पर कर सकते हैं, या साइबर क्राइम हेल्पलाइन ",
  notListedC: " पर कॉल कर सकते हैं।",
  inDirectory: "RBI की डिजिटल लेंडिंग ऐप्स की सूची में दर्ज",
  lenderIs: (lender, type) => `लेंडर ${lender} (${type})`,
  lenderTypes: { NBFC: "NBFC", BANK: "बैंक", "HOUSING FINANCE COMPANY": "हाउसिंग फ़ाइनेंस कंपनी" },
  sourceA: (date) => `स्रोत: RBI की डिजिटल लेंडिंग ऐप्स की सूची, ${date} की कॉपी। Say So का RBI से कोई संबंध नहीं है, और RBI इसका समर्थन नहीं करता। `,
  rbiHome: "rbi.org.in",
  lenderLabel: "लेंडर",
  yourLender: "[आपका लेंडर, जैसा आपके Key Facts Statement में लिखा है]",
  pickLender: "अपना लेंडर चुनें",
  lenderNote: (n) => `इस ऐप से ${n} लेंडर लोन देते हैं। वही चुनें जिसका नाम आपके लोन एग्रीमेंट या Key Facts Statement में है।`,
  pickLenderFirst: "आगे बढ़ने के लिए अपना लेंडर चुनें।",
  loanPrivacy: "Arkiv पर सिर्फ़ RBI की सूची वाला ऐप और लेंडर, और मक़सद लिखा जाता है। आप जो टाइप करते हैं, वह नहीं।",
  loanLetterIntro: (lender) =>
    `इसे ${lender} के शिकायत निवारण अधिकारी (Grievance Redressal Officer) को भेजें। उनका नाम और ईमेल आपके Key Facts Statement, लोन एग्रीमेंट, ऐप के शिकायत या संपर्क पेज, और ${lender} की वेबसाइट पर मिलता है:`,
  directions: HI_DIRECTIONS,
  loanAsk: HI_LOANASK,
  loanLetter: (o) => {
    const c = o.cite
    const when = o.when.toLocaleString("hi-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" })
    const phone =
      o.purposeCode === "phone_access"
        ? ` पैराग्राफ़ ${c.phone} यह भी कहता है कि आपका ऐप, और आपके साथ काम करने वाले किसी भी लेंडिंग सर्विस प्रोवाइडर का ऐप, फ़ोन की फ़ाइलें और मीडिया, कॉन्टैक्ट लिस्ट और कॉल लॉग जैसी चीज़ें नहीं पढ़ सकता।`
        : ""
    return `सेवा में,\nशिकायत निवारण अधिकारी (Grievance Redressal Officer),\n${o.lender}\n\nविषय: ${o.app} के लिए दी गई सहमति वापस लेना\n\nमैं ${o.app} के ज़रिए लोन लेता/लेती हूँ, और RBI की डिजिटल लेंडिंग ऐप्स की सूची में इस ऐप के लेंडर के रूप में आपका नाम दर्ज है। ${when} (IST) से मैं इस बात के लिए दी गई अपनी सहमति वापस लेता/लेती हूँ: ${o.purpose}। ${HI_LOANASK[o.purposeCode] ?? ""}\n\n${HI_DIRECTIONS[c.kind]} के पैराग्राफ़ ${c.consent} के तहत मैं दी हुई सहमति वापस ले सकता/सकती हूँ, तीसरे पक्षों को अपना डेटा देने पर रोक लगा सकता/सकती हूँ, और उसे मिटाने के लिए कह सकता/सकती हूँ। पैराग्राफ़ ${c.share} के तहत, जब तक कोई क़ानून या नियम ऐसा न माँगे, मेरी स्पष्ट सहमति के बिना मेरी निजी जानकारी किसी तीसरे पक्ष के साथ साझा नहीं की जा सकती।${phone}\n\nकृपया लिखकर पुष्टि करें कि आपने, और आपकी ओर से काम करने वाले हर लेंडिंग सर्विस प्रोवाइडर ने, यह बंद कर दिया है, और जो डेटा रखना क़ानूनन ज़रूरी नहीं है, उसे मिटा दें। मैं समझता/समझती हूँ कि मेरे मौजूदा लोन की सेवा और क़ानूनी व क्रेडिट रिपोर्टिंग की ज़रूरतों के लिए जो डेटा चाहिए, वह आप रख सकते हैं।\n\n${c.kind === "rcb" ? `अगर 30 दिन में जवाब न मिले, या मैं जवाब से संतुष्ट न होऊँ, तो मैं पैराग्राफ़ ${c.griev} के तहत NABARD से, या भारतीय रिज़र्व बैंक के ग्राहक शिक्षा और संरक्षण प्रकोष्ठ (Customer Education and Protection Cell) से शिकायत कर सकता/सकती हूँ।` : `अगर 30 दिन में जवाब न मिले, या मैं जवाब से संतुष्ट न होऊँ, तो मैं पैराग्राफ़ ${c.griev} के तहत भारतीय रिज़र्व बैंक की शिकायत प्रबंधन प्रणाली (CMS) पर शिकायत कर सकता/सकती हूँ: https://cms.rbi.org.in`}\n\nमैंने इस सहमति वापसी का समय के साथ एक रिकॉर्ड Arkiv के सार्वजनिक टेस्टनेट (Tiramisu) पर रखा है। न आप और न ऐप इसे बदल सकते हैं:\n${o.link}`
  },
  whoHas: "आपका डेटा किसके पास है",
  vNone: "आपका डेटा इस्तेमाल नहीं कर रहा",
  vHolding: "इस्तेमाल की अनुमति (लीज़) है",
  vPicking: "शुरू कर रहा है…",
  vWaiting: "रुकने की पुष्टि का इंतज़ार",
  vStoppedIn: (d) => `रुक गया · ${d}`,
  vStillUsing: (d) => `अब भी इस्तेमाल · ${d}`,
  vEnded: "अनुमति ख़त्म",
  onChain: "Arkiv पर",
  liveTitle: "WebSocket से Arkiv की घटनाएँ",
  live: (n) => `लाइव · ${n} Arkiv घटनाएँ`,
  reconnecting: "फिर से जुड़ रहा है",
  reconnectingTitle: "Arkiv की लाइव घटनाओं से जुड़ाव टूट गया है; फिर से जोड़ा जा रहा है। डेटा पढ़ना जारी है।",
  vendorBlurb: { ledgerlight: "क्रेडिट ब्यूरो", recoverly: "वसूली", dakroute: "डिलीवरी", pingwave: "SMS मार्केटिंग" },
  units: { day: "दिन", days: "दिन", h: "घंटे", min: "मिनट", s: "सेकंड" },
}

export const STRINGS = { en, hi }
export const LangContext = createContext<Lang>("en")
export const useT = () => STRINGS[useContext(LangContext)]

export function loadLang(): Lang {
  try {
    return localStorage.getItem("sayso.lang") === "hi" ? "hi" : "en"
  } catch {
    return "en"
  }
}
export function saveLang(l: Lang) {
  try {
    localStorage.setItem("sayso.lang", l)
  } catch {
    /* storage blocked */
  }
}
