import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReturnPanel } from '@/features/returns/components/ReturnLayout';
import {
  addAttachments,
  attachmentSize,
  attachmentTypes,
  MAX_ATTACHMENTS,
} from '@/features/returns/services/attachmentFiles';
import {
  downloadReturnAttachment,
  openAttachmentCopy,
  removeAttachmentCopy,
  removePickedAttachment,
  resolvePickedAttachments,
} from '@/features/returns/services/returnAttachmentApi';
import { returnError } from '@/features/returns/services/returnsApi';
import { AppText, Button } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Seletor opcional com remoção antes do envio, sem pedir acesso geral à biblioteca do telemóvel. */
export function ReturnAttachmentPicker({
  files,
  onChange,
  disabled,
  onPicking,
  embedded = false,
  compact = false,
  // Permite personalizar só a ação de anexar, mantendo seleção, limites e limpeza partilhados.
  Action = Button,
}) {
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const locked = useRef(false);
  const active = useRef(false);
  const selectedCopies = useRef([]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      selectedCopies.current.forEach(removePickedAttachment);
      selectedCopies.current = [];
    };
  }, []);

  /** Copia a seleção para a cache do Expo, permitindo enviar ficheiros de fornecedores externos. */
  async function select() {
    if (locked.current || disabled) return;
    locked.current = true;
    setPicking(true);
    onPicking(true);
    setError('');
    let prepared = [];
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: attachmentTypes,
        multiple: true,
        // O Android entrega o URI autorizado; a cópia é feita por nós na cache do projeto Expo.
        copyToCacheDirectory: Platform.OS !== 'android',
      });
      if (!result.canceled) {
        prepared = await resolvePickedAttachments(result.assets);
        if (!active.current) {
          prepared.forEach(removePickedAttachment);
          return;
        }
        const next = addAttachments(files, prepared);
        const retained = prepared.filter((file) => next.some((item) => item.uri === file.uri));
        prepared.filter((file) => !retained.includes(file)).forEach(removePickedAttachment);
        selectedCopies.current.push(...retained);
        onChange(next);
      }
    } catch (failure) {
      prepared.forEach(removePickedAttachment);
      if (active.current) setError(failure.message || 'Não foi possível selecionar os ficheiros.');
    } finally {
      locked.current = false;
      if (active.current) {
        setPicking(false);
        onPicking(false);
      }
    }
  }

  // Na conversa usa um bloco leve, evitando cartões dentro das mensagens.
  const Container = embedded ? View : ReturnPanel;
  return (
    <Container {...(embedded ? { style: styles.embedded } : { title: 'Anexos — opcional' })}>
      {embedded && !compact ? <AppText variant="bodyStrong">Anexos (opcional)</AppText> : null}
      {!compact ? (
        <AppText color="muted" variant="caption">
          Adicione fotografias ou documentos que ajudem a explicar o pedido. Até 5 ficheiros, com 10
          MB cada.
        </AppText>
      ) : null}
      {files.map((file, index) => (
        <View key={`${file.uri}-${index}`} style={styles.row}>
          <View style={styles.fileIcon}>
            {file.mimeType.startsWith('image/') ? (
              <Image source={{ uri: file.uri }} style={styles.thumbnail} />
            ) : (
              <Ionicons name="document-text-outline" size={24} color={colors.primary} />
            )}
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={2}>
              {file.name}
            </AppText>
            <AppText color="muted" variant="caption">
              {attachmentSize(file.size)}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remover ${file.name}`}
            disabled={disabled || picking}
            onPress={() => {
              removePickedAttachment(file);
              selectedCopies.current = selectedCopies.current.filter(
                (selected) => selected.uri !== file.uri,
              );
              onChange(files.filter((_, position) => position !== index));
            }}
            style={styles.icon}
          >
            <Ionicons name="close-circle-outline" size={23} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}
      {error ? (
        <AppText accessibilityRole="alert" color="danger">
          {error}
        </AppText>
      ) : null}
      <Action
        label={
          compact
            ? `Anexar ficheiros (${files.length}/${MAX_ATTACHMENTS})`
            : `Adicionar ficheiros (${files.length}/${MAX_ATTACHMENTS})`
        }
        leftIcon={
          compact ? <Ionicons name="attach-outline" size={21} color={colors.primary} /> : undefined
        }
        variant="outline"
        onPress={select}
        loading={picking}
        disabled={disabled || files.length >= MAX_ATTACHMENTS}
        fullWidth
      />
      <AppText color="muted" variant="caption">
        {compact
          ? 'Opcional · até 5 ficheiros de 10 MB · JPG, PNG, WebP ou PDF'
          : 'JPG, PNG, WebP ou PDF. Pode remover os anexos antes de enviar.'}
      </AppText>
    </Container>
  );
}

/** Consulta anexos privados com uma transferência por vez e remove cópias ao abandonar o detalhe. */
export function ReturnAttachments({ token, attachments, source = 'request', embedded = false }) {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const locked = useRef(false);
  const active = useRef(false);
  const copies = useRef([]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      copies.current.forEach(removeAttachmentCopy);
      copies.current = [];
    };
  }, []);

  /** Autoriza no servidor antes de abrir; respostas tardias não aparecem numa conta ou página diferente. */
  async function open(attachment) {
    if (locked.current) return;
    locked.current = true;
    setPending(attachment.id);
    setError('');
    let copy;
    try {
      copy = await downloadReturnAttachment(token, attachment, source);
      if (!active.current) {
        removeAttachmentCopy(copy);
        return;
      }
      copies.current.push(copy);
      if (attachment.mime_type.startsWith('image/')) setPreview({ copy, name: attachment.name });
      else await openAttachmentCopy(copy, attachment, () => active.current);
    } catch (failure) {
      if (copy) removeAttachmentCopy(copy);
      if (active.current) setError(returnError(failure));
    } finally {
      locked.current = false;
      if (active.current) setPending(null);
    }
  }

  /** A pré-visualização de imagem usa apenas a cópia local, sem tokens no URI. */
  function closePreview() {
    if (preview) removeAttachmentCopy(preview.copy);
    setPreview(null);
  }

  if (!attachments?.length) return null;
  const Container = embedded ? View : ReturnPanel;
  return (
    <Container {...(embedded ? { style: styles.embedded } : { title: 'Anexos do pedido' })}>
      {!embedded ? (
        <AppText color="muted" variant="caption">
          Toque num ficheiro para consultar.
        </AppText>
      ) : null}
      {attachments.map((attachment) => (
        <Pressable
          key={attachment.id}
          accessibilityRole="button"
          accessibilityLabel={`${Platform.OS === 'web' ? 'Consultar' : 'Abrir'} ${attachment.name}`}
          accessibilityState={{ disabled: pending !== null, busy: pending === attachment.id }}
          disabled={pending !== null}
          onPress={() => open(attachment)}
          style={styles.row}
        >
          <View style={styles.fileIcon}>
            <Ionicons
              name={
                attachment.mime_type?.startsWith('image/')
                  ? 'image-outline'
                  : 'document-text-outline'
              }
              size={23}
              color={colors.primary}
            />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{attachment.name}</AppText>
            <AppText variant="caption" color="muted">
              {attachmentSize(attachment.size)}
            </AppText>
          </View>
          {pending === attachment.id ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons name="open-outline" size={20} color={colors.primary} />
          )}
        </Pressable>
      ))}
      {error ? (
        <AppText color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      {preview ? (
        <AttachmentPreview uri={preview.copy.uri} name={preview.name} onClose={closePreview} />
      ) : null}
    </Container>
  );
}

/** Mantém a imagem em área segura, com fecho acessível no dispositivo. */
function AttachmentPreview({ uri, name, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={[styles.preview, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.previewHeader}>
          <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>
            {name}
          </AppText>
          <Button label="Fechar" variant="outline" onPress={onClose} />
        </View>
        <Image
          source={{ uri }}
          style={styles.fullImage}
          resizeMode="contain"
          accessibilityLabel={name}
        />
      </View>
    </Modal>
  );
}

// Ícones e miniaturas partilham a mesma coluna para manter os nomes alinhados.
const styles = StyleSheet.create({
  embedded: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingVertical: spacing.xs,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: { width: '100%', height: '100%' },
  flex: { flex: 1, minWidth: 0, gap: spacing.xs },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  preview: { flex: 1, backgroundColor: colors.surface },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  fullImage: { flex: 1, width: '100%' },
});
