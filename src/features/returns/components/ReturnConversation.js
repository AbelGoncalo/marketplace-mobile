import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  ReturnAttachmentPicker,
  ReturnAttachments,
} from '@/features/returns/components/ReturnAttachments';
import { useReturnRefresh } from '@/features/returns/components/ReturnLayout';
import {
  findConfirmedReturnMessage,
  getReturnMessages,
  mergeReturnMessages,
  returnConversationOpen,
  sendReturnMessage,
} from '@/features/returns/services/returnMessagesApi';
import { returnError, returnOutcomeUnknown } from '@/features/returns/services/returnsApi';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button, Input } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

// O adaptador padrão preserva o contrato e os textos da conversa das devoluções.
const returnConversation = {
  getMessages: getReturnMessages,
  sendMessage: sendReturnMessage,
  isOpen: returnConversationOpen,
  attachmentSource: 'message',
  subtitle: 'Acompanhamento da sua devolução',
  instructionTitle: 'Informações sobre o artigo',
  instructionText:
    'Leia as respostas do Centro e partilhe fotografias ou documentos quando necessário. Use a seta circular para atualizar.',
  emptyOpen: 'Pode enviar uma mensagem sobre esta devolução.',
  emptyClosed: 'O histórico desta devolução está vazio.',
  closedTitle: () => 'Conversa encerrada',
  closedText: () => 'As mensagens e os anexos continuam disponíveis para consulta.',
  composerText: 'Responda ao Centro sobre o estado do artigo.',
  refreshLabel: 'Atualizar estado da devolução',
};

