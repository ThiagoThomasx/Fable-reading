# Arquitetura — ReadQuest

## Visão geral

Local-first, sem backend nesta fase. Todo o estado vive no navegador: React + Zustand no
runtime, IndexedDB como persistência.

```
┌─────────────────────────────────────────────┐
│                  React App                    │
│  ┌───────────────┐      ┌──────────────────┐ │
│  │   App Shell     │      │  Reading Surface  │ │
│  │ (biblioteca,    │      │  (leitor de PDF)  │ │
│  │  dashboard,     │      │                   │ │
│  │  notas, review) │      │  React.lazy()     │ │
│  └────────┬────────┘      └─────────┬─────────┘ │
│           │                          │           │
│      Zustand stores          pdfjs-dist Worker   │
│  (useBookStore, etc.)        (isolado por doc)   │
└───────────┬──────────────────────────┬──────────┘
            │                          │
            ▼                          ▼
  IndexedDB: 'books'/'sessions'/  IndexedDB: 'files'
    'notes' (metadata, pequeno,    (Blobs de PDF,
        lido com frequência)        lido raramente)
```

## Separação de object stores (IndexedDB)

Duas stores deliberadamente separadas — não misturar:

- **`books`**: metadata de cada livro (título, autor, progresso, status, tags, thumbnail de
  capa). Pequena, lida a cada render da biblioteca e do dashboard.
- **`files`**: Blob binário do PDF por `bookId`. Grande, lida apenas quando o reader abre um
  livro específico.

Motivo: evitar que qualquer leitura da biblioteca (grid de capas, dashboard) carregue Blobs de
PDF na memória. Atualizações de progresso (`currentPage`) tocam **apenas** `books`.

## Fluxo de dados — abrir e ler um livro

```
[Upload PDF] → Blob salvo em 'files' (chave: bookId)
        │
[pdfjs-dist worker] → extrai metadata (nº páginas) → auto-preenche totalPages em 'books'
        │
[Reading Surface] → abre o livro:
        │   1. se existe Book.lastPageSnapshot → exibe o JPEG instantaneamente (<100ms)
        │   2. em paralelo, dispara o render real da página via pdfjs-dist (worker)
        │   3. substitui o snapshot pelo render real sem flash (crossfade curto)
        │
    renderiza página atual (canvas, página-única)
    pré-carrega página N+1 em canvas invisível (background)
    cache LRU em memória das últimas 5-10 páginas renderizadas
        │
    a cada mudança de página → debounce (~1s) → updateBook(bookId,
        │        { currentPage, lastPageSnapshot })   (toca apenas 'books';
        │        snapshot = JPEG comprimido da página que o usuário está vendo,
        │        salvo sempre junto de currentPage para nunca divergirem)
        │   ao fechar o livro → flush imediato do mesmo save (sem esperar debounce)
        ▼
[App Shell / Biblioteca] ← reflete progresso atualizado nos BookCards
```

**Por que o snapshot existe (decisão do Sprint 0):** em PDFs de imagem/escaneados, o decode da
imagem embutida da página custa ~1–2s fixos, independente da resolução de saída. O snapshot
persistido torna a abertura *percebida* instantânea para qualquer tipo de PDF; o render real
chega em background e substitui. Escopo atual: aplicado apenas à **abertura do livro** — a
navegação entre páginas já é coberta pelo preload N+1 + LRU (ver log de decisões no
`ROADMAP_SPRINTS.md`).

## Fluxo de dados — sessões, notas, export

```
[Reading Surface] → captura sessão automática (tempo + páginas percorridas)
        │
[useSessionStore.addSession()] → IndexedDB
        │
[Notas criadas durante a leitura] → useNoteStore.addNote(bookId, sessionId?, page?)
        │
[Export Markdown] ← lê books + sessions + notes → funções puras de serialização → Blob/clipboard
```

### Export Markdown (Sprint 7)

`generateBookMarkdownExport` (`app/src/lib/export-markdown.ts`) é derivado exclusivamente de
`Book` + `ReadingSession[]` + `ReadingAnnotation[]` já carregados em memória pelos stores
(`useBookStore`, `useSessionStore.loadForBook`, `useNoteStore.loadForBook`) — nunca lê a object
store `files`/Blob do PDF e nunca persiste o resultado de volta no IndexedDB (o `.md` gerado
existe só na memória do navegador até o download/cópia). `downloadMarkdownFile`
(`app/src/lib/download-markdown.ts`) fica em módulo separado por depender do DOM (`Blob`/`URL`/
`document`), mantendo `export-markdown.ts` puro e testável em Node.

