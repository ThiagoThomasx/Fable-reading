# Modelo de Dados — ReadQuest

Fonte de verdade dos tipos TypeScript usados no projeto. Se um tipo mudar no código, atualize
este arquivo no mesmo commit/PR.

Ver `ARCHITECTURE.md` para a separação de object stores (`books` vs `files`) referenciada abaixo.

## Book

Vive na object store `books`. O Blob do PDF em si **não** fica neste registro — vive na store
`files`, referenciado por `fileRef`.

```ts
type Book = {
  id: string;
  title: string;
  author?: string;
  totalPages: number;        // auto-preenchido pelo pdf.js na primeira abertura
  currentPage: number;
  status: 'want_to_read' | 'reading' | 'paused' | 'completed' | 'abandoned';
  category: string;
  tags: string[];
  coverSource: 'extracted' | 'manual';  // escolha do usuário no cadastro
  coverUrl?: string;          // thumbnail ~300px — extraída da 1ª página OU upload manual
  fileRef: string;            // chave do Blob na object store 'files' (obrigatório)
  lastPageSnapshot?: string;  // JPEG comprimido (data URL) da página `currentPage` — exibido
                              // instantaneamente ao reabrir o livro enquanto o render real do
                              // pdf.js acontece em background. Gerado ao sair de uma página ou
                              // fechar o livro. Vive em 'books' (NUNCA em 'files'). Salvo sempre
                              // junto com currentPage para nunca divergirem.
  readingTheme?: 'paper' | 'dark';  // preferência de leitura por livro
  startedAt?: string;
  completedAt?: string;
  lastOpenedAt?: string;      // atualizado a cada abertura do reader — usado por "Continuar lendo"
  createdAt: string;
  updatedAt: string;
};
```

## ReadingSession

```ts
type ReadingSession = {
  id: string;
  bookId: string;
  startedAt: string;    // ISO — quando o reader abriu o livro
  endedAt: string;       // ISO — quando o reader fechou (unmount)
  durationMs: number;    // endedAt - startedAt em ms; editável manualmente
  startPage: number;     // currentPage do livro na abertura
  endPage: number;       // currentPage do livro no fechamento
  pagesRead: number;     // max(0, endPage - startPage) — avanço líquido, nunca negativo
  notes?: string;        // edição manual opcional
  createdAt: string;
  updatedAt: string;
};
```

Vive na object store `sessions`, capturada automaticamente pela Reading Surface: uma sessão é
criada no mount do reader (`startedAt`/`startPage`) e persistida no unmount (`endedAt`/`endPage`/
`durationMs`/`pagesRead`). Sessões triviais (fechadas quase instantaneamente, sem avanço de
página) não são persistidas — ver decisão da Sprint 4 em `ROADMAP_SPRINTS.md`. Edição manual é
opcional (ajustar `durationMs` e `notes`), feita depois via `useSessionStore.patch()`.

## ReadingAnnotation

```ts
type ReadingAnnotationType = 'page_note' | 'bookmark' | 'highlight';
type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

type ReadingAnnotation = {
  id: string;
  bookId: string;
  page: number;
  type: ReadingAnnotationType;
  body?: string;
  color?: AnnotationColor;
  tags?: string[];
  // Preenchidos quando type === 'highlight' (Sprint 9). quoteText é o texto
  // selecionado (trim, quebras de linha preservadas). textAnchor.rects são
  // frações 0..1 relativas ao container da página (sobrevivem a zoom/resize
  // sem recomputar contra o viewport original — ver ARCHITECTURE.md).
  quoteText?: string;
  textAnchor?: {
    page: number;
    text?: string;
    rects?: Array<{ x: number; y: number; width: number; height: number }>;
  };
  createdAt: string;
  updatedAt: string;
};
```

Vive na object store `notes`, criada a partir do painel lateral dentro da própria Reading
Surface (`NotesSidePanel.tsx`), sempre vinculada à página atual — não há criação solta fora do
reader. `type: 'page_note'` cobre notas de texto livre; `type: 'bookmark'` marca a página sem
exigir `body`. `type: 'highlight'` (Sprint 9) é criado a partir de uma seleção de texto no modo
seleção da Reading Surface — ver `TextLayerOverlay`/`SelectionToolbar` em
`features/reader/highlights/`. Fora do reader, `NotesList.tsx` (dentro de `EditBookDialog`)
lista/edita/remove as anotações de um livro, mas não cria (mesma restrição do `SessionHistory`);
highlights só permitem remoção ali (sem edição de `quoteText`/rects).

**Limitações conhecidas do highlight (Sprint 9):** não atravessa páginas (rects sempre relativos a
uma única `page`); não corrige rotação de página; texto extraído depende do text layer do pdf.js
funcionar na página (PDFs escaneados/sem texto extraível não permitem highlight — fallback visual
mostrado ao usuário).

## BookReview (Sprint 11)

