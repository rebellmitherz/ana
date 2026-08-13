import type {
  CareCaseRow,
  CaregiverRow,
  MatchReason,
  ScoreBreakdown,
  SkillKey,
} from '@/core/db/types'

/**
 * Matching Engine — deterministisch, ohne AI, vollständig testbar.
 *
 * Warum kein Modell den Score bestimmt: Eine Zahl, die ein Sprachmodell
 * ausspuckt, ist nicht reproduzierbar und im Zweifelsfall nicht erklärbar.
 * Hier ist jeder Punkt herleitbar, und die Begründungen entstehen aus den
 * Score-Beiträgen selbst — ohne einen einzigen AI-Aufruf.
 *
 * Diese Datei enthält reine Funktionen. Keine Datenbank, kein Netz, kein Zufall.
 */

/** Wird beim Vorschlag am Placement eingefroren, damit alte Vorschläge lesbar bleiben. */
export const MATCHING_VERSION = '1.0.0'

/** Wie viele Gründe die Karte höchstens zeigt — Negatives ausgenommen. */
const MAX_REASONS = 6

export const WEIGHTS = {
  availability: 25,
  skills: 25,
  german: 15,
  experience: 10,
  tasks: 10,
  preferences: 10,
  reliability: 5,
} as const

export interface MatchResult {
  score: number
  /** Wie vollständig die Daten sind, auf denen der Score beruht. */
  confidence: number
  breakdown: ScoreBreakdown
  reasons: MatchReason[]
  /** Felder, deren Fehlen den Score unsicher macht — werden zu Rückfragen. */
  unknownFields: string[]
}

export interface MatchCandidate extends MatchResult {
  caregiver: CaregiverRow
}

export interface CaregiverHistory {
  completed: number
  cancelled: number
}

