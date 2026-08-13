'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

import { Button } from '@/ui/primitives'

/**
 * Magic Link statt Passwort.
 *
 * Für eine Nutzerin, die keine Lust auf Technik hat, ist ein Passwort eine
 * Hürde ohne Gegenwert — sie würde es aufschreiben oder vergessen. Der Link
 * kommt per E-Mail, die Sitzung bleibt danach sehr lange gültig.
 */
export function SignInForm({
  labels,
}: {
  labels: { email: string; continue: string; sent: string; failed: string }
}) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setState('sending')

    try {
      const client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      )
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      setState(error ? 'error' : 'sent')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <p className="rounded-card border border-line bg-paper-raised p-5 text-center text-[0.95rem] text-ink-soft">
        {labels.sent} — {email}
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={labels.email}
        className="w-full rounded-control border border-line bg-paper-raised px-4 py-3.5 text-[1rem] focus:border-gold focus:outline-none"
      />
      <Button full size="lg" type="submit" disabled={state === 'sending'}>
        {labels.continue}
      </Button>
      {state === 'error' ? (
        <p className="text-center text-sm text-critical">{labels.failed}</p>
      ) : null}
    </form>
  )
}
