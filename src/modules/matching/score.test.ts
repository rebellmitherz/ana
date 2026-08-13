import { describe, expect, it } from 'vitest'

import type { CareCaseRow, CaregiverRow } from '@/core/db/types'
import { passesHardFilters, rankCandidates, requiredSkills, scoreMatch } from './score'

/**
 * Die Matching-Engine ist die einzige Stelle, an der die App eine fachliche
 * Empfehlung ausspricht. Sie muss deshalb reproduzierbar und erklärbar sein —
 * und genau das prüfen diese Tests.
 */

const YEAR = new Date().getFullYear()

function caregiver(overrides: Partial<CaregiverRow> = {}): CaregiverRow {
  return {
    id: 'c1',
    org_id: 'o1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    is_demo: false,
    deleted_at: null,
    first_name: 'Nino',
    last_name: 'Beridze',
    birth_year: YEAR - 47,
    phone: null,
    whatsapp: null,
    city: null,
    country: 'GE',
    german_level: 2,
    languages: [],
    experience_years: 8,
    skills: ['dementia', 'medication'],
    driver_license: false,
    smoker: false,
    night_work: true,
    cooking: true,
    available_from: '2026-09-01',
    rotation_weeks: 12,
    desired_salary_eur: null,
    status: 'available',
    photo_path: null,
    notes: null,
    ...overrides,
  }
}

function careCase(overrides: Partial<CareCaseRow> = {}): CareCaseRow {
  return {
    id: 'k1',
    org_id: 'o1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    is_demo: false,
    deleted_at: null,
    family_id: 'f1',
    patient_first_name: 'Ingrid',
    patient_birth_year: YEAR - 82,
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
    tasks: ['cooking', 'shopping', 'medication'],
    start_date: '2026-09-01',
    expected_months: 12,
    budget_eur: 2400,
    status: 'searching',
    notes: null,
    ...overrides,
  }
}

describe('requiredSkills', () => {
  it('leitet Demenz aus der Diagnosestufe ab', () => {
    expect(requiredSkills(careCase({ dementia: 'moderate' }))).toContain('dementia')
    expect(requiredSkills(careCase({ dementia: 'none', tasks: [] }))).not.toContain('dementia')
  })

  it('verlangt bei Bettlägerigkeit Mobilisation', () => {
    const skills = requiredSkills(careCase({ mobility: 'bedridden' }))
    expect(skills).toContain('bedridden')
    expect(skills).toContain('mobilization')
  })
})

describe('passesHardFilters', () => {
  it('lässt Unbekanntes durch — fehlende Daten schließen nie aus', () => {
    const unknown = caregiver({ driver_license: null, smoker: null, available_from: null })
    expect(passesHardFilters(unknown, careCase({ driver_license_required: true }))).toBe(true)
  })

  it('schließt aus, wenn ein Führerschein nachweislich fehlt', () => {
    const noLicense = caregiver({ driver_license: false })
    expect(passesHardFilters(noLicense, careCase({ driver_license_required: true }))).toBe(false)
  })

  it('schließt Raucherinnen aus, wo Rauchen nicht erlaubt ist', () => {
    expect(passesHardFilters(caregiver({ smoker: true }), careCase())).toBe(false)
    expect(passesHardFilters(caregiver({ smoker: true }), careCase({ smoking_allowed: true }))).toBe(
      true,
    )
  })

  it('schließt bereits eingesetzte Pflegerinnen aus', () => {
    expect(passesHardFilters(caregiver({ status: 'placed' }), careCase())).toBe(false)
  })

  it('schließt aus, wer erst deutlich zu spät frei wird', () => {
    expect(passesHardFilters(caregiver({ available_from: '2027-06-01' }), careCase())).toBe(false)
  })
})

describe('scoreMatch', () => {
  it('bewertet eine passende Kandidatin hoch und begründet es', () => {
    // Der Fall verlangt dementia, medication und cooking — hier alle drei.
    const ideal = caregiver({ skills: ['dementia', 'medication', 'cooking'] })
    const result = scoreMatch(ideal, careCase())

    expect(result.score).toBeGreaterThanOrEqual(80)
    expect(result.reasons.some((reason) => reason.key === 'reason.availability.perfect')).toBe(true)
    expect(result.reasons.some((reason) => reason.key === 'reason.skills.match')).toBe(true)
  })

  it('meldet Teilabdeckung als solche, nicht als Volltreffer', () => {
    // Standardkandidatin deckt 2 von 3 nötigen Kenntnissen ab.
    const result = scoreMatch(caregiver(), careCase())
    expect(result.reasons.some((reason) => reason.key === 'reason.skills.partial')).toBe(true)
    expect(result.reasons.some((reason) => reason.key === 'reason.skills.missing')).toBe(true)
  })

  it('ist deterministisch — gleicher Input, gleiches Ergebnis', () => {
    const a = scoreMatch(caregiver(), careCase())
    const b = scoreMatch(caregiver(), careCase())
    expect(a.score).toBe(b.score)
    expect(a.breakdown).toEqual(b.breakdown)
  })

  it('bleibt immer zwischen 0 und 100', () => {
    const weak = caregiver({
      german_level: 0,
      experience_years: 0,
      skills: [],
      available_from: '2026-11-20',
    })
    const result = scoreMatch(weak, careCase({ required_german_level: 4 }))
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('senkt die Sicherheit, wenn Daten fehlen — nicht den Score auf null', () => {
    const sparse = caregiver({
      german_level: null,
      experience_years: null,
      skills: [],
      driver_license: null,
      smoker: null,
    })
    const result = scoreMatch(sparse, careCase())
    expect(result.confidence).toBeLessThan(60)
    expect(result.score).toBeGreaterThan(20)
    expect(result.unknownFields.length).toBeGreaterThan(0)
  })

  it('benennt fehlende Fachkenntnisse ausdrücklich', () => {
    const result = scoreMatch(caregiver({ skills: ['cooking'] }), careCase({ dementia: 'severe' }))
    const missing = result.reasons.find((reason) => reason.key === 'reason.skills.missing')
    expect(missing).toBeDefined()
    expect(String(missing?.params?.skills)).toContain('dementia')
  })

  it('bestraft ein zu niedriges Deutschniveau, ohne auszuschließen', () => {
    const result = scoreMatch(caregiver({ german_level: 1 }), careCase({ required_german_level: 4 }))
    expect(result.reasons.some((reason) => reason.key === 'reason.german.below')).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })

  it('bewertet Neulinge ohne Historie neutral statt schlecht', () => {
    const withoutHistory = scoreMatch(caregiver(), careCase())
    const withGoodHistory = scoreMatch(caregiver(), careCase(), { completed: 3, cancelled: 0 })
    expect(withGoodHistory.score).toBeGreaterThanOrEqual(withoutHistory.score)
    expect(withoutHistory.score).toBeGreaterThan(70)
  })
})

describe('rankCandidates', () => {
  it('sortiert absteigend und filtert Unmögliches heraus', () => {
    const candidates = rankCandidates(
      [
        caregiver({ id: 'good' }),
        caregiver({ id: 'weak', german_level: 0, skills: [], experience_years: 1 }),
        caregiver({ id: 'smoker', smoker: true }),
      ],
      careCase(),
    )

    expect(candidates.map((entry) => entry.caregiver.id)).toEqual(['good', 'weak'])
    expect(candidates[0]!.score).toBeGreaterThanOrEqual(candidates[1]!.score)
  })
})
