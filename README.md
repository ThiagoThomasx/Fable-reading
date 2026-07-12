# ReadQuest (Fable Reading)

> Um leitor de PDF local-first que substitui o Kindle — com uma camada pessoal de progresso,
> notas, highlights, review e assistente de IA por cima.

## O que é

ReadQuest é um app web local-first para ler livros em PDF. O **core do produto é a experiência
de leitura em si** (a "Reading Surface"): abrir um PDF e lê-lo melhor do que em qualquer leitor
genérico, com abertura quase instantânea, navegação em cache, temas Paper/Dark e modo foco.

Todo o resto — biblioteca, sessões, dashboard, notas, highlights, review, busca global,
exportação e assistente de IA — é uma camada de valor agregado construída **em cima** do reader,
nunca em detrimento dele. Decisões técnicas que colocariam essas camadas em conflito com a
performance/simplicidade do reader sempre priorizam o reader (ver `CLAUDE.md`).

## Status atual — v0.1.0 (RC1)

Primeiro baseline recuperável do projeto: 15 sprints implementadas (Sprint 0 a 15), cobrindo
leitor core, biblioteca, sessões, dashboard, notas/highlights, review, export Markdown, busca
global e um portão seguro de integração com IA real. Ver `ROADMAP_SPRINTS.md` para o histórico
completo por sprint e `CHANGELOG.md` para o detalhe de cada entrega.

## Features atuais

- **Leitor de PDF** (`app/src/features/reader/`): renderização página-única via `pdfjs-dist` em
  Web Worker isolado por documento, abertura snapshot-first (<500ms percebido), preload de
  página N+1/N-1, cache LRU de 5–10 páginas, zoom, modo foco, temas Paper/Dark, atalhos de
  teclado completos.
- **Highlights de texto**: seleção real de texto sob demanda ("modo seleção", atalho `T`), 5
  cores, persistência como `ReadingAnnotation`, sem custo de text layer fora do modo seleção.
- **Notas e marcadores**: painel lateral vinculado à página atual, lista fora do reader.
- **Biblioteca (App Shell)**: CRUD de metadados, capa por extração automática ou upload manual,
  filtros por status/categoria, seção "Continuar lendo".
- **Sessões de leitura**: captura 100% automática (tempo + páginas) ao navegar no reader, edição
  manual opcional.
- **Dashboard**: agregações de tempo lido, páginas, atividade dos últimos 7 dias, resumo por
  livro, livros finalizados.
- **Review de leitura**: nota, texto livre, principais ideias e highlights favoritos ao marcar um
  livro como finalizado.
- **Export Markdown**: metadados, resumo de leitura, notas/highlights, sessões e review em um
  único `.md` por livro, pronto para Obsidian/Notion.
- **Busca global** (`Ctrl/Cmd+K`): busca local sobre títulos, autores, notas, highlights,
  marcadores, reviews e principais aprendizados, com resultados ancorados à página exata.
- **Assistente de IA local-first**: geração de prompts/contexto em Markdown para colar em
  ChatGPT/Claude/NotebookLM (sem chamada externa), mais um chat experimental com modo mock
  (sempre disponível, sem risco) e modo real opt-in (ver seção IA/privacidade abaixo).
- **Dados e segurança**: backup/restore completo (JSON), relatório de integridade e reparo seguro
  de órfãos/inconsistências, acessível pela Biblioteca.

## Stack

- React 19 + Vite 6 + TypeScript estrito
- Tailwind CSS 4 (tokens do design system Fable, ver `DESIGN - Fable.md`)
- Zustand (uma store por entidade — `useBookStore`, `useSessionStore`, `useNoteStore`,
  `useReviewStore`, `useUIStore`, `useAiSettingsStore`)
- IndexedDB via `idb` (persistência local-first, sem backend), duas object stores separadas
  (`books` metadata / `files` Blobs de PDF) — ver `ARCHITECTURE.md`
- `pdfjs-dist` (renderização de PDF em Web Worker isolado por documento)
- Vitest (testes unitários) + `fake-indexeddb`

Sem MUI, sem Framer Motion, sem router — decisões deliberadas documentadas em `CLAUDE.md` e no
log de decisões de `ROADMAP_SPRINTS.md`.

## Como rodar localmente

O código do app vive em `app/` (não na raiz do repositório):

```bash
cd app
npm install
npm run dev
```

Abre em `http://localhost:5173` (ou a porta configurada). Sem backend, sem variáveis de
ambiente obrigatórias — todo o estado vive no navegador via IndexedDB.

### Scripts (`app/package.json`)

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | `tsc --noEmit` + build de produção |
| `npm run preview` | Preview local do build de produção |
| `npm test` | Roda a suíte de testes (Vitest) uma vez |
| `npm run test:watch` | Testes em modo watch |

