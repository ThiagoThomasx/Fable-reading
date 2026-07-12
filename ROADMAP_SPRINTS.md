# Roadmap por Sprints — ReadQuest

Documento vivo. Marque os itens conforme forem concluídos. Detalhamento completo de riscos e
arquitetura em `READQUEST_PLANO_TECNICO.md`; critérios de teste detalhados em
`QA_CHECKLIST.md`.

**Regra de ordem:** não pular o Sprint 0. Não implementar features de sprints futuros antes das
anteriores cumprirem seus critérios de aceite.

---

## Sprint 0 — Spike Técnico PDF.js
**Duração estimada:** 2–3 dias
**Objetivo:** validar viabilidade de performance do `pdfjs-dist` antes de comprometer prazo
**Critério de aceite:** abertura da 1ª página <500ms (PDF até 50MB); navegação em cache <100ms; sem travar a UI

- [x] Protótipo isolado com `pdfjs-dist` + Web Worker (`spike-pdf/`)
- [x] Teste com PDF leve, PDF pesado (com imagens) e PDF escaneado
- [x] Confirmar renderização página-única (decisão já tomada)
- [x] Registrar os três tempos medidos como baseline para a Sprint 1 (ver log de decisões abaixo)

## Sprint 1 — Leitor PDF Core
**Duração estimada:** 1,5–2 semanas
**Objetivo:** abrir e ler um PDF localmente, substituindo o Kindle no essencial
**Critério de aceite:** upload → leitura com navegação/zoom → fecha e volta exatamente onde parou; troca de página instantânea para páginas adjacentes

- [x] Setup React + Vite + TS + Tailwind + tokens Fable (`app/`)
- [x] Duas object stores no IndexedDB: `files` e `books`
- [x] Upload local de PDF → Blob em `files`
- [x] Renderização página-única com pdfjs-dist, worker isolado por documento
- [x] Snapshot persistido da última página lida (`lastPageSnapshot` na store `books`): exibição
      instantânea na abertura do livro + substituição pelo render real sem flash
- [x] Gerar e salvar snapshot comprimido (JPEG) ao trocar de página e ao fechar o livro
- [x] Pré-carregamento da página N+1 em canvas invisível
- [x] Cache LRU em memória das últimas 5–10 páginas renderizadas (8, com testes unitários)
- [x] Navegação por página (teclado + clique) e zoom com downscale de resolução
- [x] Salvar página atual automaticamente (debounce 1s, toca só `books` — coberto por teste)
- [x] Skeleton cream sólido como placeholder durante o render
- [x] Modo foco (esconde chrome, só o texto)
- [x] Code splitting: `PdfReader` via `React.lazy()` (pdfjs-dist também fora do bundle inicial)

## Sprint 2 — Refino da Reading Surface
**Duração estimada:** 1 semana
**Objetivo:** experiência de leitura no nível "melhor que Kindle"
**Critério de aceite:** leitura confortável em sessões longas, temas Paper e Dark funcionais

- [x] Tema Paper (padrão) e Dark
- [x] Atalhos de teclado (página anterior/próxima, zoom, reset de zoom, foco, tema, fechar)
- [x] Transições suaves entre páginas (CSS, discreta — ver decisão abaixo sobre Framer Motion)
- [x] Indicador de progresso sutil (nº página / total + barra fina)

## Sprint 3 — Biblioteca (App Shell)
**Duração estimada:** 1 semana
**Objetivo:** gerenciar múltiplos livros carregados
**Critério de aceite:** usuário vê todos os PDFs com capa e progresso, e abre qualquer um

- [x] CRUD de metadados do livro (título, autor, categoria, status — `tags` fica para uma sprint
      futura de notas, sem consumidor de UI ainda)
- [x] Capa: extração automática (1ª página) OU upload manual — usuário escolhe (cadastro desde a
      Sprint 1; edição de capa pós-cadastro nova nesta sprint)
- [x] Grid de biblioteca com Book Cover Tile (estilo Fable)
- [x] Filtro por status e categoria

## Sprint 4 — Sessões de Leitura & Progresso
**Duração estimada:** 1 semana
**Objetivo:** tracking automático de progresso ao longo do tempo
**Critério de aceite:** sessão registrada automaticamente ao ler, sem ação manual obrigatória

- [x] Captura automática de sessão (tempo + páginas) ao navegar no reader
- [x] Edição manual opcional (tempo, observação)
- [x] Histórico de sessões por livro

## Sprint 5 — Dashboard
**Duração estimada:** 3–5 dias
**Objetivo:** visão consolidada da atividade de leitura
**Critério de aceite:** usuário entende sua atividade da semana em poucos segundos

- [x] Helpers puros de agregação (`lib/dashboard-stats.ts`): tempo total, páginas totais,
      sessões recentes, resumo por livro, atividade dos últimos 7 dias — cobertos por testes
- [x] Cards de métricas (tempo lido, páginas avançadas, sessões, livros ativos, última leitura)
- [x] Atividade dos últimos 7 dias (mini barras CSS, sem lib de gráficos)
- [x] Lista de atividade recente (últimas sessões, com fallback para livro removido)
- [x] Resumo por livro (top 5 mais ativos, sem tocar Blobs)
- [x] Nova view `dashboard` no App Shell, acessível pela Biblioteca, code-split via `React.lazy()`

## Sprint 6 — Notas
**Duração estimada:** 1 semana
**Objetivo:** anotações vinculadas à página lida
**Critério de aceite:** usuário cria nota durante a leitura, vinculada à página atual

- [x] Painel lateral de notas dentro da Reading Surface
- [x] CRUD de nota com tipo/tag (page_note/bookmark; `tags` no modelo, sem UI de filtro ainda)
- [x] Lista de notas por livro fora do reader

## Sprint 7 — Export Markdown
**Duração estimada:** 3–5 dias
**Objetivo:** tornar os dados portáveis
**Critério de aceite:** usuário exporta .md de sessão/notas/livro e usa no Obsidian

- [x] Funções puras de serialização MD (livro, sessão, notas)
- [x] Copiar para clipboard
- [x] Baixar arquivo .md

## Spike técnico (fora de sequência) — Text Layer
**Duração estimada:** 2–3 dias
**Objetivo:** investigar viabilidade de adicionar text layer do pdf.js ao reader canvas-only,
para seleção de texto e highlight textual futuro
**Critério de aceite:** decisão clara (GO / NO-GO / GO condicionado) documentada, sem quebrar o
reader estável, notes/bookmarks/sessions/export continuando funcionais

> Nota de numeração: este spike foi pedido como "Sprint 8" pela instrução que o originou, mas
> esse número já está em uso por "Modo Review" abaixo (que segue o plano original em
> `READQUEST_PLANO_TECNICO.md`). Mantido como item fora de sequência para não renumerar sprints já
> concluídas — ver `TEXT_LAYER_SPIKE.md` para o relatório completo.

- [x] Auditoria do reader atual (`pdf-engine.ts`, `use-reader.ts`, `PdfReader.tsx`, hotzones,
      `NotesSidePanel`, `ReadingAnnotation.textAnchor`) — ver `TEXT_LAYER_SPIKE.md`
- [x] Protótipo isolado atrás de flag (`ENABLE_TEXT_LAYER_EXPERIMENT`), "modo seleção" sob demanda
- [x] Teste com PDF textual leve, PDF pesado (imagens) e PDF escaneado (achado: nem toda página
      "escaneada" carece de texto — ver seção de resultados)
- [x] Teste de zoom/resize e interação com hotzones/painel de notas/temas
- [x] Medição de performance (montagem do text layer em página densa: ~1.5–2s, isolada ao modo
      seleção, sem impacto na leitura normal)
- [x] Decisão documentada: **GO condicionado** (Estratégia B — text layer sob demanda) — ver
      `TEXT_LAYER_SPIKE.md`

## Text Highlights (fora de sequência) — promoção do spike a feature estável
**Duração estimada:** 3–5 dias
**Objetivo:** promover o "modo seleção" do spike técnico a feature real de highlights textuais
**Critério de aceite:** usuário cria, visualiza, persiste e remove highlights de texto; export
Markdown os inclui; reader padrão sem regressão de performance

> Nota de numeração: esta sprint foi pedida como "Sprint 9" pela instrução que o originou, mas
> esse número já está em uso por "IA Assistida" abaixo (que segue o plano original em
> `READQUEST_PLANO_TECNICO.md`). Mantida como item fora de sequência, na sequência direta do spike
> de Text Layer, pelo mesmo motivo documentado lá.

- [x] `TextLayerOverlay` promovido de `text-layer-experiment/` (atrás de flag) para
      `features/reader/highlights/` (feature estável, sem flag) — text layer continua sob demanda
