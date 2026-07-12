# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Unreleased]

### Planejamento
- Definição do core do produto: leitor de PDF que substitui o Kindle, com camadas de valor
  agregado (tracker, notas, review, IA) construídas por cima.
- Design system de referência definido (`DESIGN - Fable.md`), com separação entre linguagem
  visual do App Shell (editorial, bandas coloridas) e da Reading Surface (minimalista,
  paper cream/ink).
- Plano técnico completo criado: viabilidade, riscos, arquitetura de dados, roadmap de 10
  sprints (0 a 9).
- Decisões de arquitetura confirmadas:
  - Renderização de PDF página-única (não scroll contínuo).
  - Capa de livro com duas fontes possíveis (extração automática ou upload manual), à escolha
    do usuário.
  - Duas object stores separadas no IndexedDB (`books` para metadata, `files` para Blobs de PDF).
- Otimizações de performance mapeadas: pré-carregamento de página adjacente, cache LRU em
  memória, Web Worker isolado por documento, code splitting do reader, downscale de zoom.
- Critério de aceite mensurável definido para o Sprint 0: abertura da primeira página <500ms
  (PDF até 50MB), navegação em cache <100ms.

### Adicionado
- **Sprint 0 — Spike técnico de `pdfjs-dist` concluído** (2026-07-09), protótipo isolado em
  `spike-pdf/` (fora da estrutura final do app; PDFs de teste não versionados):
  - pdfjs-dist v4 com Web Worker isolado por documento, renderização página-única em canvas,
    cache LRU de 8 páginas (ImageBitmap), pré-carregamento N+1 em background.
  - Benchmark automatizado (fetch, abertura, navegação sequencial/em cache/salto frio) +
    monitor de jank (Long Tasks + gap de frames via rAF).
  - Resultados: navegação em cache ~0.1ms ✅; zero long tasks (UI nunca travou) ✅; abertura
    373ms para PDF de texto ✅, mas 1.3–1.8s para PDFs de imagem/scan ❌ (decode fixo da imagem
    da página, independente da escala de saída).
  - Baseline completo e decisões derivadas registrados em `ROADMAP_SPRINTS.md` (log de
    decisões); status por critério em `QA_CHECKLIST.md`.

### Decisões técnicas
- Downscale de resolução **não** reduz o tempo de abertura de PDFs escaneados (o custo é o
  decode da imagem, não a rasterização) — mitigação escolhida: snapshot persistido da última
  página lida, exibido instantaneamente na abertura enquanto o render real ocorre em background
  (a implementar na Sprint 1, condicionado à aprovação do veredito do spike).

### Adicionado
- **Sprint 1 — Leitor PDF Core implementado** (2026-07-09), app real em `app/`
  (React 19 + Vite 6 + TS estrito + Tailwind 4 com tokens Fable + Zustand + idb):
  - IndexedDB com stores separadas `books`/`files`; upload de PDF → Blob em `files`;
    cadastro com capa extraída da 1ª página OU upload manual (escolha do usuário).
  - Reading Surface página-única: engine portada do spike (worker isolado por documento,
    LRU de 8 ImageBitmaps, preload N+1), navegação por teclado/clique, zoom com
    resolução de render proporcional, modo foco, skeleton cream, tema paper.
  - **Abertura snapshot-first**: `Book.lastPageSnapshot` (JPEG ~600px, dezenas de KB) exibido
    no primeiro paint e substituído pelo render real com crossfade; snapshot regenerado a cada
    troca de página (debounce 1s, junto de `currentPage`) e no fechamento do livro (flush).
  - Code splitting: `PdfReader` via `React.lazy()` e `pdfjs-dist` em chunk próprio carregado
    sob demanda — bundle inicial da Biblioteca com 210KB (67KB gzip).
  - Testes unitários (Vitest): cache LRU e repositório de livros (fake-indexeddb), incluindo
    garantia de que atualização de progresso nunca toca a store `files`. 14 testes verdes.

### Decisões técnicas (Sprint 1)
- Escopo do snapshot restrito à **abertura do livro** (não generalizado para navegação fora do
  cache LRU) — justificativa no log de decisões do `ROADMAP_SPRINTS.md`.
- Render do pdf.js com `intent: 'print'`: o intent `display` depende de
  `requestAnimationFrame`, que não dispara em aba oculta e travava o render offscreen/preload.
  Crossfade do snapshot com fallback por timer pelo mesmo motivo.

### Adicionado
- **Sprint 2 — Refino da Reading Surface implementado** (2026-07-09):
  - Tema Paper (padrão) e Dark na Reading Surface, alternável pelo botão de tema ou atalho `D`,
    persistido por livro (`Book.readingTheme`, campo já existente no modelo desde a Sprint 1, sem
    consumidor até agora). Tons quentes no dark (sem azul neon), aplicados via CSS custom
    properties (`--reader-*`) com dois conjuntos de valores (`:root` / `.reader-dark`).
  - Atalhos de teclado completos: `→`/`Espaço`/`PageDown` avança, `←`/`PageUp` volta, `+`/`-`
    zoom, `0` reseta zoom, `F` alterna modo foco, `D` alterna tema, `Esc` sai do foco antes de
    fechar o reader. Guard contra disparo com foco em input/textarea/select/contentEditable.
  - Indicador de progresso: texto `Página N de M · P%` (antes só `N / M`) + barra fina de 2px no
    rodapé da topbar (e uma versão discreta fixa no topo em modo foco, já que a topbar some).
  - Transição sutil de virada de página via CSS (`page-turn`, 150ms) — ver decisão técnica sobre
    não usar Framer Motion. `prefers-reduced-motion` desativa essa transição e a `snapshot-fade`
    já existente.
  - Polimento da toolbar: estados disabled nos botões de zoom (limites min/max) e nas hit-zones de
    página anterior/próxima (início/fim do livro), setas `‹`/`›` que aparecem discretamente no
    hover das hit-zones, tooltips com o atalho de cada ação.
  - `useReader` ganhou `resetZoom`, `isAtFirstPage`, `isAtLastPage`, `isMinZoom`, `isMaxZoom` —
    adições puras, sem alterar a lógica de navegação/preload da Sprint 1.

### Decisões técnicas (Sprint 2)
- CSS em vez de Framer Motion para a transição de página — canvas reutilizado (não remontado por
  página) não é compatível com o modelo de animação de montagem do Framer Motion sem reintroduzir
  o flash que a Sprint 1 evitou. Detalhes no log de decisões do `ROADMAP_SPRINTS.md`.
