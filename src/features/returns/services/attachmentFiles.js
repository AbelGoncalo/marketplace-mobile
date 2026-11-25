import { File } from 'expo-file-system';

/** Limites iguais aos da API; a validação definitiva continua a ser feita no servidor. */
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const attachmentTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const extensions = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/** Valida o ficheiro selecionado, incluindo os casos em que o fornecedor não indica o tipo. */
export function normalizeAttachment(asset) {
  const name = typeof asset?.name === 'string' ? asset.name.trim() : '';
  const extension = name.split('.').pop().toLowerCase();
  const inferred = extensions[extension];
  const mimeType =
    !asset?.mimeType || asset.mimeType === 'application/octet-stream'
      ? inferred
      : asset.mimeType.toLowerCase();
  if (!name || !inferred || !attachmentTypes.includes(mimeType) || mimeType !== inferred)
    throw new Error('Escolha ficheiros JPG, PNG, WebP ou PDF.');
  if (!Number.isFinite(asset.size) || asset.size <= 0)
    throw new Error(`Não foi possível confirmar o tamanho de “${name}”. Escolha outro ficheiro.`);
  if (asset.size > MAX_ATTACHMENT_BYTES) throw new Error(`“${name}” excede o limite de 10 MB.`);
  if (typeof asset.uri !== 'string' || !asset.uri)
    throw new Error('Não foi possível ler o ficheiro selecionado.');
  return { ...asset, name, mimeType };
}

/** Aplica a seleção inteira ou devolve erro sem perder os anexos que já estavam no formulário. */
export function addAttachments(current, incoming) {
  const normalized = incoming.map(normalizeAttachment);
  const added = normalized.filter(
    (file, index) =>
      !current.some(
        (old) => old.uri === file.uri || (old.name === file.name && old.size === file.size),
      ) &&
      !normalized
        .slice(0, index)
        .some((old) => old.uri === file.uri || (old.name === file.name && old.size === file.size)),
  );
  if (current.length + added.length > MAX_ATTACHMENTS)
    throw new Error('Pode anexar até 5 ficheiros por pedido.');
  return [...current, ...added];
}

/** Prepara multipart com campos da compra e ficheiros; o fetch define o separador Content-Type. */
export function attachmentFormData(payload, attachments) {
  if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS)
    throw new Error('Pode anexar até 5 ficheiros por pedido.');
  const files = attachments.map(normalizeAttachment);
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => form.append(key, String(value)));
  files.forEach((file, index) => {
    if (file.file) form.append(`attachments[${index}]`, file.file, file.name);
    else {
      const localFile = new File(file.uri);
      if (localFile.exists === false)
        throw new Error(
          `Não foi possível ler a cópia de “${file.name}”. Remova o anexo e selecione-o novamente.`,
        );
      // O fetch do Expo 58 lê bytes/Blob; o objeto antigo { uri, name, type } não é serializado.
      // O adaptador conserva o nome original e o tipo, mesmo quando o ficheiro na cache tem outro nome.
      form.append(`attachments[${index}]`, {
        name: file.name,
        type: file.mimeType,
        bytes: () => localFile.bytes(),
      });
    }
  });
  return form;
}

/** Formata o tamanho para orientar a escolha sem expor nomes internos de armazenamento. */
export function attachmentSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Tamanho indisponível';
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}