- [x] Modo seleção/highlight: botão na topbar + atalho `T`; sai com clique novamente, `Esc`,
      navegação de página ou modo foco; hotzones com `pointer-events-none` durante o modo
- [x] Criação de highlight a partir da seleção (`SelectionToolbar`, 5 cores) — persiste
      `ReadingAnnotation` `type: 'highlight'` com `quoteText` e `textAnchor.rects` relativos (0..1)
- [x] Renderização de highlights salvos (`HighlightMarks`) — sempre ativa (independe do modo
      seleção, sem custo de text layer), alinhada após zoom/resize via `ResizeObserver`
- [x] Remoção de highlight via `NotesSidePanel` e `NotesList` (`EditBookDialog`)
- [x] Integração com `NotesSidePanel` e `NotesList`: ícone, cor, `quoteText`, ação de remover
- [x] Export Markdown com seção `#### Highlight` (blockquote + cor)
- [x] Fallback de página sem texto extraível preservado do spike
- [x] Testes: helpers de rects/seleção, `create-highlight`, notes-repo/useNoteStore (coexistência
      note+bookmark+highlight), export-markdown (highlight único, múltiplo, cor, ausência)
- [x] Validação manual no navegador (PDF textual real, PDF escaneado, zoom, tema Dark, reload,
      export) — ver relatório da sprint

## Sprint 8 — Modo Review
**Duração estimada:** 1 semana
**Objetivo:** apoiar produção de reviews ao concluir um livro
**Critério de aceite:** usuário termina o livro com base pronta para escrever review

> **Superseded pela Sprint 11 (2026-07-10):** o escopo real de review (`BookReview`) foi
> implementado como parte de "Reading Review & Book Completion", com um modelo mais simples
> (rating, título, texto livre, principais ideias, highlights favoritos) do que o formulário
> estruturado originalmente planejado aqui (pontos fortes/fracos, temas, cenas). Ver Sprint 11
> abaixo — os itens `[ ]` desta seção não serão implementados como descrito.

- [ ] ~~Schema `Review` + CRUD~~ — ver `BookReview` na Sprint 11
- [ ] ~~Formulário estruturado (pontos fortes/fracos, temas, cenas, nota final)~~ — fora de escopo,
      substituído por formulário simples (ver Sprint 11)
- [ ] ~~Export da review em Markdown~~ — implementado na Sprint 11 (seção `## Review` no export
      existente do livro)

## Sprint 9 — IA Assistida (fase 1: sem API)
**Duração estimada:** 1 semana
**Objetivo:** transformar notas em material de estudo/review via prompt exportável
**Critério de aceite:** app gera prompt copiável com contexto de notas/sessão

> **Superseded pela Sprint 13 (2026-07-12):** implementado como "AI Reading Assistant
> Foundation" — escopo mais amplo do que o previsto aqui (seleção de livro, 7 categorias de
> dados selecionáveis, 4 tipos de prompt, preview + copiar + exportar .md). Ver Sprint 13
> abaixo.

- [ ] ~~Templates de prompt (resumo, perguntas de revisão, base de review)~~ — ver Sprint 13
      (4 tipos de prompt: discussão, quiz, insights, dados brutos)
- [ ] ~~Botão "copiar prompt" com dados interpolados~~ — implementado na Sprint 13
- [ ] (Futuro/opcional) integração direta via API — segue fora de escopo

## Sprint 10 (fora de sequência) — Product QA & Data Safety
**Duração estimada:** 3–5 dias
**Objetivo:** tornar o ReadQuest seguro para uso real local-first: backup completo, restore,
integridade e QA de produto, antes de abrir IA/mobile avançado/review system
**Critério de aceite:** usuário consegue exportar/restaurar um backup completo, ver um relatório
de integridade e corrigir órfãos com segurança; nenhuma regressão no reader, notes, highlights,
sessions, dashboard ou export Markdown

> Nota de numeração: mesma situação das duas entradas anteriores — pedida como "Sprint 10" pela
> instrução que a originou, fora da sequência de `READQUEST_PLANO_TECNICO.md`. Mantida como item
> fora de sequência para não renumerar sprints já concluídas.

- [x] Auditoria inicial (schema IndexedDB, tipos, CRUD/delete, export, stores, testes, docs) —
      achado principal: `useBookStore.remove()` deixava sessões/anotações órfãs ao excluir um
      livro (cascade incompleto)
- [x] Cascade de exclusão corrigido: `remove()` agora apaga também sessões e anotações do livro
      (`deleteSessionsForBook`/`deleteAnnotationsForBook`) e limpa o estado em memória das outras
      stores
- [x] Helpers puros de integridade (`lib/data-integrity.ts`): arquivo/sessão/anotação órfã,
      página fora do intervalo válido, `currentPage` inválido, highlight incompleto, bookmark
      duplicado — `validateLibraryIntegrity` agrega tudo num `IntegrityReport`
- [x] Backup completo (`lib/backup.ts` puro + `lib/backup-io.ts`/`lib/base64.ts`): inclui
      livros, PDFs (Base64), sessões e anotações, inclusive registros órfãos — nunca perde dado
- [x] Restore/import (`lib/restore.ts` puro + `lib/restore-io.ts`): valida a forma inteira do
      backup antes de escrever qualquer coisa; modo substituição total, sem merge parcial
- [x] Reparo seguro (`lib/repair.ts`): remove órfãos, corrige `currentPage` fora do intervalo
      (clamp), remove bookmark duplicado — nunca reconstrói PDF nem inventa dado
- [x] UI "Dados e segurança" (`features/data-safety/DataSafetyDialog.tsx`), acessível pela
      Biblioteca: exportar backup, restaurar (com confirmação explícita), verificar integridade,
      corrigir problemas seguros, versão do schema
- [x] Testes unitários para backup/restore/integridade/repair/cascade (fake-indexeddb)
- [x] `tsc --noEmit`, `vitest run` (179 testes) e `npm run build` (code-split preservado) — todos
      verdes
- [x] Validação manual completa no navegador (2026-07-10, via Browser pane em `app` real com
      dados de uso pré-existentes: 6 livros, 8 sessões, 2 anotações) — ver detalhes e achado em
      `QA_CHECKLIST.md`. Sprint 10 agora é considerada base segura para a Sprint 11.

## Sprint 11 (fora de sequência) — Reading Review & Book Completion
**Duração estimada:** 1 semana
**Objetivo:** fechar o ciclo leitura → anotação → destaque → finalização → review → export
**Critério de aceite:** usuário marca um livro como finalizado, escreve/edita/apaga uma review com
rating e highlights favoritos, vê tudo persistir após reload, exporta a review em Markdown junto
do resto do livro, e tudo isso é coberto por backup/restore/integridade — sem regressão em
reader, notes, highlights, sessions, dashboard ou export existente

> Nota de numeração: mesma situação da Sprint 10 — fora da sequência de
> `READQUEST_PLANO_TECNICO.md`. Substitui o escopo original da Sprint 8 "Modo Review" (ver nota lá).

- [x] Auditoria inicial de `Book`/`ReadingSession`/`ReadingAnnotation`/export/backup/integridade/
      `EditBookDialog`/`BookTile`/`Library`/`Dashboard`/stores/IndexedDB antes de qualquer código
      (reportada na sessão) — achado: `Book.completedAt` já existia no tipo, mas não era escrito
      por nenhum fluxo; nenhum conceito de "favorito" existia em `ReadingAnnotation`
- [x] Modelo `BookReview` (`types/models.ts`): `bookId` como chave própria (sem `id` separado —
      no máximo uma review por livro), `rating` (0.5–5), `title`, `body`, `mainTakeaways`,
      `favoriteAnnotationIds`, `startedAt`/`finishedAt`
- [x] Store `reviews` no IndexedDB (`DB_VERSION` 3→4), chaveada por `bookId`, sem índice —
      `db/reviews-repo.ts` (`getReviewByBook`/`upsertReview`/`deleteReviewForBook`/`listAllReviews`)
- [x] `stores/useReviewStore.ts`: carrega sob demanda por livro, `save`/`remove` explícitos (sem
      autosave), `loadAll`/`allReviews` para badges de rating na Biblioteca
- [x] Marcar como finalizado: reaproveita o `<select>` de status do `EditBookDialog` — ao mudar
      para `completed` pela primeira vez, `Book.completedAt` é carimbado com a data atual (uma
      única vez; não sobrescreve em edições seguintes; não apaga a review se o status voltar atrás)
- [x] UI de review (`features/library/ReviewEditor.tsx`): nota (select 0.5–5), título, textarea de
      review, textarea de principais ideias (uma por linha), data de finalização, checkboxes de
      highlights favoritos, salvar/excluir explícitos, feedback de sucesso/erro; visível só quando
      `status === 'completed'`
