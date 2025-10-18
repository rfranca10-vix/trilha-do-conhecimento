self.addEventListener("install", (event) => {
  // SW instalado — não vamos fazer cache agressivo por enquanto
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Garante que o SW assuma o controle de imediato
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through: deixa a rede responder normalmente
  return; // sem interceptar
});
