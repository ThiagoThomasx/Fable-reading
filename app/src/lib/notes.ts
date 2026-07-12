/**
 * Validação pura de corpo de nota — compartilhada entre criação e edição para que
 * "salvar só espaços" seja bloqueado nos dois fluxos (ver Sprint 7).
 */
export function isBlankNoteBody(body: string): boolean {
  return body.trim().length === 0;
}