- [x] Highlights favoritos: `favoriteAnnotationIds` referencia `ReadingAnnotation.id` (FK
      unidirecional, sem duplicar texto); resolvido só no export; anotação deletada não quebra a
      review (integridade sinaliza como aviso, reparo pode limpar o ID)
- [x] Export Markdown (`lib/export-markdown.ts`): seção `## Review` opcional inserida entre
      "Resumo de leitura" e "Notas e marcações" — omitida por completo quando o livro não tem
      review; livros sem review continuam exportando exatamente como antes
- [x] Backup/restore/integridade/repair estendidos para `reviews`: 5ª lista no
      `ReadQuestBackup`/`LibrarySnapshot`, `findOrphanReviews`/`findReviewsWithMissingFavorites`
      (avisos), `repairLibrary` remove reviews órfãs e limpa favoritos inválidos separadamente,
      cascade de exclusão de livro (`useBookStore.remove`) apaga a review do livro
- [x] Dashboard: novo stat "Livros finalizados" (`getFinishedBookCount`, primeira métrica do
      Dashboard derivada de `Book[]` em vez de `ReadingSession[]`); Biblioteca mostra rating (★) no
      tile quando o livro está finalizado e tem review
- [x] Testes unitários: `reviews-repo.test.ts`, `useReviewStore.test.ts`, extensões em
      `data-integrity.test.ts`/`repair.test.ts`/`backup.test.ts`/`backup-io.test.ts`/
      `restore.test.ts`/`restore-io.test.ts`/`export-markdown.test.ts`/`useBookStore.test.ts` —
      `tsc --noEmit`, `vitest run` (208 testes) e `npm run build` todos verdes
- [x] Validação manual completa no navegador (2026-07-11) — o travamento do IndexedDB da sessão
      anterior não se reproduziu numa sessão nova do Browser pane: `indexedDB.open('readquest')`
      abriu de imediato em v4 com as 5 stores esperadas (era artefato de conexão obsoleta da aba
      antiga, não defeito de schema/código). Checklist completo de `QA_CHECKLIST.md` executado:
      finalizar livro, CRUD de review (criar/editar/excluir/recriar, guarda de review vazia),
      highlight favorito (persistência + exclusão do highlight sem quebrar a review), export
      Markdown (com e sem review), backup/restore (incluindo review), integridade/reparo
      (`orphan-review` e `review-missing-favorite`, ambos detectados e corrigidos sem afetar dados
      válidos), cascade de exclusão de livro (book/file/sessions/annotations/review removidos
      juntos), e regressão geral do reader/notes/bookmark/highlight/dashboard — sem erros de
      console em nenhuma etapa
- [x] Bug real encontrado e corrigido durante o QA manual: `ReviewEditor.onSave` convertia a data
      de "Finalizado em" com `new Date(finishedAt).toISOString()`, que interpreta a string
      `YYYY-MM-DD` como meia-noite UTC; `formatMarkdownDate` (export) lê de volta com componentes
      locais, então em fusos negativos (ex.: America/Sao_Paulo, UTC-3) a data exportada aparecia um
      dia antes da escolhida. Corrigido para `new Date(\`${finishedAt}T00:00:00\`)` (meia-noite
      local), tornando o round-trip local sem perda. `tsc --noEmit`, `vitest run` (208 testes) e
      `npm run build` seguem verdes após a correção.

---

## Sprint 12 — Busca Global & Recuperação de Conhecimento

**Objetivo:** transformar o ReadQuest numa base pessoal de leitura recuperável — busca local em
títulos, autores, categorias, notas, highlights, marcadores, reviews, principais aprendizados e
notas manuais de sessão.
**Critério de aceite:** usuário digita uma query e vê resultados ranqueados de todas essas
fontes; clicar num resultado ancorado a uma página (nota/highlight/marcador/nota de sessão) abre
o reader exatamente naquela página; clicar num resultado sem página (título/autor/categoria/
review/ideia) abre o reader na página salva do livro.

- [x] Auditoria inicial (schema IndexedDB, tipos, repos, stores Zustand, navegação do App Shell,
      helpers existentes, riscos de performance) — achado principal: `useNoteStore` só carregava
      anotações por livro, sem o eixo `allAnnotations`/`loadAll()` que `useSessionStore`/
      `useReviewStore` já tinham; nenhuma migração de schema foi necessária (todo `listAll*` já
      existia no repo layer)
- [x] `useNoteStore` ganhou `allAnnotations`/`isAllLoaded`/`loadAll()`, espelhando o padrão de
      `useSessionStore`/`useReviewStore`; `useBookStore.remove()` (cascade) passou a filtrar
      `allAnnotations` também, junto de `allSessions`/`allReviews`
- [x] Índice de busca puro (`lib/search-index.ts`): `buildSearchIndex` monta registros
      pesquisáveis a partir de `Book[]`/`ReadingAnnotation[]`/`BookReview[]`/`ReadingSession[]` já
      carregados (nunca toca `files`/Blob); `searchLibrary` filtra por substring
      case-insensitive e sem acento, pontua por tipo/posição do match/exatidão e ordena por
      score e depois por `updatedAt` — 18 testes unitários cobrindo cada tipo de resultado,
      registros órfãos (livro removido) e empates de ranking
- [x] Nova view `search` em `useUIStore` (`AppView`), acessível por um botão "Buscar" no
      cabeçalho da Biblioteca e pelo atalho global `Ctrl/Cmd+K` (ativo só fora do reader, que já
      tem seu próprio conjunto de atalhos locais)
- [x] `useUIStore.openReader` ganhou um segundo parâmetro opcional `page`; `useReader`/`PdfReader`
      ganharam `initialPage` (sobrescreve `book.currentPage` só na abertura) — resultados de
      busca ancorados a uma página abrem o reader direto nela, sem passo intermediário
- [x] Nova tela `features/search/GlobalSearch.tsx` (App Shell, code-split via `React.lazy`):
      campo de busca com foco automático, lista de resultados ranqueados com rótulo do tipo,
      título do livro e página (quando aplicável), estados vazio/sem-resultado/carregando
- [x] `tsc --noEmit`, `vitest run` (228 testes, +20 novos) e `npm run build` (novo chunk
      `GlobalSearch` de ~5.8kB, fora do bundle inicial da Biblioteca) todos verdes
- [x] Validado no preview com dados reais (livro com highlight, nota de página, review completa
      com ideias principais e nota manual de sessão, todos mencionando "metamorfose"): busca
      retornou os 3 tipos ranqueados corretamente (highlight > review > nota de sessão, pela
      pesagem por tipo), clique no highlight abriu o reader exatamente na página 3, clique num
      resultado de título de livro abriu na página salva do livro (sem forçar página), busca sem
      correspondência mostrou o estado vazio, `Ctrl+K` abriu a busca a partir da Biblioteca — sem
      erros de console em nenhum fluxo

## Sprint 13 — AI Reading Assistant Foundation

**Objetivo:** camada local-first para gerar prompts/contextos úteis para uso com IA externa
(ChatGPT, Claude, NotebookLM), sem integrar API paga, sem enviar dados a servidor, sem chat
interno completo e sem embeddings nesta fase.
**Critério de aceite:** usuário seleciona um livro, escolhe quais dados incluir e um tipo de
prompt, gera um bloco Markdown pronto para copiar, e opcionalmente exporta como `.md`.

- [x] Auditoria inicial (schema, repos, stores, export Markdown, busca global, navegação do App
      Shell) — achado principal: `lib/export-markdown.ts` já era puro e reutilizável, mas as
      funções de escape (`escapeMarkdownBody/Quote/Line`) eram privadas; exportadas para reuso
      sem duplicar lógica de sanitização. Nenhuma migração de schema necessária.
- [x] `lib/ai-context.ts` (puro, sem I/O): `generateAiContext` monta um bloco de prompt a partir
      de `Book`/`ReadingSession[]`/`ReadingAnnotation[]`/`BookReview?` já carregados — 7 seções
      selecionáveis (metadados, notas, highlights, marcadores, review, sessões, principais
      ideias, cada uma renderizada só se selecionada e só se houver dado equivalente) e 4 tipos
      de prompt (discussão, quiz, extrair insights, dados brutos sem instrução) — 8 testes
      unitários.
- [x] Nova view `ai-assistant` (`useUIStore`), acessível pelo botão "Assistente IA" no cabeçalho
      da Biblioteca (ao lado de "Buscar"/"Dashboard").
- [x] Nova tela `features/ai-assistant/AiAssistant.tsx` (App Shell, code-split via
      `React.lazy`, ~8.75kB): seletor de livro, checkboxes de seção, seletor de tipo de prompt,
      preview do Markdown gerado, botão "Copiar" (`navigator.clipboard`) e "Exportar .md"
      (reaproveita `downloadMarkdownFile`/`sanitizeMarkdownFilename` do export existente).
      Carrega sessões/notas/review sob demanda por livro (mesmo padrão de
      `EditBookDialog.buildBookMarkdown`), nunca toca o Blob do PDF.
