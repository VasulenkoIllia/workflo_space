/* S12-03 Web Push service worker: показує сповіщення і відкриває апку по кліку. */
self.addEventListener('push', (event) => {
  let data = { title: 'workflo.space', body: '' }
  try {
    data = { ...data, ...event.data.json() }
  } catch {
    data.body = event.data ? event.data.text() : ''
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})