- Cores dependentes de tema aplicadas via `style` inline (CSS var), não classes Tailwind
  arbitrary-value — bug específico do ambiente de preview onde `bg-[var(--x)]` gerado dentro de
  `@layer utilities` não reagia a mudanças da variável. Detalhes no log de decisões do
  `ROADMAP_SPRINTS.md`.

### Corrigido (Micro-hardening pós-Sprint 2, 2026-07-09)
- **Tela de erro do reader não respeitava tema Paper/Dark**: usava classes fixas `bg-paper-cream`/
  `text-ink`/`text-graphite`/`bg-charcoal-plum`/`text-pure-white`. Trocado para os mesmos tokens
  `--reader-*` do resto da Reading Surface (`PdfReader.tsx`), sem criar componente novo.
- Benchmark de regressão pós-Sprint 2: navegação para trás em página já pré-carregada 1.0–1.8ms;
  avanço contínuo além da janela de preload 15–25ms; após troca de zoom, vizinhos já
  pré-carregados na nova largura em 2–2.3ms. Sem regressão perceptível frente à Sprint 1/2.

### Adicionado
- **Sprint 3 — Biblioteca (App Shell) implementada** (2026-07-09):
  - CRUD completo de metadados via `EditBookDialog` (título, autor, categoria, status), acessível
    por um botão de edição que aparece no hover/foco de cada `BookTile`, sem tocar o Blob em
    `files`.
  - Exclusão de livro (`useBookStore.remove`, `deleteBook` em `books-repo.ts`): remove metadata e
    Blob juntos, com confirmação nativa antes de excluir.
  - Edição de capa dentro do diálogo: manter a atual, re-extrair da 1ª página (lê o Blob já salvo,
    sem reprocessar o cadastro) ou enviar nova imagem manual — reaproveita `imageFileToThumbnail`
    da Sprint 1.
  - `BookTile` ganhou selo de status (`STATUS_LABELS`, `app/src/lib/book-status.ts`) e data da
    última leitura.
  - Filtros por status (5 chips + "Todos") e por categoria (aparece só com 2+ categorias
    cadastradas), ordenação (recentes, título A–Z, progresso, adicionados recentemente) — tudo
    como estado local de `Library.tsx`, sem novo store global.
  - Seção "Continuar lendo": destaca o livro com status `reading` de leitura mais recente,
    baseado no novo campo `Book.lastOpenedAt` (atualizado a cada abertura do reader,
    `app/src/App.tsx`, chaveado pelo id da view para não reexecutar em loop).
  - Empty states: biblioteca vazia, filtro sem resultados (com atalho "Limpar filtros") e erro ao
    carregar a biblioteca (com "Tentar novamente") — `useBookStore.load` agora captura erro em vez
    de deixá-lo não tratado.

### Adicionado
- **Sprint 4 — Sessões de Leitura & Progresso implementada** (2026-07-09):
  - Novo tipo `ReadingSession` (`app/src/types/models.ts`) e object store `sessions` no IndexedDB
    (`DB_VERSION` 1 → 2, migração incremental preservando `books`/`files` existentes), com índices
    `by-book` e `by-started`.
  - `sessions-repo.ts` (CRUD imutável, espelhando `books-repo.ts`) e `useSessionStore.ts`
    (carregamento por livro, `add`/`patch`/`remove`), com testes unitários (`fake-indexeddb`).
  - Captura automática de sessão em `use-reader.ts`: uma sessão é iniciada no mount do efeito de
    abertura do reader (`startedAt`/`startPage`) e persistida no cleanup (unmount = fechar o livro
    ou trocar de livro, já que `PdfReader` é montado com `key={book.id}`), sem nenhuma ação manual
    do usuário. Sessões abaixo de 3s são descartadas (filtra o double-invoke de efeitos do
    `StrictMode` em dev, que monta/desmonta/remonta o reader uma vez antes da abertura real).
  - Histórico de sessões por livro (`SessionHistory.tsx`, dentro do `EditBookDialog` existente):
    lista cronológica (mais recente primeiro) com data/hora, duração, páginas percorridas e
    observação; edição manual inline de duração (minutos) e observação por sessão.
  - Validado manualmente no preview: abertura de um PDF de 2 páginas por >3s gerou exatamente 1
    sessão consistente com `Book.currentPage`; edição manual de duração/observação persistiu e
    refletiu na UI sem reload.

### Decisões técnicas (Sprint 4)
- `ReadingSession` reconciliado para um shape mais simples (`startedAt`/`endedAt`/`durationMs`) do
  que o rascunho anterior em `DATA_MODEL.md` (`date`/`durationMinutes`/`mood`/`sessionType`) —
  `mood`/`sessionType` removidos por YAGNI (sem consumidor de UI previsto antes do Sprint 6/8).
  Detalhes no log de decisões do `ROADMAP_SPRINTS.md`.
- Sessão = ciclo de vida do mount/unmount do reader, sem detecção de pausa/idle — suficiente para o
  critério de aceite desta sprint; revisitar se o Sprint 5 (dashboard) revelar sessões enganosas.

- **Sprint 5 — Dashboard implementado** (2026-07-09):
  - Helpers puros de agregação (`lib/dashboard-stats.ts`): `getTotalReadingTime`,
    `getTotalPagesRead`, `getRecentSessions`, `getBookActivitySummary`, `getLast7DaysActivity`,
    `getActiveBookCount`, `formatDuration`, `resolveBookTitle` — 22 testes unitários cobrindo
    vazio, sessão única, múltiplos livros, `pagesRead = 0` e livro removido.
  - `sessions-repo.ts` ganhou `listAllSessions()`; `useSessionStore` ganhou um segundo eixo de
    estado (`allSessions`/`isAllLoaded`/`allError` + ação `loadAll()`) para carregar todas as
    sessões de uma vez, sem afetar o carregamento por-livro existente (`SessionHistory`).
  - Nova área `features/dashboard/` (`Dashboard.tsx` + `StatsCards`, `WeeklyActivity`,
    `RecentActivityList`, `BookActivityList`): cards de métricas, mini barras dos últimos 7 dias
    (CSS puro, sem lib de gráficos), atividade recente e top 5 livros mais ativos — nunca lê
    Blobs, reaproveita `useBookStore.books` já em memória para título/capa.
  - Nova terceira `AppView` (`dashboard`) em `useUIStore.ts`, acessível por um link na banda
    verde da Biblioteca; `Dashboard` carregado via `React.lazy()` (chunk próprio de ~8kB no
    build), fora do bundle inicial da Biblioteca.
  - Validado no preview com dados reais de seed: cards, barras semanais, atividade recente e
    resumo por livro renderizaram com os valores corretos; navegação Biblioteca ↔ Dashboard sem
    erros de console.

