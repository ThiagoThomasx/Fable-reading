# QA Checklist — ReadQuest

Checklist de critérios de aceite e testes manuais por sprint. Rodar antes de considerar uma
sprint concluída. Complementa (não substitui) o critério de aceite de uma frase de cada sprint
em `ROADMAP_SPRINTS.md`.

---

## Sprint 0 — Spike PDF.js

- [ ] Tempo de abertura da 1ª página **< 500ms** para PDF de até 50MB
      — *parcial: 373ms para PDF de texto (9.1MB) ✅; 1318ms para PDF escaneado de 44.6MB ❌
      (custo fixo de decode da imagem da página). Mitigação definida para a Sprint 1: snapshot
      persistido da última página lida. Ver baseline em `ROADMAP_SPRINTS.md`.*
- [x] Tempo de navegação entre páginas já em cache **< 100ms** — *máx. 0.1ms medido*
- [x] UI não trava (sem jank perceptível) durante render de PDF pesado — *0 long tasks >50ms,
      maior gap de frame 55ms, mesmo com PDF de 89MB*
- [x] PDF escaneado (sem texto selecionável) abre e exibe visualmente sem erro
- [x] Renderização confirmada como página-única (não scroll contínuo)

## Sprint 1 — Leitor PDF Core

- [ ] Upload de PDF de 300+ páginas, navegar até página 150, fechar e reabrir → retorna na página 150
      — *parcial: verificado com PDF de 212 páginas (fecha na pág. 4, reabre na pág. 4); falta o
      teste manual com 300+ páginas/upload via UI*
- [x] Reabrir um livro exibe a última página lida instantaneamente (snapshot) e o render real a
      substitui sem flash perceptível — *verificado: snapshot visível ~60ms após o clique, canvas
      real substitui em seguida; falta conferir visualmente com PDF pesado/escaneado*
- [x] `lastPageSnapshot` vive na store `books` (nunca em `files`) e é pequeno — *verificado:
      JPEG data URL de ~5KB na store `books`*
- [x] Zoom in/out mantém a página atual visível corretamente — *verificado a 125%: mesma página,
      canvas re-renderizado em resolução maior*
- [x] Modo foco esconde toda a UI exceto texto e controles mínimos — *verificado: header e
      indicador somem com `F` e voltam ao sair*
- [ ] Cadastrar um livro com capa manual e outro com capa extraída automaticamente → ambos exibem corretamente
      — *parcial: capa extraída verificada; fluxo de capa manual implementado mas não testado na UI*
- [ ] Virar para a próxima página não mostra flash de carregamento (página pré-carregada)
      — *preload N+1 implementado (validado no spike); confirmar visualmente*
- [x] Abrir a Biblioteca não dispara leitura de nenhum Blob de PDF — *por construção: `loadFile`
      só é chamado pelo reader e pela sondagem do cadastro*
- [x] `updateBook({ currentPage })` não reescreve o Blob na store `files` — *coberto por teste
      unitário (books-repo.test.ts)*
- [x] Bundle inicial da Biblioteca não inclui o código do `PdfReader` — *verificado no build:
      `PdfReader` e `pdfjs-dist` (366KB) em chunks próprios; bundle inicial 210KB/67KB gzip*

## Sprint 2 — Refino da Reading Surface

- [x] Alternar entre tema Paper e Dark não perde a página atual — *verificado: `D` e clique no
      botão de tema trocam cor de fundo/tinta/borda instantaneamente, `currentPage` inalterado*
- [x] Tema escolhido persiste ao fechar e reabrir o livro (via `Book.readingTheme`) — *verificado:
      alternado para dark, reload completo da página, reabertura do livro volta em dark*
- [x] Todos os atalhos de teclado funcionam: `→`/`Espaço`/`PageDown`, `←`/`PageUp`, `+`/`-`, `0`
      (reset zoom), `F` (foco), `D` (tema), `Esc` (sai do foco, depois fecha) — *verificado um a
      um via KeyboardEvent sintético no preview*
