import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { issueOrderCode, orderCodeAction } from '@/features/orders/services/ordersApi';
import { orderDate } from '@/features/orders/utils/orderPresentation';
import { AppText, Button } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Desmonta códigos quando a API deixa de permitir a confirmação ou muda a entrega. */
export function OrderConfirmation({ token, reference, order }) {
  const action = orderCodeAction(order);
  if (!action) return null;
  return (
    <ConfirmationCode
      key={`${reference}-${action.kind}-${action.id}`}
      token={token}
      reference={reference}
      action={action}
    />
  );
}

/** Mantém o código apenas em memória e exige uma ação explícita para emitir ou renovar. */
function ConfirmationCode({ token, reference, action }) {
  const [code, setCode] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const locked = useRef(false);
  const mounted = useRef(false);
  const pickup = action.kind === 'pickup';
  const expired = code && Number.isFinite(code.deadline) && now >= code.deadline;

  // Ao sair da aplicação, remove o segredo; respostas tardias não o devem voltar a mostrar.
  const generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        generation.current += 1;
        setCode(null);
      }
      setNow(Date.now());
    });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      subscription.remove();
      clearInterval(timer);
    };
  }, []);

  /** Bloqueia toques repetidos e remove o código antigo antes de pedir um substituto. */
  async function generate() {
    if (locked.current) return;
    locked.current = true;
    const requestGeneration = generation.current;
    setBusy(true);
    setError('');
    setCode(null);
    try {
      const result = await issueOrderCode(token, reference, action);
      if (mounted.current && generation.current === requestGeneration) {
        setCode(result);
        setNow(Date.now());
      }
    } catch (failure) {
      if (mounted.current && generation.current === requestGeneration) {
        setError(failure.message || 'Não foi possível gerar o código.');
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <AppText variant="bodyStrong">
        {pickup ? 'Levantamento na loja' : 'Confirmar a receção'}
      </AppText>
      <AppText variant="caption" color="muted">
        {pickup
          ? 'Apresente o código ao lojista quando receber os produtos.'
          : 'Comunique o código ao entregador apenas quando receber os produtos.'}
      </AppText>
      {code && !expired ? (
        <View style={styles.codeBox}>
          <AppText variant="heading2" style={styles.code} selectable>
            {code.confirmation_code}
          </AppText>
          <AppText variant="caption" color="muted">
            Válido até {orderDate(code.expires_at)}
          </AppText>
        </View>
      ) : null}
      {expired ? <AppText color="muted">O código expirou. Gere um novo.</AppText> : null}
      {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
      <Button
        label={code || error ? 'Gerar novo código' : 'Gerar código'}
        loading={busy}
        onPress={generate}
        variant="outline"
        fullWidth
      />
      <AppText variant="caption" color="muted">
        Cada novo código invalida o anterior. Após a validação, atualize a compra para consultar o
        estado.
      </AppText>
    </View>
  );
}

// Um único bloco discreto mantém a ação junto da loja correspondente.
const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
  },
  codeBox: { gap: spacing.xs, alignItems: 'center', paddingVertical: spacing.sm },
  code: { color: colors.primary, letterSpacing: 5, fontVariant: ['tabular-nums'] },
});