Há também um protótipo isolado do spike de performance em `spike-pdf/` (ver
`spike-pdf/README.md`), não faz parte do app de produção.

## Uso básico

1. Abra a Biblioteca, clique em "Adicionar livro" e envie um PDF.
2. Escolha a capa (extração automática da 1ª página ou upload manual).
3. Abra o livro — a leitura começa exatamente de onde parou da última vez.
4. Use `Ctrl/Cmd+K` a qualquer momento fora do reader para buscar em toda a biblioteca (títulos,
   notas, highlights, reviews).
5. Dentro do reader: `T` liga o modo seleção para criar highlights, `N` abre o painel de notas,
   `B` marca/desmarca a página atual como bookmark, `D` alterna tema, `F` alterna modo foco.
6. Ao terminar um livro, marque como "Finalizado" no diálogo de edição para escrever uma review.
7. Exporte qualquer livro como Markdown, ou gere um backup completo pela seção "Dados e
   segurança" da Biblioteca.

## Data safety

- Tudo fica no IndexedDB do navegador — nada é enviado a um servidor.
- Backup completo (JSON, inclusive Blobs de PDF em Base64) e restore com validação exaustiva
  antes de qualquer escrita (`lib/backup.ts`, `lib/restore.ts`).
- Relatório de integridade detecta órfãos, páginas inválidas e inconsistências; reparo seguro só
  cobre casos de baixo risco (nunca reconstrói um PDF perdido nem inventa dado).
- Ver limitações conhecidas sobre o tamanho de backups com PDFs grandes em `KNOWN_LIMITATIONS.md`.

## IA / privacidade

- **Modo mock** (padrão, sem configuração): respostas simuladas, nenhuma chamada de rede, sempre
  disponível — usado para explorar o assistente sem qualquer risco de privacidade.
- **Modo real** (opt-in explícito): requer configurar um endpoint compatível com a API de chat
  completions da OpenAI (OpenAI, OpenRouter, Groq, Ollama local, etc.) e colar uma API key
  manualmente na UI a cada sessão do navegador.
  - A API key **nunca é persistida** (nem `localStorage` nem IndexedDB) — vive só em memória do
    processo do navegador e some ao recarregar a página.
  - Toda chamada real exige confirmação manual em duas etapas, com o contexto que será enviado
    visível antes do envio.
  - Conversas de chat não são persistidas — somem ao sair da tela.
- Nenhum texto integral de PDF é enviado — o contexto é montado a partir de notas, highlights,
  metadados e reviews já digitados/selecionados pelo usuário.

## Limitações conhecidas

Ver `KNOWN_LIMITATIONS.md` para a lista completa.

## Roadmap próximo

Sprint 16 (atual) é de estabilização: hardening do repositório, documentação e primeiro
baseline versionado (`v0.1.0` / RC1), sem feature nova. Próximos passos possíveis após o RC1
(não comprometidos): ver `ROADMAP_SPRINTS.md` para o histórico completo e ideias registradas nas
seções "fora de escopo" do `READQUEST_PLANO_TECNICO.md`.

## Documentação do projeto

| Arquivo | Conteúdo |
|---|---|
| `CLAUDE.md` | Instruções e convenções para o Claude Code operar neste repositório |
| `DESIGN - Fable.md` | Design system de referência (tokens de cor, tipografia, componentes) |
| `READQUEST_PLANO_TECNICO.md` | Plano técnico completo: viabilidade, riscos, arquitetura, roadmap |
| `ARCHITECTURE.md` | Arquitetura de dados, fluxo, separação App Shell vs Reading Surface |
| `DATA_MODEL.md` | Tipos TypeScript de todas as entidades (Book, ReadingSession, ReadingAnnotation, BookReview) |
| `ROADMAP_SPRINTS.md` | Roadmap vivo por sprints, com checklist de progresso e log de decisões |
| `QA_CHECKLIST.md` | Critérios de aceite e checklist manual de testes por sprint |
| `KNOWN_LIMITATIONS.md` | Limitações conhecidas do produto nesta fase |
| `CHANGELOG.md` | Histórico de mudanças do projeto |
| `TEXT_LAYER_SPIKE.md` | Relatório do spike técnico de text layer (highlights) |

## Princípio central

> Não competir com leitores de PDF maduros no que eles já fazem bem. O reader precisa ser
> excelente — mas o valor real do ReadQuest é a camada pessoal que nenhum leitor de PDF genérico
> entrega: progresso, rotina, notas, memória, produção autoral.

## Licença / uso

Projeto pessoal, uso individual.
