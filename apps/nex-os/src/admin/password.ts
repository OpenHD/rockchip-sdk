/** Reglas de contraseña del panel (las mismas para el registro y para cambiarla). null = válida. */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < 12) return 'Usá una contraseña de al menos 12 caracteres';
  if (password.length > 72) return 'Usá una contraseña de 72 caracteres o menos';
  const user = email.split('@')[0].toLowerCase();
  if (/^(.)\1+$/.test(password) || (user.length >= 3 && password.toLowerCase().includes(user))) {
    return 'Elegí una contraseña que no repita caracteres ni contenga tu email';
  }
  return null;
}

/** Traduce los errores de Supabase Auth al cambiar la contraseña. */
export function passwordErrorMessage(code: string | undefined, message: string): string {
  switch (code) {
    case 'same_password':
      return 'La contraseña nueva tiene que ser distinta de la actual';
    case 'weak_password':
      return 'La contraseña es demasiado débil: usá una más larga y variada';
    case 'insufficient_aal':
      return 'Confirmá con tu código de segundo factor y volvé a intentar';
    case 'reauthentication_not_valid':
      return 'El código del email no es válido o venció';
    default:
      return message || 'No se pudo cambiar la contraseña';
  }
}
