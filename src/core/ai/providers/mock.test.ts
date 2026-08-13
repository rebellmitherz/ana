import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { mockProvider } from './mock'
import type { StructuredRequest } from '../types'

/**
 * Der Mock-Provider ist im Demo-Modus das, was die Nutzerin tatsächlich sieht.
 * Eine still erfundene Angabe („15 Jahre Erfahrung", weil im Satz ein 15.
 * Oktober vorkam) wäre dort genauso schädlich wie in Produktion — deshalb wird
 * er getestet wie echter Code.
 */

const schema = z.record(z.string(), z.unknown())

function request(task: StructuredRequest<unknown>['task'], user: string) {
  return { task, system: '', user, schema, schemaName: 'test' } as StructuredRequest<unknown>
}

async function extractCaregiver(text: string): Promise<Record<string, unknown>> {
  const result = await mockProvider.generate(request('caregiver.extract', text), 'mock-nano', {})
  return result.raw as Record<string, unknown>
}

describe('mock caregiver extraction', () => {
  const currentYear = new Date().getFullYear()

  it('trennt Alter, Erfahrung und Datum sauber', async () => {
    const fields = await extractCaregiver(
      'ლიკა არის 44 წლის, აქვს ექვსი წლის გამოცდილება, ლაპარაკობს B1 დონეზე გერმანულად, ' +
        'იცნობს დემენციას და შეუძლია 15 ოქტომბრიდან დაიწყოს.',
    )

    expect(fields.birth_year).toBe(currentYear - 44)
    expect(fields.experience_years).toBe(6)
    expect(fields.german_level).toBe(3)
    expect(fields.skills).toContain('dementia')
    expect(String(fields.available_from)).toMatch(/-10-15$/)
  })

  it('liest das Sprachniveau nicht als Erfahrung', async () => {
    const fields = await extractCaregiver('ნინო ლაპარაკობს A2 დონეზე გერმანულად.')
    expect(fields.experience_years).toBeNull()
    expect(fields.german_level).toBe(2)
  })

  it('erfindet nichts, wenn nichts gesagt wurde', async () => {
    const fields = await extractCaregiver('ნინო კარგი მომვლელია.')
    expect(fields.birth_year).toBeNull()
    expect(fields.experience_years).toBeNull()
    expect(fields.german_level).toBeNull()
    expect(fields.available_from).toBeNull()
    expect(fields.rotation_weeks).toBeNull()
  })

  it('versteht Ziffern ebenso wie georgische Zahlwörter', async () => {
    const digits = await extractCaregiver('თამარს აქვს 12 წლის გამოცდილება.')
    const words = await extractCaregiver('თამარს აქვს თორმეტი წლის გამოცდილება.')
    expect(digits.experience_years).toBe(12)
    expect(words.experience_years).toBe(12)
  })

  it('erkennt Monatsnamen trotz georgischer Flexion', async () => {
    const september = await extractCaregiver('შეუძლია 1 სექტემბრიდან დაიწყოს.')
    const august = await extractCaregiver('თავისუფალია აგვისტოდან.')
    expect(String(september.available_from)).toMatch(/-09-01$/)
    expect(String(august.available_from)).toMatch(/-08-/)
  })

  it('nimmt eine Rotation nur an, wenn von Wochen die Rede ist', async () => {
    const withRotation = await extractCaregiver('სურს 12 კვირიანი როტაცია.')
    const without = await extractCaregiver('ნინო არის 47 წლის.')
    expect(withRotation.rotation_weeks).toBe(12)
    expect(without.rotation_weeks).toBeNull()
  })
})

describe('mock family extraction', () => {
  it('übernimmt Pflegegrad und Budget nur, wenn sie benannt sind', async () => {
    const result = await mockProvider.generate(
      request(
        'family.extract',
        'დედა 82 წლისაა, Pflegegrad 3, დაწყებითი დემენცია აქვს, ბიუჯეტი 2400 ევრო.',
      ),
      'mock-nano',
      {},
    )
    const fields = result.raw as Record<string, unknown>

    expect(fields.care_level).toBe(3)
    expect(fields.budget_eur).toBe(2400)
    expect(fields.dementia).toBe('mild')
  })

  it('setzt Pflegegrad und Budget auf null, wenn nichts genannt ist', async () => {
    const result = await mockProvider.generate(
      request('family.extract', 'ოჯახი ეძებს მომვლელს მიუნხენში.'),
      'mock-nano',
      {},
    )
    const fields = result.raw as Record<string, unknown>

    expect(fields.care_level).toBeNull()
    expect(fields.budget_eur).toBeNull()
  })
})
