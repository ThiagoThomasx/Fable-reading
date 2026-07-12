/**
 * "Dados e segurança" — backup completo, restauração, verificação de
 * integridade e limpeza segura de órfãos (Sprint 10). Vive no App Shell, fora
 * da Reading Surface. Nunca acessa o Blob do PDF diretamente — delega a
 * backup-io/restore-io/integrity-io/repair.
 */
import { useRef, useState } from 'react';
import { DB_VERSION } from '../../db/db';
import { createFullBackup } from '../../lib/backup-io';
import { serializeBackup, backupFilename } from '../../lib/backup';
import { downloadBackupFile } from '../../lib/download-backup';
import { parseBackupJson, validateBackup } from '../../lib/restore';
import { restoreFullBackup } from '../../lib/restore-io';
import { loadLibrarySnapshot } from '../../lib/integrity-io';
import { validateLibraryIntegrity, type IntegrityReport } from '../../lib/data-integrity';
import { repairLibrary, type RepairSummary } from '../../lib/repair';
import type { ReadQuestBackup } from '../../types/backup';

type DataSafetyDialogProps = {
  onClose: () => void;
};

type PendingRestore = {
  backup: ReadQuestBackup;
  bookCount: number;
  sessionCount: number;
  annotationCount: number;
  fileCount: number;
  reviewCount: number;
};

const SEVERITY_LABELS: Record<'warning' | 'error', string> = {
  warning: 'Aviso',
  error: 'Erro',
};

