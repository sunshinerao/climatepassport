self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const registrations = await self.registration.unregister();
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      if (registrations) {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        await Promise.all(clients.map((client) => client.navigate(client.url)));
      }
    })(),
  );
});

self.addEventListener("fetch", () => {
  // Intentionally no offline caching. This file only exists to neutralize stale service workers.
});
