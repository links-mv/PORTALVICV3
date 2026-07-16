// Portal VIC - Service Worker
// v4: network-first para os arquivos do próprio app (HTML, manifest, ícone) —
// ou seja, ele sempre tenta buscar a versão mais nova na rede primeiro, e só
// usa o que está guardado no cache como reserva se o usuário estiver offline
// ou a rede falhar. Isso resolve o problema de atualizações publicadas no
// repositório não "chegarem" pro usuário sem ele precisar limpar os dados de
// navegação manualmente. Continua com bypass total para a API (Google Apps
// Script), para nunca servir dados de funcionários/EPI/férias desatualizados.
//
// Versão anterior (v3) usava stale-while-revalidate, que sempre entregava a
// versão antiga imediatamente e só baixava a nova em segundo plano para a
// PRÓXIMA visita — por isso a atualização nunca parecia "pegar".

const CACHE_NAME = 'portal-vic-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo-pwa.png'
];

self.addEventListener('install', e => {
  self.skipWaiting(); // aplica a versão nova assim que possível, sem esperar todas as abas fecharem
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('SW: falha ao cachear', url, err))
        )
      )
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim()) // assume o controle das abas já abertas imediatamente
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return; // POSTs (envios) sempre vão direto pra rede

  const url = new URL(e.request.url);

  // Chamadas para fora do domínio do app (ex: Google Apps Script) nunca passam pelo cache.
  // Isso garante que a lista de EPIs, férias e histórico sempre venham atualizados.
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Arquivos do próprio app (HTML, manifest, ícone): tenta a rede primeiro,
  // pra sempre pegar a versão mais nova publicada no repositório. Se der
  // certo, atualiza o cache também (serve de reserva). Só usa o cache
  // (reserva) se a rede falhar, ou seja, se o usuário estiver offline.
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(resp => {
        const copia = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, copia));
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
