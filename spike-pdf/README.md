# Spike PDF.js — Sprint 0

Protótipo isolado (fora da estrutura final do app) que valida os critérios de performance do
`pdfjs-dist` definidos em `QA_CHECKLIST.md`. Resultados e veredito: ver
`ROADMAP_SPRINTS.md` → "Log de decisões" e `CHANGELOG.md`.

## Rodar

```bash
npm install
# copie os PDFs de teste para public/pdfs/ com os nomes:
#   leve.pdf  pesado.pdf  escaneado.pdf   (não são versionados no git)
npm run dev
```

Abra http://localhost:5173:

- **Abrir / ◀ ▶** — navegação manual (setas do teclado também funcionam); tempos aparecem no
  painel inferior, com indicação `(cache)` vs `(render)`.
- **Rodar benchmark completo** — mede, para cada PDF: fetch, abertura até a 1ª página visível
  (com breakdown parse vs render), navegação sequencial com preload N+1, navegação em cache,
  salto frio para a página 50, e jank da main thread (Long Tasks + gap de frames).
- Console: `window.__spike.runFullBenchmark()` e
  `window.__spike.probeScale('/pdfs/escaneado.pdf', [300, 600, 900, 1400])` (diagnóstico
  decode vs rasterização).

O quadrado verde girando na toolbar é um detector visual de travamento: se ele engasgar
durante um render, a main thread bloqueou.

## O que este spike espelha da arquitetura real

Worker isolado por documento, renderização página-única em canvas, cache LRU de 8 páginas
(ImageBitmap), preload N+1 em background, abertura a partir de ArrayBuffer (equivalente ao
Blob lido do IndexedDB no app real).
