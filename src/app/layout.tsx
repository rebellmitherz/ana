import type { Metadata, Viewport } from 'next'
import { Noto_Sans_Georgian, Noto_Serif_Georgian } from 'next/font/google'

import { getLocale } from '@/core/auth/session'
import { I18nProvider } from '@/core/i18n/client'
import { PwaRegister } from '@/ui/pwa-register'

import './globals.css'

/**
 * Schriften werden zur Bauzeit heruntergeladen und selbst ausgeliefert
 * (next/font). Zur Laufzeit gibt es keinen einzigen externen Request —
 * datenschutzrechtlich sauber und schneller.
 *
 * Beide Familien decken Georgisch UND Latein ab. Eine gemischte Zeile
 * ("Nino, A2, ab 01.09.") darf nicht aus zwei Schriften bestehen.
 */
const sansGeorgian = Noto_Sans_Georgian({
  subsets: ['georgian', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans-georgian',
  display: 'swap',
})

const serifGeorgian = Noto_Serif_Georgian({
  subsets: ['georgian', 'latin'],
  weight: ['400', '600'],
  variable: '--font-serif-georgian',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ალუბალი',
  description: 'შენი ხიდი გერმანიაში',
  manifest: '/manifest.webmanifest',
  applicationName: 'ALUBALI',
  appleWebApp: {
    capable: true,
    title: 'ალუბალი',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  // Eine persönliche App gehört nicht in Suchmaschinen.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#FBF8F4',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  maximumScale: 5,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()

  return (
    <html lang={locale} className={`${sansGeorgian.variable} ${serifGeorgian.variable}`}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <PwaRegister />
      </body>
    </html>
  )
}
