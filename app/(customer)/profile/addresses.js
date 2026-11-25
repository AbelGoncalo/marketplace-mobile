import { useCallback, useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { OrderAccess } from '@/features/orders/components/OrderAccess';
import { AddressForm } from '@/features/checkout/components/AddressForm';
import { getAddresses } from '@/features/checkout/services/checkoutApi';
import {
  ReturnFeedback,
  ReturnLayout,
  ReturnPanel,
  useReturnRefresh,
} from '@/features/returns/components/ReturnLayout';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button } from '@/shared/ui';

/** Exige sessão de Cliente e desmonta todas as moradas quando a conta muda. */
export default function AddressesScreen() {
  const { session } = useAuth();
  return (
    <OrderAccess
      title="As minhas moradas"
      description="Entre para gerir as suas moradas."
      returnTo="addresses"
    >
      {() => <Addresses key={session.token} token={session.token} />}
    </OrderAccess>
  );
}

/** Lista só moradas editáveis; a criação e edição reutilizam o formulário do checkout. */
function Addresses({ token }) {
  const loader = useCallback(() => getAddresses(token), [token]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  /** Reconsulta a lista oficial depois de confirmar a gravação, sem guardar cópias locais. */
  function saved() {
    setEditing(null);
    setNotice('Morada guardada.');
    query.refresh();
  }

  return (
    <ReturnLayout
      title="As minhas moradas"
      subtitle="Endereços para compras e recolhas."
      backTo="/(customer)/(tabs)/profile"
      busy={busy}
      onRefresh={!editing ? query.refresh : undefined}
    >
      {notice && !editing ? (
        <AppText accessibilityRole="alert" color="primary">
          {notice}
        </AppText>
      ) : null}
      {editing ? (
        <ReturnPanel>
          <AddressForm
            key={editing.id || 'new'}
            token={token}
            initial={editing.id ? editing : null}
            onBusy={setBusy}
            onSaved={saved}
          />
          <Button
            label="Voltar à lista"
            variant="outline"
            fullWidth
            disabled={busy}
            onPress={() => {
              setEditing(null);
              query.refresh();
            }}
          />
        </ReturnPanel>
      ) : (
        <>
          <Button
            label="Adicionar morada"
            fullWidth
            onPress={() => {
              setNotice('');
              setEditing({});
            }}
          />
          <ReturnFeedback
            {...query}
            onRetry={query.refresh}
            empty={Boolean(query.data && !query.data.length)}
            emptyText="Ainda não tem moradas guardadas."
            loadingText="A consultar moradas..."
          />
          {(query.data || []).map((address) => (
            <ReturnPanel key={address.id}>
              <AppText variant="bodyStrong">{address.address}</AppText>
              <AppText color="muted">
                {[address.municipality?.name, address.municipality?.province?.name]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
              <AppText variant="caption" color="muted">
                Telefone: {address.phone}
              </AppText>
              <Button
                label="Editar morada"
                variant="outline"
                fullWidth
                onPress={() => setEditing(address)}
              />
            </ReturnPanel>
          ))}
        </>
      )}
    </ReturnLayout>
  );
}
