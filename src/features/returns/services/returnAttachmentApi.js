import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import {
  attachmentTypes,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  normalizeAttachment,
} from '@/features/returns/services/attachmentFiles';
import { returnId } from '@/features/returns/services/returnsApi';
import { apiRequest } from '@/services/http/apiClient';

// Regista somente cópias criadas por este módulo, para nunca eliminar o original do Cliente.
const pickedCopies = new Map();

/** Copia a seleção para a cache própria antes de a disponibilizar ao formulário. */
export async function resolvePickedAttachments(assets) {
  if (assets.length > MAX_ATTACHMENTS) throw new Error('Pode anexar até 5 ficheiros por pedido.');
  if (Platform.OS === 'web')
    return assets.map((asset) =>
      normalizeAttachment({ ...asset, size: asset.size ?? asset.file?.size }),
    );
  const prepared = [];
  try {
    for (const asset of assets) {
      const source = new File(asset.uri);
      const metadata = normalizeAttachment({ ...asset, size: asset.size ?? source.size });
      const extension = metadata.name.split('.').pop().toLowerCase();
      const copy = new File(
        Paths.cache,
        `return-upload-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`,
      );
      const selected = { ...metadata, uri: copy.uri };
      pickedCopies.set(copy.uri, copy);
      prepared.push(selected);
      // No Android, lê o content:// autorizado pelo seletor e escreve dentro da área deste projeto.
      try {
        await source.copy(copy);
        if (copy.exists === false) throw new Error('A cópia não está acessível.');
      } catch {
        throw new Error(
          `Não foi possível copiar “${metadata.name}”. Escolha novamente um ficheiro disponível no dispositivo.`,
        );
      }
      selected.size = copy.size ?? metadata.size;
      normalizeAttachment(selected);
    }
    return prepared;
  } catch (failure) {
    prepared.forEach(removePickedAttachment);
    throw failure;
  }
}

/** Liberta apenas cópias conhecidas da seleção, incluindo anexos removidos ou rejeitados. */
export function removePickedAttachment(asset) {
  const copy = pickedCopies.get(asset?.uri);
  if (!copy) return;
  pickedCopies.delete(asset.uri);
  removeAttachmentCopy({ file: copy });
}

/** Transfere apenas o endpoint próprio; ignora URLs recebidos para nunca enviar o token a outro destino. */
export async function downloadReturnAttachment(token, attachment, source = 'request') {
  // Identificadores de anexos da mensagem e do pedido pertencem a tabelas diferentes.
  // A origem é uma lista fechada: URLs devolvidos pela API nunca recebem o token.
  const endpoints = {
    request: 'returns/attachments',
    message: 'returns/message-attachments',
    complaint: 'complaints/attachments',
  };
  if (!Object.hasOwn(endpoints, source)) throw new Error('A origem do anexo é inválida.');
  const id = returnId(attachment.id);
  if (!attachmentTypes.includes(attachment.mime_type))
    throw new Error('Este tipo de ficheiro não pode ser aberto nesta aplicação.');
  if (Number(attachment.size) > MAX_ATTACHMENT_BYTES)
    throw new Error('O ficheiro excede o limite de 10 MB.');
  const bytes = await apiRequest(`/client/${endpoints[source]}/${id}`, {
    token,
    responseType: 'arrayBuffer',
    timeoutMs: 60000,
  });
  if (!bytes?.byteLength || bytes.byteLength > MAX_ATTACHMENT_BYTES)
    throw new Error('O tamanho do ficheiro recebido é inválido.');
  if (Platform.OS === 'web') {
    const uri = URL.createObjectURL(new Blob([bytes], { type: attachment.mime_type }));
    return { uri, web: true };
  }
  // Nomes únicos evitam misturar transferências; os nomes originais não se tornam caminhos locais.
  const extension = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }[attachment.mime_type];
  const file = new File(
    Paths.cache,
    `return-${source}-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`,
  );
  try {
    file.create();
    file.write(new Uint8Array(bytes));
    return { uri: file.uri, file };
  } catch (error) {
    removeAttachmentCopy({ file });
    throw error;
  }
}

/** Abre a cópia local pelo sistema, com alternativa de partilha quando não existe visualizador. */
export async function openAttachmentCopy(copy, attachment, isActive = () => true) {
  if (!isActive()) return;
  if (copy.web) {
    const link = document.createElement('a');
    link.href = copy.uri;
    link.download = attachment.name || 'anexo';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
  if (
    typeof copy.file.canPreview === 'function' &&
    (await copy.file.canPreview({ mimeType: attachment.mime_type }))
  ) {
    if (!isActive()) return;
    await copy.file.preview({ title: attachment.name, mimeType: attachment.mime_type });
    return;
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Não existe uma aplicação disponível para abrir este ficheiro.');
  if (!isActive()) return;
  await Sharing.shareAsync(copy.uri, {
    mimeType: attachment.mime_type,
    dialogTitle: 'Abrir anexo',
  });
}

/** Remove só a cópia temporária criada pela aplicação, nunca o ficheiro original escolhido pelo Cliente. */
export function removeAttachmentCopy(copy) {
  try {
    if (copy?.web) URL.revokeObjectURL(copy.uri);
    else if (copy?.file?.exists) copy.file.delete();
  } catch {
    // A cache pode já ter sido limpa pelo sistema operativo.
  }
}
