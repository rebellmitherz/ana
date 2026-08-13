import type { LLMProvider, ProviderResponse, StructuredRequest } from '../types'

/**
 * Mock-Provider — der Grund, warum ALUBALI ohne einen einzigen API-Key
 * vollständig benutzbar ist.
 *
 * Das ist kein Platzhalter, der `{}` zurückgibt: Die Antworten sind realistisch
 * und werden aus der tatsächlichen Eingabe abgeleitet (Namen, Zahlen, Daten,
 * Stichworte). Damit fühlt sich der Demo-Modus lebendig an und jeder Flow ist
 * ehrlich testbar — inklusive der Fälle „unsicher" und „fehlt".
 */

const GEORGIAN_NAMES: Record<string, string> = {
  ნინო: 'Nino',
  თამარ: 'Tamar',
  ეკა: 'Eka',
  მარიამ: 'Mariam',
  ნათია: 'Natia',
  ლიკა: 'Lika',
  მაია: 'Maia',
  ქეთევან: 'Ketevan',
  სოფიო: 'Sopio',
  ნანა: 'Nana',
  ია: 'Ia',
  ლალი: 'Lali',
}

/**
 * Monatsstämme, bewusst kurz gehalten.
 *
 * Georgisch synkopiert im Kasus: აგვისტო → აგვისტოდან, ოქტომბერი → ოქტომბრიდან.
 * Der volle Nominativ trifft deshalb nicht — der Stamm ohne den letzten Vokal
 * schon.
 */
const MONTHS: Record<string, number> = {
  იანვ: 1, თებერვ: 2, მარტ: 3, აპრილ: 4, მაის: 5, ივნის: 6,
  ივლის: 7, აგვისტ: 8, სექტემბ: 9, ოქტომბ: 10, ნოემბ: 11, დეკემბ: 12,
  januar: 1, februar: 2, märz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
}

/** Georgische Zahlwörter — im Gespräch häufiger als Ziffern. */
const NUMBER_WORDS: Record<string, number> = {
  ერთ: 1, ორ: 2, სამ: 3, ოთხ: 4, ხუთ: 5, ექვს: 6,
  შვიდ: 7, რვა: 8, ცხრა: 9, ათ: 10, თერთმეტ: 11, თორმეტ: 12,
  ცამეტ: 13, თხუთმეტ: 15, ოცდა: 20,
}

const SKILL_HINTS: Record<string, string> = {
  დემენც: 'dementia',
  demenz: 'dementia',
  ალცჰაიმერ: 'dementia',
  წოლით: 'bedridden',
  bettläg: 'bedridden',
  მობილიზ: 'mobilization',
  დიაბეტ: 'diabetes',
  diabet: 'diabetes',
  ინსულტ: 'stroke',
  schlaganfall: 'stroke',
  პარკინსონ: 'parkinson',
  parkinson: 'parkinson',
  ჭრილობ: 'wound_care',
  wund: 'wound_care',
  მედიკამენტ: 'medication',
  ინკონტინენც: 'incontinence',
  პალიატ: 'palliative',
  სამზარეულ: 'cooking',
  ვამზადებ: 'cooking',
  koch: 'cooking',
  დიასახლის: 'household',
  haushalt: 'household',
}

function findName(text: string): string | null {
  for (const [georgian, latin] of Object.entries(GEORGIAN_NAMES)) {
    if (text.includes(georgian)) return latin
  }
  const latinMatch = /\b([A-ZÄÖÜ][a-zäöüß]{2,})\b/.exec(text)
  return latinMatch?.[1] ?? null
}

/** Georgisches Zahlwort → Zahl, sonst die Ziffer selbst. */
function wordToNumber(token: string): number | null {
  const digits = /^\d+$/.exec(token.trim())
  if (digits) return Number(token)

  for (const [stem, value] of Object.entries(NUMBER_WORDS)) {
    if (token.startsWith(stem)) return value
  }
  return null
}

/**
 * Ziffer oder georgisches Zahlwort samt Endung.
 *
 * Die Klammer um die Alternation ist wesentlich: ohne sie gilt das `\S*` nur
 * für die letzte Variante, und „ექვსი" (sechs, flektiert) wird nicht erkannt.
 */