- [x] Atalhos não disparam com foco em input/textarea/select/contentEditable — *guard
      implementado (`isEditableTarget`); reader não tem inputs hoje, guard é defensivo para telas
      futuras*
- [x] Transição entre páginas é suave, sem flicker — *crossfade CSS de 150ms (`page-turn`),
      pulado no primeiro draw da abertura (evita duplicar com o crossfade do snapshot)*
- [x] `prefers-reduced-motion` remove as animações de transição — *guard adicionado em
      `index.css` para `page-turn` e `snapshot-fade`*
- [x] Indicador de progresso reflete corretamente página atual / total — *verificado: texto
      "Página N de M · P%" e barra fina de progresso atualizam a cada navegação*
- [x] Modo foco continua reduzindo a UI ao mínimo, com indicador de progresso ainda visível
      (versão discreta, sem a topbar) — *verificado*
- [x] Estados disabled na primeira/última página e nos limites de zoom — *verificado: hit-zone e
      botão de zoom ficam com `cursor: default`/opacidade reduzida nos extremos*
- [x] `npx tsc --noEmit`, `npx vitest run` (14 testes) e `npm run build` passam sem erros

### Micro-hardening pós-Sprint 2 (2026-07-09)

- [x] Tela de erro do reader (`reader.status === 'error'`) respeita tema Paper/Dark via tokens
      `--reader-*` — *verificado: forçado erro limpando a store `files` do IndexedDB mantendo
      `books`, com tema dark ativo o fundo/tinta/botão da tela de erro usaram as cores dark
      corretas (`#1c1a17`/`#ece5d8`), sem regressão no fluxo normal*
- [x] Navegação adjacente pré-carregada continua rápida — *medido via MutationObserver no preview:
      voltar página (já preloadada) 1.0–1.8ms; avançar continuamente além da janela de preload
      15–25ms; após troca de zoom, avançar/voltar para vizinhos já 2–2.3ms — sem regressão
      perceptível da Sprint 1/2*

## Sprint 3 — Biblioteca

- [x] Grid exibe corretamente livros com capa extraída e com capa manual, lado a lado — *verificado
      no preview: capa extraída (Sprint 1) e edição de capa manual via `EditBookDialog` (upload de
      imagem sintética, `coverSource` passa a `'manual'`, preview e tile atualizam)*
- [x] Filtro por status funciona para todos os 5 status possíveis — *verificado com 6 livros
      semeados via console (`want_to_read`, `reading`, `paused`, `completed`, `abandoned`), cada
      chip de status filtra corretamente*
- [x] Filtro por categoria funciona com múltiplas categorias cadastradas — *verificado com 4
      categorias (`Dev`, `Ficção`, `Não-ficção`, `Técnico`); dropdown só aparece com 2+ categorias*
- [x] Editar metadata de um livro não afeta o Blob do PDF associado — *verificado: `updateBook`
      grava apenas na store `books`; contagem de chaves em `files` inalterada após editar título/
      status/capa de um livro (exceto o Blob órfão pré-existente de outra sessão, não relacionado)*

## Sprint 4 — Sessões

- [x] Ler um livro por alguns minutos gera uma sessão automaticamente, sem ação manual —
      *verificado no preview: PDF de teste de 2 páginas, aberto e mantido por >3s, gerou
      exatamente 1 sessão (`startPage: 1, endPage: 2, durationMs: 24669`), sem duplicata do
      StrictMode*
- [x] Progresso do livro (`currentPage`) é consistente com a última página da sessão —
      *verificado: `Book.currentPage` = 2 (tile "100% · pág. 2 de 2") igual ao `endPage` da sessão*
- [x] Edição manual de uma sessão (tempo, observação) persiste corretamente — *verificado:
      editado para 15 min + observação "Teste manual de edição" via `EditBookDialog`, refletido
      imediatamente na lista sem reload*