/** Mantém histórico e rascunho independentes para atualizar a conversa sem apagar o texto escrito. */
export function ReturnConversation({
  token,
  request,
  onBusy,
  disabled = false,
  onStatusRefresh,
  conversation = returnConversation,
}) {
  const id = request.id;
  // Uma mudança de estado na reclamação também reconsulta a mensagem do pedido de informação.
  const historyStatus = conversation.refreshStatusOnRead ? request.status : null;
  const loader = useCallback(() => conversation.getMessages(token, id), [token, id, conversation]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const refreshMessages = query.refresh;
  const previousStatus = useRef(historyStatus);
  useEffect(() => {
    if (previousStatus.current !== historyStatus) {
      previousStatus.current = historyStatus;
      refreshMessages();
    }
  }, [historyStatus, refreshMessages]);
  const [confirmed, setConfirmed] = useState([]);
  const [notice, setNotice] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const [sending, setSending] = useState(false);
  const messages = mergeReturnMessages(query.data, confirmed);
  const open = conversation.isOpen(request.status);

  /** A API devolve o histórico completo após o envio; a união por id impede linhas duplicadas. */
  function updateHistory(history, sent = false) {
    setConfirmed((previous) => mergeReturnMessages(previous, history));
    if (sent) setNotice('Mensagem enviada ao Centro Comercial.');
  }

  /** Comunica o envio ao detalhe para impedir atualização ou cancelamento durante a operação. */
  function changeBusy(value) {
    setSending(value);
    onBusy(value);
  }

  /** Atualiza mensagens e, quando necessário, confirma a permissão de escrita no processo. */
  function refreshConversation() {
    query.refresh();
    if (conversation.refreshStatusOnRead) onStatusRefresh?.();
  }

  const visible = messages.slice(-visibleCount);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Ionicons name="chatbubbles-outline" size={23} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="heading3" style={styles.title}>
            Conversa com o Centro
          </AppText>
          <AppText variant="caption" color="muted">
            {conversation.subtitle}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Atualizar conversa"
          accessibilityState={{
            disabled: sending || disabled || query.isLoading,
            busy: query.isLoading,
          }}
          disabled={sending || disabled || query.isLoading}
          onPress={refreshConversation}
          style={styles.refresh}
        >
          {query.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons name="refresh-outline" size={21} color={colors.primary} />
          )}
        </Pressable>
      </View>
      {/* As orientações têm fundo e tipografia próprios, separados das mensagens trocadas. */}
      <View style={styles.instructions}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
        <View style={styles.flex}>
          <AppText variant="caption" style={styles.instructionTitle}>
            {conversation.instructionTitle}
          </AppText>
          <AppText variant="caption" color="muted" style={styles.instructionText}>
            {conversation.instructionText}
          </AppText>
        </View>
      </View>
      {notice ? <ConversationNotice text={notice} /> : null}
      <View style={styles.history}>
        {query.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <AppText color="muted" variant="caption">
              A atualizar a conversa...
            </AppText>
          </View>
        ) : null}
        {query.error ? (
          <>
            <ConversationNotice text={query.error} danger />
            <Button
              label="Tentar consultar novamente"
              variant="outline"
              onPress={refreshConversation}
              disabled={sending}
            />
          </>
        ) : null}
        {!query.isLoading && !query.error ? (
          <>
            {!messages.length ? (
              <View style={styles.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.textMuted} />
                <AppText variant="bodyStrong">Ainda não há mensagens</AppText>
                <AppText variant="caption" color="muted" style={styles.emptyText}>
                  {open ? conversation.emptyOpen : conversation.emptyClosed}
                </AppText>
              </View>
            ) : null}
            {messages.length > visibleCount ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver mensagens anteriores"
                onPress={() => setVisibleCount((count) => count + 10)}
                style={styles.earlier}
              >
                <Ionicons name="chevron-up" size={15} color={colors.primary} />
                <AppText variant="caption" color="primary">
                  Ver mensagens anteriores
                </AppText>
              </Pressable>
            ) : null}
            {visible.map((message, index) => {
              const mine = message.sender_role === 'CLIENT';
              const stamp = messageStamp(message.created_at);
              const previous = index > 0 ? visible[index - 1] : null;
              const previousDay = previous ? messageStamp(previous.created_at).day : null;
              // Identifica só o início da sequência, incluindo mudança de administrador ou de dia.
              const startsSequence =
                !previous ||
                previous.sender_role !== message.sender_role ||
                (previous.sender?.id ?? previous.sender?.name) !==
                  (message.sender?.id ?? message.sender?.name) ||
                stamp.day !== previousDay;
              return (
                <View
                  key={message.id}
                  style={[styles.messageGroup, startsSequence && index > 0 && styles.sequenceStart]}
                >
                  {stamp.day !== previousDay ? (
                    <View style={styles.dayDivider}>
                      <View style={styles.dividerLine} />
                      <AppText variant="caption" color="muted" style={styles.dayLabel}>
                        {stamp.day}
                      </AppText>
                      <View style={styles.dividerLine} />
                    </View>
                  ) : null}
                  <View style={[styles.messageRow, mine ? styles.outgoing : styles.incoming]}>
                    {startsSequence ? (
                      <View style={styles.senderLine}>
                        {!mine ? (
                          <Ionicons name="business-outline" size={12} color={colors.primary} />
                        ) : null}
                        <AppText
                          variant="overline"
                          color={mine ? 'muted' : 'primary'}
                          style={styles.sender}
                        >
                          {mine
                            ? 'Eu'
                            : message.sender_role === 'SUPER_ADMIN'
                              ? 'Administração'
                              : 'Centro Comercial'}
                        </AppText>
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.bubble,
                        mine ? styles.mine : styles.center,
                        message.attachments?.length ? styles.fileBubble : null,
                      ]}
                    >
                      {!mine && startsSequence && message.sender?.name ? (
                        <AppText variant="caption" color="muted" style={styles.adminName}>
                          {message.sender.name}
                        </AppText>
                      ) : null}
                      <AppText selectable style={styles.messageText}>
                        {message.message}
                      </AppText>
                      <ReturnAttachments
                        token={token}
                        attachments={message.attachments}
                        source={conversation.attachmentSource}
                        embedded
                      />
                    </View>
                    <AppText variant="caption" color="muted" style={styles.time}>
                      {stamp.time}
                    </AppText>
                  </View>
                </View>
              );
            })}
          </>
        ) : null}
      </View>
      {open ? (
        <MessageComposer
          token={token}
          request={request}
          messages={messages}
          disabled={disabled || query.isLoading || Boolean(query.error)}
          onHistory={updateHistory}
          onBusy={changeBusy}
          onStatusRefresh={onStatusRefresh}
          conversation={conversation}
        />
      ) : (
        <View style={styles.closed}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{conversation.closedTitle(request.status)}</AppText>
            <AppText color="muted" variant="caption">
              {conversation.closedText(request.status)}
            </AppText>
          </View>
        </View>
      )}
    </View>
  );
}