- **Sprint 6 — Notas e marcações implementada** (2026-07-09):
  - Novo tipo `ReadingAnnotation` (`app/src/types/models.ts`, substituindo o rascunho anterior
    `Note` do `DATA_MODEL.md`) e object store `notes` no IndexedDB (`DB_VERSION` 2 → 3, migração
    incremental), índices `by-book` e `by-type`.
  - `notes-repo.ts` (CRUD imutável, espelhando `sessions-repo.ts`) e `useNoteStore.ts`
    (carregamento por livro, `add`/`patch`/`remove`), com 8 testes unitários (`fake-indexeddb`),
    incluindo garantia de que criar uma nota nunca toca `sessions`/`books`.
  - **Painel lateral de notas na Reading Surface** (`NotesSidePanel.tsx`, novo botão "Notas" na
    topbar com atalho `N`, indicador discreto — ponto — quando a página atual tem anotação): marca
    a página atual como bookmark, cria nota de texto livre vinculada à página, lista todas as
    anotações do livro com navegação direta para a página de cada uma.
  - **Lista de notas fora do reader** (`NotesList.tsx`, dentro do `EditBookDialog` existente, ao
    lado de `SessionHistory`): lista/edita/remove, sem criação (mesma restrição do histórico de
    sessões — criar é sempre vinculado à página atual, dentro do reader).
  - Validado no preview: nota e bookmark criados na página 1 refletiram no indicador da topbar, no
    painel lateral e na lista do `EditBookDialog`, em ambos os temas (Paper/Dark), sem erros de
    console.

### Decisões técnicas (Sprint 6)
- Sem highlight textual: auditoria confirmou que o reader é canvas-only (sem text layer do
  pdf.js) — decisão conservadora já prevista na instrução da sprint. Modelo `ReadingAnnotation` já
  reserva `quoteText`/`textAnchor` para uma sprint futura com text layer real.
- Painel lateral reserva espaço (`padding-right` no container fixo) em vez de sobrepor a página —
  corrige um bug real encontrado em QA manual: o painel flutuante cobria a hit-zone de "próxima
  página" em viewports ~960px, engolindo o clique silenciosamente. Detalhes no log de decisões do
  `ROADMAP_SPRINTS.md`.

### Corrigido (QA manual do Sprint 1, 2026-07-09)
- **Delay de 1-2s ao voltar página**: faltava preload de N-1 (só existia N+1). `PdfEngine` agora
  pré-carrega N+1 e N-1 em paralelo (`preloadPrev` novo em `pdf-engine.ts`, chamado junto de
  `preloadNext` em `use-reader.ts` após toda exibição de página, cobrindo também o caso de troca
  de zoom). Validado com medição real: navegação para trás caiu de ~1-2s para 1-3ms.
- **Investigado e descartado**: percepção de transição em "slide lateral" ao virar página.
  Confirmado via gravação de tela nativa que as trocas de página são cortes de frame único, sem
  animação; o efeito reportado era artefato de uma gravação anterior feita filmando o monitor
  com celular. Nenhuma mudança de código associada a este item.

### Corrigido (Hardening de Interação do Reader pós-Sprint 6, 2026-07-09)
- **Atalho `B` (bookmark) inexistente**: só era possível marcar/desmarcar a página pelo botão do
  painel de notas. Lógica de toggle extraída de `NotesSidePanel.tsx` para uma nova action
  `toggleBookmark` em `useNoteStore.ts` (garante no máximo um bookmark por página, testável
  isoladamente — 4 testes novos), reusada pelo atalho global e pelo botão do painel.
- **Esc dentro do textarea de nota não fazia nada**: usuário ficava preso numa edição sem forma de
  cancelar via teclado. `NotesSidePanel.tsx` ganhou `onKeyDown` local nos dois textareas (rascunho
  de nova nota e edição de nota existente) que cancela/limpa no `Escape` e para a propagação, sem
  disparar o `Esc` global do reader (que fecha painel/foco/reader).
- **Editar uma nota para texto vazio salvava silenciosamente**: diferente da criação (que já
  bloqueava string vazia/só espaços), o "Salvar" da edição aceitava qualquer coisa. Unificado via
  novo helper puro `isBlankNoteBody` (`app/src/lib/notes.ts`, com testes), usado para desabilitar
  os botões "Adicionar nota" e "Salvar" nos dois fluxos.
- **Falhas de salvar/remover nota ou marcação eram engolidas**: rejeições não tratadas geravam erro
  silencioso no console e nenhum feedback ao usuário. `NotesSidePanel.tsx` ganhou estado de erro
  local por linha/painel com mensagem curta, sem alterar o estado global da store.
- **Painel de notas fixo em 320px cobria quase toda a tela em mobile** (~375px de viewport
  restavam ~55px de página). Painel agora é `w-full` até o breakpoint `sm` (drawer full-width
  sobrepondo a página, sem reserva de espaço) e `w-80` (320px, com `padding-right` reservado via
  nova classe `.notes-open` em `index.css`) a partir de `sm`.
- **Modo foco não fechava o painel de notas**: entrar em foco escondia a topbar mas deixava o
  painel competindo por espaço sem controle óbvio. `toggleFocus` em `PdfReader.tsx` agora fecha o
  painel ao ativar o foco (não reabre sozinho ao sair).
- **A11y**: `aria-pressed` nos toggles de tema/notas/bookmark, `aria-label` no botão Foco e nos
  textareas de nota, foco visível temático (`.reader-focusable` em `index.css`, Paper/Dark)
  substituindo o `outline-none` sem alternativa que havia nos textareas.
- Validado no preview: atalho `B` cria/remove marcação sem duplicar; `Esc` no textarea cancela a
  edição sem fechar painel/reader; `Esc` fora dele ainda sai do foco e depois fecha o reader,
  nessa ordem; painel full-width em 375px e 320px com `padding-right` reservado a partir de 640px;
  sem erros de console em nenhum fluxo. `tsc --noEmit`, `vitest run` (59 testes) e `vite build`
  verdes.

