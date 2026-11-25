import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { OrderAccess } from '@/features/orders/components/OrderAccess';
import { orderDate } from '@/features/orders/utils/orderPresentation';
import {
  getNotifications,
  markNotification,
  markAllNotifications,
  notificationTarget,
} from '@/features/notifications/services/notificationsApi';
import {
  ReturnLayout,
  ReturnFeedback,
  ReturnPagination,
  useReturnRefresh,
} from '@/features/returns/components/ReturnLayout';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Protege a caixa e desmonta mensagens quando muda a conta autenticada. */
export default function NotificationsScreen() {
  return (
    <OrderAccess
      title="Notificações"
      description="Entre para consultar as suas notificações."
      returnTo="notifications"
    >
      {(session) => <Inbox key={session.token} token={session.token} />}
    </OrderAccess>
  );
}
/** Reconsulta após marcações e ao regressar, preservando a paginação real da API. */
function Inbox({ token }) {
  const router = useRouter();
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState(null);
  const lock = useRef(false);
  // Ignora respostas tardias ao sair da caixa ou mudar de conta.
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const loader = useCallback(() => getNotifications(token, page, unread), [token, page, unread]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const pagination = query.data?.notifications;
  const notifications = pagination?.data || [];

  /** Um toque marca a leitura e abre apenas destinos conhecidos; erros não são repetidos em silêncio. */
  async function read(notification = null, open = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (!notification) await markAllNotifications(token);
      else if (!notification.read_at) await markNotification(token, notification.id);
      if (!active.current) return;
      setPage(1);
      query.refresh();
      // Todos os tipos abrem a mensagem original, nunca o processo automaticamente.
      if (notification && open) setOpened(notification);
    } catch (failure) {
      if (active.current) setError(failure.message);
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <ReturnLayout
      title="Notificações"
      subtitle={query.data ? `${query.data.unread_count} por ler` : 'Atualizações da sua conta.'}
      backTo="/(customer)/(tabs)/profile"
      refreshLabel="Atualizar notificações"
      onRefresh={query.refresh}
      busy={busy || query.isLoading}
      scrollKey={`${unread}-${page}`}
    >
      <Button
        label="Preferências de notificações"
        variant="outline"
        fullWidth
        disabled={busy}
        onPress={() => router.push('/(customer)/profile/notification-preferences')}
      />
      <View style={styles.tabs} accessibilityRole="tablist">
        {[false, true].map((value) => (
          <Pressable
            key={String(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: unread === value, disabled: busy }}
            disabled={busy}
            style={[styles.tab, unread === value && styles.selected]}
            onPress={() => {
              setUnread(value);
              setPage(1);
              setError('');
            }}
          >
            <AppText variant="bodyStrong" color={unread === value ? 'primary' : 'muted'}>
              {value ? 'Não lidas' : 'Todas'}
            </AppText>
          </Pressable>
        ))}
      </View>
      {query.data?.unread_count > 0 ? (
        <Button
          label="Marcar todas como lidas"
          variant="outline"
          fullWidth
          disabled={busy}
          onPress={() => read()}
        />
      ) : null}
      {error ? (
        <AppText accessibilityRole="alert" color="danger">
          {error}
        </AppText>
      ) : null}
      <ReturnFeedback
        {...query}
        loadingText="A consultar notificações..."
        onRetry={query.refresh}
        empty={Boolean(pagination && !notifications.length)}
        emptyText={unread ? 'Não tem notificações por ler.' : 'Ainda não tem notificações.'}
      />
      {notifications.length ? (
        <View style={styles.inbox}>
          {notifications.map((notification, index) => {
            const fresh = !notification.read_at;
            return (
              <Pressable
                key={notification.id}
                accessibilityRole="button"
                accessibilityLabel={`${fresh ? 'Não lida. ' : ''}${notification.title}. ${orderDate(notification.created_at)}`}
                accessibilityHint={
                  notificationTarget(notification)
                    ? 'Abre o detalhe relacionado'
                    : 'Abre a mensagem completa'
                }
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => read(notification, true)}
                style={({ pressed }) => [
                  styles.messageRow,
                  index > 0 && styles.separator,
                  fresh && styles.unreadRow,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.messageIcon, fresh && styles.unreadIcon]}>
                  <Ionicons
                    name={fresh ? 'mail-unread-outline' : 'mail-open-outline'}
                    size={22}
                    color={fresh ? colors.primary : colors.textMuted}
                  />
                </View>
                <View style={styles.messageContent}>
                  <View style={styles.messageHeading}>
                    <AppText
                      variant={fresh ? 'bodyStrong' : 'body'}
                      style={styles.messageTitle}
                      numberOfLines={2}
                    >
                      {notification.title}
                    </AppText>
                    {fresh ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <AppText color="muted" numberOfLines={2} style={styles.preview}>
                    {notification.message}
                  </AppText>
                  <AppText variant="caption" color="muted" style={styles.date}>
                    {orderDate(notification.created_at)}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Modal
        visible={Boolean(opened)}
        transparent
        animationType="fade"
        onRequestClose={() => setOpened(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.reader} accessibilityViewIsModal>
            <View style={styles.readerHeader}>
              <Ionicons name="mail-open-outline" size={23} color={colors.primary} />
              <AppText variant="heading3" style={styles.messageTitle}>
                Mensagem
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar mensagem"
                onPress={() => setOpened(null)}
                style={styles.close}
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.readerContent}>
              <AppText variant="heading3" selectable>
                {opened?.title}
              </AppText>
              <AppText variant="caption" color="muted">
                {orderDate(opened?.created_at)}
              </AppText>
              <AppText selectable>{opened?.message}</AppText>
              {/* A navegação para o processo é uma ação separada da leitura da mensagem. */}
              {opened && notificationTarget(opened) ? (
                <Button
                  label={
                    notificationTarget(opened).pathname.includes('/refunds/')
                      ? 'Ver reembolso'
                      : 'Ver encomenda'
                  }
                  fullWidth
                  variant="outline"
                  onPress={() => {
                    const target = notificationTarget(opened);
                    setOpened(null);
                    if (target) router.push(target);
                  }}
                />
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {pagination && !busy ? (
        <ReturnPagination page={page} data={pagination} onPage={setPage} />
      ) : null}
    </ReturnLayout>
  );
}
// Linhas de correio, prévias curtas e pontos de leitura substituem cartões informativos com vários botões.
const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.border,
    borderRadius: radii.md,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    borderRadius: radii.sm,
  },
  selected: { backgroundColor: colors.surface },
  inbox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 112,
  },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  unreadRow: { backgroundColor: '#F5F8FD' },
  pressed: { backgroundColor: colors.primarySoft },
  messageIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadIcon: { backgroundColor: colors.primarySoft },
  messageContent: { flex: 1, minWidth: 0, gap: spacing.xs },
  messageHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  messageTitle: { flex: 1, minWidth: 0 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  preview: { fontSize: 13, lineHeight: 19 },
  date: { fontSize: 11, marginTop: spacing.xs },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  reader: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  readerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  readerContent: { padding: spacing.md, gap: spacing.md },
});