### Backup, restore e integridade (Sprint 10)

Estratégia de segurança de dados para uma biblioteca que agora acumula muito estado local
importante (livros, PDFs, sessões, notas, bookmarks, highlights). Local-first se mantém: backup e
restore são 100% client-side, nenhum dado sai do navegador.

```
[Backup]  IndexedDB (books+files+sessions+notes+reviews) → lib/backup-io.ts (lê tudo, Blob→Base64)
              → lib/backup.ts (monta ReadQuestBackup, puro) → download-backup.ts (.json)

[Restore] arquivo .json → lib/restore.ts (parse + validação pura, bloqueia tudo se inválido)
              → confirmação explícita do usuário (checkbox "entendo que...")
              → lib/restore-io.ts (limpa e regrava as 5 stores — substituição total, sem merge)
              → reload da página (garante que todas as stores Zustand releiam do zero)

[Integridade] IndexedDB → lib/integrity-io.ts (snapshot) → lib/data-integrity.ts (puro, sem IO)
              → IntegrityReport (órfãos, páginas inválidas, bookmarks duplicados)
              → lib/repair.ts (reparo seguro, opcional — nunca reconstrói PDF nem faz merge)
```

Divisão puro/IO deliberada, no mesmo padrão do Export Markdown: `backup.ts`, `restore.ts` e
`data-integrity.ts` não tocam IndexedDB nem DOM — só recebem/retornam arrays e objetos, o que os
torna testáveis em Node sem `fake-indexeddb`. `backup-io.ts`, `restore-io.ts` e `integrity-io.ts`
são as únicas pontes para o IndexedDB real.

**Por que "substituir tudo" e não merge:** merge parcial exige resolver conflitos (mesmo `id` com
`updatedAt` diferente em ambos os lados) — complexidade desnecessária para o caso de uso real
(restaurar depois de trocar de máquina/navegador, ou recuperar de um estado corrompido). Fora de
escopo da Sprint 10; documentado como decisão, não como pendência esquecida.

**Por que o backup inclui registros órfãos:** o objetivo do backup é nunca perder dado, mesmo que
a biblioteca já tenha problemas de integridade no momento da exportação. Limpeza de órfãos é uma
ação separada, explícita e opcional (botão "Corrigir problemas seguros" na UI de Data Safety) —
nunca acontece implicitamente durante backup ou restore.

**Reparos considerados seguros o suficiente para automação:** remover arquivo/sessão/anotação
órfã (sem livro correspondente), corrigir `currentPage` fora do intervalo `[1, totalPages]`
(clamp), remover bookmark duplicado na mesma página (mantendo o mais antigo). **Não
implementado/decidido como fora de escopo:** reconstruir PDF perdido, inventar livro para arquivo
órfão, corrigir automaticamente sessões/anotações com página fora do intervalo (só reportadas —
requer julgamento do usuário sobre qual página é a "certa"), merge de qualquer tipo.

**Cascade de exclusão de livro:** antes da Sprint 10, `useBookStore.remove()` só apagava o livro e
o Blob do PDF, deixando sessões e anotações órfãs no IndexedDB (bug descoberto na auditoria
inicial desta sprint). Corrigido: `remove()` agora também apaga todas as sessões e anotações do
livro (`deleteSessionsForBook`/`deleteAnnotationsForBook`), e limpa o estado em memória de
`useSessionStore`/`useNoteStore` se o livro removido era o que estava carregado. A Sprint 11
estendeu o mesmo cascade para incluir `deleteReviewForBook`/`useReviewStore`.

### Reading Review & Book Completion (Sprint 11)

Nova store `reviews` (`DB_VERSION` 3→4), chaveada diretamente por `bookId` — decisão estrutural
para impor "no máximo uma review por livro" sem precisar de índice nem checagem de duplicidade em
runtime. Segue o mesmo padrão puro/IO das demais stores: `db/reviews-repo.ts` (CRUD cru) →
`stores/useReviewStore.ts` (Zustand, carrega sob demanda por livro, sem autosave) →
`features/library/ReviewEditor.tsx` (UI, dentro de `EditBookDialog`, visível só quando
`status === 'completed'`).