### Adicionado
- **Sprint 7 — Export Markdown implementada** (2026-07-09):
  - Helper puro `generateBookMarkdownExport` (`app/src/lib/export-markdown.ts`), com funções
    auxiliares (`formatMarkdownDate`, `formatMarkdownDuration`, `sanitizeMarkdownFilename`,
    `groupAnnotationsByPage`, `sortAnnotationsForExport`, `sortSessionsForExport`) — 22 testes
    unitários cobrindo livro sem dados, nota única, notas em páginas diferentes, bookmark sem
    corpo, nota+bookmark na mesma página, múltiplas sessões, nota manual de sessão, autor/
    categoria ausentes, título com caracteres inválidos para filename, notas com Markdown
    (`#`/`>`/`-`) no corpo (escapado sem quebrar quebras de linha), ordenação por página e por
    data.
  - `downloadMarkdownFile` (`app/src/lib/download-markdown.ts`, Blob + URL temporária revogada
    após o clique) em arquivo separado do helper puro por depender do DOM.
  - Novo `<fieldset>` "Exportar" em `EditBookDialog.tsx`, logo abaixo do histórico de sessões:
    botões "Exportar Markdown" (baixa `readquest-<slug-do-título>.md`) e "Copiar Markdown"
    (Clipboard API, com erro visível se a permissão for negada ou a API não existir).
  - Markdown gerado inclui metadados (título, autor, categoria, status, progresso, página atual,
    última abertura, última leitura), resumo de leitura (tempo total, sessões, páginas
    avançadas), notas/bookmarks agrupados por página e sessões em ordem cronológica — nunca
    acessa a object store `files`/Blob do PDF.
  - Validado no preview com dados reais de seed (livro sem dados e livro com notas/bookmark):
    saída conferida via import dinâmico do módulo no console do navegador, sem chamadas de rede
    à store `files` (confirmado na aba de rede), sem erros de console em nenhum fluxo.

### Decisões técnicas (Sprint 7)
- Export é por livro (metadados + sessões + notas agregados em um único `.md`), não por sessão
  isolada — ver log de decisões do `ROADMAP_SPRINTS.md`.
- Preview do Markdown antes do download não foi implementado (fora do critério "se for simples");
  registrado como oportunidade futura.

### Adicionado
- **Spike técnico — Text Layer concluído** (2026-07-10), fora de sequência de sprint (relatório
  completo em `TEXT_LAYER_SPIKE.md`):
  - Protótipo experimental isolado em `app/src/features/reader/text-layer-experiment/`, atrás da
    flag `ENABLE_TEXT_LAYER_EXPERIMENT` — nenhuma feature final de highlight foi exposta ao
    usuário.
  - `TextLayerOverlay.tsx`: monta a `TextLayer` do pdf.js sobre a página atual apenas quando um
    "modo seleção" está ligado (atalho `T`), permitindo seleção real de texto em PDFs textuais e
    escaneados com OCR embutido.
  - Helpers puros com testes: `hasExtractableText` (`text-content.ts`, detecção por página de PDF
    sem texto extraível) e `toRelativeRects`/`sortRectsReadingOrder` (`rects.ts`, normalização de
    rects de seleção para coordenadas relativas 0..1 — candidato a formato de persistência de
    `ReadingAnnotation.textAnchor` numa futura sprint de highlights).
  - `PdfEngine.getPageForTextLayer` (método aditivo em `pdf-engine.ts`) expõe o `PDFPageProxy`
    cacheado pelo pdf.js sem alterar o caminho de renderização em canvas existente.
  - Nenhuma feature final exposta: sem highlight persistente, sem OCR, sem UI de produção.

### Corrigido (durante o spike, 2026-07-10)
- Dois bugs de integração do pdf.js encontrados e corrigidos, documentados em
  `TEXT_LAYER_SPIKE.md`: (1) `--scale-factor` CSS custom property obrigatória para o
  dimensionamento do text layer em `pdfjs-dist@4.10` (sem ela, o layout colapsa silenciosamente,
  sem erro); (2) `NotFoundError: removeChild` ao misturar DOM imperativo do pdf.js com filhos
  React declarados no mesmo container — corrigido isolando o container do pdf.js de qualquer
  filho JSX (a mensagem de fallback virou um nó irmão).

### Decisões técnicas (Spike Text Layer)
- **GO condicionado**, Estratégia B (text layer sob demanda via "modo seleção", nunca
  sempre-ativa) — evita conflito permanente com as hotzones de navegação e isola o custo de
  `getTextContent`/render (observado ~1.5–2s numa página densa de 1010 spans) à ação explícita do
  usuário. Recomendação para uma Sprint 9: promover o protótipo para feature estável de highlight
  textual. Ver `ROADMAP_SPRINTS.md` (log de decisões) e `TEXT_LAYER_SPIKE.md` para o relatório
  completo, incluindo achados sobre extratibilidade de texto por página (não por documento) em
  PDFs "escaneados".
- `npx tsc --noEmit`, `npx vitest run` (89 testes, +8 novos) e `npm run build` verdes.

### Adicionado
- **Text Highlights concluído** (2026-07-10), fora de sequência de sprint — promoção do spike de
  Text Layer a feature estável:
  - `TextLayerOverlay` movida de `text-layer-experiment/` (atrás de flag) para
    `app/src/features/reader/highlights/`, agora sem flag — text layer continua **sob demanda**
    (só monta com o "modo seleção" ligado), mas passou a persistir highlights de verdade.
  - Modo seleção acessível pelo botão "Selecionar" na topbar e pelo atalho `T`; sai ao clicar de
    novo, `Esc`, navegar de página ou entrar em modo foco. Hotzones de navegação recebem
    `pointer-events-none` durante o modo para que uma seleção não vire página.
  - `SelectionToolbar.tsx` (nova): mini toolbar com 5 cores (`yellow`, `green`, `blue`, `pink`,
    `purple`) que aparece perto de uma seleção válida; um clique persiste o highlight.
  - `create-highlight.ts` (nova, pura): transforma uma seleção capturada (`quoteText` + rects
    relativos) em `ReadingAnnotation` do tipo `'highlight'`.
  - `HighlightMarks.tsx` (nova): renderiza os highlights salvos da página atual como retângulos
    coloridos — **independente do modo seleção** (não requer text layer), então funciona também
    fora dele sem custo de `getTextContent`.
  - `NotesSidePanel` e `NotesList` (`EditBookDialog`) passam a exibir highlights com ícone 🖍️,
    cor e `quoteText`, com ação de remover.
  - `export-markdown.ts`: nova seção `#### Highlight` (blockquote com `quoteText` + linha de
    cor) na exportação de notas e marcações.
  - Nenhuma mudança de schema: `ReadingAnnotation.type: 'highlight'`, `quoteText` e
    `textAnchor.rects` já existiam desde a Sprint 6.