const NUMBER_TOKEN = `(\\d+|(?:${Object.keys(NUMBER_WORDS).join('|')})\\S*)`

/**
 * Ende eines georgischen Wortes.
 *
 * `\b` taugt hier nicht: JavaScript definiert Wortgrenzen über ASCII, und
 * zwischen zwei georgischen Buchstaben besteht deshalb nie eine Grenze.
 */
const GEO_WORD_END = '(?![\\u10A0-\\u10FF])'

/**
 * Gezielte Extraktion statt Zahlenraten.
 *
 * Die frühere Variante sammelte alle Zahlen und ordnete sie nach Wertebereich
 * zu — damit wurde aus „15 ოქტომბრიდან" prompt eine Erfahrung von 15 Jahren.
 * Eine still erfundene Angabe ist der teuerste Fehler, den diese App machen
 * kann; deshalb wird hier nur übernommen, was ausdrücklich benannt ist.
 */
function findExperienceYears(text: string): number | null {
  const patterns = [
    new RegExp(`${NUMBER_TOKEN}\\s*წლ\\S*\\s*(?:სამუშაო\\s*)?გამოცდილებ`, 'i'),
    new RegExp(`გამოცდილებ\\S*\\s*${NUMBER_TOKEN}\\s*წლ`, 'i'),
    /(\d+)\s*Jahre?\s+Erfahrung/i,
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match?.[1]) {
      const value = wordToNumber(match[1])
      if (value !== null && value >= 0 && value <= 60) return value
    }
  }
  return null
}

function findAge(text: string): number | null {
  const patterns = [
    new RegExp(`${NUMBER_TOKEN}\\s*წლ(?:ის|ისაა)${GEO_WORD_END}`, 'i'),
    /\b(\d{2})\s*Jahre\s+alt/i,
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match?.[1]) {
      const value = wordToNumber(match[1])
      // Nur plausible Lebensalter — „8 წლის გამოცდილება" ist kein Alter.
      if (value !== null && value >= 18 && value <= 100) return value
    }
  }
  return null
}

function findRotationWeeks(text: string): number | null {
  const match = new RegExp(`${NUMBER_TOKEN}\\s*კვირ`, 'i').exec(text)
  const value = match?.[1] ? wordToNumber(match[1]) : null
  return value !== null && value >= 1 && value <= 52 ? value : null
}

function findGermanLevel(text: string): number | null {
  const match = /\b([ABC])\s?([12])\b/i.exec(text)
  if (!match) return null
  const letter = match[1]!.toUpperCase()
  const digit = Number(match[2])
  const base = letter === 'A' ? 0 : letter === 'B' ? 2 : 4
  return base + digit
}

