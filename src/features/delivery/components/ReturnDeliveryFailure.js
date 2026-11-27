import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/theme';
import { DeliveryActionRow } from '@/features/delivery/components/DeliveryCards';
import { ReturnDeliveryPanel } from '@/features/delivery/components/ReturnDeliveryCards';
import {
  returnFailureReasons,
  reportReturnFailure,
} from '@/features/delivery/services/returnFailureApi';
import { ReturnAttachmentPicker } from '@/features/returns/components/ReturnAttachments';
import { AppText, Button, Input, Select } from '@/shared/ui';

/** Formulário exclusivo da ocorrência: a confirmação normal fica oculta enquanto está aberto. */
export function ReturnDeliveryFailure({ token, delivery, onOpen, onBusy, onReported, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [observation, setObservation] = useState('');
  const [files, setFiles] = useState([]);
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const active = useRef(false);
  const options = returnFailureReasons(delivery);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  /** Bloqueia navegação/ações durante a seleção para não desmontar as cópias antes do envio. */
  function changePicking(value) {
    setPicking(value);
    onBusy(value);
  }
  /** Fecha o formulário e desmonta o seletor, que limpa apenas as cópias criadas na cache. */
  function close() {
    if (lock.current || picking || unknown) return;
    setOpen(false);
    setConfirming(false);
    setReason('');
    setObservation('');
    setFiles([]);
    setError('');
    onOpen(false);
  }
  /** Nunca repete o POST; respostas incertas só permitem consultar novamente o estado. */
  async function submit() {
    if (lock.current || picking || unknown || !confirming) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const result = await reportReturnFailure(token, delivery, {
        reason,
        observation,
        attachments: files,
      });
      if (active.current) onReported(result);
    } catch (failure) {
      if (active.current) {
        const uncertain = failure.status === 0 || failure.status >= 500;
        setUnknown(uncertain || failure.requiresRefresh === true);
        setConfirming(false);
        setError(
          uncertain
            ? 'Não foi possível confirmar o registo. Consulte o estado antes de repetir; a ocorrência pode já ter sido recebida.'
            : failure.message,
        );
      }
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
      onBusy(false);
    }
  }
  if (!options.length) return null;
  // Fechado, o formulário ocupa apenas uma linha; os campos só surgem após a escolha explícita.
  if (!open && !unknown)
    return (
      <DeliveryActionRow
        label="Comunicar falha"
        icon="alert"
        variant="danger"
        onPress={() => {
          setOpen(true);
          onOpen(true);
        }}
      />
    );
  return (
    <ReturnDeliveryPanel title="Problema na devolução" icon="alert-circle-outline">
      <AppText variant="caption" color="muted">
        {delivery.status === 'AWAITING_PICKUP'
          ? 'Não conseguiu recolher o artigo junto do cliente?'
          : 'Não conseguiu transportar ou entregar o artigo na loja?'}{' '}
        Comunique a ocorrência para análise pelo Centro.
      </AppText>
      {error ? (
        <AppText accessibilityRole="alert" color="danger">
          {error}
        </AppText>
      ) : null}
      {unknown ? (
        <Button label="Consultar estado" variant="outline" fullWidth onPress={onRefresh} />
      ) : (
        <>
          <Select
            label="O que aconteceu?"
            placeholder="Selecione o motivo"
            options={options}
            value={reason}
            disabled={busy || picking || confirming}
            onChange={(value) => {
              setReason(value);
              setError('');
            }}
          />
          <Input
            label="Observação (opcional)"
            placeholder="Acrescente informações úteis para a análise"
            value={observation}
            onChangeText={setObservation}
            multiline
            textAlignVertical="top"
            maxLength={3000}
            editable={!busy && !picking && !confirming}
            style={{ minHeight: 96 }}
          />
          <ReturnAttachmentPicker
            Action={FailureAttachmentAction}
            embedded
            compact
            files={files}
            onChange={setFiles}
            disabled={busy || confirming}
            onPicking={changePicking}
          />
          {confirming ? (
            <>
              <AppText variant="bodyStrong">Confirmar esta ocorrência?</AppText>
              <AppText variant="caption" color="muted">
                A operação logística fica com falha e os códigos atuais deixam de ser válidos. O
                pedido de devolução continua para análise pelo Centro.
              </AppText>
              <Button
                label="Confirmar falha"
                variant="danger"
                fullWidth
                loading={busy}
                onPress={submit}
              />
              <Button
                label="Rever informação"
                variant="outline"
                fullWidth
                disabled={busy}
                onPress={() => setConfirming(false)}
              />
            </>
          ) : (
            <DeliveryActionRow
              label="Rever e confirmar"
              icon="checkmark-circle-outline"
              disabled={!reason || picking}
              onPress={() => {
                setConfirming(true);
                setError('');
              }}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar comunicação da falha"
            accessibilityState={{ disabled: busy || picking }}
            disabled={busy || picking}
            onPress={close}
            style={({ pressed }) => [
              styles.cancel,
              pressed && styles.pressed,
              (busy || picking) && styles.disabled,
            ]}
          >
            <Ionicons name="close-outline" size={18} color={colors.textMuted} />
            <AppText variant="caption" color="muted">
              Cancelar
            </AppText>
          </Pressable>
        </>
      )}
    </ReturnDeliveryPanel>
  );
}

/** Ação de anexar própria deste formulário, preservando contador, bloqueio e indicação da seleção. */
function FailureAttachmentAction({ label, onPress, disabled, loading }) {
  const locked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: locked, busy: loading }}
      disabled={locked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.attachment,
        pressed && styles.pressed,
        locked && styles.disabled,
      ]}
    >
      <View style={styles.attachmentIcon}>
        <Ionicons name="attach-outline" size={24} color={colors.primary} />
      </View>
      <AppText variant="bodyStrong" color="primary" style={styles.flex}>
        {label}
      </AppText>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Ionicons name="add-circle-outline" size={21} color={colors.primary} />
      )}
    </Pressable>
  );
}

// Ações com hierarquia distinta e área de toque mínima; o texto pode crescer em ecrãs pequenos.
const styles = StyleSheet.create({
  attachment: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  attachmentIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
  cancel: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