### Decisões técnicas (Text Highlights)
- Criação de highlight em um único clique na cor desejada (sem passo de confirmação separado) —
  reduz fricção sem comprometer a regra de não criar UX complexa.
- `HighlightMarks` renderiza sempre que a página atual tem highlights, não só durante o modo
  seleção — desenhar retângulos a partir de rects já persistidos é barato; o custo caro
  (extração de texto) permanece isolado ao modo seleção. Ver `ARCHITECTURE.md`.
- Limitações conhecidas: highlight não atravessa páginas nesta versão; rotação de página não foi
  testada; mobile não recebeu tratamento dedicado de seleção de texto.
- `npx tsc --noEmit`, `npx vitest run` (109 testes, +20 novos) e `npm run build` verdes.
  Validação manual completa no navegador (PDF textual real, PDF escaneado, zoom, tema Dark,
  reload, export) sem erros de console nem requisições de rede falhas.

### Adicionado
- **Sprint 10 concluída — Product QA & Data Safety** (2026-07-10), fora de sequência de
  sprint — auditoria + backup/restore/integridade/repair + UI de "Dados e segurança":
  - **Auditoria inicial** de todo o data layer (schema IndexedDB, tipos, CRUD/delete, export,
    stores Zustand, testes, documentação) — achado principal: `useBookStore.remove()` deletava o
    livro e o Blob do PDF mas **deixava sessões e anotações órfãs** no IndexedDB.
  - **Cascade de exclusão corrigido**: `deleteSessionsForBook`/`deleteAnnotationsForBook` (novas,
    em `sessions-repo.ts`/`notes-repo.ts`) removem tudo que pertence ao livro; `useBookStore.remove`
    passa a chamá-las e também limpa o estado em memória de `useSessionStore`/`useNoteStore` se o
    livro removido era o que estava carregado. Texto de confirmação de exclusão atualizado para
    refletir o que de fato é removido.
  - **Backup completo**: `lib/backup.ts` (montagem pura do `ReadQuestBackup`) + `lib/backup-io.ts`
    (lê books/files/sessions/annotations do IndexedDB, converte Blobs para Base64 via
    `lib/base64.ts`) + `lib/download-backup.ts` (download `.json`). Inclui **todos** os registros,
    inclusive órfãos — o backup nunca descarta dado.
  - **Restore/import**: `lib/restore.ts` (parse + validação pura e exaustiva — `app`, `version`,
    `schemaVersion`, forma de cada `book`/`file`/`session`/`annotation`, Base64 minimamente
    validado) + `lib/restore-io.ts` (substituição total das 4 stores, sem merge parcial). Um
    backup inválido nunca corrompe os dados atuais — a validação roda inteira antes de qualquer
    escrita.
  - **Integridade**: `lib/data-integrity.ts` (puro): `validateLibraryIntegrity` e helpers
    (`findOrphanFiles`, `findOrphanSessions`, `findOrphanAnnotations`, `findInvalidSessions`,
    `findInvalidAnnotations`, `findInvalidBooks`, `findDuplicateBookmarks`) detectam arquivo sem
    livro, sessão/anotação sem livro, página fora do intervalo `[1, totalPages]`, `currentPage`
    inválido, highlight sem `quoteText`/`textAnchor.rects`, bookmark duplicado na mesma página.
  - **Reparo seguro**: `lib/repair.ts` remove órfãos, corrige `currentPage` fora do intervalo
    (clamp) e remove bookmarks duplicados (mantendo o mais antigo) — nunca reconstrói PDF perdido,
    nunca inventa livro para arquivo órfão, nunca faz merge automático.
  - **UI "Dados e segurança"** (`features/data-safety/DataSafetyDialog.tsx`), acessível por um
    link discreto na Biblioteca: exportar backup, restaurar (com resumo do conteúdo do arquivo +
    checkbox de confirmação explícita), verificar integridade, corrigir problemas seguros, versão
    do schema visível.
  - Novas funções de leitura no repo layer: `listAllFileIds`/`listAllFiles` (`files-repo.ts`),
    `listAllAnnotations` (`notes-repo.ts`); `DB_VERSION` agora exportado de `db.ts`.

### Decisões técnicas (Sprint 10)
- Restore é sempre substituição total (nunca merge parcial) — evita a complexidade de resolver
  conflitos de `id`/`updatedAt` para um caso de uso (recuperar de uma máquina nova ou de um estado
  corrompido) que não precisa de merge. Documentado como decisão de escopo, não pendência.
- Backup inclui registros órfãos deliberadamente — limpeza é sempre uma ação separada e explícita
  (`repairLibrary`), nunca implícita durante backup/restore.
- Reparo automático cobre só os casos de baixo risco (remoção de órfão, clamp de página, dedupe de
  bookmark); sessões/anotações com página inválida são só reportadas, não corrigidas
  automaticamente — requerem julgamento humano sobre qual página é a correta.
- Split puro/IO no mesmo padrão do Export Markdown (Sprint 7): `backup.ts`, `restore.ts` e
  `data-integrity.ts` não tocam IndexedDB nem DOM, o que os mantém testáveis em Node sem
  `fake-indexeddb`; `backup-io.ts`, `restore-io.ts` e `integrity-io.ts` são as únicas pontes reais.
- `npx tsc --noEmit`, `npx vitest run` (179 testes, +70 novos) e `npm run build` (code-split do
  reader preservado) verdes. **Validação manual no navegador executada em 2026-07-10** (sessão
  seguinte, via Browser pane, reaproveitando dados reais de uso) — backup/restore/round-trip,
  arquivo inválido, schema inválido, checkbox de confirmação, cascade de exclusão, órfão forçado
  e reparo seguro todos confirmados; achado um órfão pré-existente do ambiente de dev (não uma
  regressão), corrigido pelo próprio botão de reparo. Detalhes em `QA_CHECKLIST.md` (Sprint 10).

---

## Sprint 11 (fora de sequência) — Reading Review & Book Completion