- Validado no preview com dados reais: seleção de livro, toggle de seções refletindo no preview
  em tempo real, troca de tipo de prompt, geração correta do Markdown (seções sem dado
  equivalente omitidas silenciosamente), sem erros de console. `tsc --noEmit`, `vitest run`
  (236 testes, +8 novos) e `npm run build` verdes.

### Decisões técnicas (Sprint 13)

- Sem nova object store: mesmo padrão do Dashboard/busca global — dados montados em memória a
  partir dos arrays já carregados pelos stores existentes.
- Tipos de `lib/ai-context.ts` (`AiContextSection`, `AiPromptType`) não entraram em
  `DATA_MODEL.md` por não serem um formato persistido — mesma convenção do Dashboard (Sprint 5)
  e da busca global (Sprint 12).
- Seções "Review" e "Principais ideias" (`mainTakeaways`) são selecionáveis independentemente:
  um usuário pode querer só as ideias principais sem o texto livre da review.

### Decisões técnicas (Sprint 12)

- Nenhuma nova object store: o índice é reconstruído em memória (`useMemo`) a partir dos arrays
  já carregados pelos stores existentes — dataset local e pessoal (dezenas/centenas de
  registros), sem necessidade de persistir um índice invertido.
- `SearchResult`/`ScoredSearchResult` não entraram em `DATA_MODEL.md`: são tipos derivados de
  `lib/search-index.ts`, não um formato persistido em object store — mesma convenção já usada
  para `BookActivitySummary`/`DayActivity` do Dashboard (Sprint 5).
- Bookmark só entra no índice quando tem corpo de texto (`body`) — um marcador "puro" (sem nota)
  não tem nada pesquisável além do número da página.
- Atalho `Ctrl/Cmd+K` desativado enquanto o reader está aberto — o reader já tem seu próprio
  `keydown` global (navegação/zoom/tema/notas/bookmark/seleção); registrar dois listeners globais
  no mesmo evento arriscava disputa/duplicação para pouco ganho, já que a Reading Surface não é o
  lugar principal para iniciar uma busca.

## Sprint 14 — AI Chat/RAG Spike

**Objetivo:** investigar a viabilidade de um chat interno com IA (RAG) dentro do ReadQuest, sem
implementar uma feature final. Responder: vale a pena um chat interno? API externa ou só prompts
exportáveis? Arquitetura mínima segura? Quais dados enviar? Como controlar custo/token? Como
evitar alucinação? PDF inteiro fica fora do escopo?
**Critério de aceite:** abstração de provider mockável, helper de contexto conversacional puro
reaproveitando dados locais, estimativa de tokens, UI experimental de chat — nenhuma chamada
externa real, nenhuma API key, nenhum backend, nenhum embedding, nenhuma indexação de PDF.

- [x] Auditoria inicial — achados principais: `lib/ai-context.ts` (Sprint 13) e
      `lib/search-index.ts` (Sprint 12) já cobrem, respectivamente, formatação de contexto e
      retrieval por palavra-chave sobre os dados locais; nenhuma integração externa existia no
      código de produção (só `dev/seed.ts`, dev-only). `useUIStore.AppView` + `React.lazy` em
      `App.tsx` já são o padrão pronto para uma nova view experimental.
- [x] `lib/ai-provider.ts` (puro, só tipos): `AIProviderMessage`/`AIProviderRequest`/
      `AIProviderResponse`/`AIProvider` — contrato desacoplado de qualquer SDK real.
- [x] `lib/mock-ai-provider.ts`: `createMockAiProvider()` implementa `AIProvider` com resposta
      determinística e disclaimer explícito ("Resposta simulada... nenhuma chamada externa foi
      feita"), latência simulada via `setTimeout`, sem `fetch`/rede — 4 testes unitários.
- [x] `lib/token-estimate.ts`: `estimateTokens`/`estimateMessagesTokens`/`estimateContextSize`,
      heurística de ~4 caracteres por token (sem tokenizer real) — 6 testes unitários.
- [x] `lib/ai-chat-context.ts` (puro, sem I/O): `buildAiChatContext` faz "RAG simples" reusando
      `buildSearchIndex`/`searchLibrary` (Sprint 12) como retrieval — sem embeddings, sem indexar
      o PDF — e monta um bloco de contexto Markdown com os N trechos mais relevantes para a
      pergunta do usuário, com escopo opcional por livro — 7 testes unitários.
- [x] Nova view `ai-chat` (`useUIStore`), acessível pelo botão "Chat IA (spike)" no cabeçalho da
      Biblioteca (ao lado de "Assistente IA").
- [x] Nova tela `features/ai-chat/AiChat.tsx` (App Shell, code-split via `React.lazy`,
      ~10.2kB): aviso de privacidade fixo e explícito, seletor de escopo (biblioteca inteira ou
      um livro), painel de contexto recuperado visível **antes** de enviar a pergunta (atualiza
      ao digitar), estimativa de tamanho/tokens ao vivo, botões "Copiar contexto" e "Copiar
      prompt completo", histórico de conversa em estado de componente apenas (nada persistido —
      some ao sair da tela). Nunca importa `db/files-repo.ts` nem lê o Blob do PDF.
- Validado no preview com dados reais (`readquest-dev`): retrieval ao vivo trouxe highlight +
  review + nota de sessão corretos para a query "metamorfose"; envio gerou resposta mock com
  disclaimer, contagem de fontes e tokens estimados; botão "Copiar contexto" confirmou sucesso;
  `read_network_requests` após o envio mostrou 100% das chamadas em `localhost:5176` (nenhuma
  chamada externa); zero erros de console. `tsc --noEmit`, `vitest run` (253 testes, +25 novos) e
  `npm run build` verdes.

### Decisões técnicas (Sprint 14)

- **Retrieval sem embeddings**: "RAG simples" definido como reaproveitar o índice de busca por
  palavra-chave já existente (Sprint 12) em vez de vetores — cobre a restrição explícita de não
  criar embeddings nem indexar o PDF inteiro nesta sprint, e evita pipeline novo de indexação.
- **Contexto embutido na última mensagem do usuário** (não numa mensagem `system` separada): o
  `AIProviderRequest` final é `[system prompt fixo, ...histórico da conversa, mensagem do usuário
  com contexto + pergunta concatenados]` — mais simples de raciocinar e mais próximo do que um
  usuário faria copiando/colando manualmente em outra IA.
- **Sem persistência de conversa**: histórico do chat vive só em `useState` do componente —
  atende à restrição explícita da sprint e evita decidir prematuramente sobre um formato de
  armazenamento para dados potencialmente sensíveis (notas/highlights do usuário) antes de uma
  decisão de GO real.
- **Conclusão preliminar do spike: GO condicionado.** A infraestrutura de agregação de dados já
  existe (Sprints 12/13); falta, para uma feature real, um provider de verdade + opt-in explícito
  por sessão de chat + algum controle de custo além da estimativa aproximada (ex: limite de
  tokens por conversa) antes de qualquer chamada externa real.

## Sprint 15 — AI Provider Integration Gate

**Objetivo:** criar um portão seguro de integração com provider real de IA, sem tornar a IA uma
feature irreversível — configurável e testável de forma explícita, opt-in, mantendo o
ReadQuest local-first por padrão.
**Critério de aceite:** usuário continua usando o modo mock sem provider real; pode configurar
um provider real explicitamente; vê exatamente qual contexto será enviado; confirma
manualmente antes de cada chamada real; recebe resposta da IA; copia/limpa; entende os riscos
de privacidade; PDF Blob e texto integral seguem fora do escopo.

- [x] Auditoria inicial (status da Sprint 14, arquivos do provider mock, tipos `AIProvider`,
      montagem do contexto conversacional, preview do contexto, estrutura da UI de chat,
      persistência de configurações, riscos de API key, providers viáveis) — achado principal:
      **nenhum padrão de persistência de settings existe no projeto** (zero uso de
      `localStorage`/`sessionStorage` em todo `src/`; toda persistência passa por IndexedDB via
      `idb`), então a store de configuração de IA precisou ser greenfield.
- [x] Decisão de segurança: **API key nunca persistida** (nem localStorage nem IndexedDB) —
      aceita apenas em memória de sessão do navegador, via store Zustand sem `persist`.
- [x] `lib/openai-compatible-provider.ts`: segundo `AIProvider` real, via `fetch` puro (sem SDK
      novo), compatível com qualquer endpoint no formato OpenAI chat completions. Valida
      apiKey/baseUrl/model sincronamente na construção; nunca dispara chamada sozinho; erros
      nunca vazam a apiKey — 10 testes.
