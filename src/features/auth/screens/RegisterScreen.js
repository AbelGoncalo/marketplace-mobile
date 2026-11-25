import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { AuthScreenLayout } from '@/features/auth/components/AuthScreenLayout';
import { FormField } from '@/features/auth/components/FormField';
import { SelectField } from '@/features/auth/components/SelectField';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getAccountKind } from '@/features/auth/data/registerOptions';
import { useRegisterOptions } from '@/features/auth/hooks/useRegisterOptions';
import { registerSchema } from '@/features/auth/schemas/authSchemas';
import { buildRegisterPayload } from '@/features/auth/services/authApi';
import { AppText, Button, LoadingState } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

const defaultValues = {
  accountType: 'customer',
  name: '',
  genderId: '',
  identityNumber: '',
  storeName: '',
  entityTypeId: '',
  taxNumber: '',
  phone: '',
  email: '',
  address: '',
  provinceId: '',
  municipalityId: '',
  password: '',
  passwordConfirmation: '',
};

/** Formulário único que adapta campos e validações ao perfil escolhido. */
export function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [submitError, setSubmitError] = useState('');
  const {
    control,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues, resolver: zodResolver(registerSchema) });
  const accountType = useWatch({ control, name: 'accountType' });
  const provinceId = useWatch({ control, name: 'provinceId' });
  const {
    error: optionsError,
    isLoading,
    isLoadingMunicipalities,
    loadOptions,
    municipalities,
    options,
  } = useRegisterOptions(provinceId);
  const selectedAccount = options?.accountTypes.find((item) => item.value === accountType);
  const isEntity = getAccountKind(accountType, options?.accountTypes) === 'entity';

  // Impede que um município antigo permaneça escolhido após mudar a província.
  useEffect(() => {
    resetField('municipalityId');
  }, [provinceId, resetField]);

  async function onSubmit(values) {
    if (!selectedAccount) return;
    setSubmitError('');
    try {
      await signUp(buildRegisterPayload(values, selectedAccount));
      router.replace('/(customer)/(tabs)/profile');
    } catch (requestError) {
      setSubmitError(requestError.message);
    }
  }

  if (isLoading) {
    return (
      <AuthScreenLayout description="A preparar os dados do cadastro." title="Crie a sua conta">
        <LoadingState message="A carregar opções..." />
      </AuthScreenLayout>
    );
  }

  if (!options) {
    return (
      <AuthScreenLayout description={optionsError} title="Não foi possível carregar">
        <Button fullWidth label="Tentar novamente" onPress={loadOptions} />
      </AuthScreenLayout>
    );
  }

  return (
    <AuthScreenLayout
      description="Escolha o seu perfil e preencha somente os dados necessários."
      title="Crie a sua conta"
    >
      <FormSection number="1" title="Tipo de conta">
        <SelectField
          control={control}
          error={errors.accountType?.message}
          label="Perfil de acesso"
          name="accountType"
          options={options.accountTypes}
        />
      </FormSection>

      <FormSection number="2" title={isEntity ? 'Dados da entidade' : 'Dados pessoais'}>
        {isEntity ? (
          <>
            <FormField
              control={control}
              error={errors.storeName?.message}
              label={accountType === 'carrier' ? 'Nome da transportadora' : 'Nome da loja'}
              name="storeName"
              placeholder="Nome comercial da entidade"
            />
            <SelectField
              control={control}
              error={errors.entityTypeId?.message}
              label="Tipo de entidade"
              name="entityTypeId"
              options={options.entityTypes}
              placeholder="Seleccione uma opção"
            />
            <FormField
              autoCapitalize="characters"
              control={control}
              error={errors.taxNumber?.message}
              label="NIF"
              name="taxNumber"
              placeholder="Número fiscal"
            />
          </>
        ) : (
          <>
            <SelectField
              control={control}
              error={errors.genderId?.message}
              label="Género"
              name="genderId"
              options={options.genders}
              placeholder="Seleccione uma opção"
            />
            <FormField
              autoCapitalize="words"
              control={control}
              error={errors.name?.message}
              label="Nome completo"
              name="name"
              placeholder="Nome e apelido"
            />
            <FormField
              autoCapitalize="characters"
              control={control}
              error={errors.identityNumber?.message}
              helperText="Opcional"
              label="N.º do BI"
              name="identityNumber"
              placeholder="Documento de identificação"
            />
          </>
        )}
      </FormSection>

      <FormSection number="3" title="Contacto e localização">
        <FormField
          control={control}
          error={errors.phone?.message}
          keyboardType="phone-pad"
          label="Telefone"
          name="phone"
          placeholder="Ex.: +244 923 000 000"
        />
        <FormField
          autoCapitalize="none"
          control={control}
          error={errors.email?.message}
          keyboardType="email-address"
          label="Email"
          name="email"
          placeholder="nome@exemplo.com"
        />
        {!isEntity ? (
          <>
            <FormField
              control={control}
              error={errors.address?.message}
              label="Morada"
              name="address"
              placeholder="Rua, bairro e número"
            />
            <SelectField
              control={control}
              error={errors.provinceId?.message}
              label="Província"
              name="provinceId"
              options={options.provinces}
              placeholder="Escolha a província"
            />
            <SelectField
              control={control}
              disabled={!provinceId || isLoadingMunicipalities}
              error={errors.municipalityId?.message}
              label="Município"
              name="municipalityId"
              options={municipalities}
              placeholder={
                isLoadingMunicipalities
                  ? 'A carregar municípios...'
                  : provinceId
                    ? 'Escolha o município'
                    : 'Escolha primeiro a província'
              }
            />
          </>
        ) : null}
      </FormSection>

      <FormSection number="4" title="Segurança da conta">
        <FormField
          control={control}
          error={errors.password?.message}
          helperText="Mínimo de 8 caracteres, com maiúscula, minúscula e número."
          label="Senha"
          name="password"
          placeholder="Crie uma senha segura"
          secureTextEntry
        />
        <FormField
          control={control}
          error={errors.passwordConfirmation?.message}
          label="Confirmar senha"
          name="passwordConfirmation"
          placeholder="Repita a senha"
          secureTextEntry
        />
      </FormSection>
      {submitError ? <AppText color="danger">{submitError}</AppText> : null}
      <Button
        fullWidth
        label="Criar conta"
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      />
      <AppText align="center" color="muted" variant="caption">
        Ao continuar, confirma que os dados fornecidos são verdadeiros.
      </AppText>
    </AuthScreenLayout>
  );
}

/** Agrupa campos relacionados para facilitar a leitura de um formulário longo. */
function FormSection({ number, title, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.number}>
          <AppText color="inverse" variant="caption">
            {number}
          </AppText>
        </View>
        <AppText variant="heading3">{title}</AppText>
      </View>
      <View style={styles.fields}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  number: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  fields: { gap: spacing.md },
});