### Adicionado
- **Sprint 11 code-complete — Reading Review & Book Completion** (2026-07-10), fecha o ciclo
  leitura → anotação → destaque → finalização → review → export:
  - **Modelo `BookReview`** (`types/models.ts`): `bookId` como chave própria (sem `id` separado —
    estrutura já impõe no máximo uma review por livro), `rating` (0.5–5), `title`, `body`,
    `mainTakeaways`, `favoriteAnnotationIds`, `startedAt`/`finishedAt`.
  - **Store `reviews`** no IndexedDB (`DB_VERSION` 3→4), chaveada diretamente por `bookId`, sem
    índice. `db/reviews-repo.ts`: `getReviewByBook`/`upsertReview`/`deleteReviewForBook`/
    `listAllReviews`, seguindo o mesmo padrão de `sessions-repo.ts`/`notes-repo.ts`.
  - **`stores/useReviewStore.ts`**: carrega sob demanda por livro (`loadForBook`), `save`/`remove`
    sempre explícitos (sem autosave), mais `loadAll`/`allReviews` para o badge de rating na
    Biblioteca sem duplicar o estado principal de edição.
  - **Marcar como finalizado**: reaproveita o `<select>` de status já existente no
    `EditBookDialog` — nenhum botão dedicado novo. Ao transicionar para `status: 'completed'` pela
    primeira vez, `Book.completedAt` (campo que já existia no tipo desde antes desta sprint, mas
    nunca era escrito por nenhum fluxo) é carimbado com a data atual; edições seguintes não
    sobrescrevem essa data, e reverter o status não apaga a review.
  - **UI de review** (`features/library/ReviewEditor.tsx`): nota, título, texto livre, principais
    ideias (uma por linha), data de finalização e checkboxes de highlights favoritos; visível só
    quando o status do livro é "Finalizado"; salvar/excluir sempre explícitos; bloqueia salvar uma
    review totalmente vazia.
  - **Highlights favoritos**: `favoriteAnnotationIds` referencia `ReadingAnnotation.id` por FK
    unidirecional (nunca duplica o texto do highlight); resolvidos apenas no momento do export;
    deletar uma anotação favorita não quebra a review.
  - **Export Markdown**: `generateBookMarkdownExport` ganhou um parâmetro `review` opcional — insere
    uma seção `## Review` (nota, texto, principais ideias, highlights favoritos com o texto
    resolvido) entre "Resumo de leitura" e "Notas e marcações". Livros sem review exportam
    exatamente como antes desta sprint.
  - **Backup/restore/integridade/repair estendidos**: `reviews` vira a 5ª lista do
    `ReadQuestBackup`/`LibrarySnapshot`; `findOrphanReviews`/`findReviewsWithMissingFavorites`
    (ambos avisos) entram em `validateLibraryIntegrity`; `repairLibrary` remove reviews órfãs
    inteiras e, separadamente, limpa apenas IDs de favoritos inválidos de reviews que continuam
    vinculadas a um livro existente; `useBookStore.remove()` agora também apaga a review do livro
    (cascade).
  - **Dashboard**: novo stat "Livros finalizados" (`getFinishedBookCount`) — primeira métrica do
    Dashboard derivada de `Book[]` em vez de `ReadingSession[]`.
  - **Biblioteca**: `BookTile` mostra rating (★) quando o livro está finalizado e tem review;
    `Library.tsx` carrega todas as reviews uma vez (`useReviewStore.loadAll`) para alimentar esse
    badge sem duplicar o estado de edição por livro.
  - Sprint 8 "Modo Review" marcada como superseded por este escopo real (ver `ROADMAP_SPRINTS.md`).

### Decisões técnicas (Sprint 11)
- `reviews` chaveada diretamente por `bookId` em vez de `id` próprio + índice `by-book`: impõe a
  regra "no máximo uma review por livro" estruturalmente, sem precisar de checagem de duplicidade
  em runtime — mesma decisão de design já usada implicitamente pela store `files` (chaveada por
  bookId).
- `BookReview.finishedAt` é um campo separado de `Book.completedAt`, mesmo sendo pré-preenchido a
  partir dele: a review deve poder ter sua data editada pelo usuário depois sem afetar o status
  "oficial" do livro.
- Reaproveitar o `<select>` de status existente para "marcar como finalizado" em vez de um botão
  dedicado: evita duplicar a superfície de edição de status e mantém o `EditBookDialog` como único
  lugar de mudança de status do livro.
- `npx tsc --noEmit`, `npx vitest run` (208 testes, +29 novos) e `npm run build` (code-split
  preservado) verdes.

### QA manual e correção (2026-07-11) — fecha a Sprint 11
- Validação manual completa executada numa sessão nova do Browser pane: o travamento de IndexedDB
  da sessão anterior (nenhum evento de `indexedDB.open('readquest', 3)`, nem `success` nem `error`
  nem `blocked`) não se reproduziu — abriu de imediato em v4 com as 5 stores esperadas. Era conexão
  obsoleta da aba anterior, não defeito de schema/migração. Checklist completo de `QA_CHECKLIST.md`
  (Sprint 11) executado com massa de dados real via UI: finalizar livro, CRUD de review completo
  (criar/editar/excluir/recriar, guarda contra review vazia), highlight favorito (persistência +
  exclusão segura do highlight sem quebrar a review), export Markdown (com e sem review), backup +
  restore via UI real (incluindo cenário de review órfã por backup mutado), integridade/reparo
  (`orphan-review` e `review-missing-favorite`), cascade de exclusão de livro, e regressão geral do
  reader/notes/bookmarks/highlights/dashboard/export — sem erros de console em nenhuma etapa.
- **Bug real encontrado e corrigido:** `ReviewEditor.onSave` construía `BookReview.finishedAt` com
  `new Date(finishedAt).toISOString()`, que interpreta a string `YYYY-MM-DD` do `<input
  type="date">` como meia-noite UTC. `formatMarkdownDate` (export) lê essa data de volta com
  componentes de calendário locais, então em fusos negativos (ex.: America/Sao_Paulo, UTC-3) a
  data exportada aparecia um dia antes da escolhida pelo usuário. Os testes existentes não
  cobriam o caso porque o fixture usa meio-dia UTC, que não cruza a fronteira de dia em fusos
  comuns. Corrigido construindo a data como meia-noite local
  (`new Date(\`${finishedAt}T00:00:00\`)`), preservando o round-trip local. `tsc --noEmit`,
  `vitest run` (208 testes) e `npm run build` seguem verdes após a correção.

---

## Sprint 12 — Busca Global & Recuperação de Conhecimento

