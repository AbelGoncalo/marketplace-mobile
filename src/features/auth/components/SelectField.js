import { Controller } from 'react-hook-form';

import { Select } from '@/shared/ui';

/** Liga o Select ao React Hook Form, tal como FormField faz com campos de texto. */
export function SelectField({ control, name, error, ...selectProps }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <Select error={error} onChange={onChange} value={value} {...selectProps} />
      )}
    />
  );
}
