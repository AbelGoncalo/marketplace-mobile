import { z } from 'zod';

const email = z.string().trim().min(1, 'Informe o email.').email('Informe um email válido.');
const password = z
  .string()
  .min(8, 'Use pelo menos 8 caracteres.')
  .regex(/[A-Z]/, 'Inclua uma letra maiúscula.')
  .regex(/[a-z]/, 'Inclua uma letra minúscula.')
  .regex(/[0-9]/, 'Inclua pelo menos um número.');

export const loginSchema = z.object({ email, password });

export const registerSchema = z
  .object({
    accountType: z.enum(['customer', 'seller', 'carrier', 'courier']),
    name: z.string().trim().optional(),
    genderId: z.string().optional(),
    identityNumber: z.string().trim().max(80, 'Use no máximo 80 caracteres.').optional(),
    storeName: z.string().trim().optional(),
    entityTypeId: z.string().optional(),
    taxNumber: z.string().trim().optional(),
    phone: z.string().trim().min(1, 'Informe o telefone.').max(30, 'Telefone muito longo.'),
    email,
    address: z.string().trim().optional(),
    provinceId: z.string().optional(),
    municipalityId: z.string().optional(),
    password,
    passwordConfirmation: z.string().min(1, 'Confirme a senha.'),
  })
  .superRefine((data, context) => {
    const isEntity = ['seller', 'carrier'].includes(data.accountType);
    function requireField(field, message) {
      if (!data[field]) context.addIssue({ code: 'custom', message, path: [field] });
    }
    if (isEntity) {
      requireField('storeName', 'Informe o nome da entidade.');
      requireField('entityTypeId', 'Escolha o tipo de entidade.');
      requireField('taxNumber', 'Informe o NIF.');
    } else {
      requireField('name', 'Informe o nome completo.');
      requireField('genderId', 'Escolha o género.');
      requireField('address', 'Informe a morada.');
      requireField('provinceId', 'Escolha a província.');
      requireField('municipalityId', 'Escolha o município.');
    }
    if (data.password !== data.passwordConfirmation) {
      context.addIssue({
        code: 'custom',
        message: 'As senhas não coincidem.',
        path: ['passwordConfirmation'],
      });
    }
  });

export const forgotPasswordSchema = z.object({ email });

const angolaPhone = z
  .string()
  .trim()
  .min(1, 'Informe o telefone.')
  .regex(/^9\d{8}$/, 'Informe os 9 dígitos, por exemplo 923000000.');

export const forgotPasswordSmsSchema = z.object({ phone: angolaPhone });

export const resetPasswordSmsSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Informe o código de 6 dígitos.'),
    password,
    passwordConfirmation: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'As senhas não coincidem.',
    path: ['passwordConfirmation'],
  });

export const resetPasswordSchema = z
  .object({
    password,
    passwordConfirmation: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'As senhas não coincidem.',
    path: ['passwordConfirmation'],
  });
