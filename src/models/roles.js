// Un solo rol por ahora: el Maestro que administra los campeonatos.
// La parte publica (/campeonato) no requiere ningun rol - es de solo
// lectura, sin login.
export const ROLES = {
  MASTER: 'master',
}

export const ROLE_LABELS = {
  [ROLES.MASTER]: 'Administrador',
}
