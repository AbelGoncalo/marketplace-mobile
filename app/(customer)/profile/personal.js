import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '@/theme';
import { PhoneVerification } from '@/features/profile/components/PhoneVerification';
import { EmailVerification } from '@/features/profile/components/EmailVerification';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getCurrentAccess } from '@/features/auth/services/authApi';
import { apiRequest } from '@/services/http/apiClient';
import { ReturnLayout, ReturnPanel } from '@/features/returns/components/ReturnLayout';
import { AppText, Button, Input } from '@/shared/ui';

/** Isola os dados pessoais pela sessão autenticada. */
export default function PersonalScreen() {
  const { session, refreshProfile } = useAuth();
  if (!session) return <AppText>Entre na sua conta para consultar os dados pessoais.</AppText>;
  return (
    <PersonalForm
      key={session.token}
      token={session.token}
      accountType={session.user.accountType}
      refreshProfile={refreshProfile}
    />
  );
}

/** Consulta os contactos oficiais e conserva os campos quando ocorre uma falha de validação. */
function PersonalForm({ token, refreshProfile, accountType }) {
  // Os dados ficam no formulário pai para preservar o rascunho ao mudar de tab.
  const [tab, setTab] = useState('account');
  const [contact, setContact] = useState(null);
  const [values, setValues] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const active = useRef(false);
  const lock = useRef(false);
  useEffect(() => {
    active.current = true;
    getCurrentAccess(token)
      .then((access) => {
        if (active.current)
          setValues({
            name: access.user?.person?.name || access.user?.entity?.name || '',
            email: access.email || '',
            phone: access.phone || '',
          });
      })
      .catch((failure) => {
        if (active.current) setError(failure.message);
      });
    return () => {
      active.current = false;
    };
  }, [token]);

  /** Envia apenas os campos editáveis; não repete automaticamente uma alteração com resposta perdida. */
  async function save() {
    if (lock.current || phoneBusy) return;
    const body = {
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || null,
    };
    if (!body.name || body.name.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      setError('Preencha um nome até 180 caracteres e um email válido.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest('/auth/profile', { token, method: 'PUT', body: JSON.stringify(body) });
      await refreshProfile(token);
      if (active.current)
        setNotice(
          'Dados pessoais guardados. Alterar email ou telefone requer nova verificação do contacto.',
        );
    } catch (failure) {
      if (active.current)
        setError(
          Object.values(failure.errors || {})
            .flat()
            .join('\n') || failure.message,
        );
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }

  return (
    <ReturnLayout
      title="Dados pessoais"
      subtitle="Mantenha os seus contactos atualizados."
      backTo="/(customer)/(tabs)/profile"
      busy={busy || phoneBusy}
    >
      <View accessibilityRole="tablist" style={styles.tabs}>
        {[
          { id: 'account', label: 'Dados da conta' },
          { id: 'verification', label: 'Verificações' },
        ].map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.id, disabled: busy || phoneBusy }}
            disabled={busy || phoneBusy}
            onPress={() => setTab(item.id)}
            style={[styles.tab, tab === item.id && styles.selectedTab]}
          >
            <AppText
              variant="bodyStrong"
              color={tab === item.id ? 'primary' : 'muted'}
              style={styles.tabText}
            >
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </View>
      {tab === 'account' ? (
        <ReturnPanel title="Informações da conta">
          <AppText variant="caption" color="muted">
            Tipo de conta: {accountType}
          </AppText>
          {values ? (
            <>
              {['name', 'email', 'phone'].map((field) => (
                <Input
                  key={field}
                  label={{ name: 'Nome', email: 'Email', phone: 'Telefone' }[field]}
                  value={values[field]}
                  maxLength={field === 'name' ? 180 : field === 'phone' ? 30 : 254}
                  editable={!busy && !phoneBusy}
                  autoCapitalize={field === 'name' ? 'words' : 'none'}
                  keyboardType={
                    field === 'email'
                      ? 'email-address'
                      : field === 'phone'
                        ? 'phone-pad'
                        : 'default'
                  }
                  onChangeText={(value) =>
                    setValues((previous) => ({ ...previous, [field]: value }))
                  }
                />
              ))}
              <Button
                label="Guardar alterações"
                loading={busy}
                disabled={phoneBusy}
                fullWidth
                onPress={save}
              />
            </>
          ) : (
            <AppText color="muted">
              {error
                ? 'Não foi possível consultar os dados. Volte ao perfil e tente novamente.'
                : 'A consultar dados pessoais...'}
            </AppText>
          )}
          {error ? (
            <AppText accessibilityRole="alert" color="danger">
              {error}
            </AppText>
          ) : null}
          {notice ? (
            <AppText accessibilityRole="alert" color="primary">
              {notice}
            </AppText>
          ) : null}
        </ReturnPanel>
      ) : (
        <>
          <ReturnPanel title="Confirme os seus contactos">
            <AppText color="muted">
              Escolha o contacto para consultar o estado ou concluir a verificação. As alterações
              devem ser guardadas na tab Dados da conta.
            </AppText>
            {[
              { id: 'email', label: 'Email', icon: 'mail-outline' },
              { id: 'phone', label: 'Telefone', icon: 'call-outline' },
            ].map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ expanded: contact === item.id, disabled: phoneBusy }}
                disabled={phoneBusy}
                onPress={() => setContact((previous) => (previous === item.id ? null : item.id))}
                style={[styles.contact, contact === item.id && styles.selectedContact]}
              >
                <Ionicons name={item.icon} size={22} color={colors.primary} />
                <View style={styles.contactText}>
                  <AppText variant="bodyStrong">{item.label}</AppText>
                  <AppText variant="caption" color="muted">
                    Consultar estado e verificar
                  </AppText>
                </View>
                <Ionicons
                  name={contact === item.id ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            ))}
          </ReturnPanel>
          {contact === 'email' ? (
            <EmailVerification token={token} disabled={busy || phoneBusy} />
          ) : null}
          {contact === 'phone' ? (
            <PhoneVerification
              key={`${token}-${notice}`}
              token={token}
              disabled={busy}
              onBusy={setPhoneBusy}
            />
          ) : null}
        </>
      )}
    </ReturnLayout>
  );
}

// Tabs de altura flexível e contactos com área de toque confortável acomodam letras ampliadas.
const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    padding: spacing.xs,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  selectedTab: { backgroundColor: colors.surface },
  tabText: { textAlign: 'center', fontSize: 14 },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedContact: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  contactText: { flex: 1, minWidth: 0, gap: spacing.xs },
});
