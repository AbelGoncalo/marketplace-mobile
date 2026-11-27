import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AddressForm } from '@/features/checkout/components/AddressForm';
import { getAddresses } from '@/features/checkout/services/checkoutApi';
import { correctPickupAddress } from '@/features/returns/services/returnDeliveryApi';
import { returnError, returnOutcomeUnknown } from '@/features/returns/services/returnsApi';
import { ReturnFeedback } from '@/features/returns/components/ReturnLayout';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button, Select } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Torna o pedido do Centro visível no próprio detalhe, sem depender das notificações. */
export function PickupAddressCorrection({
  token,
  request,
  delivery,
  disabled,
  onBusy,
  onEditing,
  onRefresh,
  onCorrected,
}) {
  const [open, setOpen] = useState(false);
  // Uma consulta ou mudança de conta pode desmontar o formulário; liberta a atualização automática.
  useEffect(() => () => onEditing(false), [onEditing]);
  return (
    <View style={styles.notice}>
      <View style={styles.heading}>
        <View style={styles.headingIcon}>
          <Ionicons name="location-outline" size={23} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="overline" color="primary">
            AÇÃO NECESSÁRIA
          </AppText>
          <AppText variant="heading3">Corrigir morada de recolha</AppText>
        </View>
      </View>
      <AppText color="muted" style={styles.description}>
        O Centro pediu a confirmação de uma morada válida para reagendar a recolha.
      </AppText>
      {open ? (
        <CorrectionForm
          token={token}
          request={request}
          delivery={delivery}
          disabled={disabled}
          onBusy={onBusy}
          onRefresh={onRefresh}
          onCorrected={onCorrected}
          onClose={() => {
            setOpen(false);
            onEditing(false);
          }}
        />
      ) : (
        <CorrectionAction
          label="Corrigir morada de recolha"
          icon="create-outline"
          disabled={disabled}
          onPress={() => {
            setOpen(true);
            onEditing(true);
          }}
        />
      )}
    </View>
  );
}
/** Lista exclusivamente moradas da conta e reutiliza o formulário existente para criar outra. */
function CorrectionForm({
  token,
  request,
  delivery,
  disabled,
  onBusy,
  onClose,
  onRefresh,
  onCorrected,
}) {
  const loader = useCallback(() => getAddresses(token), [token]);
  const query = useApiQuery(loader);
  const [selectedId, setSelectedId] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const selected = query.data?.find((address) => String(address.id) === selectedId);
  const blocked = busy || addressBusy || disabled || unknown;
  /** Protege o envio e a navegação também durante a criação da morada. */
  function changeAddressBusy(value) {
    setAddressBusy(value);
    onBusy(value);
  }
  /** Uma resposta incerta exige nova consulta; nunca repete o PATCH automaticamente. */
  async function submit() {
    if (lock.current || blocked || !selected || !confirming) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      await correctPickupAddress(token, request, delivery, selected.id);
      if (active.current) onCorrected();
    } catch (failure) {
      if (active.current) {
        const uncertain = returnOutcomeUnknown(failure);
        setUnknown(uncertain || failure.requiresRefresh === true);
        setError(
          uncertain
            ? 'Não foi possível confirmar a correção. Consulte o acompanhamento antes de repetir.'
            : returnError(failure),
        );
      }
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
      onBusy(false);
    }
  }
  return (
    <View style={styles.form}>
      {error ? (
        <AppText accessibilityRole="alert" color="danger">
          {error}
        </AppText>
      ) : null}
      {unknown ? (
        <CorrectionAction
          label="Consultar acompanhamento"
          icon="refresh-outline"
          disabled={busy || disabled}
          onPress={onRefresh}
        />
      ) : (
        <>
          {creating ? (
            <View style={styles.newAddress} pointerEvents={disabled ? 'none' : 'auto'}>
              <AddressForm
                token={token}
                onBusy={changeAddressBusy}
                onSaved={(address) => {
                  setSelectedId(String(address.id));
                  setCreating(false);
                  query.refresh();
                }}
              />
            </View>
          ) : (
            <>
              <ReturnFeedback
                {...query}
                loadingText="A consultar as suas moradas..."
                onRetry={query.refresh}
              />
              {query.data && !confirming ? (
                <Select
                  label="Morada correta para a recolha"
                  placeholder="Escolha uma morada"
                  value={selectedId}
                  options={query.data.map((address) => ({
                    value: String(address.id),
                    label: `${address.address} · ${address.phone || ''}`,
                  }))}
                  disabled={blocked || confirming}
                  onChange={(value) => {
                    setSelectedId(value);
                    setError('');
                  }}
                />
              ) : null}
              {query.data?.length === 0 ? (
                <AppText color="muted">
                  Ainda não tem moradas guardadas. Adicione uma para continuar.
                </AppText>
              ) : null}
              {selected ? <AddressPreview address={selected} /> : null}
              {!confirming ? (
                <CorrectionAction
                  label="Adicionar nova morada"
                  icon="add-circle-outline"
                  secondary
                  disabled={blocked}
                  onPress={() => setCreating(true)}
                />
              ) : null}
              {confirming ? (
                <>
                  <View style={styles.confirmation}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">Enviar esta morada ao Centro?</AppText>
                      <AppText variant="caption" color="muted">
                        O Centro será informado e tratará do reagendamento da recolha.
                      </AppText>
                    </View>
                  </View>
                  <Button
                    label="Confirmar morada"
                    fullWidth
                    loading={busy}
                    leftIcon={
                      <Ionicons name="checkmark-outline" size={20} color={colors.textOnPrimary} />
                    }
                    disabled={disabled}
                    onPress={submit}
                  />
                  <CorrectionAction
                    label="Escolher outra morada"
                    icon="swap-horizontal-outline"
                    secondary
                    disabled={blocked}
                    onPress={() => setConfirming(false)}
                  />
                </>
              ) : (
                <CorrectionAction
                  label="Rever e confirmar"
                  icon="checkmark-circle-outline"
                  disabled={blocked || !selected}
                  onPress={() => setConfirming(true)}
                />
              )}
            </>
          )}
          {creating ? (
            <CorrectionAction
              label="Voltar às moradas"
              icon="arrow-back-outline"
              secondary
              disabled={blocked}
              onPress={() => {
                setCreating(false);
                query.refresh();
              }}
            />
          ) : null}
          <CorrectionAction
            label="Cancelar correção"
            icon="close-outline"
            secondary
            muted
            disabled={blocked}
            onPress={onClose}
          />
        </>
      )}
    </View>
  );
}