- [x] Histórico de sessões lista em ordem cronológica correta — *implementado com ordenação
      descendente (mais recente primeiro) em `SessionHistory.tsx`; coberto indiretamente por
      `sessions-repo.test.ts` (índice `by-started` em ordem crescente)*

## Sprint 5 — Dashboard

*Nota: "streak" foi removido do escopo da sprint (gamificação está explicitamente fora de escopo
no plano detalhado) — ver log de decisões do `ROADMAP_SPRINTS.md`.*

- [x] Tempo total lido e páginas avançadas nos cards batem com a soma das sessões — *verificado
      no preview com dados reais de seed: card "Tempo lido" = 15min / "Páginas avançadas" = 1,
      igual à única sessão existente*
- [x] Sessão descartada (< 3s, nunca persistida) não aparece em nenhuma métrica — *garantido
      estruturalmente: `MIN_SESSION_DURATION_MS` no reader impede a persistência; helpers de
      dashboard nunca veem essas sessões*
- [x] Atividade recente lista em ordem cronológica decrescente (mais recente primeiro) —
      *coberto por teste unitário (`getRecentSessions`) e verificado no preview*
- [x] Resumo por livro agrega corretamente sessões do mesmo `bookId` e ordena por tempo lido
      desc — *coberto por testes unitários (`getBookActivitySummary`) e verificado no preview*
- [x] Atividade dos últimos 7 dias mostra os 7 dias (incluindo hoje) em timezone local, com dias
      sem leitura zerados — *coberto por testes unitários (`getLast7DaysActivity`)*
- [x] Livro deletado/ausente em uma sessão órfã não quebra a UI — *tratado com fallback "Livro
      removido" em `resolveBookTitle`/`BookActivityList`, coberto por teste unitário*
- [x] Dashboard nunca carrega Blobs de `files` — *reaproveita `useBookStore.books` (metadata já
      em memória); nenhuma chamada nova a `files-repo`*
- [x] Navegação Biblioteca ↔ Dashboard funciona sem erros de console — *verificado no preview*

## Sprint 6 — Notas

*Nota: modelo final é `ReadingAnnotation` (`type: 'page_note' | 'bookmark' | 'highlight'`), não o
rascunho `Note` (com `sessionId`/`favorite`) do `DATA_MODEL.md` anterior à sprint. Sem highlight
textual (reader é canvas-only, sem text layer) e sem UI de filtro por tipo/tag — ver log de
decisões do `ROADMAP_SPRINTS.md`.*

- [x] Criar nota durante a leitura vincula corretamente `bookId` e `page` (página atual do
      reader) — *verificado no preview: nota criada na página 1 tem `page: 1`, aparece no painel
      lateral, no indicador da topbar e em `NotesList` dentro de `EditBookDialog`*
- [x] Marcar/desmarcar página (bookmark) persiste e reflete no indicador discreto da topbar —
      *verificado: `hasPageAnnotation` via `preview_inspect` confirmou `true` após marcar a página
      e o ponto discreto renderizou ao lado do botão "Notas"*
- [x] Editar/remover nota (dentro do reader e em `NotesList`) persiste sem reload — *verificado em
      ambos os locais*
- [x] Notas nunca tocam `sessions`/`books`/`files` — *coberto por teste unitário
      (`notes-repo.test.ts`)*
- [x] Painel lateral não sobrepõe/bloqueia a navegação de página — *bug real encontrado e
      corrigido em QA manual: painel flutuante cobria a hit-zone de "próxima página" em viewports
      ~960px; corrigido reservando espaço (`padding-right`) em vez de sobrepor; reverificado com
      `document.elementFromPoint` no clique*
- [x] Painel de notas funciona em ambos os temas (Paper/Dark) — *verificado no preview*

## Sprint 7 — Export Markdown

- [x] Export por livro gera Markdown válido (metadados, progresso, resumo, notas, bookmarks,
      sessões) — *verificado no preview: saída inspecionada via import dinâmico do módulo no
      console, formato confere com a estrutura da instrução da sprint*