**Finalizar um livro:** feito através do `<select>` de status já existente no `EditBookDialog` —
não há botão dedicado "Marcar como finalizado" separado, para não duplicar a superfície de edição
de status. Ao salvar com `status: 'completed'` vindo de um status diferente, `Book.completedAt`
(campo que já existia no tipo desde antes desta sprint, mas nunca era escrito por nenhum fluxo) é
carimbado com a data atual — uma única vez; reabrir e salvar de novo não sobrescreve.

**Highlights favoritos:** `BookReview.favoriteAnnotationIds` referencia `ReadingAnnotation.id` por
FK unidirecional (mesmo padrão de `bookId`), resolvido apenas no momento do export/renderização —
nunca duplica o texto do highlight na review. Se a anotação favorita for deletada depois, a review
não quebra (`findReviewsWithMissingFavorites` sinaliza como aviso; reparo seguro pode limpar o ID
órfão sem apagar a review).

**Export Markdown:** `generateBookMarkdownExport` ganhou um parâmetro opcional `review` — quando
presente, insere uma seção `## Review` (nota, título, texto, principais ideias, highlights
favoritos resolvidos) entre "Resumo de leitura" e "Notas e marcações". Livros sem review exportam
exatamente como antes (seção omitida), preservando o formato validado na Sprint 7.

**Backup/restore/integridade:** `reviews` entra no backup como 5ª lista (ver `DATA_MODEL.md`),
com o mesmo tratamento das demais — inclui órfãos, restore é substituição total, integridade
detecta reviews órfãs (`orphan-review`, aviso) e reviews com favoritos apontando para anotações
inexistentes (`review-missing-favorite`, aviso). Reparo seguro remove reviews órfãs inteiras e,
separadamente, limpa apenas os IDs de favoritos inválidos de reviews que continuam vinculadas a um
livro existente (nunca as duas coisas ao mesmo tempo para a mesma review).

## Camadas visuais — App Shell vs Reading Surface

Duas linguagens visuais deliberadamente distintas, ambas derivadas dos tokens do
`DESIGN - Fable.md`, mas aplicadas de forma diferente:

### App Shell
Biblioteca, dashboard, notas, review, onboarding/landing. Usa a linguagem editorial completa do
Fable: bandas full-bleed coloridas (Fable Forest, Storybook Sky), Cream Card, Book Cover Tile,
pill buttons (60px radius), tipografia Fraunces em displays grandes.

### Reading Surface
Tela de leitura em si. Minimalista, sem chrome de marca:
- Fundo: `--color-paper-cream` (tema **Paper**, padrão) ou tema **Dark** alternativo.
- Texto/controles: `--color-ink`.
- Sem bandas coloridas, sem ilustrações, sem headline de display.
- Controles de navegação flutuantes e discretos, que somem em modo foco.

A escolha de tema (Paper/Dark) é por livro (`Book.readingTheme`), independente do tema do App
Shell.

## Text layer e highlights textuais (Sprint 9 — feature estável)

O reader é **canvas-only** por padrão: cada página é rasterizada em `pdf-engine.ts` e desenhada
num único `<canvas>`, sem seleção nativa de texto. A partir da Sprint 9, um "modo seleção"
explícito (botão na topbar ou atalho `T`) monta a `TextLayer` do pdf.js **sob demanda** sobre o
`pageWrapperRef` (o mesmo container `position: relative` que já envolve canvas + hotzones),
posicionada via `page.getTextContent()` + `TextLayer` (pdf.js) casada com `reader.cssWidth` (CSS
px, não os pixels de dispositivo usados pelo raster do canvas). Todo esse código vive em
`app/src/features/reader/highlights/` (promovido do spike da Sprint 8 — ver
`TEXT_LAYER_SPIKE.md`).

**Por que sob demanda, não sempre-ativa:** as duas hotzones de navegação (terços esquerdo/direito
da página, `PdfReader.tsx`) cobrem a mesma área que um text layer full-page ocuparia — conflito
permanente se a text layer ficasse sempre presente. Isolando-a atrás de um modo explícito, o custo
de `getTextContent`/render (observado ~1.5–2s numa página densa de imagens/1010 spans no PDF de
teste "pesado") só ocorre quando o usuário pediu para selecionar texto, nunca durante leitura
normal — preserva os orçamentos de performance da Reading Surface (ver `CLAUDE.md`). Ao ativar o
modo seleção, as hotzones ganham `pointer-events-none` para que uma seleção de texto não vire
página; sair do modo (clique de novo, `Esc`, navegar de página ou entrar em modo foco) desmonta a
text layer e restaura as hotzones.

