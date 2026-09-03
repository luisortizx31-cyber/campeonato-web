// Un solo rol por ahora: el Maestro que administra su propio
// campeonato. La parte publica (/campeonato) no requiere ningun rol -
// es de solo lectura, sin login.
//
// Aparte del rol, algunas cuentas (las que dan de alta colegios
// nuevos) tienen ademas el flag booleano superAdmin:true en su doc de
// /usuarios - ver superadminService.js y PanelSuperAdmin.jsx. No es
// un rol distinto: un superadmin sigue siendo 'master' de su propio
// torneo, y ademas puede crear tenants nuevos.
export const ROLES = {
  MASTER: 'master',
}

export const ROLE_LABELS = {
  [ROLES.MASTER]: 'Administrador',
}
