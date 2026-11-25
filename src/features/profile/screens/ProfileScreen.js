import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAuth } from '@/features/auth/context/AuthContext';
import { getManagementRoute } from '@/features/auth/utils/accessControl';
import { AppText, Badge, Button, Card, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Apresenta a conta e dá acesso às compras apenas a perfis de Cliente. */
export function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, session, signOut } = useAuth();

  if (!isAuthenticated) return <GuestProfile router={router} />;

  const managementRoute = getManagementRoute(session);
  const displayName =
    !session.user.name || session.user.name.includes('@')
      ? 'Utilizador Ponto Certo'
      : session.user.name;

  function confirmSignOut() {
    Alert.alert('Terminar sessão', 'Tem a certeza de que deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Terminar sessão',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/(customer)/(tabs)');
          } catch (error) {
            Alert.alert('Não foi possível terminar sessão', error.message);
          }
        },
      },
    ]);
  }

  const showComingSoon = (feature) =>
    Alert.alert(feature, 'Esta funcionalidade será ligada numa próxima etapa.');

  return (
    <Screen contentStyle={styles.screen} padded={false} scroll safeAreaColor={colors.primaryDark}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <AppText color="accent" variant="overline">
              MINHA CONTA
            </AppText>
            <AppText color="inverse" variant="heading1">
              Perfil
            </AppText>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons color={colors.textOnPrimary} name="settings-outline" size={22} />
          </View>
        </View>
        <AppText color="inverse" style={styles.headerDescription}>
          Dados, segurança e preferências num só lugar.
        </AppText>
      </View>

      <View style={styles.content}>
        <Card style={styles.identityCard}>
          <View style={styles.avatar}>
            <AppText color="inverse" variant="heading1">
              {initials(displayName)}
            </AppText>
          </View>
          <View style={styles.identityText}>
            <AppText numberOfLines={1} variant="heading2">
              {displayName}
            </AppText>
            <AppText color="muted" numberOfLines={1}>
              {session.user.email}
            </AppText>
            <Badge label={session.user.accountType || 'Conta Ponto Certo'} variant="info" />
          </View>
        </Card>

        {managementRoute ? (
          <Card onPress={() => router.push(managementRoute)} style={styles.managementCard}>
            <View style={styles.managementIcon}>
              <Ionicons color={colors.textOnAccent} name="speedometer-outline" size={24} />
            </View>
            <View style={styles.menuText}>
              <AppText color="inverse" variant="heading3">
                Painel de gestão
              </AppText>
              <AppText color="inverse" style={styles.secondaryText} variant="caption">
                Abra os indicadores e ferramentas da sua área.
              </AppText>
            </View>
            <Ionicons color={colors.textOnPrimary} name="chevron-forward" size={22} />
          </Card>
        ) : null}

        {session.user.accountType === 'Cliente' ? <ProfilePurchases router={router} /> : null}

        <ProfileSection title="Conta e segurança">
          <ProfileMenuItem
            description="Nome, telefone e dados da conta"
            icon="person-outline"
            label="Dados pessoais"
            onPress={() => router.push('/(customer)/profile/personal')}
          />
          <ProfileMenuItem
            description="Senha e sessões ativas"
            icon="shield-checkmark-outline"
            label="Segurança"
            onPress={() => router.push('/(customer)/profile/security')}
          />
          <ProfileMenuItem
            description="Locais de entrega guardados"
            icon="location-outline"
            label="Moradas"
            onPress={() => router.push('/(customer)/profile/addresses')}
          />
        </ProfileSection>

        <ProfileSection title="Preferências e suporte">
          <ProfileMenuItem
            description="Encomendas e promoções"
            icon="notifications-outline"
            label="Notificações"
            onPress={() => router.push('/(customer)/profile/notifications')}
          />
          <ProfileMenuItem
            description="Perguntas frequentes e contactos"
            icon="help-circle-outline"
            label="Ajuda e suporte"
            onPress={() => showComingSoon('Ajuda e suporte')}
          />
          <ProfileMenuItem
            description="Português"
            icon="language-outline"
            label="Idioma"
            onPress={() => showComingSoon('Idioma')}
          />
        </ProfileSection>

        <Button fullWidth label="Terminar sessão" onPress={confirmSignOut} variant="danger" />
        <AppText color="muted" style={styles.version} variant="caption">
          Ponto Certo · versão 1.0.0
        </AppText>
      </View>
    </Screen>
  );
}

