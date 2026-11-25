import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { OrderAccess } from '@/features/orders/components/OrderAccess';
import {
  getNotificationPreferences,
  saveNotificationPreference,
  notificationEventLabel,
} from '@/features/notifications/services/notificationPreferencesApi';
import {
  ReturnLayout,
  ReturnPanel,
  ReturnFeedback,
  useReturnRefresh,
} from '@/features/returns/components/ReturnLayout';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText } from '@/shared/ui';
import { colors, spacing } from '@/theme';

/** Isola escolhas privadas pela conta autenticada. */
export default function NotificationPreferencesScreen() {
  return (
    <OrderAccess title="Preferências de notificações" returnTo="notifications">
      {(session) => <Preferences key={session.token} token={session.token} />}
    </OrderAccess>
  );
}
/** Mostra a matriz real; a caixa interna e os códigos de segurança não são desligados por estas escolhas. */
function Preferences({ token }) {
  const loader = useCallback(() => getNotificationPreferences(token), [token]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const locked = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  /** Reconsulta sempre após guardar ou falhar, sem assumir que a preferência ficou aplicada. */
  async function change(event, channel, enabled) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await saveNotificationPreference(token, event, channel, enabled);
      if (active.current) setNotice('Preferência guardada.');
    } catch (failure) {
      if (active.current)
        setError(
          'Não foi possível confirmar a alteração. Consulte os valores atualizados antes de repetir. ' +
            failure.message,
        );
    } finally {
      locked.current = false;
      if (active.current) {
        setBusy(false);
        query.refresh();
      }
    }
  }
  return (
    <ReturnLayout
      title="Preferências"
      subtitle="Escolha os canais para cada atualização."
      backTo="/(customer)/profile/notifications"
      onRefresh={query.refresh}
      busy={busy || query.isLoading}
    >
      <ReturnPanel title="Sobre os canais">
        <AppText color="muted">
          As mensagens dentro da aplicação permanecem ativas. Códigos de segurança são geridos
          separadamente.
        </AppText>
        <AppText variant="caption" color="muted">
          Push ainda não está configurado e fica indisponível nesta etapa. SMS depende da
          regularização do operador; guardar a preferência não ativa o serviço.
        </AppText>
      </ReturnPanel>
      {notice ? (
        <AppText accessibilityRole="alert" color="primary">
          {notice}
        </AppText>
      ) : null}
      {error ? (
        <AppText accessibilityRole="alert" color="danger">
          {error}
        </AppText>
      ) : null}
      <ReturnFeedback
        {...query}
        loadingText="A consultar preferências..."
        onRetry={query.refresh}
      />
      {(query.data?.events || []).map((event) => (
        <ReturnPanel key={event.event_type} title={notificationEventLabel(event.event_type)}>
          {event.channels.map((entry) => (
            <View key={entry.channel} style={styles.row}>
              <View style={styles.text}>
                <AppText variant="bodyStrong">
                  {{ EMAIL: 'Email', SMS: 'SMS', PUSH: 'Push no telemóvel' }[entry.channel] ||
                    entry.channel}
                </AppText>
                {entry.channel === 'PUSH' ? (
                  <AppText variant="caption" color="muted">
                    Configuração pendente
                  </AppText>
                ) : null}
              </View>
              <Switch
                accessibilityLabel={`${notificationEventLabel(event.event_type)} por ${entry.channel}`}
                value={entry.enabled === true}
                disabled={busy || entry.channel === 'PUSH'}
                onValueChange={(enabled) => change(event, entry.channel, enabled)}
                trackColor={{ true: colors.primary }}
              />
            </View>
          ))}
          {!event.channels.length ? (
            <AppText color="muted">Sem canais externos disponíveis.</AppText>
          ) : null}
        </ReturnPanel>
      ))}
    </ReturnLayout>
  );
}
// Etiqueta flexível e interruptor alinhado acomodam títulos longos e texto ampliado.
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, minWidth: 0, gap: spacing.xs },
});
