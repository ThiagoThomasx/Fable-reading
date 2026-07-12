/**
 * Tipos centrais do domínio. Fonte de verdade documentada em DATA_MODEL.md —
 * qualquer mudança aqui exige atualizar o .md no mesmo commit.
 */

export type BookStatus = 'want_to_read' | 'reading' | 'paused' | 'completed' | 'abandoned';
export type CoverSource = 'extracted' | 'manual';
export type ReadingTheme = 'paper' | 'dark';

export type Book = {
  id: string;
  title: string;
  author?: string;
  totalPages: number; // auto-preenchido pelo pdf.js na primeira abertura
  currentPage: number;
  status: BookStatus;
  category: string;
  tags: string[];
  coverSource: CoverSource; // escolha do usuário no cadastro
  coverUrl?: string; // thumbnail ~300px — extraída da 1ª página OU upload manual
  fileRef: string; // chave do Blob na object store 'files' (obrigatório)
  lastPageSnapshot?: string; // JPEG (data URL) da página currentPage — abertura instantânea
  readingTheme?: ReadingTheme; // preferência de leitura por livro
  startedAt?: string;
  completedAt?: string;
  lastOpenedAt?: string; // atualizado toda vez que o reader é aberto — usado por "Continuar lendo"
  createdAt: string;
  updatedAt: string;
};

/** Patch imutável aplicável a um Book — id e createdAt nunca mudam. */
export type BookPatch = Partial<Omit<Book, 'id' | 'createdAt'>>;

export type ReadingSession = {
  id: string;
  bookId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  startPage: number;
  endPage: number;
  pagesRead: number; // avanço líquido (endPage - startPage, nunca negativo)
  notes?: string; // edição manual opcional
  createdAt: string;
  updatedAt: string;
};

/** Patch imutável aplicável a uma ReadingSession — id, bookId e createdAt nunca mudam. */
export type SessionPatch = Partial<Omit<ReadingSession, 'id' | 'bookId' | 'createdAt'>>;

export type ReadingAnnotationType = 'page_note' | 'bookmark' | 'highlight';
export type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export type ReadingAnnotation = {
  id: string;
  bookId: string;
  page: number;
  type: ReadingAnnotationType;
  body?: string;
  color?: AnnotationColor;
  tags?: string[];
  // Preenchidos quando type === 'highlight' (Sprint 9): trecho selecionado e
  // âncora textual (rects relativos 0..1 à página, sobrevivem a zoom/resize).
  // Não atravessa páginas nesta versão — ver ARCHITECTURE.md.
  quoteText?: string;
  textAnchor?: {
    page: number;
    text?: string;
    rects?: Array<{ x: number; y: number; width: number; height: number }>;
  };
  createdAt: string;
  updatedAt: string;
};

/** Patch imutável aplicável a uma ReadingAnnotation — id, bookId e createdAt nunca mudam. */
export type AnnotationPatch = Partial<Omit<ReadingAnnotation, 'id' | 'bookId' | 'createdAt'>>;

/**
 * Review pessoal de um livro (Sprint 11). No máximo uma por livro — por isso não
 * tem `id` próprio: `bookId` já é o identificador único (e a chave primária na
 * store 'reviews'). `finishedAt` é denormalizado aqui (cópia de Book.completedAt
 * no momento em que o usuário marca o livro como finalizado) para permitir editar
 * a data da review sem afetar o status do livro.
 */
export type BookReview = {
  bookId: string;
  /** 0.5 a 5, em passos de 0.5. */
  rating?: number;
  title?: string;
  body?: string;
  mainTakeaways?: string[];
  /** IDs de ReadingAnnotation (tipicamente highlights) — resolvidos no momento do export. */
  favoriteAnnotationIds?: string[];
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

/** Patch imutável aplicável a uma BookReview — bookId e createdAt nunca mudam. */
export type ReviewPatch = Partial<Omit<BookReview, 'bookId' | 'createdAt'>>;