function GuestProfile({ router }) {
  const benefits = [
    ['bag-check-outline', 'Acompanhe todas as suas encomendas'],
    ['heart-outline', 'Guarde produtos e lojas favoritas'],
    ['location-outline', 'Mantenha as suas moradas organizadas'],
  ];
  return (
    <Screen contentStyle={styles.guestScreen} scroll safeAreaColor={colors.primaryDark}>
      <View style={styles.guestHero}>
        <View style={styles.guestIcon}>
          <Ionicons color={colors.textOnAccent} name="person" size={36} />
        </View>
        <AppText color="inverse" variant="heading1">
          A sua conta Ponto Certo
        </AppText>
        <AppText color="inverse" style={styles.guestDescription}>
          Entre para ter uma experiência mais rápida, segura e personalizada.
        </AppText>
      </View>
      <Card style={styles.benefitsCard}>
        {benefits.map(([icon, text]) => (
          <View key={text} style={styles.benefitRow}>
            <View style={styles.benefitIcon}>
              <Ionicons color={colors.primary} name={icon} size={21} />
            </View>
            <AppText style={styles.benefitText}>{text}</AppText>
            <Ionicons color={colors.success} name="checkmark-circle" size={20} />
          </View>
        ))}
      </Card>
      <Button
        fullWidth
        label="Entrar na minha conta"
        onPress={() => router.push('/(auth)/login')}
      />
      <Button
        fullWidth
        label="Criar uma conta"
        onPress={() => router.push('/(auth)/register')}
        variant="outline"
      />
      <AppText color="muted" style={styles.version} variant="caption">
        Compra segura, simples e no ponto certo.
      </AppText>
    </Screen>
  );
}

// Os quatro atalhos conservam os destinos privados já existentes na área de compras.
const purchaseShortcuts = [
  {
    label: 'Encomendas',
    description: 'Compras e entregas',
    icon: 'receipt-outline',
    route: '/(customer)/orders',
  },
  {
    label: 'Devoluções',
    description: 'Pedidos e recolhas',
    icon: 'return-down-back-outline',
    route: '/(customer)/returns',
  },
  {
    label: 'Reembolsos',
    description: 'Valores e pagamentos',
    icon: 'wallet-outline',
    route: '/(customer)/refunds',
  },
  {
    label: 'Reclamações',
    description: 'Problemas e respostas',
    icon: 'chatbox-ellipses-outline',
    route: '/(customer)/complaints',
  },
];

/** Usa duas colunas; ecrãs estreitos e fontes ampliadas recebem uma coluna sem truncar textos. */
function ProfilePurchases({ router }) {
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 360 || fontScale > 1.2;
  return (
    <View style={styles.section}>
      <AppText color="muted" variant="overline">
        Compras
      </AppText>
      <View style={styles.purchaseGrid}>
        {purchaseShortcuts.map((item) => (
          <Pressable
            key={item.route}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}. ${item.description}`}
            onPress={() => router.push(item.route)}
            style={({ pressed }) => [
              styles.purchaseCard,
              singleColumn && styles.purchaseCardWide,
              pressed && styles.purchaseCardPressed,
            ]}
          >
            <View style={styles.purchaseCardHeader}>
              <View style={styles.purchaseIcon}>
                <Ionicons name={item.icon} size={22} color={colors.primary} />
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
            <View style={styles.purchaseText}>
              <AppText variant="bodyStrong">{item.label}</AppText>
              <AppText variant="caption" color="muted">
                {item.description}
              </AppText>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ProfileSection({ title, children }) {
  return (
    <View style={styles.section}>
      <AppText color="muted" variant="overline">
        {title}
      </AppText>
      <Card padding="none">{children}</Card>
    </View>
  );
}

function ProfileMenuItem({ icon, label, description, onPress }) {
  return (
    <Card onPress={onPress} padding="md" style={styles.menuItem}>
      <View style={styles.menuIcon}>
        <Ionicons color={colors.primary} name={icon} size={21} />
      </View>
      <View style={styles.menuText}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText color="muted" variant="caption">
          {description}
        </AppText>
      </View>
      <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
    </Card>
  );
}

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primaryDark,
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: radii.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerDescription: { opacity: 0.7 },
  content: { gap: spacing.lg, padding: spacing.md },
  identityCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: -spacing.xxl,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 3,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  identityText: { flex: 1, gap: spacing.xs },
  managementCard: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    flexDirection: 'row',
    gap: spacing.md,
  },
  managementIcon: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  secondaryText: { opacity: 0.72 },
  section: { gap: spacing.sm },
  // A largura flexível e a altura mínima mantêm pares alinhados, permitindo crescer com o texto.
  purchaseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'stretch' },
  purchaseCard: {
    flexBasis: '46%',
    flexGrow: 1,
    minWidth: 0,
    minHeight: 144,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  purchaseCardWide: { flexBasis: '100%' },
  purchaseCardPressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  purchaseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  purchaseIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseText: { gap: spacing.xs },
  menuItem: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    flexDirection: 'row',
    gap: spacing.md,
    shadowOpacity: 0,
  },
  menuIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  menuText: { flex: 1, gap: spacing.xxs },
  version: { textAlign: 'center' },
  guestScreen: { backgroundColor: colors.background, gap: spacing.lg, paddingBottom: spacing.xl },
  guestHero: {
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.xl,
  },
  guestIcon: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  guestDescription: { opacity: 0.72, textAlign: 'center' },
  benefitsCard: { gap: spacing.md },
  benefitRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  benefitIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  benefitText: { flex: 1 },
});