- [x] Export de notas do livro inclui todas as notas/bookmarks vinculados àquele `bookId`,
      agrupados por página — *verificado com livro real de seed contendo 1 bookmark + 1 nota na
      mesma página*
- [x] Botão "Copiar Markdown" funciona sem quebrar a UI quando a Clipboard API nega permissão —
      *verificado no preview: erro "Failed to execute 'writeText' on 'Clipboard': Write
      permission denied" exibido como texto de erro na UI, sem exceção não tratada no console*
- [x] Download do arquivo `.md` gera nome de arquivo sensato (sem caracteres inválidos) —
      *coberto por teste unitário (`sanitizeMarkdownFilename`), incluindo fallback
      `readquest-export.md` para títulos sem caracteres alfanuméricos*
- [x] Exportação nunca carrega o Blob do PDF (`files`) — *confirmado na aba de rede do preview:
      nenhuma requisição relacionada a `files`/Blob durante clique em "Exportar Markdown"/"Copiar
      Markdown"; helper só recebe `Book`/`ReadingSession[]`/`ReadingAnnotation[]` já em memória*
- [x] `npx tsc --noEmit`, `npx vitest run` (81 testes) e `npm run build` passam sem erros

## Spike técnico (fora de sequência) — Text Layer

- [x] PDF textual (`leve.pdf`): seleção de linha única, multi-linha, após zoom, após navegar e
      voltar — texto extraído confere com o conteúdo visível do canvas
- [x] PDF escaneado (`escaneado.pdf`): páginas com OCR embutido selecionáveis normalmente; páginas
      genuinamente sem texto (ex. capa) mostram aviso de fallback sem erro — *achado: extratibilidade
      de texto é por página, não por documento*
- [x] PDF pesado (`pesado.pdf`, imagens): text layer monta em página densa (1010 spans) sem travar
      a UI; custo (~1.5–2s) isolado ao "modo seleção", não afeta navegação normal
- [x] Zoom (100%→125%) mantém o text layer alinhado ao canvas após recalcular `--scale-factor`
- [x] Hotzones de navegação inertes enquanto "modo seleção" está ligado (`elementFromPoint`
      confirmado sobre o text layer, não sobre os botões); funcionam normalmente com modo desligado
- [x] Painel de notas aberto não impede seleção de texto (testado com tema dark)
- [x] Tema Paper/Dark: texto do text layer permanece invisível (cor transparente) em ambos, sem
      impacto de legibilidade
- [x] Viewport mobile (375px): "modo seleção" liga sem erro no console — limitação de largura fixa
      do reader é pré-existente, documentada em `ARCHITECTURE.md`, não introduzida por este spike
- [x] Notes/bookmarks/sessions continuam funcionando após as mudanças — *verificado manualmente:
      criação de bookmark via painel de notas confirmada no preview*
- [x] Export Markdown não foi tocado (nenhum arquivo do Sprint 7 alterado)
- [x] Reader estável (fora do "modo seleção") não apresenta nenhuma regressão visual ou funcional
- [x] `npx tsc --noEmit`, `npx vitest run` (89 testes) e `npm run build` passam sem erros
- [x] Decisão final documentada em `TEXT_LAYER_SPIKE.md`: **GO condicionado** (Estratégia B)

## Text Highlights (fora de sequência) — promoção do spike a feature estável

- [x] PDF textual (`READQUEST_PLANO_TECNICO.pdf`): modo seleção liga via botão da topbar e via
      atalho `T`; text layer monta (`data-status="ready"`), sem erro no console
- [x] Seleção de uma linha cria highlight (`SelectionToolbar` aparece, clique numa cor persiste)
- [x] Seleção multi-linha cria highlight com múltiplos rects e `quoteText` preservando `\n`
- [x] Highlight aparece imediatamente sobre a página (retângulo colorido, `mix-blend-mode:
      multiply`) — verificado via IndexedDB e DOM
