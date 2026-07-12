/**
 * Chat de IA — spike técnico (Sprint 14) + portão de integração real (Sprint 15, App
 * Shell). Retrieval é busca local por palavra-chave (lib/ai-chat-context.ts,
 * reaproveitando o índice da Sprint 12). Por padrão a resposta vem do AIProvider mock
 * (lib/mock-ai-provider.ts) — nenhuma chamada de rede é feita. Um provider real
 * (lib/openai-compatible-provider.ts) pode ser configurado explicitamente pelo usuário
 * (useAiSettingsStore, apiKey só em memória de sessão, nunca persistida); toda chamada
 * real exige confirmação manual explícita antes de sair do navegador (ver
 * `pendingRealConfirm`). Não acessa a store 'files' (nunca carrega o Blob do PDF) e não
 * persiste a conversa: ela some ao navegar para outra tela (estado só de componente).
 */
import { useEffect, useMemo, useState } from 'react';
import { useBookStore } from '../../stores/useBookStore';
import { useNoteStore } from '../../stores/useNoteStore';
import { useReviewStore } from '../../stores/useReviewStore';
import { useSessionStore } from '../../stores/useSessionStore';
import { useUIStore } from '../../stores/useUIStore';
import { useAiSettingsStore } from '../../stores/useAiSettingsStore';
import { buildAiChatContext, AI_CHAT_SYSTEM_PROMPT } from '../../lib/ai-chat-context';
import { createMockAiProvider } from '../../lib/mock-ai-provider';
import { createOpenAiCompatibleProvider } from '../../lib/openai-compatible-provider';
import { estimateContextSize } from '../../lib/token-estimate';
import type { AIProvider, AIProviderMessage, AIProviderResponse } from '../../lib/ai-provider';

type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sourcesCount?: number;
  usage?: AIProviderResponse['usage'];
};

type PendingRealSend = {
  trimmedQuestion: string;
  finalUserMessage: string;
};

// Único provider mock desta app — sempre disponível, mesmo quando o modo real está
// selecionado mas mal configurado (ver `activeProvider`).
const mockProvider = createMockAiProvider();

