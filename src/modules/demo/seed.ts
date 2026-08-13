import 'server-only'

import { getScopedStore } from '@/core/db'
import { TABLE_NAMES, type CareCaseRow, type CaregiverRow } from '@/core/db/types'
import type { Session } from '@/core/auth/session'
import { MATCHING_VERSION, scoreMatch } from '@/modules/matching/score'

/**
 * Demo-Daten.
 *
 * Grund: Eine leere Vermittlungsplattform kann nichts zeigen. Beim ersten
 * Öffnen muss die App beweisen, was sie kann — nicht um Eingaben bitten.
 *
 * Alles ist mit `is_demo: true` markiert und lässt sich in einem Schritt
 * vollständig entfernen (`removeDemoData`). Keine Lorem-Ipsum-Daten: georgische
 * Namen, die es wirklich gibt, und deutsche Pflegesituationen, die realistisch
 * sind.
 */

const DAY = 86_400_000

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10)
}

function isoTime(offsetDays: number, hour = 9): string {
  const date = new Date(Date.now() + offsetDays * DAY)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

const currentYear = new Date().getFullYear()

type CaregiverSeed = Omit<
  CaregiverRow,
  'id' | 'org_id' | 'created_at' | 'updated_at' | 'is_demo' | 'deleted_at'
>

const CAREGIVERS: CaregiverSeed[] = [
  {
    first_name: 'Nino',
    last_name: 'Beridze',
    birth_year: currentYear - 47,
    phone: '+995 599 24 18 07',
    whatsapp: '+995 599 24 18 07',
    city: 'Tbilisi',
    country: 'GE',
    german_level: 2,
    languages: [
      { code: 'ka', level: 6 },
      { code: 'de', level: 2 },
      { code: 'ru', level: 5 },
    ],
    experience_years: 8,
    skills: ['dementia', 'medication', 'cooking', 'companionship'],
    driver_license: false,
    smoker: false,
    night_work: true,
    cooking: true,
    available_from: isoDate(20),
    rotation_weeks: 12,
    desired_salary_eur: 1650,
    status: 'available',
    photo_path: null,
    notes: 'Arbeitet am liebsten mit älteren Damen. Sehr geduldig, kocht gerne georgisch.',
  },
  {
    first_name: 'Tamar',
    last_name: 'Kiknadze',
    birth_year: currentYear - 52,
    phone: '+995 577 41 09 33',
    whatsapp: '+995 577 41 09 33',
    city: 'Kutaisi',
    country: 'GE',
    german_level: 3,
    languages: [
      { code: 'ka', level: 6 },
      { code: 'de', level: 3 },
    ],
    experience_years: 12,
    skills: ['bedridden', 'mobilization', 'wound_care', 'medication', 'incontinence'],
    driver_license: true,
    smoker: false,
    night_work: true,
    cooking: true,
    available_from: isoDate(64),
    rotation_weeks: 8,
    desired_salary_eur: 1900,
    status: 'available',
    photo_path: null,
    notes: 'Hat vier Jahre in Bayern gearbeitet. Erfahrung mit Pflegebett und Lifter.',
  },
  {
    first_name: 'Eka',
    last_name: 'Lomidze',
    birth_year: currentYear - 41,
    phone: '+995 555 78 12 44',
    whatsapp: null,
    city: 'Batumi',
    country: 'GE',
    german_level: 1,
    languages: [
      { code: 'ka', level: 6 },
      { code: 'de', level: 1 },
      { code: 'tr', level: 3 },
    ],
    experience_years: 4,
    skills: ['companionship', 'household', 'cooking'],
    driver_license: false,
    smoker: false,
    night_work: false,
    cooking: true,
    available_from: isoDate(-3),
    rotation_weeks: 12,
    desired_salary_eur: 1450,
    status: 'available',
    photo_path: null,
    notes: 'Sehr herzlich. Deutsch noch schwach, lernt aber mit einer App.',
  },
  {
    first_name: 'Mariam',
    last_name: 'Tsiklauri',
    birth_year: currentYear - 58,
    phone: '+995 591 63 20 15',
    whatsapp: '+995 591 63 20 15',
    city: 'Tbilisi',
    country: 'GE',
    german_level: 3,
    languages: [
      { code: 'ka', level: 6 },
      { code: 'de', level: 3 },
      { code: 'ru', level: 6 },
    ],
    experience_years: 15,
    skills: ['dementia', 'palliative', 'medication', 'bedridden', 'mobilization'],
    driver_license: true,
    smoker: false,
    night_work: true,
    cooking: true,
    available_from: isoDate(96),
    rotation_weeks: 10,
    desired_salary_eur: 2000,
    status: 'placed',
    photo_path: null,
    notes: 'Ausgebildete Krankenschwester in Georgien. Sehr gefragt.',
  },
  {
    first_name: 'Natia',
    last_name: 'Gogoladze',
    birth_year: null,
    phone: null,
    whatsapp: null,
    city: null,
    country: 'GE',
    german_level: null,
    languages: [{ code: 'ka', level: 6 }],
    experience_years: 2,
    skills: [],
    driver_license: null,
    smoker: null,
    night_work: null,
    cooking: null,
    available_from: null,
    rotation_weeks: null,
    desired_salary_eur: null,
    status: 'incomplete',
    photo_path: null,
    notes: 'Über Lika empfohlen. Noch nicht angerufen.',
  },
]

interface FamilySeed {
  family: { contact_name: string; relation: string; phone: string; email: string | null; city: string; postal_code: string }
  careCase: Partial<CareCaseRow>
  diagnoses: string | null
}

const FAMILIES: FamilySeed[] = [
  {
    family: {
      contact_name: 'Familie Müller',
      relation: 'Tochter',
      phone: '+49 171 2884019',
      email: 'c.mueller@example.de',
      city: 'München',
      postal_code: '81675',
    },
    careCase: {
      patient_first_name: 'Ingrid',
      patient_birth_year: currentYear - 82,
      care_level: 2,
      mobility: 'mobile',
      dementia: 'mild',
      living_situation: 'alone',
      has_pets: false,
      own_room: true,
      night_work_required: false,
      driver_license_required: false,
      smoking_allowed: false,
      required_german_level: 1,
      tasks: ['cooking', 'shopping', 'companionship', 'medication', 'walks', 'laundry'],
      start_date: isoDate(20),
      expected_months: 12,
      budget_eur: 2400,
      status: 'searching',
      notes: 'Tochter wohnt 40 Minuten entfernt, kommt jedes Wochenende.',
    },
    diagnoses: 'Beginnende Alzheimer-Demenz, Bluthochdruck, leichte Arthrose in beiden Knien.',
  },
  {
    family: {
      contact_name: 'Familie Schneider',
      relation: 'Sohn',
      phone: '+49 160 5512740',
      email: 'schneider.thomas@example.de',
      city: 'Nürnberg',
      postal_code: '90403',
    },
    careCase: {
      patient_first_name: 'Werner',
      patient_birth_year: currentYear - 79,
      care_level: 3,
      mobility: 'wheelchair',
      dementia: 'none',
      living_situation: 'with_partner',
      has_pets: true,
      own_room: true,
      night_work_required: true,
      driver_license_required: true,
      smoking_allowed: false,
      required_german_level: 2,
      tasks: ['personal_hygiene', 'dressing', 'cooking', 'driving', 'night_care', 'doctor_visits'],
      start_date: isoDate(64),
      expected_months: 18,
      budget_eur: 2800,
      status: 'new',
      notes: 'Ehefrau ist selbst 76 und kann nachts nicht mehr aufstehen. Kleiner Hund im Haus.',
    },
    diagnoses: 'Zustand nach Schlaganfall vor 14 Monaten, halbseitige Lähmung rechts, Diabetes Typ 2.',
  },
  {
    family: {
      contact_name: 'Familie Bergmann',
      relation: 'Tochter',
      phone: '+49 176 3390218',
      email: null,
      city: 'Augsburg',
      postal_code: '86150',
    },
    careCase: {
      patient_first_name: 'Helga',
      patient_birth_year: currentYear - 88,
      care_level: 4,
      mobility: 'bedridden',
      dementia: 'moderate',
      living_situation: 'with_family',
      has_pets: false,
      own_room: true,
      night_work_required: true,
      driver_license_required: false,
      smoking_allowed: false,
      required_german_level: 2,
      tasks: ['personal_hygiene', 'dressing', 'medication', 'night_care', 'cooking'],
      start_date: isoDate(-40),
      expected_months: 24,
      budget_eur: 3200,
      status: 'active',
      notes: 'Pflegebett und Lifter sind vorhanden. Sehr zufrieden mit Mariam.',
    },
    diagnoses: 'Fortgeschrittene vaskuläre Demenz, Dekubitus Grad 2 am Steißbein (in Behandlung), Inkontinenz.',
  },
]

// ---------------------------------------------------------------------------

export async function hasDemoData(session: Session): Promise<boolean> {
  const store = await getScopedStore(session.orgId)
  const rows = await store.list('caregivers', { where: { is_demo: true }, limit: 1 })
  return rows.length > 0
}

export async function isStoreEmpty(session: Session): Promise<boolean> {
  const store = await getScopedStore(session.orgId)
  const [caregivers, families] = await Promise.all([
    store.list('caregivers', { limit: 1, includeDeleted: true }),
    store.list('families', { limit: 1, includeDeleted: true }),
  ])
  return caregivers.length === 0 && families.length === 0
}

export async function seedDemoData(session: Session): Promise<void> {
  const store = await getScopedStore(session.orgId)
  if (!(await isStoreEmpty(session))) return

  const caregiverRows: CaregiverRow[] = []
  for (const seed of CAREGIVERS) {
    caregiverRows.push(await store.insert('caregivers', { ...seed, is_demo: true }))
  }

  const caseRows: CareCaseRow[] = []
  for (const seed of FAMILIES) {
    const family = await store.insert('families', {
      ...seed.family,
      notes: null,
      is_demo: true,
    })
    const careCase = await store.insert('care_cases', {
      patient_first_name: null,
      patient_birth_year: null,
      care_level: null,
      mobility: null,
      dementia: null,
      living_situation: null,
      has_pets: null,
      own_room: null,
      night_work_required: false,
      driver_license_required: false,
      smoking_allowed: false,
      required_german_level: null,
      tasks: [],
      start_date: null,
      expected_months: null,
      budget_eur: null,
      notes: null,
      status: 'new',
      ...seed.careCase,
      family_id: family.id,
      is_demo: true,
    })
    caseRows.push(careCase)

    if (seed.diagnoses) {
      await store.insert('care_case_health', {
        care_case_id: careCase.id,
        diagnoses: seed.diagnoses,
        medication: null,
        special_care_notes: null,
        is_demo: true,
      })
    }
  }

  // --- Einsätze: ein laufender und ein vorgeschlagener ---------------------
  const mariam = caregiverRows.find((row) => row.first_name === 'Mariam')
  const nino = caregiverRows.find((row) => row.first_name === 'Nino')
  const bergmann = caseRows[2]
  const mueller = caseRows[0]

  if (mariam && bergmann) {
    const result = scoreMatch(mariam, bergmann)
    await store.insert('placements', {
      caregiver_id: mariam.id,
      care_case_id: bergmann.id,
      status: 'active',
      match_score: result.score,
      match_confidence: result.confidence,
      match_reasons: result.reasons,
      match_breakdown: result.breakdown,
      matching_version: MATCHING_VERSION,
      snapshot_created_at: isoTime(-52),
      proposed_at: isoTime(-52),
      accepted_at: isoTime(-46),
      declined_reason: null,
      start_date: isoDate(-40),
      end_date: null,
      compensation_eur: 2000,
      commission_eur: 900,
      notes: 'Läuft sehr gut. Familie hat bereits nach Verlängerung gefragt.',
      is_demo: true,
    })
  }

  if (nino && mueller) {
    const result = scoreMatch(nino, mueller)
    await store.insert('placements', {
      caregiver_id: nino.id,
      care_case_id: mueller.id,
      status: 'proposed',
      match_score: result.score,
      match_confidence: result.confidence,
      match_reasons: result.reasons,
      match_breakdown: result.breakdown,
      matching_version: MATCHING_VERSION,
      snapshot_created_at: isoTime(-2),
      proposed_at: isoTime(-2),
      accepted_at: null,
      declined_reason: null,
      start_date: mueller.start_date,
      end_date: null,
      compensation_eur: null,
      commission_eur: null,
      notes: null,
      is_demo: true,
    })
  }

  // --- Aufgaben ------------------------------------------------------------
  const tasks: { title: string; detail: string | null; due: string | null }[] = [
    {
      title: 'დაურეკე ქალბატონ მიულერს — ნინოს შესახებ',
      detail: 'უნდა უთხრა, რომ ნინო 1 სექტემბრიდან თავისუფალია.',
      due: isoTime(1, 10),
    },
    {
      title: 'ნათიას პროფილი შეავსე',
      detail: 'ასაკი, გერმანულის დონე და თავისუფალი თარიღი აკლია.',
      due: isoTime(3, 9),
    },
    {
      title: 'ეკას პასპორტის ვადა შეამოწმე',
      detail: null,
      due: isoTime(-1, 9),
    },
    {
      title: 'შნაიდერების ოჯახს კანდიდატები შეურჩიე',
      detail: 'ღამის მუშაობა და მართვის მოწმობა სავალდებულოა.',
      due: isoTime(5, 9),
    },
  ]

  for (const task of tasks) {
    await store.insert('tasks', {
      title: task.title,
      detail: task.detail,
      due_at: task.due,
      status: 'open',
      source: 'system',
      related_kind: null,
      related_id: null,
      done_at: null,
      is_demo: true,
    })
  }

  // --- Notizen -------------------------------------------------------------
  await store.insert('notes', {
    owner_kind: 'caregiver',
    owner_id: nino?.id ?? null,
    body: 'ნინომ თქვა, რომ ორშაბათს შეუძლია დაიწყოს, მაგრამ ჯერ უნდა იცოდეს, ექნება თუ არა ცალკე ოთახი.',
    body_lang: 'ka',
    source: 'assistant',
    recording_id: null,
    is_demo: true,
  })

  // --- ჩემი ----------------------------------------------------------------
  const personal: {
    category: 'favorites' | 'wishlist' | 'restaurant' | 'beauty'
    title: string
    note: string | null
    price: number | null
    locked?: boolean
  }[] = [
    { category: 'restaurant', title: 'Tantris, München', note: 'დაბადების დღისთვის', price: null },
    { category: 'restaurant', title: 'Georgisches Haus, Berlin', note: 'ხინკალი და ხაჭაპური', price: null },
    { category: 'beauty', title: 'La Mer — Crème de la Mer', note: null, price: 190 },
    { category: 'beauty', title: 'Dyson Airwrap', note: null, price: 549 },
    { category: 'wishlist', title: 'ოქროს სამაჯური', note: 'ის, რომელიც გვინახავს', price: null },
    { category: 'wishlist', title: '🍒', note: 'ეს რჩება.', price: null, locked: true },
    { category: 'favorites', title: 'ბათუმი, ზღვასთან', note: null, price: null },
  ]

  for (const [index, item] of personal.entries()) {
    await store.insert('personal_items', {
      category: item.category,
      title: item.title,
      note: item.note,
      url: null,
      price_eur: item.price,
      is_favorite: item.category === 'favorites',
      is_locked: item.locked ?? false,
      position: index,
      is_demo: true,
    })
  }
}

/** Entfernt alle Demo-Daten restlos. Echte Einträge bleiben unberührt. */
export async function removeDemoData(session: Session): Promise<number> {
  const store = await getScopedStore(session.orgId)
  let removed = 0
  for (const table of TABLE_NAMES) {
    removed += await store.deleteWhere(table, { is_demo: true })
  }
  return removed
}