const GERMAN_LABELS = ['—', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// ---------------------------------------------------------------------------
// Harte Filter — bewusst nur vier
// ---------------------------------------------------------------------------

/**
 * Eine versteckte Kandidatin ist schlimmer als eine schlecht bewertete: über
 * sie kann nicht gesprochen werden. Deshalb schließt nur aus, was tatsächlich
 * unmöglich ist — und Unbekanntes schließt nie aus.
 */
export function passesHardFilters(caregiver: CaregiverRow, careCase: CareCaseRow): boolean {
  if (['placed', 'archived', 'paused'].includes(caregiver.status)) return false

  if (careCase.driver_license_required && caregiver.driver_license === false) return false
  if (!careCase.smoking_allowed && caregiver.smoker === true) return false

  // Verfügbarkeit: nur ausschließen, wenn sie nachweislich viel zu spät frei wird.
  if (careCase.start_date && caregiver.available_from) {
    const start = new Date(careCase.start_date).getTime()
    const free = new Date(caregiver.available_from).getTime()
    const daysLate = (free - start) / 86_400_000
    if (daysLate > 90) return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Bedarfsableitung
// ---------------------------------------------------------------------------

/** Welche Fachkenntnisse verlangt dieser Fall tatsächlich? */
export function requiredSkills(careCase: CareCaseRow): SkillKey[] {
  const skills = new Set<SkillKey>()

  if (careCase.dementia && careCase.dementia !== 'none') skills.add('dementia')
  if (careCase.mobility === 'bedridden') {
    skills.add('bedridden')
    skills.add('mobilization')
  }
  if (careCase.mobility === 'wheelchair' || careCase.mobility === 'limited') {
    skills.add('mobilization')
  }
  if (careCase.tasks.includes('medication')) skills.add('medication')
  if (careCase.tasks.includes('cooking')) skills.add('cooking')
  if (careCase.tasks.includes('cleaning') || careCase.tasks.includes('laundry')) {
    skills.add('household')
  }
  if (careCase.tasks.includes('companionship')) skills.add('companionship')

  return [...skills]
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

function scoreAvailability(
  caregiver: CaregiverRow,
  careCase: CareCaseRow,
  reasons: MatchReason[],
): { points: number; known: boolean } {
  if (!careCase.start_date || !caregiver.available_from) {
    return { points: WEIGHTS.availability * 0.5, known: false }
  }

  const start = new Date(careCase.start_date).getTime()
  const free = new Date(caregiver.available_from).getTime()
  const days = Math.round((free - start) / 86_400_000)
  const distance = Math.abs(days)

  if (distance <= 3) {
    reasons.push({
      key: 'reason.availability.perfect',
      polarity: 'positive',
      points: WEIGHTS.availability,
    })
    return { points: WEIGHTS.availability, known: true }
  }

  if (days <= 30) {
    const points = WEIGHTS.availability * (1 - distance / 40)
    reasons.push({
      key: 'reason.availability.near',
      params: { days: distance },
      polarity: distance <= 14 ? 'positive' : 'neutral',
      points,
    })
    return { points: Math.max(0, points), known: true }
  }

  reasons.push({ key: 'reason.availability.late', polarity: 'negative', points: 0 })
  return { points: 0, known: true }
}

function scoreSkills(
  caregiver: CaregiverRow,
  careCase: CareCaseRow,
  reasons: MatchReason[],
): { points: number; known: boolean } {
  const needed = requiredSkills(careCase)
  if (needed.length === 0) return { points: WEIGHTS.skills, known: true }
  if (caregiver.skills.length === 0) {
    return { points: WEIGHTS.skills * 0.4, known: false }
  }

  const matched = needed.filter((skill) => caregiver.skills.includes(skill))
  const missing = needed.filter((skill) => !caregiver.skills.includes(skill))
  const ratio = matched.length / needed.length
  const points = WEIGHTS.skills * ratio

  if (matched.length > 0) {
    reasons.push({
      key: ratio === 1 ? 'reason.skills.match' : 'reason.skills.partial',
      // Rohe Katalogschlüssel — übersetzt wird erst beim Rendern (reasons.ts).
      params: { skills: matched.join(',') },
      polarity: 'positive',
      points,
    })
  }
  if (missing.length > 0) {
    reasons.push({
      key: 'reason.skills.missing',
      params: { skills: missing.join(',') },
      polarity: 'negative',
      points: 0,
    })
  }

  return { points, known: true }
}

function scoreGerman(
  caregiver: CaregiverRow,
  careCase: CareCaseRow,
  reasons: MatchReason[],
): { points: number; known: boolean } {
  if (caregiver.german_level === null) {
    return { points: WEIGHTS.german * 0.4, known: false }
  }

  const label = GERMAN_LABELS[caregiver.german_level] ?? '—'
  const required = careCase.required_german_level

  if (required === null) {
    reasons.push({
      key: 'reason.german.enough',
      params: { level: label },
      polarity: 'neutral',
      points: WEIGHTS.german * 0.8,
    })
    return { points: WEIGHTS.german * 0.8, known: true }
  }

  if (caregiver.german_level >= required) {
    const above = caregiver.german_level > required
    reasons.push({
      key: above ? 'reason.german.above' : 'reason.german.enough',
      params: { level: label },
      polarity: 'positive',
      points: WEIGHTS.german,
    })
    return { points: WEIGHTS.german, known: true }
  }

  const gap = required - caregiver.german_level
  const points = Math.max(0, WEIGHTS.german * (1 - gap * 0.45))
  reasons.push({
    key: 'reason.german.below',
    params: { level: label },
    polarity: 'negative',
    points,
  })
  return { points, known: true }
}

function scoreExperience(
  caregiver: CaregiverRow,
  reasons: MatchReason[],
): { points: number; known: boolean } {
  if (caregiver.experience_years === null) {
    return { points: WEIGHTS.experience * 0.4, known: false }
  }

  // Logarithmisch: der Sprung von 1 auf 4 Jahre zählt mehr als von 12 auf 15.
  const normalized = Math.min(1, Math.log(1 + caregiver.experience_years) / Math.log(11))
  const points = WEIGHTS.experience * normalized

  reasons.push({
    key: caregiver.experience_years >= 5 ? 'reason.experience.strong' : 'reason.experience.some',
    params: { years: caregiver.experience_years },
    polarity: caregiver.experience_years >= 3 ? 'positive' : 'neutral',
    points,
  })
  return { points, known: true }
}

function scoreTasks(
  caregiver: CaregiverRow,
  careCase: CareCaseRow,
  reasons: MatchReason[],
): { points: number; known: boolean } {
  if (careCase.tasks.length === 0) return { points: WEIGHTS.tasks, known: true }

  const checks: boolean[] = []
  if (careCase.tasks.includes('cooking')) checks.push(caregiver.cooking !== false)
  if (careCase.tasks.includes('driving')) checks.push(caregiver.driver_license === true)
  if (careCase.tasks.includes('night_care')) checks.push(caregiver.night_work !== false)

  if (checks.length === 0) return { points: WEIGHTS.tasks * 0.8, known: true }

  const covered = checks.filter(Boolean).length
  const ratio = covered / checks.length
  reasons.push({
    key: ratio === 1 ? 'reason.tasks.covered' : 'reason.tasks.partial',
    polarity: ratio === 1 ? 'positive' : 'neutral',
    points: WEIGHTS.tasks * ratio,
  })
  return { points: WEIGHTS.tasks * ratio, known: true }
}

function scorePreferences(
  caregiver: CaregiverRow,
  careCase: CareCaseRow,
  reasons: MatchReason[],
): { points: number; known: boolean } {
  let points = 0
  let considered = 0
  let known = true

  considered += 1
  if (!careCase.driver_license_required) {
    points += 1
    reasons.push({ key: 'reason.license.notNeeded', polarity: 'neutral', points: 0 })
  } else if (caregiver.driver_license === true) {
    points += 1
    reasons.push({ key: 'reason.license.has', polarity: 'positive', points: 0 })
  } else if (caregiver.driver_license === null) {
    known = false
    points += 0.5
  }

  considered += 1
  if (caregiver.smoker === false) {
    points += 1
    reasons.push({ key: 'reason.smoking.ok', polarity: 'positive', points: 0 })
  } else if (caregiver.smoker === null) {
    known = false
    points += 0.5
  }

  if (careCase.night_work_required) {
    considered += 1
    if (caregiver.night_work === true) {
      points += 1
      reasons.push({ key: 'reason.night.ok', polarity: 'positive', points: 0 })
    } else if (caregiver.night_work === null) {
      known = false
      points += 0.5
    }
  }

  if (caregiver.rotation_weeks && careCase.expected_months) {
    considered += 1
    const caseWeeks = careCase.expected_months * 4.3
    if (caregiver.rotation_weeks <= caseWeeks) {
      points += 1
      reasons.push({
        key: 'reason.rotation.match',
        params: { weeks: caregiver.rotation_weeks },
        polarity: 'positive',
        points: 0,
      })
    }
  }

  const ratio = considered === 0 ? 1 : points / considered
  return { points: WEIGHTS.preferences * ratio, known }
}

function scoreReliability(
  history: CaregiverHistory | undefined,
  reasons: MatchReason[],
): { points: number; known: boolean } {
  if (!history || history.completed + history.cancelled === 0) {
    // Ohne Historie neutral bewerten — Neulinge dürfen nicht bestraft werden.
    return { points: WEIGHTS.reliability * 0.6, known: false }
  }

  const ratio = history.completed / (history.completed + history.cancelled)
  if (ratio >= 0.8) {
    reasons.push({ key: 'reason.reliability.good', polarity: 'positive', points: 0 })
  }
  return { points: WEIGHTS.reliability * ratio, known: true }
}

// ---------------------------------------------------------------------------

/**
 * Bewertet eine Kandidatin gegen einen Fall.
 *
 * Zwei Zahlen kommen heraus, nicht eine: `score` (wie gut passt sie) und
 * `confidence` (wie viel wissen wir überhaupt). Ein 95-%-Match auf Basis von
 * drei bekannten Feldern ist gefährlicher als ein ehrliches "91 %, Sicherheit
 * 70 %".
 */
export function scoreMatch(
  caregiver: CaregiverRow,
  careCase: CareCaseRow,
  history?: CaregiverHistory,
): MatchResult {
  const reasons: MatchReason[] = []

  const availability = scoreAvailability(caregiver, careCase, reasons)
  const skills = scoreSkills(caregiver, careCase, reasons)
  const german = scoreGerman(caregiver, careCase, reasons)
  const experience = scoreExperience(caregiver, reasons)
  const tasks = scoreTasks(caregiver, careCase, reasons)
  const preferences = scorePreferences(caregiver, careCase, reasons)
  const reliability = scoreReliability(history, reasons)

  const parts = { availability, skills, german, experience, tasks, preferences, reliability }

  const breakdown: ScoreBreakdown = {
    availability: Math.round(availability.points),
    skills: Math.round(skills.points),
    german: Math.round(german.points),
    experience: Math.round(experience.points),
    tasks: Math.round(tasks.points),
    preferences: Math.round(preferences.points),
    reliability: Math.round(reliability.points),
  }

  const total = Object.values(parts).reduce((sum, part) => sum + part.points, 0)
  const knownCount = Object.values(parts).filter((part) => part.known).length
  const confidence = Math.round((knownCount / Object.keys(parts).length) * 100)

  const unknownFields = Object.entries(parts)
    .filter(([, part]) => !part.known)
    .map(([key]) => key)

  // Negative Gründe werden NIE weggekürzt: Ein weggelassenes „Deutsch reicht
  // nicht" ist genau die Information, wegen der ein Vorschlag scheitert. Sie
  // stehen zuletzt, damit sich die Karte wie „darum ja — aber" liest, und sie
  // bekommen ihren Platz vor den schwächsten positiven Gründen.
  const negatives = reasons.filter((reason) => reason.polarity === 'negative')
  const rest = reasons
    .filter((reason) => reason.polarity !== 'negative')
    .sort((a, b) => b.points - a.points)

  const room = Math.max(2, MAX_REASONS - negatives.length)

  return {
    score: Math.max(0, Math.min(100, Math.round(total))),
    confidence,
    breakdown,
    reasons: [...rest.slice(0, room), ...negatives],
    unknownFields,
  }
}

/** Vollständiger Lauf: filtern, bewerten, sortieren. */
export function rankCandidates(
  caregivers: CaregiverRow[],
  careCase: CareCaseRow,
  histories: Map<string, CaregiverHistory> = new Map(),
): MatchCandidate[] {
  return caregivers
    .filter((caregiver) => passesHardFilters(caregiver, careCase))
    .map((caregiver) => ({
      caregiver,
      ...scoreMatch(caregiver, careCase, histories.get(caregiver.id)),
    }))
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
}
