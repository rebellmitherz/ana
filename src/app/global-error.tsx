'use client'

import { useEffect } from 'react'

/**
 * Letzte Sicherheitsnetz-Ebene, falls das Root-Layout selbst abstürzt.
 *
 * Anders als error.tsx läuft diese Datei AUSSERHALB des Root-Layouts — sie
 * bringt ihr eigenes <html>/<body> mit und darf sich nicht auf Fonts, i18n-
 * Kontext oder sonst irgendetwas aus layout.tsx verlassen. Deshalb bewusst
 * schlicht gehalten, mit Inline-Styles statt Tailwind-Klassen.
 *
 * Ohne diese Datei erzeugt Next.js intern eine eigene Ersatzseite dafür
 * ("_global-error") — bei dieser Next-16/Turbopack-Kombination führte deren
 * automatisch generierte Variante beim Vercel-Build zu einem defekten
 * Funktionspfad. Eine eigene Datei umgeht das zuverlässig.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] Unbehandelter Fehler im Root-Layout:', error)
  }, [error])

  return (
    <html lang="ka">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.75rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#FBF8F4',
          color: '#171210',
        }}
      >
        <p style={{ fontSize: '1.5rem', margin: 0 }}>რაღაც ვერ გამოვიდა</p>
        <p style={{ marginTop: '0.5rem', color: '#8A7D76', fontSize: '0.95rem' }}>
          სცადე თავიდან — შენი მონაცემები არ დაკარგულა
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '2rem',
            height: '3rem',
            padding: '0 1.5rem',
            borderRadius: '1rem',
            border: 'none',
            background: '#7A1F2B',
            color: '#FBF8F4',
            fontSize: '0.95rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          თავიდან ცდა
        </button>
      </body>
    </html>
  )
}