/** Ação em linha com ícone e seta; alternativas ficam discretas sem perder a área de toque. */
function CorrectionAction({ label, icon, onPress, disabled, secondary = false, muted = false }) {
  const color = muted ? colors.textMuted : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        secondary && styles.secondaryAction,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={secondary ? 18 : 21} color={color} />
      <AppText
        variant={secondary ? 'caption' : 'bodyStrong'}
        color={muted ? 'muted' : 'primary'}
        style={secondary ? styles.secondaryLabel : styles.flex}
      >
        {label}
      </AppText>
      {!secondary ? <Ionicons name="chevron-forward" size={18} color={color} /> : null}
    </Pressable>
  );
}
/** Confirma o endereço escolhido com localização e contacto em linhas distintas. */
function AddressPreview({ address }) {
  const location = [address.municipality?.name, address.municipality?.province?.name]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.preview}>
      <View style={styles.previewHeading}>
        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        <AppText variant="overline" color="muted" style={styles.flex}>
          MORADA SELECIONADA
        </AppText>
      </View>
      <AppText variant="bodyStrong" selectable>
        {address.address}
      </AppText>
      {location ? (
        <View style={styles.detailLine}>
          <Ionicons name="map-outline" size={16} color={colors.textMuted} />
          <AppText variant="caption" color="muted" style={styles.flex}>
            {location}
          </AppText>
        </View>
      ) : null}
      {address.phone ? (
        <View style={styles.detailLine}>
          <Ionicons name="call-outline" size={16} color={colors.primary} />
          <AppText variant="caption" color="primary" selectable style={styles.flex}>
            {address.phone}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

// Cores discretas e texto flexível mantêm a hierarquia entre aviso, morada e confirmação final.
const styles = StyleSheet.create({
  notice: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm + spacing.xs,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs },
  headingIcon: {
    width: 44,
    height: 44,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
  description: { fontSize: 14, lineHeight: 21 },
  form: { gap: spacing.sm + spacing.xs },
  newAddress: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    padding: spacing.sm + spacing.xs,
  },
  preview: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: spacing.sm + spacing.xs,
    gap: spacing.sm,
  },
  previewHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  confirmation: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  action: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
  },
  secondaryAction: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: 'transparent',
    padding: spacing.sm,
  },
  secondaryLabel: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
