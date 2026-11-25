/** Opções temporárias; na integração virão de /auth/register-options. */
export const accountTypeOptions = [
  { label: 'Cliente', value: 'customer', kind: 'person' },
  { label: 'Fornecedor / Lojista', value: 'seller', kind: 'entity' },
  { label: 'Transportadora', value: 'carrier', kind: 'entity' },
  { label: 'Entregador', value: 'courier', kind: 'person' },
];

export const genderOptions = [
  { label: 'Feminino', value: 'female' },
  { label: 'Masculino', value: 'male' },
  { label: 'Prefiro não informar', value: 'not_informed' },
];

export const entityTypeOptions = [
  { label: 'Individual', value: 'individual' },
  { label: 'Colectiva', value: 'collective' },
];

export const provinceOptions = [
  { label: 'Bengo', value: 'bengo' },
  { label: 'Benguela', value: 'benguela' },
  { label: 'Huambo', value: 'huambo' },
  { label: 'Huíla', value: 'huila' },
  { label: 'Luanda', value: 'luanda' },
];

export const municipalityOptions = {
  bengo: [{ label: 'Caxito', value: 'caxito' }],
  benguela: [
    { label: 'Benguela', value: 'benguela' },
    { label: 'Lobito', value: 'lobito' },
  ],
  huambo: [{ label: 'Huambo', value: 'huambo' }],
  huila: [{ label: 'Lubango', value: 'lubango' }],
  luanda: [
    { label: 'Belas', value: 'belas' },
    { label: 'Cacuaco', value: 'cacuaco' },
    { label: 'Luanda', value: 'luanda' },
    { label: 'Talatona', value: 'talatona' },
    { label: 'Viana', value: 'viana' },
  ],
};

/** Retorna se o perfil representa uma pessoa ou uma entidade. */
export function getAccountKind(accountType, options = accountTypeOptions) {
  return options.find((option) => option.value === accountType)?.kind;
}
