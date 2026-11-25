import { Controller } from 'react-hook-form';

import { Input } from '@/shared/ui';

/** Liga um campo visual do design system ao estado do React Hook Form. */
export function FormField({ control, name, error, ...inputProps }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onBlur, onChange, value } }) => (
        <Input
          error={error}
          onBlur={onBlur}
          onChangeText={onChange}
          value={value}
          {...inputProps}
        />
      )}
    />
  );
}
