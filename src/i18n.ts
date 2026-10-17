// The person's screens in English and Hindi. A notice and a consent request must be available in
// English or any language in the Eighth Schedule (DPDP Act s.5(3), s.6(3)); Hindi is the first one.
import { createContext, useContext } from "react"

export type Lang = "en" | "hi"

const en = {
  yourPhone: "Your phone",
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
  purposeLabel: "What you are withdrawing",
  anyPrivacy: "Only the company's name and the purpose are written to Arkiv. Numbers and @ are blocked, so a phone number or email cannot slip in.",
  recordBtn: "Record my withdrawal",
  letterIntro: (co: string) => `Send this to ${co} (email, chat or their app's privacy form):`,
  copy: "Copy message",
  copied: "Copied",
  letter: (co: string, purpose: string, when: Date, link: string) =>
    `To ${co},\n\nI withdraw my consent for you to use my personal data for: ${purpose}, with effect from ${when.toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST. Please stop this processing and ask any vendor you share my data with to stop too.\n\nI have kept a timestamped record of this withdrawal on Arkiv, a public database that neither of us can alter:\n${link}\n\nUnder the Digital Personal Data Protection Act, 2023, withdrawing consent must be as easy as giving it, and a company must then stop processing and make its vendors stop (section 6).`,
  anyPurpose: {
    marketing_calls: "Marketing calls and SMS",
    sharing_partners: "Sharing my data with partners",
    personalised_ads: "Personalised ads",
    contacts_photos: "Reading my contacts or photos",
    other: "Everything I consented to",
  } as Record<string, string>,
  units: { day: "day", days: "days", h: "h", min: "min", s: "s" },
}

const hi: typeof en = {
  yourPhone: "आपका फ़ोन",
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
  purposeLabel: "आप किस बात की सहमति वापस ले रहे हैं",
  anyPrivacy: "Arkiv पर सिर्फ़ कंपनी का नाम और मक़सद लिखा जाता है। अंक और @ नहीं लिखे जा सकते, ताकि कोई फ़ोन नंबर या ईमेल न चला जाए।",
  recordBtn: "मेरी सहमति वापसी दर्ज करें",
  letterIntro: (co) => `इसे ${co} को भेजें (ईमेल, चैट या उनके ऐप के प्राइवेसी फ़ॉर्म से):`,
  copy: "संदेश कॉपी करें",
  copied: "कॉपी हो गया",
  letter: (co, purpose, when, link) =>
    `${co} को,\n\nमैं ${when.toLocaleString("hi-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" })} (IST) से अपने निजी डेटा के इस इस्तेमाल के लिए अपनी सहमति वापस लेता/लेती हूँ: ${purpose}। कृपया यह इस्तेमाल बंद करें, और जिन वेंडरों के साथ आप मेरा डेटा साझा करते हैं, उनसे भी बंद करवाएँ।\n\nमैंने इस सहमति वापसी का समय के साथ एक रिकॉर्ड Arkiv पर रखा है, जो एक सार्वजनिक डेटाबेस है और जिसे हम में से कोई नहीं बदल सकता:\n${link}\n\nडिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के अनुसार सहमति वापस लेना उतना ही आसान होना चाहिए जितना देना, और उसके बाद कंपनी को इस्तेमाल बंद करना होता है और अपने वेंडरों से भी बंद करवाना होता है (धारा 6)।`,
  anyPurpose: {
    marketing_calls: "मार्केटिंग कॉल और SMS",
    sharing_partners: "मेरा डेटा पार्टनरों के साथ साझा करना",
    personalised_ads: "मेरे हिसाब से विज्ञापन",
    contacts_photos: "मेरे कॉन्टैक्ट या फ़ोटो पढ़ना",
    other: "जिस भी चीज़ के लिए मैंने सहमति दी थी",
  },
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
