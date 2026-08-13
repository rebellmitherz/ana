import type { MatchReason } from '@/core/db/types'
import type { MessageKey, TranslateParams, Translator } from '@/core/i18n'

/**
 * Begründungen in lesbaren Text übersetzen.
 *
 * Die Engine liefert bewusst nur Schlüssel und Rohwerte — sie kennt keine
 * Sprache. Erst hier werden Katalogschlüssel wie `bedridden` zu „წოლითი
 * რეჟიმი". Ohne diesen Schritt stünden englische Feldnamen in der georgischen
 * Oberfläche, und genau das darf nie passieren.
 *
 * Kostet keinen AI-Aufruf.
 */
export function reasonText(t: Translator, reason: MatchReason): string {
  const params: TranslateParams = { ...(reason.params ?? {}) }

  const skills = params.skills
  if (typeof skills === 'string' && skills.length > 0) {
    params.skills = skills
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)
      .map((key) => t(`skill.${key}` as MessageKey))
      .join(', ')
  }

  return t(reason.key as MessageKey, params)
}
