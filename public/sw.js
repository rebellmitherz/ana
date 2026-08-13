/**
 * Service Worker — bewusst klein.
 *
 * Umfang: App-Shell und statische Assets werden gecacht, damit die installierte
 * PWA sofort erscheint statt weiß zu blinken. Datenseiten laufen immer über das
 * Netz (network-first) — veraltete Pflegedaten anzuzeigen wäre schlimmer als
 * ein Ladezustand.
 *
 * Eine vollständige Offline-Datenbank ist bewusst NICHT enthalten: Kosten und
 * Komplexität stehen in keinem Verhältnis zum Nutzen (siehe LATER.md).
 */

const VERSION = 'alubali-v1'
const SHELL = ['/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Alles, was Daten liefert oder verändert, geht ungefiltert ans Netz.
  if (url.pathname.startsWith('/api/')) return

  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone()
            caches.open(VERSION).then((cache) => cache.put(request, copy))
            return response
          }),
      ),
    )
    return
  }

  // Seiten: Netz zuerst, Cache nur als Rettung bei Funkloch.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(VERSION).then((cache) => cache.put(request, copy))
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/'))),
  )
})
