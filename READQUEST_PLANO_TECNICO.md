# ReadQuest — Plano Técnico de Produto

Leitor de PDF como core. Documento consolidado para leitura do Claude Code — definição de
escopo, decisões de arquitetura, sistema de design de referência (Fable) e roadmap de execução.

## 0. Definição do Core do Produto

O ReadQuest é, antes de tudo, um **app-website de leitura de PDF** que substitui o Kindle para
livros em PDF no PC. O usuário carrega seu PDF e tem uma experiência de leitura superior a abrir
o arquivo em um leitor genérico (SumatraPDF, Edge, Xodo, Adobe Reader).

Tudo o que não é o reader em si — biblioteca, sessões, dashboard, notas, review, exportação, IA
— é tratado como **camada de valor agregado**, construída em cima do core, nunca antes dele.

## 1. Análise de Viabilidade Técnica e Riscos

### Mudança de prioridade
- PDF.js deixa de ser o item isolado de maior risco no fim do roadmap e passa a ser o bloqueador
  do MVP inteiro.
- É obrigatório um spike técnico (**Sprint 0**) antes de comprometer prazo de qualquer sprint de
  produto.
- Tracker, notas e dashboard passam a ser "agregadores de valor" — vêm depois do reader validado.

### Sobre o design de referência (Fable)
- `DESIGN - Fable.md` é um design system editorial de marketing/landing page: bandas full-bleed
  coloridas (Fable Forest, Storybook Sky), ilustrações grandes, headlines 48–80px. Ótimo para a
  home/onboarding do app — não aplicável diretamente à tela de leitura.