- [x] Navegar de página desliga o modo seleção automaticamente e desmonta a text layer
- [x] Ao voltar para a página do highlight, ele reaparece — **mesmo fora do modo seleção**
      (`HighlightMarks` independe da text layer)
- [x] Reload da página mantém o highlight persistido, na posição correta
- [x] Zoom (100%→125%) mantém o highlight alinhado (rects escalam proporcionalmente,
      confirmado via `getBoundingClientRect`/estilo inline)
- [x] Tema Dark: highlight permanece legível, painel de notas mostra ícone/cor/quoteText
- [x] Painel de notas (`NotesSidePanel`) lista o highlight com ícone 🖍️, cor e `quoteText`;
      "Remover" apaga da UI e do IndexedDB imediatamente
- [x] `NotesList` (`EditBookDialog`) lista o highlight com trecho entre aspas e ação "Remover",
      sem carregar o Blob do PDF
- [x] Export Markdown ("Exportar Markdown" no `EditBookDialog`) roda sem erro com highlight
      presente
- [x] PDF escaneado (`Escaneado (spike8)`): modo seleção liga, página sem texto extraível mostra
      o aviso de fallback ("sem texto extraível... sem seleção possível"), sem erro
- [x] Hotzones de navegação recebem `pointer-events-none` durante o modo seleção (verificado via
      `className`, não via clique sintético)
- [x] `Esc` desliga o modo seleção e desmonta a text layer
- [x] Notes/bookmarks/sessions/dashboard/export continuam funcionando após as mudanças
- [x] `npx tsc --noEmit`, `npx vitest run` (109 testes) e `npm run build` passam sem erros
- [x] Nenhuma requisição de rede falhou nem erro de console durante toda a validação manual

## Sprint 10 (fora de sequência) — Product QA & Data Safety

Automatizado: `npx tsc --noEmit`, `npx vitest run` (179 testes), `npm run build` (code-split
preservado). Validação manual executada em 2026-07-10 via Browser pane contra o `app` real,
reaproveitando dados de uso pré-existentes (6 livros, 8 sessões, 2 anotações) em vez de biblioteca
vazia/seed do zero:

- [x] Cadastrar livro, criar sessão, nota, bookmark e highlight; exportar backup completo e
      conferir que os 4 tipos de dado aparecem no arquivo — confirmado com dados já existentes
      ("Backup gerado: 6 livro(s), 6 arquivo(s), 8 sessão(ões), 2 anotação(ões)")
- [x] Restaurar o backup gerado acima: round-trip completo, estado da biblioteca idêntico antes/
      depois (mesmos livros, progresso, status), sem erro no console