export function DataSafetyDialog({ onClose }: DataSafetyDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const [restoreErrors, setRestoreErrors] = useState<string[] | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreDone, setRestoreDone] = useState(false);

  const [isChecking, setIsChecking] = useState(false);
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairSummary, setRepairSummary] = useState<RepairSummary | null>(null);

  const onExportBackup = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    setExportFeedback(null);
    try {
      const backup = await createFullBackup();
      const json = serializeBackup(backup);
      downloadBackupFile(backupFilename(backup.generatedAt), json);
      setExportFeedback(
        `Backup gerado: ${backup.books.length} livro(s), ${backup.files.length} arquivo(s), ${backup.sessions.length} sessão(ões), ${backup.annotations.length} anotação(ões), ${backup.reviews.length} review(s).`,
      );
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Falha ao gerar o backup.');
    } finally {
      setIsExporting(false);
    }
  };

  const onFileChosen = async (files: FileList | null) => {
    const file = files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setRestoreErrors(null);
    setPendingRestore(null);
    setConfirmChecked(false);
    setRestoreDone(false);

    const text = await file.text();
    const parsed = parseBackupJson(text);
    if (!parsed.ok) {
      setRestoreErrors([parsed.error]);
      return;
    }
    const validated = validateBackup(parsed.data);
    if (!validated.valid) {
      setRestoreErrors(validated.errors);
      return;
    }

    setPendingRestore({
      backup: validated.backup,
      bookCount: validated.backup.books.length,
      sessionCount: validated.backup.sessions.length,
      annotationCount: validated.backup.annotations.length,
      fileCount: validated.backup.files.length,
      reviewCount: validated.backup.reviews.length,
    });
  };

  const onConfirmRestore = async () => {
    if (!pendingRestore || !confirmChecked || isRestoring) return;
    setIsRestoring(true);
    setRestoreErrors(null);
    try {
      await restoreFullBackup(pendingRestore.backup);
      setRestoreDone(true);
      setPendingRestore(null);
      // Recarrega a página: garante que todas as stores Zustand releiam o
      // IndexedDB do zero, sem risco de estado parcial/inconsistente em memória.
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setRestoreErrors([error instanceof Error ? error.message : 'Falha ao restaurar o backup.']);
    } finally {
      setIsRestoring(false);
    }
  };

  const onCheckIntegrity = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setCheckError(null);
    setRepairSummary(null);
    try {
      const snapshot = await loadLibrarySnapshot();
      setReport(validateLibraryIntegrity(snapshot));
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : 'Falha ao verificar integridade.');
    } finally {
      setIsChecking(false);
    }
  };

  const onRepair = async () => {
    if (isRepairing) return;
    setIsRepairing(true);
    setCheckError(null);
    try {
      const snapshot = await loadLibrarySnapshot();
      const summary = await repairLibrary(snapshot);
      setRepairSummary(summary);
      const freshSnapshot = await loadLibrarySnapshot();
      setReport(validateLibraryIntegrity(freshSnapshot));
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : 'Falha ao reparar a biblioteca.');
    } finally {
      setIsRepairing(false);
    }
  };

  const hasRepairableIssues = (report?.issues.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-paper-cream p-6 shadow-lift">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl text-ink">Dados e segurança</h2>
            <p className="mt-1 text-sm text-graphite">
              Tudo fica só no seu navegador. Faça backup regularmente — não há nuvem nem sync.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-fog px-3 py-1 text-xs font-medium text-graphite">
            Schema v{DB_VERSION}
          </span>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-ink">Backup completo</legend>
          <p className="mt-1 text-xs text-graphite">
            Gera um arquivo .json com livros, PDFs, sessões, notas, marcadores, highlights e
            reviews.
          </p>
          <button
            type="button"
            onClick={() => void onExportBackup()}
            disabled={isExporting}
            className="mt-3 rounded-pill bg-charcoal-plum px-5 py-2.5 text-sm font-medium text-pure-white shadow-lift disabled:opacity-50"
          >
            {isExporting ? 'Gerando backup…' : 'Exportar backup'}
          </button>
          {exportFeedback && <p className="mt-2 text-xs text-graphite">{exportFeedback}</p>}
          {exportError && <p className="mt-2 text-xs text-red-700">{exportError}</p>}
        </fieldset>

        <fieldset className="mt-6 border-t border-ink/10 pt-6">
          <legend className="text-sm font-medium text-ink">Restaurar backup</legend>
          <p className="mt-1 text-xs text-graphite">
            Substitui todos os dados atuais pelos dados do arquivo escolhido. Não é possível
            desfazer — se tiver dúvida, exporte um backup atual antes.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 rounded-pill border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink hover:bg-ink/5"
          >
            Escolher arquivo de backup…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void onFileChosen(event.target.files)}
          />

          {restoreErrors && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <p className="font-medium">Backup inválido — nada foi alterado:</p>
              <ul className="mt-1 list-disc pl-4">
                {restoreErrors.slice(0, 8).map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          {pendingRestore && (
            <div className="mt-3 rounded-lg bg-fog p-4 text-sm text-ink">
              <p>
                Este arquivo contém {pendingRestore.bookCount} livro(s), {pendingRestore.fileCount}{' '}
                arquivo(s) de PDF, {pendingRestore.sessionCount} sessão(ões),{' '}
                {pendingRestore.annotationCount} anotação(ões) e {pendingRestore.reviewCount}{' '}
                review(s).
              </p>
              <p className="mt-2 font-medium text-red-700">
                Restaurar este backup substituirá sua biblioteca atual, PDFs, sessões, notas e
                highlights. Esta ação não pode ser desfeita.
              </p>
              <label className="mt-3 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(event) => setConfirmChecked(event.target.checked)}
                />
                Entendo que meus dados atuais serão substituídos.
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void onConfirmRestore()}
                  disabled={!confirmChecked || isRestoring}
                  className="rounded-pill bg-red-700 px-5 py-2 text-xs font-medium text-pure-white disabled:opacity-50"
                >
                  {isRestoring ? 'Restaurando…' : 'Restaurar e substituir'}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingRestore(null)}
                  disabled={isRestoring}
                  className="rounded-pill px-5 py-2 text-xs font-medium text-ink hover:bg-ink/5"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {restoreDone && (
            <p className="mt-3 text-xs font-medium text-green-700">
              Backup restaurado. Recarregando o app…
            </p>
          )}
        </fieldset>

        <fieldset className="mt-6 border-t border-ink/10 pt-6">
          <legend className="text-sm font-medium text-ink">Verificar integridade</legend>
          <p className="mt-1 text-xs text-graphite">
            Procura arquivos, sessões ou anotações órfãs, páginas fora do intervalo válido e
            bookmarks duplicados.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void onCheckIntegrity()}
              disabled={isChecking}
              className="rounded-pill border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              {isChecking ? 'Verificando…' : 'Verificar agora'}
            </button>
            {hasRepairableIssues && (
              <button
                type="button"
                onClick={() => void onRepair()}
                disabled={isRepairing}
                className="rounded-pill bg-charcoal-plum px-5 py-2.5 text-sm font-medium text-pure-white disabled:opacity-50"
              >
                {isRepairing ? 'Corrigindo…' : 'Corrigir problemas seguros'}
              </button>
            )}
          </div>

          {checkError && <p className="mt-2 text-xs text-red-700">{checkError}</p>}

          {report && (
            <div className="mt-3 rounded-lg bg-fog p-4 text-sm text-ink">
              {report.issues.length === 0 ? (
                <p className="font-medium text-green-700">
                  Tudo certo — nenhum problema encontrado.
                </p>
              ) : (
                <>
                  <p className="font-medium">
                    {report.issues.length} problema(s) encontrado(s)
                    {report.ok ? ' (todos apenas avisos)' : ''}:
                  </p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {report.issues.map((issue, index) => (
                      <li key={`${issue.code}-${issue.entityId ?? index}`}>
                        <span
                          className={
                            issue.severity === 'error' ? 'font-medium text-red-700' : 'font-medium text-graphite'
                          }
                        >
                          [{SEVERITY_LABELS[issue.severity]}]
                        </span>{' '}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {repairSummary && (
            <p className="mt-2 text-xs text-graphite">
              Corrigido: {repairSummary.removedOrphanFiles} arquivo(s) órfão(s),{' '}
              {repairSummary.removedOrphanSessions} sessão(ões) órfã(s),{' '}
              {repairSummary.removedOrphanAnnotations} anotação(ões) órfã(s),{' '}
              {repairSummary.fixedBooksCurrentPage} página(s) atual(is) corrigida(s),{' '}
              {repairSummary.removedDuplicateBookmarks} bookmark(s) duplicado(s) removido(s),{' '}
              {repairSummary.removedOrphanReviews} review(s) órfã(s) removida(s),{' '}
              {repairSummary.cleanedReviewFavorites} review(s) com favoritos limpos.
            </p>
          )}
        </fieldset>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-pill px-5 py-2.5 text-sm font-medium text-ink hover:bg-ink/5"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