- [x] `stores/useAiSettingsStore.ts`: `mode`/`apiKey`/`baseUrl`/`model` em memória, ação
      `clearApiKey` ("Esquecer chave") — 5 testes.
- [x] `features/ai-chat/AiChat.tsx` estendido: seletor Mock/Real, painel de configuração do
      provider real, aviso de privacidade específico por modo, confirmação manual em duas
      etapas obrigatória antes de qualquer chamada real (nunca automática ao abrir a tela).
      Modo mock permanece de um clique só (sem risco de privacidade).
- [x] Validação manual no preview: alternância mock↔real, bloqueio por config incompleta, gate
      de confirmação comprovadamente impedindo chamada de rede antes do clique explícito
      (`read_network_requests`), cancelamento sem efeito colateral, confirmação disparando a
      chamada real de fato, "Esquecer chave" funcional, modo mock sem regressão, zero erros de
      console. `tsc --noEmit`, `vitest run` (268 testes, +15 novos) e `npm run build` verdes.

### Decisões técnicas (Sprint 15)

- Sessão = memória do processo do navegador (não por-tela): a chave sobrevive à navegação
  interna da SPA, mas some ao recarregar/fechar a aba — sem introduzir um conceito novo de
  "sessão de chat" só para isso.
- Adapter único (`OpenAICompatibleProvider`) cobre múltiplos provedores reais (OpenAI,
  OpenRouter, Groq, Ollama local) via URL base configurável, evitando um adapter por provedor
  nesta fase.
- Gate de confirmação em duas etapas só se aplica ao modo real — o modo mock não tem risco de
  privacidade a mitigar, então manteve a UX de um clique já validada na Sprint 14.

## Sprint 16 (fora de sequência) — Release Candidate & Repository Hardening

**Objetivo:** preparar o ReadQuest para um primeiro baseline recuperável (`v0.1.0` / RC1):
auditoria pré-commit, limpeza segura, `.gitignore` de raiz, documentação alinhada ao estado real
do produto, limitações conhecidas documentadas, QA final de release e primeiro histórico git
organizado (repositório não tinha nenhum commit antes desta sprint). Sem feature nova, sem
mexer no reader core, sem novo escopo de IA.

> Nota de numeração: mesma situação das sprints "fora de sequência" anteriores — pedida como
> "Sprint 16" pela instrução que a originou, seguindo diretamente a Sprint 15.

- [x] Auditoria inicial: `git status` confirmou **zero commits** no repositório (todos os
      arquivos untracked); estrutura (`app/`, `spike-pdf/`, docs de raiz); scripts/dependências
      de `app/package.json`; documentação existente; ausência de `.gitignore` de raiz;
      `spike-pdf/public/pdfs/` (144MB de PDFs de teste) já corretamente gitignored por
      `spike-pdf/.gitignore`; nenhum `.env`, log, screenshot, dump ou backup real encontrado em
      lugar nenhum do repositório — único achado ambíguo: duplicata de download
      (`READQUEST_PLANO_TECNICO (1).pdf`, confirmada com o usuário e removida)
- [x] `.gitignore` de raiz criado: cobre `node_modules/`, `dist/`, `.vite/`, `.env`/`.env.*`
      (com `!.env.example`), `*.log`, `.DS_Store`/`Thumbs.db`, `coverage/`/`playwright-report/`/
      `test-results/`, `*.tsbuildinfo`, artefatos de backup do ReadQuest, e diretórios-armadilha
      para PDFs reais acidentais (`uploads/`, `test-pdfs/`, `**/fixtures/**/*.pdf`) — os
      `.gitignore` locais de `app/` e `spike-pdf/` permanecem como estão, sem duplicação de
      responsabilidade
- [x] `README.md` reescrito por completo: estado anterior descrevia a fase pré-implementação
      (stack errada — citava `idb-keyval`/Framer Motion/Lucide Icons, nenhum dos quais é usado de
      fato — e instrução de `npm install` na raiz, que não tem `package.json`). Agora documenta
      as 15 sprints implementadas, stack real, `cd app && npm install && npm run dev`, scripts,
      uso básico, data safety, IA/privacidade e link para `KNOWN_LIMITATIONS.md`
- [x] `KNOWN_LIMITATIONS.md` criado: armazenamento/backup grande, extratibilidade de texto por
      página (não por documento), sem OCR, sem highlight multi-página, rotação não validada,
      mobile limitado, IA real opt-in com chave só em memória, conversas de IA não persistidas,
      retrieval por palavra-chave (não embeddings), sem sync/nuvem/login
- [x] `.env.example` avaliado e **não criado** — auditoria confirmou zero uso de
      `import.meta.env`/`process.env` além do `import.meta.env.DEV` nativo do Vite em todo
      `app/src`; a chave de IA é inserida manualmente na UI e nunca persistida, então não há
      nenhuma variável de ambiente real para documentar
- [x] Gates técnicos: `npx tsc --noEmit` limpo, `npx vitest run` (268 testes, todos verdes) e
      `npm run build` (code-split preservado: `PdfReader`/`AiChat`/`AiAssistant`/`Dashboard`/
      `GlobalSearch` em chunks próprios)
- [x] QA final de release no preview real (livro semeado via `window.__dev.seedFromUrl` com o
      fixture `leve.pdf` do spike): biblioteca, abertura de livro, navegação de página, criação
      de nota/marcador/highlight (achado durante o QA: página 2 do fixture não tem texto
      extraível — comportamento esperado e já documentado no spike de text layer; o highlight foi
      validado com sucesso na página 5), sessão de leitura capturada e visível no Dashboard, busca
      global (highlight encontrado e navegação direta para a página correta), export Markdown
      (UI funcional; `Copiar Markdown` reportou "Write permission denied" — restrição conhecida
      do ambiente de preview automatizado, já documentada na Sprint 7, sem travar o diálogo),
      backup/integridade ("Tudo certo — nenhum problema encontrado"), Assistente IA em modo mock,
      Chat IA alternado para modo real **bloqueado corretamente** sem API key configurada (botão
      "Revisar antes de enviar" desabilitado, zero requisições de rede a qualquer endpoint externo
      confirmado via inspeção de rede) — sem erros de console em nenhuma etapa
- [x] Versão confirmada em `0.1.0` (`app/package.json`, já estava correta) e descrição do pacote
      atualizada de "(Sprint 1)" para "v0.1.0 (RC1)"
- [x] Primeiro histórico git do projeto criado a partir do estado atual do repositório (commits
      organizados por área/sprint, ordem lógica reconstruída a partir de `CHANGELOG.md`/
      `ROADMAP_SPRINTS.md` — sem timestamps reais de cada sprint, já que o repositório nunca teve
      commits antes desta sprint)

## Sprint 17 (fora de sequência) — Deploy & Release Validation

**Objetivo:** publicar e validar o ReadQuest `v0.1.0-rc1` num ambiente real (fora do preview/dev),
confirmando que build de produção, IndexedDB, upload/leitura de PDF, backup/restore, notes/
highlights/sessions/reviews e o gate de IA opt-in funcionam idênticos ao preview quando servidos
por um domínio HTTPS real. Sem feature nova, sem mexer no reader core, sem novo escopo de IA.

> Nota de numeração: mesma situação das sprints "fora de sequência" anteriores — pedida como
> "Sprint 17" pela instrução que a originou, seguindo diretamente a Sprint 16.

- [x] Auditoria inicial: `git status` limpo, `master` = tag `v0.1.0-rc1` (16 commits); `origin`
      já configurado (`github.com/ThiagoThomasx/Fable-reading`) mas remoto **vazio** (zero refs,
      `git ls-remote` sem erro) — nenhum risco de sobrescrita; `npm run build`
      (`tsc --noEmit && vite build`) e `npm run test` (268 testes) verdes localmente antes de
      qualquer alteração; nenhum `README`/CI/config de deploy pré-existente
      (`.github/workflows`, `vercel.json`, `netlify.toml`, `Dockerfile`)
- [x] Branch local renomeado `master` → `main` (decisão do usuário, alinhado ao padrão atual do
      GitHub); `git push -u origin main` e `git push origin v0.1.0-rc1` — histórico completo e a
      tag agora no remoto
- [x] Deploy via Vercel CLI (já autenticado na máquina do usuário): `app/` linkado como root do
      projeto Vercel (`thiago-thomas-projects/app`), detecção automática de Vite
      (`vite build` → `dist/`), `vercel --prod` — produção em
      `https://app-wheat-three-52.vercel.app`
- [x] Build de produção real no Vercel (não just local) verificado: `tsc --noEmit && vite build`
      rodou limpo no build remoto, mesmos chunks/tamanhos do build local (`pdf-engine` 366KB/
      108KB gzip, code-split de `PdfReader`/`AiChat`/`AiAssistant`/`Dashboard`/`GlobalSearch`
      preservado)