function findDate(text: string): string | null {
  const lower = text.toLowerCase()
  const explicit = /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/.exec(text)
  if (explicit) {
    const [, d, m, y] = explicit
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  for (const [key, month] of Object.entries(MONTHS)) {
    if (!lower.includes(key)) continue
    const dayMatch = new RegExp(`(\\d{1,2})\\s*[^\\d]{0,12}${key}`, 'i').exec(lower)
    const day = dayMatch ? Number(dayMatch[1]) : 1
    const today = new Date()
    let year = today.getFullYear()
    if (month < today.getMonth() + 1) year += 1
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return null
}

function findSkills(text: string): string[] {
  const lower = text.toLowerCase()
  const found = new Set<string>()
  for (const [hint, skill] of Object.entries(SKILL_HINTS)) {
    if (lower.includes(hint)) found.add(skill)
  }
  return [...found]
}

// ---------------------------------------------------------------------------

function mockCaregiver(text: string): Record<string, unknown> {
  const age = findAge(text)
  const currentYear = new Date().getFullYear()

  return {
    first_name: findName(text) ?? 'Nino',
    last_name: null,
    birth_year: age ? currentYear - age : null,
    phone: /\+?\d{7,}/.exec(text.replace(/\s/g, ''))?.[0] ?? null,
    city: null,
    german_level: findGermanLevel(text),
    experience_years: findExperienceYears(text),
    skills: findSkills(text),
    driver_license: /მართვის|führerschein/i.test(text) ? !/არ აქვს|kein/i.test(text) : null,
    smoker: /ეწევა|raucht/i.test(text) ? !/არ ეწევა|nicht/i.test(text) : null,
    night_work: /ღამ|nacht/i.test(text) ? true : null,
    cooking: /სამზარეულ|ვამზადებ|koch/i.test(text) ? true : null,
    available_from: findDate(text),
    rotation_weeks: findRotationWeeks(text),
    notes: null,
  }
}

function mockFamily(text: string): Record<string, unknown> {
  const patientAge = findAge(text)
  const currentYear = new Date().getFullYear()
  const lower = text.toLowerCase()

  const careLevel = /(?:pflegegrad|მოვლის ხარისხი)\s*(\d)/i.exec(text)
  const budget = /(\d{3,5})\s*(?:€|euro|ევრო)/i.exec(text)

  return {
    contact_name: findName(text) ?? 'Familie Müller',
    relation: /ქალიშვილ|tochter/i.test(text) ? 'Tochter' : null,
    phone: null,
    email: null,
    city: null,
    patient_first_name: null,
    patient_birth_year: patientAge ? currentYear - patientAge : null,
    care_level: careLevel?.[1] ? Number(careLevel[1]) : null,
    mobility: /წოლით|bettläg/i.test(lower)
      ? 'bedridden'
      : /ეტლ|rollstuhl/i.test(lower)
        ? 'wheelchair'
        : /დამოუკიდებლად|mobil/i.test(lower)
          ? 'mobile'
          : null,
    dementia: /დემენც|demenz/i.test(lower)
      ? /დაწყებით|beginnend|leicht/i.test(lower)
        ? 'mild'
        : 'moderate'
      : null,
    living_situation: /მარტო|allein/i.test(lower) ? 'alone' : null,
    night_work_required: /ღამ|nacht/i.test(lower),
    driver_license_required: /მართვის|führerschein/i.test(lower),
    smoking_allowed: false,
    required_german_level: findGermanLevel(text),
    tasks: [],
    start_date: findDate(text),
    expected_months: null,
    budget_eur: budget?.[1] ? Number(budget[1]) : null,
    notes: null,
    diagnoses: null,
  }
}

function mockDocument(): Record<string, unknown> {
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + 14)

  return {
    document_type: 'krankenkasse',
    sender: 'AOK Bayern — Pflegekasse',
    subject_ka: 'მოთხოვნა დამატებით დოკუმენტებზე მოვლის ხარისხის განაცხადში',
    summary_ka:
      'ჯანმრთელობის დაზღვევა გწერს, რომ მოვლის ხარისხის (Pflegegrad) განაცხადი მიღებულია, მაგრამ საქმეს აკლია ერთი დოკუმენტი. სანამ ის არ მიიღეს, გადაწყვეტილებას ვერ მიიღებენ.',
    what_they_want_ka:
      'სჭირდებათ ექიმის ცნობა ბოლო ექვსი თვის განმავლობაში ჩატარებული მკურნალობის შესახებ. ცნობა უნდა გამოგზავნო ფოსტით ან ატვირთო მათ ონლაინ პორტალზე.',
    action_required: true,
    deadline: {
      date: deadline.toISOString().slice(0, 10),
      what_ka: 'ამ თარიღამდე უნდა გაგზავნო ექიმის ცნობა',
    },
    next_steps_ka: [
      'დაურეკე ოჯახის ექიმს და სთხოვე ცნობა',
      'ცნობა გადაუღე ან დაასკანერე',
      'გააგზავნე მითითებულ მისამართზე ვადის გასვლამდე',
      'შეინახე გაგზავნის დადასტურება',
    ],
    important_ka:
      'თუ ვადაში ვერ მოასწრებ, დარეკე და სთხოვე გაგრძელება — ამას ჩვეულებრივ აძლევენ. მთავარია, უპასუხოდ არ დატოვო.',
    amounts: [],
    advisory_level: 'sensitive',
    original_excerpt:
      'Sehr geehrte Damen und Herren, Ihr Antrag auf Feststellung der Pflegebedürftigkeit ist bei uns eingegangen. Zur abschließenden Prüfung benötigen wir noch einen ärztlichen Befundbericht…',
  }
}

function mockMessage(text: string): Record<string, unknown> {
  const name = findName(text) ?? 'Nino'
  const hasRoom = /ოთახ|zimmer/i.test(text)
  const detail = hasRoom ? ' Sie würde nur gerne vorher wissen, ob sie ein eigenes Zimmer hat.' : ''

  return {
    variants: [
      {
        key: 'natural',
        text_de: `Guten Tag,\n\nich habe gute Nachrichten: ${name} könnte am Montag anfangen.${detail}\n\nSagen Sie mir gerne kurz Bescheid, dann plane ich alles Weitere.\n\nHerzliche Grüße`,
      },
      {
        key: 'short',
        text_de: `Hallo, ${name} kann Montag anfangen.${detail} Passt das für Sie?`,
      },
      {
        key: 'professional',
        text_de: `Sehr geehrte Damen und Herren,\n\ngerne teile ich Ihnen mit, dass ${name} den Einsatz zum kommenden Montag aufnehmen kann.${detail}\n\nFür eine kurze Rückmeldung wäre ich Ihnen dankbar.\n\nMit freundlichen Grüßen`,
      },
    ],
    back_translation_ka: `ვწერ, რომ ${name}-ს ორშაბათს შეუძლია დაწყება.${
      hasRoom ? ' და ვეკითხები, ექნება თუ არა ცალკე ოთახი.' : ''
    } ვთხოვ, მოკლედ მიპასუხონ.`,
  }
}

function mockTranslation(text: string, system: string): Record<string, unknown> {
  const toGerman = system.includes('Deutsch') || /→ *de/i.test(system)
  return {
    translation: toGerman
      ? `[Demo-Übersetzung] ${text.slice(0, 400)}`
      : `[დემო თარგმანი] ${text.slice(0, 400)}`,
    note: null,
  }
}

function mockRoute(text: string): Record<string, unknown> {
  const lower = text.toLowerCase()
  const looksLikeCaregiver =
    /წლის|გამოცდილება|მომვლელ|დემენც|თავისუფალ|erfahrung|jahre/i.test(lower) &&
    !/ოჯახ|familie|დედაჩემ|ბებია/i.test(lower)
  const looksLikeFamily = /ოჯახ|familie|ბებია|ბაბუა|პაციენტ|mutter|vater/i.test(lower)
  const looksLikeTask = /შემახსენ|დამავიწყ|დავალებ|erinner|aufgabe/i.test(lower)

  const tool = looksLikeCaregiver
    ? 'createCaregiverDraft'
    : looksLikeFamily
      ? 'createFamilyDraft'
      : looksLikeTask
        ? 'createTask'
        : 'createNote'

  return {
    tool,
    confidence: tool === 'createNote' ? 0.5 : 0.86,
    reasoning_ka: 'დემო რეჟიმი — გადაწყვეტილება საკვანძო სიტყვებით',
  }
}

// ---------------------------------------------------------------------------

export const mockProvider: LLMProvider = {
  id: 'mock',
  supportsVision: true,

  async generate<T>(request: StructuredRequest<T>, _model: string): Promise<ProviderResponse> {
    // Kleine, realistisch wirkende Latenz — die UI-Zustände sollen echt getestet werden.
    await new Promise((resolve) => setTimeout(resolve, 550 + Math.random() * 500))

    const text = request.user

    const raw = ((): Record<string, unknown> => {
      switch (request.task) {
        case 'caregiver.extract':
          return mockCaregiver(text)
        case 'family.extract':
          return mockFamily(text)
        case 'document.explain':
          return mockDocument()
        case 'message.draft':
          return mockMessage(text)
        case 'translate':
          return mockTranslation(text, request.system)
        case 'assistant.route':
          return mockRoute(text)
        case 'search.filter':
          return { skills: findSkills(text), available_from: findDate(text), german_level_min: null }
      }
    })()

    return { raw, inputTokens: 0, outputTokens: 0 }
  },
}
