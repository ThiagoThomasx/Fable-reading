# Limitações conhecidas — ReadQuest

Documento vivo. Lista as limitações conhecidas do produto no baseline `v0.1.0` (RC1). Não são
bugs escondidos — são escolhas de escopo ou consequências diretas da arquitetura local-first,
documentadas para não serem redescobertas a cada sprint.

## Armazenamento e dados

- **PDFs ficam só no IndexedDB do navegador.** Não há backend, não há sync entre dispositivos —
  o livro só existe no navegador/máquina onde foi importado. Trocar de navegador ou de máquina
  exige backup manual (ver "Dados e segurança" na Biblioteca) e restore no destino.
- **Backups com PDFs grandes geram um JSON grande.** O backup completo (`lib/backup.ts`)
  serializa cada Blob de PDF como Base64 dentro do mesmo arquivo `.json` — um PDF de 50MB vira
  ~67MB de texto Base64 no backup. Bibliotecas com muitos livros grandes geram backups de
  centenas de MB, sem streaming nem compressão.
- **Sem sync, sem nuvem, sem login.** Local-first é uma decisão de arquitetura desta fase, não um
  detalhe temporário — não há conta de usuário nem qualquer envio de dado a servidor.

## Highlights e text layer

- **Highlights dependem de extração de texto por página, não por documento.** Em PDFs
  "escaneados", algumas páginas têm texto digital embutido (OCR prévio) e outras não — a
  extratibilidade varia página a página dentro do mesmo arquivo (achado do spike, ver
  `TEXT_LAYER_SPIKE.md`). Páginas sem texto extraível não permitem seleção/highlight.
- **Sem OCR.** O ReadQuest não roda OCR em páginas sem texto embutido — está fora do escopo desta
  fase (ver `READQUEST_PLANO_TECNICO.md`, seção "Fora do Escopo Inicial").
- **Sem highlight multi-página.** Um highlight fica contido a uma única página; selecionar texto
  que atravessa a quebra de página não é suportado nesta versão.
- **Rotação de página não validada.** O comportamento de highlights/seleção de texto em páginas
  com rotação não-padrão (90°/180°/270°) não foi testado.
- **Mobile tem tratamento limitado de seleção de texto.** O modo seleção foi validado em
  desktop; toque/seleção em telas pequenas não recebeu ajuste dedicado.

## IA

- **IA real é opt-in, com chave inserida manualmente e mantida só em memória.** Não há
  persistência de API key (nem `localStorage` nem IndexedDB) — a chave precisa ser reinserida a
  cada sessão do navegador. Isso é uma decisão de segurança deliberada (ver Sprint 15), não uma
  limitação a corrigir.
- **Conversas do chat de IA não são persistidas.** O histórico vive só no estado do componente e
  some ao sair da tela ou recarregar a página.
- **Retrieval é por palavra-chave, não por embeddings.** O contexto recuperado para o chat reusa
  o índice de busca textual (Sprint 12), não uma busca semântica vetorial — perguntas
  parafraseadas sem sobreposição de palavras com o conteúdo podem não recuperar o trecho certo.
- **PDF inteiro nunca é enviado à IA.** Só notas, highlights, metadados e reviews já digitados
  pelo usuário entram no contexto — texto corrido do PDF não é extraído para esse fim.

## Performance

- **Abertura de PDFs de imagem/scan pesados ainda depende do snapshot da última página lida**
  para parecer instantânea — a primeira abertura de uma página nunca visitada antes em um PDF
  de imagem pode levar 1–2s (custo fixo de decode da imagem embutida, não de rasterização; ver
  baseline do Sprint 0 em `ROADMAP_SPRINTS.md`).