- [x] Validação manual no domínio real via Browser pane (app estático sem rotas de URL — sem
      necessidade de rewrite/fallback SPA no Vercel):
      - App carrega sem erros de console; todos os assets `200`
      - `indexedDB.databases()` confirma banco `readquest` v4 com as 5 stores esperadas
        (`books`/`files`/`notes`/`reviews`/`sessions`) no domínio `vercel.app`
      - Upload de PDF sintético (gerado em memória via `DataTransfer`, já que o Browser pane não
        expõe picker nativo de arquivo) → pdf.js abriu, extraiu capa, cadastro completo
      - Reader abriu a página real (worker `pdf.worker.min.mjs` carregado, canvas renderizado,
        "Página 1 de 1")
      - Nota de página + bookmark criados e persistidos no painel lateral; sessão de leitura
        capturada automaticamente e visível no Dashboard (tempo, atividade de 7 dias, atividade
        recente, livro mais ativo)
      - "Dados e segurança": "Verificar integridade" → "Tudo certo"; **round-trip real de
        backup/restore** (blob exportado pela própria função de export interceptado via hook em
        `URL.createObjectURL`, então injetado de volta no input de restore) → reload automático,
        estado idêntico antes/depois, sem erro de console
      - Gate de IA: "Chat IA (spike)" abriu com **"Provider ativo: Mock (local, sem rede)"** por
        padrão; pergunta enviada em modo mock não gerou nenhuma requisição de rede nova
        (`read_network_requests` antes/depois idêntico); "Assistente IA" (gerador de contexto)
        também 100% local
      - Zero erros de console em qualquer etapa da validação
- [x] Documentação: `CHANGELOG.md`/`ROADMAP_SPRINTS.md`/`QA_CHECKLIST.md` atualizados com o
      resultado desta sprint

### Decisões técnicas (Sprint 17)

- **Deploy direto para produção** (não preview-primeiro): decisão explícita do usuário — o app é
  100% estático/local-first (sem backend, sem estado compartilhado no servidor), então uma
  promoção manual posterior preview→produção não reduziria risco real além do que a validação
  pós-deploy já cobre.
- **`app/` como root do projeto Vercel** (não `vercel.json` no root do monorepo): mais simples
  para este layout (app único em subpasta, sem outros serviços no monorepo) e evita manter duas
  fontes de verdade para build command/output directory.
- **Sem rewrite SPA no Vercel**: auditoria confirmou que o app não usa nenhuma lib de roteamento
  por URL (`react-router` ausente, `App.tsx` não lê `location`/`history`) — toda navegação é
  estado interno (`useUIStore.AppView`), então a raiz estática (`index.html`) é suficiente sem
  regra de fallback.
- **Teste de upload de PDF via `DataTransfer` sintético**: o Browser pane usado para validação não
  expõe o picker nativo de arquivo do SO; construir um `File`/`DataTransfer` em JS e disparar
  `change` no `<input type="file">` é a forma padrão de testar upload em ambientes automatizados
  sem acesso ao SO, e exercita exatamente o mesmo caminho de código (`onChange` → parse via
  pdf.js) que um upload real do usuário.
- **Teste de restore usando o backup real gerado pela própria UI** (via hook em
  `URL.createObjectURL`, não um JSON construído à mão): mais fiel que reconstruir o schema
  manualmente — exercita a serialização real (`createFullBackup`/`serializeBackup`) e a
  desserialização real (`parseBackupJson`/`validateBackup`/`restoreFullBackup`) juntas, no mesmo
  domínio de produção.

---

## Log de decisões durante a execução

Registrar aqui decisões técnicas tomadas durante cada sprint que não estavam no plano original
(ADRs informais). Atualizar `CHANGELOG.md` em paralelo.

### Text Highlights (2026-07-10) — promoção do spike a feature estável

`TextLayerOverlay`, `rects.ts` e `text-content.ts` migraram de
`text-layer-experiment/` (atrás de `ENABLE_TEXT_LAYER_EXPERIMENT`, removida) para
`app/src/features/reader/highlights/`, junto de três arquivos novos: `create-highlight.ts`
(transformação pura seleção → `ReadingAnnotation`), `HighlightMarks.tsx` (renderização dos
highlights salvos, independente do modo seleção) e `SelectionToolbar.tsx` (mini toolbar de cores).
Nenhuma mudança de schema foi necessária — `ReadingAnnotation.type: 'highlight'`, `quoteText` e
`textAnchor.rects` já existiam desde a Sprint 6 sem consumidor.

Decisão de UX: um único clique numa cor da `SelectionToolbar` já persiste o highlight (sem passo
de confirmação separado) — reduz fricção e mantém a regra "não criar UX complexa" da instrução da
sprint. Decisão de performance: `HighlightMarks` renderiza sempre que há highlights na página
atual (não só durante o modo seleção), pois não depende de `getTextContent`/`TextLayer` — só de
rects já persistidos e do tamanho atual da página via `ResizeObserver`; o custo caro do spike
(extração de texto) permanece isolado ao modo seleção.

### Spike técnico — Text Layer (2026-07-10) — GO condicionado, "modo seleção" sob demanda

Auditoria confirmou zero código de text layer pré-existente (`getTextContent`/`TextLayer` nunca
usados) e que `ReadingAnnotation.textAnchor` já estava modelado desde a Sprint 6 sem consumidor.
Protótipo (`app/src/features/reader/text-layer-experiment/`) validou seleção real de texto em
PDFs textuais e em PDFs "escaneados" com OCR embutido (achado: extratibilidade de texto é
**por página**, não por documento — algumas páginas de scan têm texto digital, outras não).

Dois bugs de integração descobertos e corrigidos durante o spike, ambos documentados em detalhe
em `TEXT_LAYER_SPIKE.md`: (1) `pdfjs-dist@4.10` exige a CSS custom property `--scale-factor` no
container do text layer — sem ela o layout colapsa silenciosamente, sem erro no console; (2)
misturar DOM imperativo do pdf.js com filhos React declarados no mesmo container causa
`NotFoundError: removeChild` e derruba a árvore React inteira (sem ErrorBoundary no app) — corrigido
isolando o container do pdf.js de qualquer filho JSX.

Decisão: **Estratégia B (text layer sob demanda, atrás de "modo seleção")**, não sempre-ativa —
evita conflito permanente com as hotzones de navegação e mantém o custo de `getTextContent`/render
(observado ~1.5–2s numa página densa de 1010 spans) isolado à ação explícita do usuário, sem
impacto na leitura normal. Recomendação para Sprint 9: promover `TextLayerOverlay` de experimental
para estável, persistir `ReadingAnnotation` tipo `'highlight'` com `quoteText` + `rects` relativos
(0..1, formato validado em `rects.ts`).

### Sprint 7 (2026-07-09) — Export por livro (não por sessão isolada); download separado do helper puro; sem preview de Markdown

A instrução detalhada da sprint pediu export "por livro" como escopo principal (metadados +
progresso + notas + bookmarks + sessões + resumo, tudo agregado em um único `.md`), não exports
avulsos por sessão individual — decisão consistente com `EditBookDialog` já ser o local central de
gestão por livro (mesma posição de `NotesList`/`SessionHistory`, novo `<fieldset>` "Exportar" logo
abaixo do histórico de sessões).

`generateBookMarkdownExport` (`app/src/lib/export-markdown.ts`) é puro (sem DOM/IndexedDB,
testável em Node/Vitest) e reaproveita `STATUS_LABELS`, `progressPercent` e
`getTotalReadingTime`/`getTotalPagesRead`/`formatDuration` de `dashboard-stats.ts` em vez de
duplicar lógica de agregação já validada no Sprint 5. `downloadMarkdownFile`
(`app/src/lib/download-markdown.ts`) ficou em arquivo separado por depender de `document`/`Blob`/
`URL` (não roda no ambiente `node` do Vitest configurado em `vite.config.ts`); manter os dois no
mesmo arquivo teria exigido trocar o `environment` do Vitest para `jsdom` só por causa de uma
função sem lógica a testar.

**Copiar Markdown implementado** via Clipboard API (`navigator.clipboard.writeText`), com fallback
de erro visível quando a API está indisponível ou nega permissão (validado manualmente: ambiente
de preview automatizado nega a permissão de escrita, e o erro apareceu corretamente na UI sem
travar o diálogo).

**Preview do Markdown antes de baixar não foi implementado** — fora do critério "se for simples";
registrado aqui como oportunidade futura, não como pendência bloqueante.

Escaping de Markdown nas notas: apenas o **início de cada linha** é escapado (`#`, `>`, `-`, `*`,
`+`, listas numeradas) via regex `^(\s*)([#>*+-]|\d+\.)`, preservando o restante do texto e as
quebras de linha originais — suficiente para não quebrar a estrutura de headings/blockquotes/listas
do documento gerado sem transformar o corpo da nota em um bloco de código (que perderia a leitura
natural em Obsidian/Notion).