- Os tokens **Paper Cream (#f7f4ee)** + **Ink (#161015)** são, na prática, a paleta de um livro
  físico / Kindle — base natural para o modo de leitura claro (**Paper**), mais indicado que dark
  mode como padrão para leitura longa de texto denso.
- Decisão: **Paper** como tema padrão da Reading Surface, com **Dark** como tema alternativo para
  leitura noturna. O App Shell (biblioteca, dashboard) pode manter dark mode como padrão.
- Claude Code fica livre para compor o layout usando os tokens (cor, tipografia, radius, spacing)
  como linguagem de design — sem replicar literalmente os componentes de landing dentro do reader.

### Riscos ordenados por probabilidade × impacto

| Risco | Prob. | Impacto | Nível |
|---|---|---|---|
| PDF.js não performar bem com PDFs grandes/escaneados sendo o core | Alta | Crítico | 🔴 Alto |
| Aplicar o design de landing (bandas, ilustrações) dentro da tela de leitura | Média | Alto | 🔴 Alto |
| Fonte Heldane Display não licenciada / precisa de substituto | Alta | Baixo | 🟢 Baixo |
| Texto selecionável para highlights (feature futura) no PDF.js | Média | Médio | 🟡 Médio |
| Fricção no cadastro se upload de PDF virar obrigatório | Baixa | Médio | 🟡 Médio |

### Mitigações
- Spike de PDF.js antes de qualquer UI — testar `pdfjs-dist` com PDF leve, PDF pesado (com
  imagens) e PDF escaneado, medindo tempo de render.
- Separar dois modos visuais explícitos: **Reading Surface** (minimalista, paper cream, foco
  total no texto) vs **App Shell** (biblioteca, dashboard, onboarding).
- Substituir **Heldane Display** por **Fraunces** (Google Fonts, open-source).
- Cadastro de livro passa a exigir upload de PDF — `fileRef` deixa de ser opcional.

### Decisões de arquitetura confirmadas
- Renderização **página-única** (não scroll contínuo).
- Capa do livro: **as duas opções disponíveis** — extração automática da primeira página como
  thumbnail, e upload manual alternativo. O usuário escolhe por livro.
- PDF armazenado como Blob no **IndexedDB**, em object store separada da metadata (ver seção 4).
- `pdfjs-dist` rodando em Web Worker, isolado por documento.
- Progresso de leitura salvo automaticamente por `bookId` (número da página atual).
- Dois temas de leitura no mínimo: **Paper** (padrão) e **Dark**, desacoplados do tema do App Shell.

## 2. Arquitetura de Dados e Fluxo

Ver `ARCHITECTURE.md` para o detalhamento completo (diagramas, separação de object stores,
camadas visuais). Resumo do fluxo principal:

```
[Upload PDF] -> Blob armazenado em 'files' (bookId como chave)
        |
[pdfjs-dist worker] -> extrai metadata (nº páginas) -> auto-preenche totalPages
        |
[Reading Surface] -> renderiza página única, controla zoom/navegação
        |
    a cada mudança de página -> debounce -> updateProgress(bookId, currentPage)
        |
[App Shell / Biblioteca] <- reflete progresso atualizado nos BookCards
```

Modelo de dados completo (Book, ReadingSession, Note, Review): ver `DATA_MODEL.md`.

## 3. Roadmap do Projeto

Roadmap vivo, com checklist de progresso: ver `ROADMAP_SPRINTS.md`.

Resumo das 10 sprints:

| Sprint | Objetivo | Duração |
|---|---|---|
| 0 | Spike técnico PDF.js | 2-3 dias |
| 1 | Leitor PDF Core | 1,5-2 semanas |
| 2 | Refino da Reading Surface | 1 semana |
| 3 | Biblioteca (App Shell) | 1 semana |
| 4 | Sessões de Leitura & Progresso | 1 semana |
| 5 | Dashboard | 3-5 dias |
| 6 | Notas | 1 semana |
| 7 | Export Markdown | 3-5 dias |
| 8 | Modo Review | 1 semana |
| 9 | IA Assistida (fase 1: sem API) | 1 semana |

## 4. Otimizações de Performance e Arquitetura

### Performance do Reader (maior impacto)
- Pré-carregar páginas adjacentes (N+1, opcionalmente N-1) em canvas invisível.
- Cache de páginas renderizadas em memória (LRU), últimas ~5-10 páginas.
- Confirmar no spike que o pdf.js carrega sob demanda por página, não o arquivo inteiro.
- Web Worker isolado por documento, não compartilhado globalmente.
- Downscale de resolução de canvas conforme zoom.

### Bundle e Build
- Code splitting: `PdfReader` via `React.lazy()`, fora do bundle inicial da Biblioteca.
- `pdf.worker.js` servido como asset separado.
- Fontes com `font-display: swap`, apenas pesos usados (Fraunces 400/500, Inter).

### Dados e Armazenamento
- Nunca reescrever o Blob do PDF ao atualizar progresso — `updateBook()` toca só a metadata.
- Duas object stores no IndexedDB: `books` (metadata) e `files` (Blobs, grandes, lidos raramente).
- Thumbnail de capa pequena (~300px), nunca a página em resolução real.

### UX percebida
- Skeleton cream sólido como placeholder durante o render.
- Virtualização da grid de biblioteca (react-window) se a coleção crescer além de ~50-100 livros.

**Critério de aceite mensurável (Sprint 0):** abertura da primeira página <500ms para PDF de até
50MB; navegação entre páginas em cache <100ms.

## 5. Backlog Detalhado — Sprint 0 + Sprint 1

Ver `ROADMAP_SPRINTS.md` para o checklist vivo e `QA_CHECKLIST.md` para os critérios de teste
manuais detalhados de cada sprint.

## Fora do Escopo Inicial

Não implementar no início: OCR, edição de PDF, highlight nativo dentro do arquivo, sincronização
em nuvem, login, marketplace, social features, recomendação de livros, IA via API paga,
conversão PDF→EPUB, leitor mobile completo, importação automática de metadados.

## Documentos relacionados

- `DESIGN - Fable.md` — tokens e componentes do design system
- `CLAUDE.md` — instruções e convenções para o Claude Code
- `ARCHITECTURE.md` — arquitetura de dados e fluxo detalhados
- `DATA_MODEL.md` — tipos TypeScript de todas as entidades
- `ROADMAP_SPRINTS.md` — roadmap vivo com checklist
- `QA_CHECKLIST.md` — critérios de aceite e testes manuais
- `CHANGELOG.md` — histórico de mudanças