### Adicionado
- **Sprint 12 concluída — Busca Global** (2026-07-11): busca local-first sobre títulos, autores,
  categorias, notas, highlights, marcadores, reviews, principais aprendizados e notas manuais de
  sessão.
  - **Auditoria inicial** de modelos, IndexedDB, repos, stores e navegação do App Shell — achado:
    `useNoteStore` não tinha o eixo `allAnnotations`/`loadAll()` que `useSessionStore`/
    `useReviewStore` já tinham; adicionado seguindo o mesmo padrão, incluindo o filtro por
    `bookId` no cascade de exclusão de livro (`useBookStore.remove`).
  - **`lib/search-index.ts`** (puro, sem I/O): `buildSearchIndex` monta o índice pesquisável a
    partir dos arrays já carregados pelos stores; `searchLibrary` filtra por substring
    case-insensitive/sem acento e pontua por tipo de resultado, posição do match e exatidão,
    desempatando por `updatedAt` — 18 testes unitários.
  - **Nova view `search`** (`useUIStore`), acessível pelo botão "Buscar" na Biblioteca e pelo
    atalho `Ctrl/Cmd+K` (desativado dentro do reader). `openReader` ganhou um `page` opcional;
    `useReader`/`PdfReader` ganharam `initialPage` — resultados ancorados a página (nota,
    highlight, marcador, nota de sessão) abrem o reader direto nela.
  - **`features/search/GlobalSearch.tsx`**: tela de busca no estilo App Shell, code-split via
    `React.lazy` (~5.8kB, fora do bundle inicial da Biblioteca), com estados vazio/sem-resultado/
    carregando.
  - Validado no preview com dados reais: ranking correto entre highlight/review/nota de sessão,
    navegação para a página exata do highlight, navegação para a página salva num match de
    título, `Ctrl+K` funcional — sem erros de console. `tsc --noEmit`, `vitest run` (228 testes,
    +20 novos) e `npm run build` verdes.

### Decisões técnicas (Sprint 12)
- Sem nova object store: índice reconstruído em memória (`useMemo`) a partir dos dados já
  carregados — suficiente para o volume local/pessoal do ReadQuest.
- Tipos de busca (`SearchResult`) não entraram em `DATA_MODEL.md` por não serem um formato
  persistido — mesma convenção do Dashboard (Sprint 5).

---

## Sprint 13 — AI Reading Assistant Foundation

### Adicionado
- **Sprint 13 concluída — Assistente de Leitura IA** (2026-07-12): camada local-first para gerar
  prompts/contextos prontos para colar em ChatGPT, Claude ou NotebookLM. Sem API paga, sem envio
  de dados a servidor, sem chat interno completo, sem embeddings.
  - **Auditoria inicial**: `lib/export-markdown.ts` já era puro/reutilizável; as funções de
    escape de Markdown eram privadas — exportadas para reuso sem duplicar lógica de sanitização.
    Nenhuma migração de schema necessária.
  - **`lib/ai-context.ts`** (puro, sem I/O): `generateAiContext` monta o bloco de prompt a partir
    de `Book`/`ReadingSession[]`/`ReadingAnnotation[]`/`BookReview?` já carregados — 7 seções
    selecionáveis (metadados, notas, highlights, marcadores, review, principais ideias, sessões)
    e 4 tipos de prompt (discussão, quiz, extrair insights, dados brutos) — 8 testes unitários.
  - **Nova view `ai-assistant`** (`useUIStore`), acessível pelo botão "Assistente IA" no
    cabeçalho da Biblioteca.
  - **`features/ai-assistant/AiAssistant.tsx`**: seletor de livro, checkboxes de seção, seletor
    de tipo de prompt, preview do Markdown gerado, "Copiar" (clipboard) e "Exportar .md" — nunca
    toca o Blob do PDF. Code-split via `React.lazy` (~8.75kB).
  - Validado no preview com dados reais: toggle de seções refletindo em tempo real, omissão
    correta de seções sem dado (review ausente, etc.), sem erros de console. `tsc --noEmit`,
    `vitest run` (236 testes, +8 novos) e `npm run build` verdes.

### Decisões técnicas (Sprint 13)
- Sem nova object store — mesmo padrão do Dashboard/busca global.
- Tipos de `lib/ai-context.ts` não entraram em `DATA_MODEL.md` por não serem formato persistido.
- "Review" e "Principais ideias" são seções independentes: dá para incluir só as ideias
  principais sem o texto livre da review.

---

## Sprint 14 — AI Chat/RAG Spike

### Adicionado
- **Sprint 14 concluída — spike técnico de AI Chat/RAG** (2026-07-12): investigação de
  viabilidade de um chat interno com IA, sem virar feature final. Nenhuma chamada externa real,
  sem API key, sem backend, sem embeddings, sem indexar o PDF.
  - **`lib/ai-provider.ts`**: contrato `AIProvider` (`AIProviderMessage`/`Request`/`Response`)
    desacoplado de qualquer SDK real — trocar por um provider de verdade no futuro não exige
    mudar a UI.
  - **`lib/mock-ai-provider.ts`**: `createMockAiProvider()` — resposta determinística com
    disclaimer explícito de que é simulada, sem `fetch`/rede — 4 testes.
  - **`lib/token-estimate.ts`**: estimativa aproximada de tokens (~4 caracteres/token) e tamanho
    de contexto — 6 testes.
  - **`lib/ai-chat-context.ts`** (puro): `buildAiChatContext` — "RAG simples" reaproveitando
    `buildSearchIndex`/`searchLibrary` (Sprint 12) como retrieval por palavra-chave sobre
    livros/notas/highlights/reviews/sessões já carregados, com escopo opcional por livro — 7
    testes.
  - **Nova view `ai-chat`** (`useUIStore`), botão "Chat IA (spike)" no cabeçalho da Biblioteca.
  - **`features/ai-chat/AiChat.tsx`**: aviso de privacidade fixo, painel de contexto recuperado
    visível antes de enviar, estimativa de tokens ao vivo, "Copiar contexto"/"Copiar prompt
    completo", conversa não persistida (só estado de componente). Nunca toca `db/files-repo.ts`
    nem o Blob do PDF. Code-split via `React.lazy` (~10.2kB).
  - Validado no preview: retrieval ao vivo correto, resposta mock com disclaimer/fontes/tokens,
    cópia de contexto confirmada, `read_network_requests` só mostrou `localhost` (zero chamadas
    externas), zero erros de console. `tsc --noEmit`, `vitest run` (253 testes, +25 novos) e
    `npm run build` verdes.

