import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CheckoutNotice } from '@/features/checkout/components/CheckoutLayout';
import { spacing } from '@/theme';

import { useRegisterOptions } from '@/features/auth/hooks/useRegisterOptions';
import { createAddress, updateAddress } from '@/features/checkout/services/checkoutApi';
import { AppText, Button, Input, Select } from '@/shared/ui';

/** Reutiliza as listas geográficas do cadastro para criar uma morada de entrega. */
export function AddressForm({ token, onSaved, initial = null, onBusy }) {
  const [province, setProvince] = useState(
    initial?.municipality?.province_id ? String(initial.municipality.province_id) : '',
  );
  const [municipality, setMunicipality] = useState(
    initial?.municipality_id ? String(initial.municipality_id) : '',
  );
  const [address, setAddress] = useState(initial?.address || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Bloqueia toques repetidos e respostas tardias depois de sair do formulário.
  const locked = useRef(false);
  const active = useRef(false);
  const [unknown, setUnknown] = useState(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const options = useRegisterOptions(province);

  /** Impede guardar uma combinação geográfica antiga após mudar de província. */
  function changeProvince(value) {
    setProvince(value);
    setMunicipality('');
  }

  /** Valida campos obrigatórios e deixa a API confirmar a propriedade e os limites. */
  async function save() {
    if (locked.current || unknown) return;
    if (!municipality || !address.trim() || !phone.trim()) {
      setError('Preencha município, morada e telefone.');
      return;
    }
    locked.current = true;
    setBusy(true);
    onBusy?.(true);
    setError('');
    try {
      const payload = {
        municipality_id: Number(municipality),
        address: address.trim(),
        phone: phone.trim(),
      };
      const result = initial
        ? await updateAddress(token, initial.id, payload)
        : await createAddress(token, payload);
      if (active.current) onSaved(result);
    } catch (requestError) {
      if (active.current) {
        const uncertain = requestError.status === 0 || requestError.status >= 500;
        setUnknown(uncertain);
        setError(
          uncertain
            ? 'Não foi possível confirmar a gravação. Volte à lista e atualize antes de repetir.'
            : Object.values(requestError.errors || {})
                .flat()
                .join(' ') || requestError.message,
        );
      }
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
      onBusy?.(false);
    }
  }

  return (
    <View style={styles.form}>
      <AppText variant="bodyStrong">{initial ? 'Editar morada' : 'Dados da nova morada'}</AppText>
      <Select
        label="Província"
        value={province}
        placeholder="Escolha a província"
        options={options.options?.provinces || []}
        onChange={changeProvince}
        disabled={unknown || busy || options.isLoading}
      />
      <Select
        label="Município"
        value={municipality}
        placeholder="Escolha o município"
        options={options.municipalities}
        onChange={setMunicipality}
        disabled={unknown || busy || !province || options.isLoadingMunicipalities}
      />
      <Input
        label="Morada"
        value={address}
        onChangeText={setAddress}
        maxLength={1000}
        editable={!busy && !unknown}
        multiline
      />
      <Input
        label="Telefone"
        value={phone}
        onChangeText={setPhone}
        maxLength={30}
        keyboardType="phone-pad"
        editable={!busy && !unknown}
      />
      {error || options.error ? (
        <CheckoutNotice danger>{error || options.error}</CheckoutNotice>
      ) : null}
      {options.error ? (
        <Button fullWidth variant="outline" label="Repetir opções" onPress={options.loadOptions} />
      ) : null}
      <Button fullWidth label="Guardar morada" loading={busy} disabled={unknown} onPress={save} />
    </View>
  );
}

// O formulário usa uma única coluna e espaçamento uniforme dentro da secção de morada.
const styles = StyleSheet.create({ form: { gap: spacing.md, paddingTop: spacing.sm } });
