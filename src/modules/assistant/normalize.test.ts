import { describe, expect, it } from 'vitest'

import { clampInt, normalizeCaregiver, normalizeDate, normalizeFamily } from './normalize'
import type { CaregiverExtraction, FamilyExtraction } from './schemas'

/**
 * Die Normalisierung ist die Grenze zwischen Modellausgabe und Datenbank.
 * Was hier nicht durchkommt, erreicht die Businessdaten nie.
 */

function extraction(overrides: Partial<CaregiverExtraction> = {}): CaregiverExtraction {
  return {
    first_name: 'Nino',
    last_name: null,
    birth_year: null,
    phone: null,
    city: null,
    german_level: null,
    experience_years: null,
    skills: [],
    driver_license: null,
    smoker: null,
    night_work: null,
    cooking: null,
    available_from: null,
    rotation_weeks: null,
    notes: null,
    ...overrides,
  }
}

describe('normalizeDate', () => {
  it('nimmt ISO und deutsches Format an', () => {
    expect(normalizeDate('2026-09-01')).toBe('2026-09-01')
    expect(normalizeDate('01.09.2026')).toBe('2026-09-01')
    expect(normalizeDate('1.9.2026')).toBe('2026-09-01')
  })

  it('gibt null zurück statt zu raten', () => {
    expect(normalizeDate(null)).toBeNull()
    expect(normalizeDate('irgendwann')).toBeNull()
    expect(normalizeDate('')).toBeNull()
  })
})

describe('clampInt', () => {
  it('verwirft Werte außerhalb des Bereichs, statt sie zu kappen', () => {
    expect(clampInt(5, 0, 10)).toBe(5)
    expect(clampInt(99, 0, 10)).toBeNull()
    expect(clampInt(-1, 0, 10)).toBeNull()
    expect(clampInt(null, 0, 10)).toBeNull()
  })
})

describe('normalizeCaregiver', () => {
  const currentYear = new Date().getFullYear()

  it('behält nur bekannte Fachkenntnisse', () => {
    const result = normalizeCaregiver(
      extraction({ skills: ['dementia', 'zauberei', 'cooking'] }),
      'ნინო',
    )
    expect(result.values.skills).toEqual(['dementia', 'cooking'])
  })

  it('verwirft unmögliche Geburtsjahre', () => {
    expect(normalizeCaregiver(extraction({ birth_year: 1200 }), '').values.birth_year).toBeNull()
    expect(
      normalizeCaregiver(extraction({ birth_year: currentYear - 47 }), '').values.birth_year,
    ).toBe(currentYear - 47)
  })

  it('markiert Zahlen als unsicher, die im Transkript nicht vorkommen', () => {
    const supported = normalizeCaregiver(
      extraction({ birth_year: currentYear - 47, experience_years: 8 }),
      'ნინო არის 47 წლის და აქვს 8 წლის გამოცდილება',
    )
    expect(supported.uncertain).not.toContain('birth_year')
    expect(supported.uncertain).not.toContain('experience_years')

    const invented = normalizeCaregiver(
      extraction({ birth_year: currentYear - 47, experience_years: 8 }),
      'ნინო კარგი მომვლელია',
    )
    expect(invented.uncertain).toContain('birth_year')
    expect(invented.uncertain).toContain('experience_years')
  })

  it('markiert ein Deutschniveau als unsicher, das nie genannt wurde', () => {
    const stated = normalizeCaregiver(
      extraction({ german_level: 2 }),
      'ლაპარაკობს A2 დონეზე გერმანულად',
    )
    expect(stated.uncertain).not.toContain('german_level')

    const guessed = normalizeCaregiver(extraction({ german_level: 2 }), 'ცოტა გერმანული იცის')
    expect(guessed.uncertain).toContain('german_level')
  })

  it('meldet wichtige fehlende Felder als Rückfragen', () => {
    const result = normalizeCaregiver(extraction(), 'ნინო')
    expect(result.missing).toContain('german_level')
    expect(result.missing).toContain('available_from')
    expect(result.missing).toContain('skills')
  })
})

describe('normalizeFamily', () => {
  function familyExtraction(overrides: Partial<FamilyExtraction> = {}): FamilyExtraction {
    return {
      contact_name: 'Familie Müller',
      relation: null,
      phone: null,
      email: null,
      city: null,
      patient_first_name: null,
      patient_birth_year: null,
      care_level: null,
      mobility: null,
      dementia: null,
      living_situation: null,
      night_work_required: null,
      driver_license_required: null,
      smoking_allowed: null,
      own_room: null,
      required_german_level: null,
      tasks: [],
      start_date: null,
      expected_months: null,
      budget_eur: null,
      notes: null,
      diagnoses: null,
      ...overrides,
    }
  }

  it('trennt Gesundheitsdaten vom übrigen Fall', () => {
    const result = normalizeFamily(
      familyExtraction({ diagnoses: 'Beginnende Alzheimer-Demenz' }),
      'test',
    )
    expect(result.values.diagnoses).toBe('Beginnende Alzheimer-Demenz')
    expect(JSON.stringify(result.values.careCase)).not.toContain('Alzheimer')
  })

  it('behält nur bekannte Einsatzaufgaben', () => {
    const result = normalizeFamily(
      familyExtraction({ tasks: ['cooking', 'gartenarbeit', 'night_care'] }),
      'test',
    )
    expect(result.values.careCase.tasks).toEqual(['cooking', 'night_care'])
  })

  it('setzt boolesche Anforderungen ohne Angabe auf false statt null', () => {
    const result = normalizeFamily(familyExtraction(), 'test')
    expect(result.values.careCase.night_work_required).toBe(false)
    expect(result.values.careCase.driver_license_required).toBe(false)
  })
})