### Decisões técnicas (Sprint 14)
- Retrieval reaproveita o índice de busca por palavra-chave da Sprint 12 em vez de embeddings —
  cumpre a restrição de não indexar o PDF inteiro nem criar embeddings nesta sprint.
- Contexto recuperado é embutido na última mensagem do usuário (não numa mensagem `system`
  separada), junto com a pergunta — mais simples e mais próximo de copiar/colar manual.
- Conversa vive só em `useState` do componente, sem persistência — decisão explícita da sprint.
- **Conclusão do spike: GO condicionado.** Infra de agregação de dados já existe; falta um
  provider real + opt-in explícito por conversa + controle de custo além da estimativa
  aproximada antes de qualquer chamada externa de verdade.

## Sprint 15 — AI Provider Integration Gate

### Adicionado
- **Sprint 15 concluída — portão seguro de integração com provider real de IA** (2026-07-12):
  primeira chamada externa real possível no ReadQuest, opt-in, sem tornar IA uma feature
  irreversível. Modo mock (Sprint 14) continua o padrão; nada muda para quem não configurar um
  provider real.
  - **`lib/openai-compatible-provider.ts`**: `createOpenAiCompatibleProvider()` — segundo
    `AIProvider` real (via `fetch` puro, sem SDK novo), compatível com qualquer endpoint no
    formato OpenAI chat completions (OpenAI, OpenRouter, Groq, Ollama local etc.). Valida
    apiKey/baseUrl/model sincronamente na construção (nunca dispara `fetch` sozinho); erros de
    resposta nunca incluem a apiKey — 10 testes (incluindo verificação explícita de que a chave
    não vaza em mensagens de erro nem na URL).
  - **`stores/useAiSettingsStore.ts`**: store Zustand **sem persistência** (nem localStorage nem
    IndexedDB) — `mode`/`apiKey`/`baseUrl`/`model` vivem só em memória do processo, perdidos ao
    recarregar a página; ação explícita `clearApiKey` ("Esquecer chave") — 5 testes.
  - **`features/ai-chat/AiChat.tsx`** estendido: seletor Mock/Real, campos de configuração do
    provider real (URL base, modelo, apiKey mascarada) visíveis só no modo real, aviso de
    privacidade específico do modo ativo, e **confirmação manual obrigatória em duas etapas**
    antes de qualquer chamada real (botão "Revisar antes de enviar" → callout com
    endpoint/tokens estimados → "Confirmar e enviar"/"Cancelar"); modo mock permanece de um
    clique só, sem gate (nenhum risco de privacidade). Code-split via `React.lazy`
    (~16.3kB, +6kB pelo novo painel de configuração).
  - Validado no preview: alternância mock↔real, "Configuração incompleta" bloqueando envio sem
    apiKey, gate de confirmação **impedindo qualquer chamada de rede antes do clique explícito**
    (confirmado via `read_network_requests` — zero requisições ao endpoint configurado antes da
    confirmação), cancelamento sem efeito colateral, confirmação disparando a chamada real (erro
    de rede esperado no ambiente de preview, sem vazar a apiKey na mensagem), "Esquecer chave"
    limpando o campo, e modo mock seguindo funcional sem regressão. Zero erros de console.
    `tsc --noEmit`, `vitest run` (268 testes, +15 novos) e `npm run build` verdes.

### Decisões técnicas (Sprint 15)
- **API key nunca persistida** (nem localStorage nem IndexedDB) — decisão de segurança
  explícita da sprint. Sessão = memória do processo do navegador (Zustand sem `persist`), não
  por-tela: a chave sobrevive à troca de view dentro do mesmo carregamento da SPA, mas some ao
  recarregar ou fechar a aba.
- **Adapter via `fetch` puro, sem SDK novo**: formato "OpenAI chat completions" é o
  denominador comum mais amplo (cobre OpenAI, OpenRouter, Groq, Ollama local) sem adicionar
  dependência auditável a mais em um projeto que hoje só depende de `idb`/`pdfjs-dist`/
  `react`/`zustand`.
- **Confirmação em duas etapas só no modo real**: modo mock não ganhou o mesmo gate porque não
  há risco de privacidade nele (nenhum dado sai do navegador) — adicionar fricção ali violaria a
  convenção do projeto de não criar UX complexa sem necessidade.

---

## [0.1.0] - 2026-07-12 (RC1)

### Adicionado
- **Sprint 16 concluída — Release Candidate & Repository Hardening**: primeiro baseline
  recuperável do projeto, sem feature nova.
  - `.gitignore` de raiz (node_modules, dist, .vite, .env(.*), logs, coverage/test artifacts,
    backups do ReadQuest, PDFs reais acidentais).
  - `README.md` reescrito para refletir o produto real (15 sprints implementadas), com stack,
    scripts, uso básico, data safety e IA/privacidade corretos.
  - `KNOWN_LIMITATIONS.md` novo: limitações de armazenamento, text layer/OCR, IA e performance.
  - Primeiro histórico git do repositório (não havia nenhum commit antes desta sprint).

### Removido
- Duplicata de download `READQUEST_PLANO_TECNICO (1).pdf` (conteúdo idêntico ao PDF já versionado).

### Corrigido
- `app/package.json`: descrição desatualizada ("Sprint 1") corrigida para refletir o estado
  real do projeto (v0.1.0 / RC1).

### Verificado
- `npx tsc --noEmit`, `npx vitest run` (268 testes) e `npm run build` verdes.
- QA manual completo no preview: biblioteca, reader, notas, marcador, highlight, sessão,
  dashboard, busca global, export Markdown, backup/integridade, Assistente IA (mock) e Chat IA
  (modo real corretamente bloqueado sem API key, zero chamadas de rede externas) — sem erros de
  console em nenhum fluxo. Detalhes em `ROADMAP_SPRINTS.md` (Sprint 16).

---

## Como preencher esta seção conforme o projeto avança

Ao concluir uma sprint, adicionar uma nova entrada versionada (ex: `[0.1.0] - 2026-07-20`) com
as subseções relevantes:

- `Adicionado` — novas features
- `Modificado` — mudanças em comportamento existente
- `Corrigido` — bugs resolvidos
- `Removido` — features ou dependências removidas
- `Decisões técnicas` — ADRs informais tomados durante a sprint (espelhar também em
  `ROADMAP_SPRINTS.md`, seção "Log de decisões durante a execução")