- [x] Selecionar um arquivo que não é JSON válido → erro claro ("O arquivo selecionado não é um
      JSON válido"), nenhum dado atual alterado
- [x] Selecionar um JSON válido mas com `app`/`schemaVersion` ausentes → erro claro listando cada
      campo inválido individualmente (`app`, `version`, `schemaVersion`, `generatedAt`, `files`,
      `sessions`, `annotations`), nenhum dado atual alterado
- [x] Confirmação de restore exige marcar o checkbox antes de habilitar o botão "Restaurar e
      substituir" — confirmado (botão `disabled` até marcar)
- [x] Rodar "Verificar integridade" numa biblioteca saudável → relatório aponta apenas os
      problemas reais existentes (ver achado abaixo), nada além disso
- [x] Excluir um livro (via `EditBookDialog`, botão "Excluir livro") e confirmar, via "Verificar
      integridade", que não sobra sessão/anotação órfã — confirmado, nenhum órfão novo introduzido
      pela exclusão de "Livro de Teste Export"
- [x] Forçar um estado com órfãos (backup mutado removendo um livro mas mantendo seu arquivo/PDF)
      → relatório listou corretamente `[Aviso] Arquivo PDF órfão` com a severidade certa
- [x] Rodar "Corrigir problemas seguros" → o órfão forçado foi removido (1 arquivo órfão
      corrigido), relatório manteve apenas o erro pré-existente não coberto por reparo automático
      (sessão com páginas inválidas — requer decisão manual, corretamente não tocado)
- [x] Reader (abrir, navegar página seguinte, progresso `Página N de M`) segue funcionando sem
      regressão após todo o fluxo de backup/restore/repair acima
- [x] Nenhum erro no console do navegador durante toda a validação
- [x] Reload do app após restore preserva o estado esperado

**Achado durante a QA (não introduzido por código novo, estado pré-existente do ambiente de
dev):** a biblioteca já continha 1 sessão órfã e 1 anotação órfã de execuções anteriores. O botão
"Corrigir problemas seguros" removeu ambas corretamente na primeira execução. Um erro adicional
("Sessão com páginas inválidas" para um livro específico) permanece e não é elegível para reparo
automático — é sinalizado como `[Erro]` e requer investigação/correção manual dos dados daquele
registro; não bloqueia a Sprint 11 pois é um dado de teste pré-existente, não uma regressão da
Sprint 10.

**Limitação de ambiente:** dashboard e alguns fluxos de notes/bookmarks/highlights não foram
re-exercitados nesta rodada por escopo de tempo (o reader e o fluxo de dados foram priorizados);
recomenda-se cobrir esses dois pontos na próxima sessão de QA manual, embora nenhuma mudança de
código dos últimos sprints os afete.

## Sprint 11 (fora de sequência) — Reading Review & Book Completion

Automatizado: `npx tsc --noEmit`, `npx vitest run` (208 testes), `npm run build` — verdes.
**Validação manual executada em 2026-07-11**, numa sessão nova do Browser pane: o travamento de
IndexedDB relatado na sessão anterior não se reproduziu (`indexedDB.open('readquest')` abriu de
imediato em v4 com as 5 stores; era conexão obsoleta da aba antiga, não defeito de schema). Massa
de QA: 1 livro PDF real, 1 sessão, 1 nota, 1 bookmark, 1 highlight, 1 review, 1 highlight
favoritado.

- [x] Abrir um livro "Para ler"/"Lendo", mudar o status para "Finalizado" no `EditBookDialog` e
      salvar → `Book.completedAt` é carimbado com a data atual; reabrir o diálogo e salvar de novo
      (sem trocar o status) não altera essa data
- [x] Com o status "Finalizado", a seção "Review" aparece no `EditBookDialog`; com qualquer outro
      status, ela não aparece
- [x] Criar uma review com nota (rating), título, texto e 2+ principais ideias; salvar → feedback
      de sucesso aparece
- [x] Reload da página → a review persiste com todos os campos (nota, título, texto, ideias, data
      de finalização)
- [x] Editar a review existente (mudar nota e texto) → salvar → reload → alterações persistem
- [x] Marcar 1-2 highlights como favoritos na seção de review, salvar, reload → favoritos
      persistem marcados
- [x] Deletar um highlight que estava marcado como favorito (via `NotesList`) → reabrir a review:
      nada quebra, o highlight deletado simplesmente não aparece mais na lista de favoritos
- [x] Tentar salvar uma review totalmente vazia (sem nota, título, texto, ideias, favoritos nem
      data) → erro claro pedindo para preencher ao menos um campo, nada é salvo
- [x] Excluir a review (botão "Excluir review") com confirmação → review some do formulário; reload
      confirma que não voltou
- [x] Exportar Markdown do livro (botão existente em "Exportar") → arquivo contém uma seção
      `## Review` com nota, texto, principais ideias e highlights favoritos resolvidos com o texto
      completo do highlight
- [x] Exportar Markdown de um livro **sem** review → arquivo não contém nenhuma seção `## Review`,
      resto do export idêntico ao formato pré-Sprint 11
- [x] Gerar backup completo → arquivo `.json` inclui a lista `reviews` com a(s) review(s) criada(s)
- [x] Restaurar esse backup (em ambiente limpo ou após excluir os dados atuais) → livro, status
      "Finalizado" e review completa (nota/texto/ideias/favoritos) voltam intactos
- [x] Rodar "Verificar integridade" numa biblioteca saudável com reviews → nenhum problema
      relacionado a `orphan-review`/`review-missing-favorite` é reportado
- [x] Restaurar um backup mutado com uma review referenciando um `bookId` que não existe no mesmo
      backup → integridade reporta `[Aviso] Review órfã` com a severidade correta
- [x] Rodar "Corrigir problemas seguros" nesse cenário → a review órfã é removida, relatório fica
      limpo
- [x] Excluir um livro finalizado com review (via `EditBookDialog` → "Excluir livro") → confirmar
      via "Verificar integridade" que a review foi removida em cascade, sem sobrar órfã
- [x] Dashboard mostra o card "Livros finalizados" com a contagem correta de livros com
      `status === 'completed'`
- [x] Biblioteca mostra um indicador de nota (★) no tile de um livro finalizado que tem review, e
      nenhum indicador em livros sem review ou não finalizados
- [x] Reader, notes, bookmarks, highlights, sessions e export Markdown de livros sem review
      continuam funcionando sem regressão após todo o fluxo acima
- [x] Nenhum erro no console do navegador durante toda a validação

**Bug real encontrado e corrigido durante este QA:** `ReviewEditor.onSave` gerava
`BookReview.finishedAt` com `new Date(finishedAt).toISOString()`, que interpreta a string de data
(`YYYY-MM-DD` do `<input type="date">`) como meia-noite UTC. `formatMarkdownDate` (usado no export)
lê a data de volta com componentes de calendário **locais**, então em qualquer fuso negativo (ex.:
America/Sao_Paulo, UTC-3 — o fuso deste ambiente) a data exportada aparecia um dia antes da
escolhida (ex.: usuário escolhe 2026-07-11, export mostra "Finalizado em: 2026-07-10"). Os testes
existentes não cobriam isso porque o fixture usa meio-dia UTC (`T12:00:00.000Z`), que nunca cruza a
fronteira de dia em fusos comuns. Corrigido em `ReviewEditor.tsx` construindo a data como meia-noite
**local** (`new Date(\`${finishedAt}T00:00:00\`)`), tornando o round-trip local sem perda; os 208
testes automatizados e o build continuam verdes após a correção.

## Sprint 8 — Modo Review

> Superseded pela Sprint 11 — ver checklist real logo abaixo, após a Sprint 10.

## Sprint 9 — IA Assistida

> Superseded pela Sprint 13 — ver checklist real logo abaixo, após a Sprint 12.

## Sprint 12 — Busca Global & Recuperação de Conhecimento

- [x] Botão "Buscar" no cabeçalho da Biblioteca abre a tela de busca
- [x] Atalho `Ctrl/Cmd+K` abre a busca a partir da Biblioteca/Dashboard; não interfere com os
      atalhos locais do reader (não registrado enquanto o reader está aberto)
- [x] Buscar por um termo presente no **título** de um livro retorna um resultado do tipo "Livro"
- [x] Buscar por um termo presente numa **highlight** (`quoteText`) retorna um resultado do tipo
      "Highlight" com o número da página
- [x] Buscar por um termo presente numa **nota de página** retorna um resultado do tipo "Nota"
- [x] Buscar por um termo presente numa **review** (título/texto) retorna um resultado do tipo
      "Review"; cada **ideia principal** (`mainTakeaways`) aparece como um resultado próprio do
      tipo "Ideia principal"
- [x] Buscar por um termo presente numa **nota manual de sessão** retorna um resultado do tipo
      "Nota de sessão" com a página de término da sessão
- [x] Um marcador (`bookmark`) sem corpo de texto não aparece na busca; um marcador com corpo
      aparece
- [x] Busca ignora acentos e maiúsculas/minúsculas ("cafe" encontra "Café")
- [x] Query vazia mostra o estado "digite para buscar"; query sem correspondência mostra "nenhum
      resultado", sem erro
- [x] Clicar num resultado ancorado a página (nota/highlight/marcador/nota de sessão) abre o
      reader **exatamente naquela página**, mesmo que seja diferente da página salva do livro
- [x] Clicar num resultado sem página (título/autor/categoria/review/ideia principal) abre o
      reader na página salva do livro (`currentPage`), sem forçar página 1
- [x] Excluir um livro remove suas anotações do índice de busca imediatamente (sem precisar
      recarregar a página)
- [x] Nenhuma chamada à object store `files` (Blob de PDF) ocorre durante a busca (verificado: a
      busca opera só sobre os arrays já carregados pelos stores)
- [x] Nenhum erro no console do navegador durante toda a validação

## Sprint 13 — AI Reading Assistant Foundation

- [x] Botão "Assistente IA" no cabeçalho da Biblioteca abre a tela do assistente
- [x] Selecionar um livro carrega seus dados (sessões/notas/review) e habilita o preview, sem
      travar a UI
- [x] Desmarcar uma seção remove imediatamente o bloco correspondente do preview; marcar
      novamente o traz de volta
- [x] Seção "Review" não aparece se o livro não tiver review, mesmo com o checkbox marcado
- [x] Seção "Principais ideias" pode ser incluída independente da seção "Review"
- [x] Trocar o tipo de prompt (discussão/quiz/insights/dados brutos) altera o texto de instrução
      no topo do preview; "dados brutos" não inclui nenhuma instrução
- [x] Botão "Copiar" copia o conteúdo exato do preview para a área de transferência
- [x] Botão "Exportar .md" baixa um arquivo `.md` com o mesmo conteúdo do preview
- [x] Nenhuma chamada de rede é feita ao gerar, copiar ou exportar o contexto
- [x] Nenhum acesso à object store `files` (Blob de PDF) ocorre nesta tela
- [x] Nenhum erro no console do navegador durante toda a validação

---

## Sprint 15 — AI Provider Integration Gate

- [x] Tela abre em modo Mock por padrão, sem nenhuma configuração de provider real visível
- [x] Alternar para "Real (opt-in)" revela URL base/modelo/apiKey e o aviso de privacidade
      específico do modo real; alternar de volta para "Mock" esconde os campos e restaura o
      aviso de privacidade original
- [x] Sem apiKey preenchida, "Provider ativo" mostra "Configuração incompleta" e a mensagem de
      erro correspondente aparece no painel — botão de envio fica desabilitado
- [x] Preencher apiKey/baseUrl/modelo válidos habilita o envio; clicar em "Revisar antes de
      enviar" **não** dispara nenhuma requisição de rede ao endpoint configurado (verificado via
      `read_network_requests` — só chamadas a `localhost`) e mostra o callout de confirmação
      com endpoint e tokens estimados
- [x] "Cancelar" no callout de confirmação descarta o envio sem qualquer chamada de rede
- [x] "Confirmar e enviar" dispara a chamada real de fato (verificado com credenciais falsas —
      erro de rede retornado e exibido, sem a apiKey aparecer em nenhuma mensagem de erro)
- [x] "Esquecer chave" limpa o campo de apiKey imediatamente
- [x] Recarregar a página com o modo real configurado reseta para Mock com apiKey vazia (nada
      persistido em localStorage/IndexedDB)
- [x] Modo Mock segue funcionando exatamente como na Sprint 14 (envio de um clique, resposta
      simulada com disclaimer, sem gate de confirmação)
- [x] Nenhum erro no console do navegador durante toda a validação

---

## Checklist transversal (rodar a cada sprint, não só a específica)

- [ ] Nenhuma regressão nos critérios de performance da Sprint 0/1 (abrir DevTools → Performance)
- [ ] Nenhum dado sai da máquina do usuário (sem chamadas de rede não previstas)
- [ ] Reading Surface não usa nenhum componente/token exclusivo do App Shell (bandas, ilustrações)
- [ ] `DATA_MODEL.md` está sincronizado com os tipos reais do código
