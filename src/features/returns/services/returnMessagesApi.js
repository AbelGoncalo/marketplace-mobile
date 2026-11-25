import { attachmentFormData } from '@/features/returns/services/attachmentFiles';
import { returnId } from '@/features/returns/services/returnsApi';
import { apiRequest } from '@/services/http/apiClient';

const openStates = [
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'AWAITING_RETURN',
  'IN_TRANSIT',
  'RECEIVED',
  'INSPECTING',
];

/** Repete as permissões atuais da API; estados novos ficam em consulta até serem reconhecidos. */
export function returnConversationOpen(status) {
  return openStates.includes(status);
}

/** Uma resposta inválida ao POST é incerta: o servidor pode já ter guardado a mensagem. */
function checkedHistory(history, afterSend = false) {
  if (!Array.isArray(history)) {
    const error = new Error('Não foi possível confirmar o histórico da conversa.');
    if (afterSend) error.status = 500;
    throw error;
  }
  return history;
}

/** Obtém a conversa privada mesmo depois de encerrada a devolução. */
export function getReturnMessages(token, id) {
  return apiRequest(`/client/returns/${returnId(id)}/messages`, { token }).then((history) =>
    checkedHistory(history),
  );
}

/** Valida texto e anexos e envia uma única mensagem, sem repetição automática. */
export function sendReturnMessage(token, request, message, attachments = []) {
  const id = returnId(request.id);
  if (!returnConversationOpen(request.status))
    throw new Error('Esta conversa está encerrada para novas mensagens.');
  const text = typeof message === 'string' ? message.trim() : '';
  if ([...text].length < 2 || [...text].length > 5000)
    throw new Error('Escreva uma mensagem com 2 a 5000 caracteres.');
  if (!Array.isArray(attachments)) throw new Error('A seleção de anexos é inválida.');
  const multipart = attachments.length > 0;
  return apiRequest(`/client/returns/${id}/messages`, {
    token,
    method: 'POST',
    body: multipart
      ? attachmentFormData({ message: text }, attachments)
      : JSON.stringify({ message: text }),
    ...(multipart ? { timeoutMs: 120000 } : {}),
  }).then((history) => checkedHistory(history, true));
}

/** Junta respostas completas sem repetir mensagens imutáveis, preservando a ordem de envio. */
export function mergeReturnMessages(...groups) {
  const messages = new Map();
  groups.forEach((group) => (group || []).forEach((message) => messages.set(message.id, message)));
  return [...messages.values()].sort((left, right) => {
    const delta = Date.parse(left.created_at) - Date.parse(right.created_at);
    return Number.isFinite(delta) && delta !== 0 ? delta : left.id - right.id;
  });
}

/** Procura evidência de um envio com resposta perdida, sem confundir mensagens anteriores iguais. */
export function findConfirmedReturnMessage(messages, attempt) {
  return (
    messages.find(
      (message) =>
        message.sender_role === 'CLIENT' &&
        !attempt.knownIds.includes(message.id) &&
        message.message?.trim() === attempt.message.trim() &&
        (message.attachments || []).length === attempt.attachments.length &&
        attempt.attachments.every((file) =>
          (message.attachments || []).some(
            (saved) => saved.name === file.name && Number(saved.size) === file.size,
          ),
        ),
    ) || null
  );
}