export function AiChat() {
  const books = useBookStore((state) => state.books);
  const isBooksLoaded = useBookStore((state) => state.isLoaded);
  const loadBooks = useBookStore((state) => state.load);
  const allAnnotations = useNoteStore((state) => state.allAnnotations);
  const isNotesLoaded = useNoteStore((state) => state.isAllLoaded);
  const loadAllNotes = useNoteStore((state) => state.loadAll);
  const allReviews = useReviewStore((state) => state.allReviews);
  const isReviewsLoaded = useReviewStore((state) => state.isAllLoaded);
  const loadAllReviews = useReviewStore((state) => state.loadAll);
  const allSessions = useSessionStore((state) => state.allSessions);
  const isSessionsLoaded = useSessionStore((state) => state.isAllLoaded);
  const loadAllSessions = useSessionStore((state) => state.loadAll);
  const openLibrary = useUIStore((state) => state.openLibrary);

  const aiMode = useAiSettingsStore((state) => state.mode);
  const aiApiKey = useAiSettingsStore((state) => state.apiKey);
  const aiBaseUrl = useAiSettingsStore((state) => state.baseUrl);
  const aiModel = useAiSettingsStore((state) => state.model);
  const setAiMode = useAiSettingsStore((state) => state.setMode);
  const setAiApiKey = useAiSettingsStore((state) => state.setApiKey);
  const setAiBaseUrl = useAiSettingsStore((state) => state.setBaseUrl);
  const setAiModel = useAiSettingsStore((state) => state.setModel);
  const clearAiApiKey = useAiSettingsStore((state) => state.clearApiKey);

  const [selectedBookId, setSelectedBookId] = useState('');
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [pendingRealSend, setPendingRealSend] = useState<PendingRealSend | null>(null);

  // Provider real só é construído quando o modo 'real' está ativo e a config está
  // completa (apiKey/baseUrl/model). Se a config estiver incompleta, `activeProvider`
  // fica null e a UI bloqueia o envio com uma mensagem explicativa em vez de tentar a
  // chamada e falhar depois.
  const { activeProvider, activeProviderError } = useMemo((): {
    activeProvider: AIProvider | null;
    activeProviderError: string | null;
  } => {
    if (aiMode === 'mock') return { activeProvider: mockProvider, activeProviderError: null };
    try {
      return {
        activeProvider: createOpenAiCompatibleProvider({ apiKey: aiApiKey, baseUrl: aiBaseUrl, model: aiModel }),
        activeProviderError: null,
      };
    } catch (error) {
      return {
        activeProvider: null,
        activeProviderError: error instanceof Error ? error.message : 'Configuração do provider real inválida.',
      };
    }
  }, [aiMode, aiApiKey, aiBaseUrl, aiModel]);

  useEffect(() => {
    void loadBooks();
    void loadAllNotes();
    void loadAllReviews();
    void loadAllSessions();
  }, [loadBooks, loadAllNotes, loadAllReviews, loadAllSessions]);

  const isReady = isBooksLoaded && isNotesLoaded && isReviewsLoaded && isSessionsLoaded;

  // Contexto recuperado ao vivo, antes de enviar — permite ao usuário conferir exatamente
  // o que seria mandado ao provider (mock ou, no futuro, real) antes de perguntar qualquer coisa.
  const liveContext = useMemo(
    () =>
      buildAiChatContext({
        query: question,
        books,
        annotations: allAnnotations,
        reviews: allReviews,
        sessions: allSessions,
        bookId: selectedBookId || undefined,
      }),
    [question, books, allAnnotations, allReviews, allSessions, selectedBookId],
  );

  const contextSize = useMemo(() => estimateContextSize(liveContext.contextText), [liveContext.contextText]);

  const fullPromptPreview = useMemo(() => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return '';
    return liveContext.contextText
      ? `${liveContext.contextText}\n\n### Pergunta\n${trimmedQuestion}`
      : trimmedQuestion;
  }, [liveContext.contextText, question]);

  const executeSend = async (trimmedQuestion: string, finalUserMessage: string, providerToUse: AIProvider) => {
    const userTurn: ChatTurn = { id: crypto.randomUUID(), role: 'user', content: trimmedQuestion };
    const history: AIProviderMessage[] = turns.map((turn) => ({ role: turn.role, content: turn.content }));

    setTurns((current) => [...current, userTurn]);
    setQuestion('');
    setSendError(null);
    setIsSending(true);

    try {
      const response = await providerToUse.complete({
        messages: [
          { role: 'system', content: AI_CHAT_SYSTEM_PROMPT },
          ...history,
          { role: 'user', content: finalUserMessage },
        ],
      });
      const assistantTurn: ChatTurn = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        sourcesCount: liveContext.sources.length,
        usage: response.usage,
      };
      setTurns((current) => [...current, assistantTurn]);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Falha ao gerar resposta.');
    } finally {
      setIsSending(false);
    }
  };

  // Modo mock: envia direto (sem risco de privacidade). Modo real: exige uma segunda
  // confirmação explícita (`confirmRealSend`) antes de qualquer dado sair do navegador —
  // nunca dispara a chamada no mesmo clique que gerou a pergunta.
  const requestSend = () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isSending || !activeProvider) return;
    const finalUserMessage = fullPromptPreview || trimmedQuestion;

    if (aiMode === 'real') {
      setPendingRealSend({ trimmedQuestion, finalUserMessage });
      return;
    }
    void executeSend(trimmedQuestion, finalUserMessage, activeProvider);
  };

  const confirmRealSend = () => {
    if (!pendingRealSend || !activeProvider) return;
    const { trimmedQuestion, finalUserMessage } = pendingRealSend;
    setPendingRealSend(null);
    void executeSend(trimmedQuestion, finalUserMessage, activeProvider);
  };

  const cancelRealSend = () => setPendingRealSend(null);

  const copyText = async (text: string, feedback: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(feedback);
    } catch {
      setCopyFeedback('Não foi possível copiar automaticamente — selecione e copie o texto manualmente.');
    }
  };

  return (
    <div className="min-h-screen bg-pure-white">
      <section className="bg-fable-forest px-6 py-16 md:px-12">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={openLibrary}
            className="mb-6 text-sm font-medium text-pure-white/80 underline underline-offset-2 hover:text-pure-white"
          >
            ← Voltar à biblioteca
          </button>
          <h1 className="font-display text-5xl leading-[0.94] text-pure-white md:text-6xl md:leading-[0.9]">
            Chat com sua
            <br />
            biblioteca.
          </h1>
          <p className="mt-5 max-w-lg text-pure-white/80">
            Modo mock por padrão (sem rede). Um provider real é opcional, configurado por
            você, e nunca é chamado sem confirmação manual explícita.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 pt-8 md:px-12">
        {aiMode === 'mock' ? (
          <div className="rounded-xl border border-fable-forest/25 bg-fog p-4 text-sm text-ink">
            <p className="font-medium">Aviso de privacidade e escopo</p>
            <p className="mt-1 text-graphite">
              Este chat é 100% local: nenhum dado (notas, highlights, reviews, sessões) é
              enviado a nenhum servidor. A "resposta da IA" é simulada — não há chamada de
              rede neste modo. O texto do PDF não é lido nem indexado; apenas metadados e
              anotações que você já criou no ReadQuest.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-600/40 bg-amber-50 p-4 text-sm text-ink">
            <p className="font-medium">Aviso de privacidade — modo real ativo</p>
            <p className="mt-1 text-graphite">
              O contexto recuperado (notas, highlights, reviews, sessões correspondentes à
              sua pergunta) e a pergunta serão enviados ao endpoint configurado abaixo.
              Nenhum envio acontece sem uma confirmação manual explícita sua, e o texto do
              PDF nunca é lido nem enviado. Sua API key vive só em memória desta sessão do
              navegador — não é salva em disco e some ao recarregar a página.
            </p>
          </div>
        )}
      </div>

      <section className="bg-paper-cream px-6 py-8 md:px-12">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[minmax(0,260px)_1fr]">
          <div className="space-y-6">
            <div>
              <label htmlFor="ai-chat-book-select" className="mb-2 block text-sm font-medium text-ink">
                Escopo
              </label>
              {!isBooksLoaded ? (
                <p className="text-sm text-graphite">Carregando biblioteca…</p>
              ) : (
                <select
                  id="ai-chat-book-select"
                  value={selectedBookId}
                  onChange={(event) => setSelectedBookId(event.target.value)}
                  className="w-full rounded-md border border-ink/15 bg-pure-white px-3 py-2 text-sm text-ink outline-none"
                >
                  <option value="">Toda a biblioteca</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="rounded-lg border border-ink/10 bg-pure-white p-3 text-xs text-graphite">
              <p className="font-medium text-ink">Provider ativo</p>
              <p className="mt-1">{activeProvider?.name ?? 'Configuração incompleta'}</p>
              <p className="mt-2 font-medium text-ink">Retrieval</p>
              <p className="mt-1">
                Busca local por palavra-chave (Sprint 12) — não é busca semântica nem
                embeddings.
              </p>
            </div>

            <fieldset className="space-y-3 rounded-lg border border-ink/10 bg-pure-white p-3 text-xs">
              <legend className="px-1 text-sm font-medium text-ink">Configuração do provider</legend>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAiMode('mock')}
                  className={`flex-1 rounded-pill px-3 py-1.5 font-medium ${
                    aiMode === 'mock' ? 'bg-fable-forest text-pure-white' : 'border border-ink/15 text-ink'
                  }`}
                >
                  Mock (padrão)
                </button>
                <button
                  type="button"
                  onClick={() => setAiMode('real')}
                  className={`flex-1 rounded-pill px-3 py-1.5 font-medium ${
                    aiMode === 'real' ? 'bg-fable-forest text-pure-white' : 'border border-ink/15 text-ink'
                  }`}
                >
                  Real (opt-in)
                </button>
              </div>

              {aiMode === 'real' && (
                <div className="space-y-2 pt-1">
                  <label className="block">
                    <span className="mb-1 block font-medium text-ink">URL base (OpenAI-compatible)</span>
                    <input
                      type="text"
                      value={aiBaseUrl}
                      onChange={(event) => setAiBaseUrl(event.target.value)}
                      placeholder="https://api.openai.com/v1"
                      className="w-full rounded-md border border-ink/15 bg-paper-cream px-2 py-1.5 text-ink outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-medium text-ink">Modelo</span>
                    <input
                      type="text"
                      value={aiModel}
                      onChange={(event) => setAiModel(event.target.value)}
                      placeholder="gpt-4o-mini"
                      className="w-full rounded-md border border-ink/15 bg-paper-cream px-2 py-1.5 text-ink outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-medium text-ink">API key (só nesta sessão)</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={aiApiKey}
                      onChange={(event) => setAiApiKey(event.target.value)}
                      placeholder="sk-..."
                      className="w-full rounded-md border border-ink/15 bg-paper-cream px-2 py-1.5 text-ink outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={clearAiApiKey}
                    disabled={!aiApiKey}
                    className="rounded-pill border border-ink/15 px-3 py-1 font-medium text-ink disabled:opacity-50"
                  >
                    Esquecer chave
                  </button>
                  <p className="text-graphite">
                    Nunca salva em localStorage/IndexedDB — some ao recarregar a página.
                  </p>
                  {activeProviderError && <p className="text-red-700">{activeProviderError}</p>}
                </div>
              )}
            </fieldset>
          </div>

          <div className="space-y-6">
            {!isReady && <p className="text-graphite">Carregando dados locais…</p>}

            {isReady && (
              <>
                <div className="min-h-[10rem] space-y-3 rounded-xl border border-ink/10 bg-pure-white p-4">
                  {turns.length === 0 && (
                    <p className="text-sm text-graphite">
                      Faça uma pergunta sobre suas notas, highlights, reviews ou sessões.{' '}
                      {aiMode === 'mock'
                        ? 'A resposta abaixo será sempre simulada (mock).'
                        : 'Modo real ativo — você confirmará antes de qualquer envio.'}
                    </p>
                  )}
                  {turns.map((turn) => (
                    <div
                      key={turn.id}
                      className={
                        turn.role === 'user'
                          ? 'ml-auto max-w-[85%] rounded-xl bg-fable-forest px-4 py-2 text-sm text-pure-white'
                          : 'mr-auto max-w-[85%] rounded-xl border border-ink/10 bg-fog px-4 py-2 text-sm text-ink'
                      }
                    >
                      <p className="whitespace-pre-wrap">{turn.content}</p>
                      {turn.role === 'assistant' && (
                        <p className="mt-2 text-[11px] text-graphite">
                          {turn.sourcesCount ?? 0} fonte(s) local(is) · ~{turn.usage?.totalTokens ?? 0}{' '}
                          tokens estimados
                        </p>
                      )}
                    </div>
                  ))}
                  {isSending && (
                    <p className="text-sm text-graphite">
                      {aiMode === 'mock' ? 'Gerando resposta simulada…' : 'Aguardando resposta do provider real…'}
                    </p>
                  )}
                  {sendError && <p className="text-sm text-red-700">{sendError}</p>}
                </div>

                <div>
                  <label htmlFor="ai-chat-input" className="mb-2 block text-sm font-medium text-ink">
                    Sua pergunta
                  </label>
                  <textarea
                    id="ai-chat-input"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    rows={3}
                    placeholder="Ex: o que eu anotei sobre o segundo capítulo?"
                    className="w-full resize-none rounded-md border border-ink/15 bg-pure-white p-3 text-sm text-ink outline-none"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={requestSend}
                      disabled={!question.trim() || isSending || !activeProvider || !!pendingRealSend}
                      className="rounded-pill bg-fable-forest px-5 py-2 text-sm font-medium text-pure-white shadow-lift transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      {isSending ? 'Enviando…' : aiMode === 'mock' ? 'Perguntar (mock)' : 'Revisar antes de enviar'}
                    </button>
                    <span className="text-xs text-graphite">
                      Contexto atual: {contextSize.chars} caract. · ~{contextSize.approxTokens} tokens
                      estimados
                    </span>
                  </div>

                  {pendingRealSend && (
                    <div className="mt-3 rounded-lg border border-amber-600/50 bg-amber-50 p-3 text-xs text-ink">
                      <p className="font-medium">Confirmar envio ao provider real</p>
                      <p className="mt-1 text-graphite">
                        Isso enviará o contexto e a pergunta acima para{' '}
                        <span className="font-medium">{activeProvider?.name}</span> (~
                        {contextSize.approxTokens} tokens estimados). Revise o painel de contexto abaixo
                        antes de confirmar.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={confirmRealSend}
                          className="rounded-pill bg-fable-forest px-4 py-1.5 font-medium text-pure-white"
                        >
                          Confirmar e enviar
                        </button>
                        <button
                          type="button"
                          onClick={cancelRealSend}
                          className="rounded-pill border border-ink/15 px-4 py-1.5 font-medium text-ink"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-ink/10 bg-pure-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">
                      Contexto que seria enviado (visualize antes de perguntar)
                    </p>
                  </div>
                  <textarea
                    readOnly
                    value={liveContext.contextText || 'Digite uma pergunta para ver o contexto recuperado aqui.'}
                    aria-label="Prévia do contexto recuperado"
                    className="mt-2 h-40 w-full resize-none rounded-md border border-ink/15 bg-fog p-3 font-mono text-xs text-ink outline-none"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void copyText(liveContext.contextText, 'Contexto copiado para a área de transferência.')}
                      disabled={!liveContext.contextText}
                      className="rounded-pill border border-ink/15 bg-pure-white px-4 py-1.5 text-xs font-medium text-ink transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      Copiar contexto
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyText(fullPromptPreview, 'Prompt completo copiado para a área de transferência.')}
                      disabled={!fullPromptPreview}
                      className="rounded-pill border border-ink/15 bg-pure-white px-4 py-1.5 text-xs font-medium text-ink transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      Copiar prompt completo
                    </button>
                    {copyFeedback && <span className="text-xs text-graphite">{copyFeedback}</span>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