**Highlights salvos são renderizados independentemente do modo seleção:** `HighlightMarks`
desenha os retângulos coloridos (`ReadingAnnotation.textAnchor.rects`, convertidos de volta a
pixels via `relativeRectToPixelStyle`) como uma camada `pointer-events-none` sempre que a página
atual tem highlights — não exige text layer nem custo de `getTextContent`, então fica ativa mesmo
fora do modo seleção sem impacto de performance.

**Criação de highlight:** com o modo seleção ativo, uma seleção de texto válida dispara
`onSelectionCapture` (rects relativos + `quoteText` + posição de âncora); uma mini toolbar
(`SelectionToolbar`) aparece perto da seleção com 5 cores — clicar numa cor persiste a
`ReadingAnnotation` (`type: 'highlight'`) via `useNoteStore.add()`, sem passo de confirmação
adicional.

**Fallback para PDFs escaneados:** extratibilidade de texto é avaliada **por página**
(`hasExtractableText`), não por documento — um PDF "escaneado" pode ter páginas de rosto com
texto digital real e um corpo em imagem pura, ou até OCR completo. Páginas sem texto extraível
mostram um aviso sutil sem permitir seleção falsa; nenhuma tentativa de OCR é feita (fora de
escopo).

**Fronteira DOM PDF.js/React (regra obrigatória):** qualquer UI React (ex.: o aviso de fallback)
precisa viver num nó DOM **irmão** do container que a `TextLayer` do pdf.js escreve via DOM
imperativo — nunca como filho JSX desse mesmo container. Misturar as duas formas de gerência de
DOM causa `NotFoundError: removeChild` quando o React tenta reconciliar um nó que o pdf.js já
removeu por fora, derrubando a árvore inteira (o app não tem `ErrorBoundary`). Ver
`TEXT_LAYER_SPIKE.md` para a reprodução completa; `TextLayerOverlay.tsx` documenta a mitigação
inline.

**`--scale-factor` (pdf.js v4):** o `TextLayer` do `pdfjs-dist@4.x` ignora a viewport passada ao
construtor para dimensionamento e lê `viewport.rawDims` internamente, montando
`calc(var(--scale-factor) * Npx)` no CSS de cada span. `TextLayerOverlay` seta essa custom
property (`container.style.setProperty('--scale-factor', ...)`) a cada remontagem — zoom/resize
recalculam `viewport.scale` e a var junto, mantendo o alinhamento. `HighlightMarks` não depende
dessa var: usa rects relativos 0..1 e a largura/altura atual do `pageWrapperRef` (via
`ResizeObserver`), então zoom/resize também não a desalinham.

**Limitações conhecidas:** highlight não atravessa páginas; rotação de página não é tratada
(não testada); mobile não tem tratamento dedicado de seleção de texto (fora de escopo da Sprint
9).

## Otimizações de performance (arquiteturais)

| Otimização | Onde vive |
|---|---|
| Pré-carregamento de página N+1 em background | `PdfReader`, canvas invisível |
| Cache LRU em memória (últimas 5-10 páginas) | `PdfReader`, estado local do componente |
| Web Worker isolado por documento | `pdfjs-dist`, um worker por `bookId` aberto |
| Downscale de resolução conforme zoom | `PdfReader`, ajuste dinâmico do `scale` do pdf.js |
| Snapshot persistido da última página lida (`lastPageSnapshot`) | Gerado na Reading Surface ao sair da página/fechar; exibido na reabertura |
| Code splitting do reader | `React.lazy()` no ponto de entrada da rota do reader |
| `pdf.worker.js` como asset separado | Config do Vite, não bundlado no JS principal |
| Thumbnail de capa (~300px), nunca página em resolução real | Geração no momento do upload/extração |

Critérios de aceite mensuráveis: ver `QA_CHECKLIST.md`, Sprint 0.

## Fora de escopo desta arquitetura (por ora)

- Sync em nuvem, login, multi-dispositivo (Supabase é cogitado apenas se isso virar necessidade
  futura — ver `READQUEST_PLANO_TECNICO.md`).
- Backend de qualquer tipo.
- Chamadas diretas a API de IA paga (fase 1 do Sprint 9 é só geração de prompt copiável).