### Sprint 6 (2026-07-09) — Sem highlight textual (reader é canvas-only); painel lateral empurra o conteúdo em vez de sobrepor

Auditoria obrigatória antes de codar (ver instrução da sprint) confirmou que `PdfReader.tsx`
renderiza cada página como um único `<canvas>` a partir de um `ImageBitmap` pré-rasterizado no
worker (`pdf-engine.ts`) — não existe text layer do pdf.js (`renderTextLayer`/`TextLayerBuilder`)
em nenhum lugar do código, e o canvas é explicitamente `select-none`. Seguindo a regra de decisão
já definida na instrução da sprint ("se dúvida, escolha a opção conservadora"), **highlight
textual não foi implementado**. Escopo real: `type: 'page_note'` e `type: 'bookmark'` em uma
única entidade `ReadingAnnotation` (substituindo o rascunho anterior `Note` do `DATA_MODEL.md`,
que não cobria bookmark), com `quoteText`/`textAnchor` já no schema para uma Sprint futura que
adicionar text layer real — sem consumidor de UI hoje.

`NOTES_PANEL_WIDTH_PX` (320px, `PdfReader.tsx`) é aplicado como `padding-right` no container fixo
da Reading Surface quando o painel abre, em vez de deixar o `<aside>` sobrepor a página como um
overlay flutuante. Descoberto via QA manual no preview: com o painel sobreposto (`position:
fixed`), ele cobria a hit-zone de "próxima página" (terço direito da página) em viewports de
~960px de largura — o clique era engolido pelo painel silenciosamente, sem erro no console. Só foi
percebido comparando o texto "Página N de M" antes/depois do clique. Empurrar o conteúdo (reserva
de espaço) resolve de forma geral, sem precisar reduzir as hit-zones de navegação.

Criação de anotação só existe dentro do reader (`NotesSidePanel.tsx`), sempre vinculada a
`reader.currentPage` — mesma decisão já tomada para `ReadingSession` (Sprint 4) e mantida aqui por
consistência: `NotesList.tsx` (dentro do `EditBookDialog`, mesma posição de `SessionHistory.tsx`)
lista/edita/remove, mas não cria. `useNoteStore` carrega anotações por livro sob demanda — o
reader dispara `loadForBook(book.id)` no mount para alimentar tanto o indicador discreto na
topbar (`hasPageAnnotation`) quanto o painel, análogo ao carregamento por-livro de
`useSessionStore`, mas sem o eixo `allSessions`/`loadAll()` (não há Dashboard de notas nesta
sprint).

Object store `notes` nova no IndexedDB (`DB_VERSION` 2 → 3), índices `by-book` e `by-type` —
mesmo padrão incremental de upgrade das Sprints 2 e 4, sem migração de dados existentes.

### Sprint 5 (2026-07-09) — Sem streak/gamificação; `loadAll()` novo no `useSessionStore`; navegação por terceira `AppView`

O roadmap original citava "streak" como selector derivado; a instrução detalhada da sprint lista
streaks/gamificação/badges explicitamente como fora de escopo — priorizada a instrução mais
específica, então **nenhum streak foi implementado**.

`useSessionStore` carregava sessões apenas por livro (`loadForBook`, usado pelo `SessionHistory`
dentro do `EditBookDialog`). O Dashboard precisa de todas as sessões de uma vez para agregar por
livro/dia, então o store ganhou um segundo eixo de estado (`allSessions`/`isAllLoaded`/`allError`
+ ação `loadAll()`), mantendo o carregamento por-livro existente intacto — evita misturar dois
padrões de carregamento (paginado por livro vs. tudo de uma vez) no mesmo array `sessions`, o que
quebraria a lógica de `add`/`patch` do `SessionHistory`. `sessions-repo.ts` ganhou
`listAllSessions()` (`db.getAll('sessions')`, sem índice — não há necessidade de filtro).

Navegação: `AppView` (`useUIStore.ts`) virou uma união de três variantes (`library` | `reader` |
`dashboard`), sem introduzir router — mesma abordagem hand-rolled do Sprint 1. `Dashboard.tsx` é
carregado via `React.lazy()` (chunk próprio de ~8kB, confirmado no build), fora do bundle inicial
da Biblioteca, seguindo a mesma regra de performance do `PdfReader`. Entry point é um link "→
Dashboard" na banda `bg-fable-forest` da Biblioteca (única chrome persistente do app hoje).

"Não usar Blob" foi cumprido reaproveitando `useBookStore.books` (metadata já em memória, carregada
uma vez no mount do `App`) para resolver título/capa nas listas do Dashboard — nenhum novo fetch
de books ou files foi introduzido.

### Sprint 4 (2026-07-09) — Escopo do `ReadingSession`, sessão = ciclo de vida do reader, limiar mínimo de duração

O `ReadingSession` planejado em `DATA_MODEL.md` antes desta sprint (`date`, `durationMinutes`,
`mood`, `sessionType`) foi trocado por um shape mais simples e alinhado à captura 100% automática
pedida pelo critério de aceite ("sem ação manual obrigatória"): `startedAt`/`endedAt`/`durationMs`
em vez de campos derivados, e remoção de `mood`/`sessionType` (YAGNI — nenhum consumidor de UI
usaria esses campos nesta sprint; podem voltar no Sprint 6/8 se notas/review precisarem). Campo
`notes` mantido como o único campo de edição manual pedido pelo roadmap ("tempo, observação").

**Sessão = ciclo de vida do mount do reader.** Uma sessão começa quando o `useEffect` de abertura
do documento em `use-reader.ts` monta (registra `startedAt`/`startPage` a partir do estado local,
antes de qualquer navegação) e é persistida no cleanup desse mesmo efeito (unmount = fechar o
livro ou trocar de livro, já que `PdfReader` é montado com `key={book.id}` em `App.tsx`). Não há
detecção de "pausa" (ex. troca de aba) nem de idle — o roadmap desta sprint pede apenas captura
por navegação, sem esse refinamento; fica como possível ajuste futuro se o QA do Sprint 5
(dashboard) mostrar sessões enganosamente longas por causa de abas esquecidas abertas.

**Limiar mínimo de 3s (`MIN_SESSION_DURATION_MS`) antes de persistir uma sessão.** Necessário
porque o `StrictMode` do React (`main.tsx`) faz o efeito de abertura montar/desmontar/remontar uma
vez em dev — sem o limiar, toda abertura em dev geraria uma sessão fantasma de ~0ms. Validado
manualmente no preview: abrir um PDF de 2 páginas, aguardar >3s, navegar e fechar gerou exatamente
uma sessão (não duas), com `startPage`/`endPage`/`durationMs` corretos.

**Histórico de sessões vive dentro do `EditBookDialog`** (novo componente `SessionHistory.tsx` em
`features/library/`), não em uma tela dedicada — não há uma seção "dashboard" ainda (Sprint 5),
então reaproveitar o diálogo de edição de metadata já existente evita introduzir uma rota/estado
de UI novo só para listar sessões. A edição manual de duração/observação acontece inline na
própria linha do histórico.

### Sprint 3 (2026-07-09) — Estado de filtro/ordenação local, sem novo store global

Filtro por status/categoria e ordenação da Biblioteca vivem como `useState` dentro de
`Library.tsx`, não em `useUIStore` nem em um store novo. Justificativa: é estado de UI consumido
por um único componente, não compartilhado entre telas nem persistido — promovê-lo a um store
Zustand seria indireção sem ganho (YAGNI), e contraria a convenção do projeto de "uma store por
entidade de domínio", já que filtro/ordenação não é uma entidade.

### Sprint 3 (2026-07-09) — `lastOpenedAt` novo campo em `Book`, distinto de `updatedAt`/`startedAt`

Nenhum dos timestamps existentes servia para "Continuar lendo": `updatedAt` muda em qualquer patch
(editar categoria também conta), e `startedAt` é setado uma única vez na primeira transição
`want_to_read → reading`, nunca mais tocado em reaberturas. `lastOpenedAt` é setado toda vez que o
reader abre (`App.tsx`), num efeito chaveado por `view.bookId` (não pelo objeto `openBook`) para
evitar loop: como o próprio patch muda a referência do livro na store, depender do objeto
reexecutaria o efeito indefinidamente.

### Sprint 2 (2026-07-09) — CSS em vez de Framer Motion para a transição de página

