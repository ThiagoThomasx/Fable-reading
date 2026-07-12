# Instruções para o Claude Code — ReadQuest (Fable Reading)

Este arquivo orienta como trabalhar neste repositório. Leia também `READQUEST_PLANO_TECNICO.md`,
`ARCHITECTURE.md` e `DATA_MODEL.md` antes de gerar código novo.

## Identidade do produto — leia antes de tudo

O ReadQuest é, **antes de qualquer coisa, um leitor de PDF que substitui o Kindle**. Esse é o
core do produto. Biblioteca, sessões, notas, dashboard, review e IA são camadas de valor
agregado — importantes, mas secundárias. Nunca priorize uma dessas camadas em detrimento da
qualidade e performance da experiência de leitura (Reading Surface).

Se em algum momento uma decisão técnica colocar em conflito "deixar o reader mais rápido/simples"
vs "adicionar uma feature de tracker", a resposta correta é proteger o reader.

## Regras de arquitetura (não negociáveis)

1. **Local-first, sem backend nesta fase.** Toda persistência é via IndexedDB no navegador.
   Não introduza chamadas de rede, autenticação ou sync sem que isso seja pedido explicitamente.
2. **Duas object stores separadas no IndexedDB:** `files` (Blobs de PDF, grandes, lidos raramente)
   e `books` (metadata, pequena, lida com frequência). Nunca misture as duas. Atualizações de
   progresso (`currentPage`) tocam **apenas** `books`, nunca reescrevem o Blob do PDF.
3. **Renderização de PDF é página-única**, não scroll contínuo. Essa decisão já foi tomada e
   validada — não proponha scroll contínuo sem justificativa técnica forte.
4. **Capa de livro tem duas fontes possíveis, à escolha do usuário:** extração automática da
   primeira página (como thumbnail ~300px) ou upload manual. Nunca force apenas uma opção.
5. **Duas camadas visuais distintas** (ver `DESIGN - Fable.md` e `ARCHITECTURE.md`):
   - **App Shell** (biblioteca, dashboard, onboarding): pode usar a linguagem editorial completa
     do Fable — bandas full-bleed, ilustrações, headlines grandes, pill buttons.
   - **Reading Surface** (tela de leitura): minimalista, fundo `--color-paper-cream` (tema padrão)
     ou tema dark alternativo, texto `--color-ink`. Nunca aplique bandas coloridas, ilustrações ou
     headlines de display dentro da Reading Surface — isso quebra o foco de leitura.

## Convenções de código

- TypeScript estrito. Tipos centrais vivem em `DATA_MODEL.md` — mantenha o código sincronizado
  com esse documento; se um tipo mudar, atualize o `.md` também.
- Estado global via Zustand, uma store por entidade (`useBookStore`, `useSessionStore`,
  `useNoteStore`, `useReviewStore`, `useUIStore`). Sem Redux, sem Context API para estado global.
- Sem MUI. Componentes de UI usam Tailwind + tokens do Fable como CSS custom properties. Para
  componentes headless complexos (dropdowns, dialogs), usar shadcn/ui — nunca uma lib com sistema
  visual próprio que conflite com os tokens do Fable.
- Fonte de display: `Fraunces` (substituto open-source de Heldane Display, já definido no design
  doc). Fonte de corpo/UI: `Inter`.
- Funções de serialização (export Markdown, prompts de IA) devem ser puras e reutilizáveis —
  não acopladas a componentes React.

## Performance — critérios que não podem regredir

- Abertura da primeira página de um PDF: **< 500ms** para arquivos de até 50MB.
- Navegação entre páginas já em cache: **< 100ms**.
- Nunca bloquear a UI principal durante render de PDF — sempre via Web Worker isolado por
  documento.
- Página seguinte (N+1) deve ser pré-carregada em background enquanto o usuário lê a página N.
- Cache LRU em memória das últimas 5–10 páginas renderizadas.
- `PdfReader` deve ser carregado via `React.lazy()`, fora do bundle inicial da Biblioteca.

Se uma mudança de código arriscar esses números, meça antes de mergear e sinalize no PR/commit.

## Ordem de execução

Siga `ROADMAP_SPRINTS.md`. Regras gerais:

- **Não pule o Sprint 0 (spike de PDF.js).** Ele valida os critérios de performance acima antes
  de qualquer UI ser construída.
- Não implemente features de sprints futuros (ex: notas, IA) antes das sprints anteriores
  estarem com os critérios de aceite cumpridos.
- Ao concluir uma sprint, marque os itens correspondentes em `ROADMAP_SPRINTS.md` e registre a
  entrada em `CHANGELOG.md`.
- Rode os itens de `QA_CHECKLIST.md` da sprint atual antes de considerá-la concluída.

## O que evitar

- Não introduzir MUI, Chakra, Bootstrap ou qualquer lib com sistema visual próprio.
- Não implementar OCR, edição de PDF, highlight nativo, login, sync em nuvem ou features de IA
  via API paga sem pedido explícito — estão fora do escopo inicial (ver
  `READQUEST_PLANO_TECNICO.md`, seção "Fora do Escopo Inicial").
- Não aplicar o design system de landing (bandas, ilustrações) dentro da Reading Surface.
- Não guardar a página do PDF em resolução real como capa — sempre gerar thumbnail pequena.