/** Usa o dia como separador e a hora como metadado, sem repetir a data completa em cada mensagem. */
function messageStamp(value) {
  if (!value || !Number.isFinite(Date.parse(value)))
    return { day: 'Data indisponível', time: 'Hora indisponível' };
  const date = new Date(value);
  return {
    day: date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

/** Enquadra confirmações e falhas como avisos do sistema, fora das bolhas da conversa. */
function ConversationNotice({ text, danger = false }) {
  return (
    <View style={[styles.notice, danger && styles.noticeDanger]} accessibilityRole="alert">
      <Ionicons
        name={danger ? 'alert-circle-outline' : 'checkmark-circle-outline'}
        size={18}
        color={danger ? colors.danger : colors.success}
      />
      <AppText variant="caption" color={danger ? 'danger' : 'default'} style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

/** Compõe respostas com anexos opcionais e recupera envios de resultado incerto por consulta. */
function MessageComposer({
  token,
  request,
  messages,
  disabled,
  onHistory,
  onBusy,
  onStatusRefresh,
  conversation,
}) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [draftVersion, setDraftVersion] = useState(0);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(null);
  const [checked, setChecked] = useState(false);
  const active = useRef(false);
  const locked = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const blocked = disabled || busy || picking || Boolean(uncertain);

  /** Só limpa os campos depois de confirmar o envio; mantém os ficheiros perante falhas recuperáveis. */
  function clearDraft() {
    setText('');
    setAttachments([]);
    // Reinicia também avisos internos do seletor depois de um envio confirmado.
    setDraftVersion((value) => value + 1);
    setUncertain(null);
    setChecked(false);
    setError('');
  }

  /** Um toque corresponde a um POST; nenhuma falha provoca repetição automática. */
  async function submit() {
    if (locked.current || blocked) return;
    locked.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    const attempt = { message: text, attachments, knownIds: messages.map((message) => message.id) };
    try {
      const history = await conversation.sendMessage(token, request, text, attachments);
      if (active.current) {
        onHistory(history, true);
        clearDraft();
      }
    } catch (failure) {
      if (active.current) {
        if (returnOutcomeUnknown(failure)) {
          setUncertain(attempt);
          setChecked(false);
          setError(
            'Não foi possível confirmar o envio. Atualize a conversa antes de tentar novamente.',
          );
        } else {
          setError(returnError(failure));
          // Uma permissão pode ter mudado durante o envio; reconsulta sem repetir a mensagem.
          if (conversation.refreshStatusOnRead && failure.status === 422) onStatusRefresh?.();
        }
      }
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
      // Mesmo que a análise feche o compositor, liberta o bloqueio do detalhe.
      onBusy(false);
    }
  }

  /** Procura o envio entre novas mensagens do Cliente, conservando o rascunho se não houver confirmação. */
  async function checkDelivery() {
    if (locked.current || !uncertain) return;
    locked.current = true;
    setBusy(true);
    onBusy(true);
    try {
      const history = await conversation.getMessages(token, request.id);
      if (active.current) {
        const confirmedMessage = findConfirmedReturnMessage(history, uncertain);
        onHistory(history, Boolean(confirmedMessage));
        if (confirmedMessage) {
          clearDraft();
        } else {
          setChecked(true);
          setError(
            'A mensagem ainda não aparece. Consulte o histórico antes de voltar a editar ou reenviar.',
          );
        }
      }
    } catch (failure) {
      if (active.current) setError(returnError(failure));
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
      // Mesmo que a análise feche o compositor, liberta o bloqueio do detalhe.
      onBusy(false);
    }
  }

  return (
    <View style={styles.composer}>
      <View style={styles.composerHeading}>
        <AppText variant="bodyStrong">A sua resposta</AppText>
        <AppText variant="caption" color="muted">
          {conversation.composerText}
        </AppText>
      </View>
      <Input
        accessibilityLabel="Mensagem para o Centro"
        placeholder="Escreva a sua mensagem..."
        value={text}
        onChangeText={setText}
        multiline
        maxLength={5000}
        editable={!blocked}
        style={styles.input}
        helperText={
          text.length
            ? `${[...text].length}/5000 caracteres · mínimo de 2`
            : 'Texto obrigatório, mesmo quando enviar imagens.'
        }
      />
      <ReturnAttachmentPicker
        key={draftVersion}
        files={attachments}
        onChange={setAttachments}
        disabled={disabled || busy || Boolean(uncertain)}
        onPicking={setPicking}
        embedded
        compact
      />
      {error ? <ConversationNotice text={error} danger /> : null}
      {uncertain ? (
        <>
          <Button
            label="Verificar envio na conversa"
            variant="outline"
            onPress={checkDelivery}
            loading={busy}
            disabled={disabled}
            fullWidth
          />
          {checked ? (
            <Button
              label="Voltar a editar o rascunho"
              variant="outline"
              onPress={() => {
                setUncertain(null);
                setChecked(false);
                setError('Confirme no histórico se esta mensagem já chegou antes de reenviar.');
              }}
              disabled={disabled || busy}
              fullWidth
            />
          ) : null}
        </>
      ) : (
        <Button
          label="Enviar mensagem"
          leftIcon={<Ionicons name="send-outline" size={18} color={colors.textOnPrimary} />}
          onPress={submit}
          loading={busy}
          disabled={blocked || [...text.trim()].length < 2}
          fullWidth
        />
      )}
      {error ? (
        <Button
          label={conversation.refreshLabel}
          variant="outline"
          onPress={onStatusRefresh}
          disabled={disabled || busy || picking}
          fullWidth
        />
      ) : null}
    </View>
  );
}

// Tamanhos e pesos distinguem instruções, conteúdo e metadados sem adicionar outra família tipográfica.
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, lineHeight: 22 },
  flex: { flex: 1, minWidth: 0, gap: spacing.xs },
  refresh: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  instructions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  instructionTitle: { fontWeight: '700', color: colors.primary, fontSize: 12, lineHeight: 18 },
  instructionText: { fontSize: 12, lineHeight: 18 },
  history: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyText: { textAlign: 'center' },
  earlier: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  messageGroup: { gap: spacing.xs },
  sequenceStart: { marginTop: spacing.xs },
  dayDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dayLabel: { fontSize: 11, lineHeight: 16 },
  messageRow: { gap: 2 },
  outgoing: { alignItems: 'flex-end', paddingLeft: spacing.md },
  incoming: { alignItems: 'flex-start', paddingRight: spacing.md },
  senderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  sender: { fontSize: 10, lineHeight: 15, letterSpacing: 0.6 },
  bubble: {
    maxWidth: '96%',
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fileBubble: { width: '96%' },
  mine: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
    borderTopRightRadius: 3,
  },
  center: { backgroundColor: colors.surface, borderColor: colors.border, borderTopLeftRadius: 3 },
  adminName: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  messageText: { fontSize: 15, lineHeight: 23 },
  time: {
    fontSize: 10,
    lineHeight: 15,
    paddingHorizontal: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.sm,
    margin: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.successSoft,
  },
  noticeDanger: { backgroundColor: colors.dangerSoft },
  composer: {
    padding: spacing.md,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  composerHeading: { gap: spacing.xs },
  input: { minHeight: 90, textAlignVertical: 'top' },
  closed: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
