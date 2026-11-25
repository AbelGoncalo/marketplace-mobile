import { attachmentFormData } from '@/features/returns/services/attachmentFiles';
import { apiRequest } from '@/services/http/apiClient';
import { getComplaint } from '@/features/complaints/services/complaintsApi';

/** Repete a regra oficial: só o pedido explícito de informação permite responder. */
export function complaintConversationOpen(status) {
  return status === 'WAITING_CUSTOMER';
}

/** Valida identificadores antes de construir a rota privada da conversa. */
function complaintId(value) {
  const id = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error('A referência da reclamação é inválida.');
  return id;
}

/** Respostas inválidas depois de um envio são incertas; nunca autorizam repetição automática. */
function checkedHistory(history, sent = false) {
  if (!Array.isArray(history)) {
    const error = new Error('Não foi possível confirmar o histórico da reclamação.');
    if (sent) error.status = 500;
    throw error;
  }
  return history;
}

/** Consulta mensagens e anexos privados, incluindo depois de encerrada a reclamação. */
export function getComplaintMessages(token, id) {
  return apiRequest(`/client/complaints/${complaintId(id)}/messages`, { token }).then((history) =>
    checkedHistory(history),
  );
}

/** Valida o conteúdo e reconsulta o estado antes do POST; a API continua a ser a autoridade final. */
export async function sendComplaintMessage(token, complaint, message, attachments = []) {
  const id = complaintId(complaint.id);
  if (!complaintConversationOpen(complaint.status))
    throw new Error('A reclamação não está a aguardar a sua resposta.');
  const text = typeof message === 'string' ? message.trim() : '';
  if ([...text].length < 2 || [...text].length > 5000)
    throw new Error('Escreva uma mensagem com 2 a 5000 caracteres.');
  if (!Array.isArray(attachments)) throw new Error('A seleção de anexos é inválida.');
  // Prepara e valida os ficheiros antes de qualquer consulta ou mutação.
  const multipart = attachments.length > 0;
  const body = multipart
    ? attachmentFormData({ message: text }, attachments)
    : JSON.stringify({ message: text });
  const current = await getComplaint(token, id);
  if (!complaintConversationOpen(current.status)) {
    const error = new Error(
      'O Centro retomou a análise ou encerrou a reclamação. Atualize o estado.',
    );
    error.status = 422;
    throw error;
  }
  return apiRequest(`/client/complaints/${id}/messages`, {
    token,
    method: 'POST',
    body,
    ...(multipart ? { timeoutMs: 120000 } : {}),
  }).then((history) => checkedHistory(history, true));
}

/** Textos e regras próprios permitem reutilizar o chat sem mudar o comportamento das devoluções. */
export const complaintConversation = {
  getMessages: getComplaintMessages,
  sendMessage: sendComplaintMessage,
  isOpen: complaintConversationOpen,
  attachmentSource: 'complaint',
  refreshStatusOnRead: true,
  subtitle: 'Acompanhamento da sua reclamação',
  instructionTitle: 'Resposta ao pedido de informação',
  instructionText:
    'Pode responder e anexar imagens ou documentos quando o Centro solicitar informação. Durante a análise, a escrita fica indisponível.',
  emptyOpen: 'Responda ao pedido de informação do Centro.',
  emptyClosed: 'Ainda não existem mensagens nesta reclamação.',
  closedTitle: (status) =>
    ['RESOLVED', 'REJECTED', 'CANCELLED'].includes(status)
      ? 'Conversa encerrada'
      : 'A aguardar análise',
  closedText: (status) =>
    ['RESOLVED', 'REJECTED', 'CANCELLED'].includes(status)
      ? 'As mensagens e os anexos continuam disponíveis para consulta.'
      : 'A escrita será disponibilizada quando o Centro solicitar informação.',
  composerText: 'Responda à informação solicitada pelo Centro.',
  refreshLabel: 'Atualizar estado da reclamação',
};