```ts
type BookReview = {
  bookId: string;              // também a chave primária na store 'reviews' — sem id próprio
  rating?: number;              // 0.5 a 5, em passos de 0.5
  title?: string;
  body?: string;
  mainTakeaways?: string[];
  favoriteAnnotationIds?: string[];  // IDs de ReadingAnnotation (tipicamente highlights)
  startedAt?: string;
  finishedAt?: string;          // denormalizado de Book.completedAt no momento de finalizar
  createdAt: string;
  updatedAt: string;
};
```

Vive na object store `reviews` (Sprint 11), chaveada diretamente por `bookId` — no máximo uma
review por livro, decisão estrutural em vez de convenção de aplicação (não há índice `by-book`
porque `bookId` já é a própria chave primária). `favoriteAnnotationIds` referencia
`ReadingAnnotation.id` por um FK unidirecional (mesmo padrão de `bookId` em `ReadingSession`/
`ReadingAnnotation`): se uma anotação favorita for deletada, a review não quebra — a integridade
(`findReviewsWithMissingFavorites`) sinaliza isso como aviso, e o reparo seguro pode limpar o ID
órfão sem apagar a review inteira.

Criada/editada via `ReviewEditor.tsx` (dentro de `EditBookDialog`, visível quando
`status === 'completed'`). Salvar é sempre explícito (sem autosave); um review "vazio" (todos os
campos em branco) não é salvo. `Book.completedAt` (já existente desde antes desta sprint, mas até
então nunca escrito por nenhum fluxo) é carimbado automaticamente com a data atual na primeira vez
que o status de um livro muda para `completed` — mudanças de status subsequentes não sobrescrevem
essa data. `BookReview.finishedAt` é um campo separado e editável pelo usuário na UI de review,
tipicamente pré-preenchido a partir de `Book.completedAt` mas independente dele depois disso.

## Backup completo (Sprint 10)

Formato de arquivo `.json` gerado por `lib/backup.ts` (montagem pura) + `lib/backup-io.ts` (leitura
do IndexedDB, incluindo conversão de Blobs para Base64 via `lib/base64.ts`). Documentado em
`ARCHITECTURE.md` a estratégia de backup/restore/integridade.

```ts
type ReadQuestBackup = {
  app: 'readquest';
  version: number;        // BACKUP_FORMAT_VERSION — versão do formato do arquivo em si
  generatedAt: string;    // ISO 8601
  schemaVersion: number;  // DB_VERSION do IndexedDB no momento do backup (hoje: 4)
  books: Book[];
  files: Array<{
    bookId: string;       // == Book.fileRef do livro correspondente
    mimeType: string;
    size: number;
    dataBase64: string;   // Blob do PDF codificado em Base64
  }>;
  sessions: ReadingSession[];
  annotations: ReadingAnnotation[];
  reviews: BookReview[];  // Sprint 11
};
```

Observações:

- `version` (formato do backup) e `schemaVersion` (versão do IndexedDB) são conceitos
  independentes — um bump de `DB_VERSION` não exige necessariamente um bump de
  `BACKUP_FORMAT_VERSION`, e vice-versa.
- O backup inclui **todos** os registros das 5 stores, inclusive órfãos (arquivo sem livro, sessão/
  anotação/review sem livro) — o objetivo do backup é nunca perder dado, mesmo que a biblioteca já
  tenha problemas de integridade. A limpeza de órfãos é uma ação separada e explícita (ver
  `lib/repair.ts`), nunca implícita no backup/restore.
- Restore (`lib/restore.ts` + `lib/restore-io.ts`) é sempre **substituição total**: cada store é
  limpa e regravada a partir do backup. Não há merge parcial. A validação (`validateBackup`)
  roda inteiramente antes de qualquer escrita — um backup inválido nunca corrompe os dados atuais.
- `dataBase64` vazio (string `''`) é um caso válido (Blob de 0 bytes) e é tratado à parte na
  validação, para não ser confundido com Base64 ausente/corrompido.

## Índices de acesso recomendados (IndexedDB)

| Store | Índice | Uso |
|---|---|---|
| `books` | `status` | Filtro por status na biblioteca |
| `books` | `category` | Filtro por categoria |
| `sessions` | `bookId` | Histórico de sessões por livro |
| `sessions` | `startedAt` | Agregações do dashboard (semana atual) |
| `notes` | `bookId` | Anotações por livro (`by-book`) |
| `notes` | `type` | Filtro por tipo de anotação (`by-type`) |
| `reviews` | — | Sem índice — `bookId` já é a chave primária da store |

## Convenções

- Todas as datas em ISO 8601 (`string`), para evitar bugs de fuso horário em cálculo de streak.
- IDs gerados no client (`crypto.randomUUID()`), sem dependência de servidor.
- Nenhum tipo aqui referencia dados de rede ou autenticação — o modelo é 100% local-first.
