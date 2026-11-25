import { useReturnRefresh } from '@/features/returns/components/ReturnLayout';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getFavorite, setFavorite } from '@/features/favorites/services/favoritesApi';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button } from '@/shared/ui';
import { colors } from '@/theme';

/** Guardar exige login; contas administrativas não recebem ações de Cliente. */
export function FavoriteButton({ product }) {
  const { session } = useAuth();
  const router = useRouter();
  if (!session)
    return (
      <HeartButton
        label="Entrar para guardar favorito"
        onPress={() => router.push('/(auth)/login')}
      />
    );
  if (session.user.accountType !== 'Cliente') return null;
  return (
    <SavedButton key={`${session.token}-${product}`} token={session.token} product={product} />
  );
}
/** Aguarda o estado confirmado antes de aceitar outro toque; falhas exigem nova consulta. */
function SavedButton({ token, product }) {
  const loader = useCallback(() => getFavorite(token, product), [token, product]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function toggle() {
    if (lock.current || !query.data) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await setFavorite(token, product, !query.data.saved);
    } catch (failure) {
      setError(failure.message);
    } finally {
      lock.current = false;
      setBusy(false);
      query.refresh();
    }
  }
  return (
    <>
      <HeartButton
        label={query.data?.saved ? 'Remover dos favoritos' : 'Guardar nos favoritos'}
        saved={query.data?.saved}
        loading={busy || query.isLoading}
        disabled={busy || query.isLoading || Boolean(query.error)}
        onPress={toggle}
      />
      {error || query.error ? (
        <>
          <AppText color="danger">{error || query.error}</AppText>
          <Button
            label="Atualizar favorito"
            variant="outline"
            onPress={query.refresh}
            disabled={busy}
          />
        </>
      ) : null}
    </>
  );
}

/** Mostra apenas o coração; o nome acessível conserva o significado da ação sem texto visual. */
function HeartButton({ label, saved = false, loading = false, disabled = false, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        alignSelf: 'flex-start',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name={saved ? 'heart' : 'heart-outline'} size={26} color={colors.primary} />
      )}
    </Pressable>
  );
}