O plano previa avaliar Framer Motion para a transição entre páginas. Decisão: **não instalar**.
A página renderizada é desenhada imperativamente num `<canvas>` reutilizado entre navegações (não
remontado — decisão da Sprint 1 para evitar flash/recriação de contexto WebGL/2D a cada página).
Framer Motion anima montagem/desmontagem ou mudança de props de elementos React; não há elemento
React "por página" para animar sem reintroduzir o remount que a Sprint 1 evitou deliberadamente.
Em vez disso, uma transição CSS curta (`page-turn`, 150ms, opacity + micro-scale) é reiniciada via
`classList` num wrapper estável, sem afetar o canvas em si. Custo zero de bundle, sem dependência
nova, mesmo resultado visual pedido (crossfade curto + micro-scale, nada de slide lateral).
`prefers-reduced-motion` desativa essa animação e também a `snapshot-fade` já existente (que não
tinha esse guard antes).

### Sprint 2 (2026-07-09) — Bug do ambiente de preview: classes Tailwind arbitrary-value com `var()` não reagem a troca de tema

Durante QA manual no navegador de preview, a troca Paper/Dark não surtia efeito visual: o valor da
CSS custom property (`--reader-bg` etc.) mudava corretamente por elemento (confirmado via
`getComputedStyle().getPropertyValue()`), mas propriedades como `background-color` geradas por
classes Tailwind `bg-[var(--reader-bg)]` permaneciam com o valor antigo. Isolado com um teste
mínimo: o mesmo `var()` aplicado via `style` inline no elemento resolvia corretamente; apenas a
regra gerada pelo Tailwind dentro de `@layer utilities` (aninhado) não era reavaliada por esse
motor de CSS especificamente. Adicionalmente, `transition-colors` sobre uma propriedade cujo valor
especificado é `var(--x)` (não um valor estático) ficava **travada** no valor anterior
indefinidamente em vez de animar ou saltar — pior que não ter transição nenhuma.

Mitigação: as propriedades de cor que dependem do tema (`background-color`, `color`) passaram a
ser aplicadas via `style` inline referenciando a mesma CSS var, em vez de classes Tailwind
arbitrary-value; hover de botão usa uma regra CSS simples fora de qualquer `@layer` (`.reader-btn:hover`);
as transições de cor foram removidas dos elementos que trocam de tema (troca é instantânea, sem
flicker, já que é um único repaint correto). Tokens de tema completos (10 variáveis por tema,
incluindo variantes de opacidade de tinta) vivem em `app/src/styles/index.css`.

### Sprint 1 (2026-07-09) — QA manual: preload bidirecional (N-1) e diagnóstico do "slide" de página

QA manual do Sprint 1 reportou dois problemas antes da liberação para o Sprint 2:

**1. Delay de 1-2s na virada de página (regressão de performance).** Diagnóstico: o preload
existente cobria apenas N+1 (`PdfEngine.preloadNext`); não havia `preloadPrev`. Navegação para
frente ficava instantânea (página já aquecida pelo preload anterior), mas a primeira vez que o
usuário voltava para uma página fora da janela do LRU (8 páginas) sempre caía no caminho de
render completo (~1-2s), como se fosse a abertura de uma página nova. Mudança de zoom também
invalida o cache (chave `${page}@${width}`), reproduzindo o mesmo delay em qualquer direção logo
após zoom.

Correção: `PdfEngine` (`app/src/lib/pdf/pdf-engine.ts`) trocou o slot único `preloadInFlight` por
um `Map<string, Promise<void>>` por `pageKey`, permitindo N+1 e N-1 pré-carregarem em paralelo, e
ganhou `preloadPrev()` espelhando `preloadNext()`. `useReader` (`use-reader.ts`) passou a chamar
os dois após toda exibição de página bem-sucedida — o que também resolve o caso de zoom, já que
qualquer `showPage` (inclusive o disparado por troca de zoom) aciona os dois preloads na largura
nova. Validado com medição real via `MutationObserver` no dev server: navegação para trás caiu de
~1-2s para 1-3ms.

**2. Transição de página parecendo slide lateral ("tipo PowerPoint").** Investigado com uma foto,
um vídeo filmado do monitor (celular) e por fim uma gravação de tela nativa (Game DVR). Grep
confirmou que não existe nenhum `transform`/`translate`/`transition`/Framer Motion na Reading
Surface. A análise frame a frame do vídeo filmado mostrou que até a barra de favoritos nativa do
navegador se deslocava em sincronia com a página — algo que uma página web não consegue causar —
confirmando artefato da câmera/gravação, não comportamento do app. A gravação de tela nativa
subsequente mostrou trocas de página como corte de frame único (33ms), sem flash, crossfade ou
deslocamento. **Nenhuma alteração de código foi necessária** — item fechado sem mudança visual,
conforme confirmado pelo usuário em 2026-07-09.

### Sprint 1 (2026-07-09) — Render do pdf.js com `intent: 'print'`

Descoberto durante a implementação: com o intent padrão (`display`), o pdf.js agenda a
continuação do render via `requestAnimationFrame`, que **não dispara em aba oculta/background**
— o render trava indefinidamente (afetaria o preload N+1 e a geração de snapshot com a aba em
segundo plano). Como toda a nossa rasterização é offscreen (canvas → ImageBitmap, nunca
frame-synced), o render usa `intent: 'print'`, que continua via microtask. Pelo mesmo motivo, o
crossfade do snapshot tem fallback por timer (600ms) além do `onAnimationEnd`, que não dispara
com animações CSS suspensas em aba oculta.

### Sprint 1 (2026-07-09) — Escopo do snapshot: restrito à abertura do livro

Decidido junto com o GO condicional do Sprint 0: `lastPageSnapshot` entra no `Book` e a
abertura passa a ser snapshot-first (ver `DATA_MODEL.md` e `ARCHITECTURE.md`).

Sobre **generalizar** o padrão "mostra snapshot memorizado, atualiza em background" para
qualquer navegação fora do cache LRU (não só a abertura), a recomendação é **não generalizar
na Sprint 1**:

1. O modelo de dados suporta um único snapshot por livro. Generalizar exige snapshots por
   página — nova store/esquema de chaves, política de invalidação e crescimento real de storage
   (livro de 500 páginas × ~30KB ≈ 15MB de JPEG, rivalizando com o próprio PDF).
2. A navegação adjacente (o caso dominante de leitura) já é coberta por preload N+1 + LRU
   (~0.1ms medido no spike). O caso restante — salto para página distante — só se beneficiaria
   de snapshot se aquela página já tivesse sido visitada antes; para páginas nunca visitadas
   não há o que mostrar, e o skeleton cream cobre a espera.
3. YAGNI: se o QA da Sprint 2 mostrar espera perceptível em saltos (sumário, slider de
   progresso), o meio-termo é manter snapshots das últimas N páginas visitadas — decisão adiada
   até haver evidência.

### Sprint 0 (2026-07-09) — Baseline de performance do pdfjs-dist

Medições em execução quente, Vite dev, canvas alvo de 900px de largura, worker isolado por
documento, cache LRU de 8 páginas (protótipo em `spike-pdf/`):

| PDF | Tamanho | Páginas (pdf.js) | Parse (getDocument) | Abertura 1ª página | Nav. em cache (máx) | Long tasks |
|---|---|---|---|---|---|---|
| Leve (A metamorfose, texto) | 9.1MB | 212 | 76ms | **373ms ✅** | **0.1ms ✅** | 0 ✅ |
| Pesado (Electrical Engineering, imagens) | 89.3MB* | 536 | 100ms | 1779ms ❌ | **0.1ms ✅** | 0 ✅ |
| Escaneado (Present Conflict of Ideals) | 44.6MB | 574 | 108ms | 1318ms ❌ | **0.1ms ✅** | 0 ✅ |

\* acima do teto de 50MB do critério — incluído como stress test.

**Diagnóstico:** o parse do documento é barato mesmo a 89MB (~100ms) — pdf.js carrega sob
demanda por página, confirmado. O custo da abertura em PDFs de imagem/scan é o **decode da
imagem embutida da página** (~1–2s), que é fixo e independente da resolução de saída (render a
300px custa o mesmo que a 1400px; o 2º render da mesma página cai para <60ms). Logo, downscale
não resolve a abertura; resolve apenas custo de rasterização.

**Decisões derivadas para a Sprint 1:**
1. **Snapshot persistido da última página lida** (bitmap comprimido ~JPEG no IndexedDB, junto da
   metadata de posição): ao abrir um livro, exibir o snapshot instantaneamente (<100ms) enquanto
   o render real acontece em background e o substitui. Torna a abertura percebida independente
   do tipo de PDF.
2. Manter worker isolado por documento, preload N+1 e LRU de 8 páginas — validados no spike
   (navegação em cache ~0ms, zero long tasks na main thread).
3. UI não trava em nenhum cenário (0 long tasks >50ms; maior gap de frame 55ms durante decode
   do PDF de 89MB) — arquitetura de worker validada sem ajustes.
