// Constantes del modulo "Campeonato". Coinciden 1:1 con los valores
// guardados en /torneo_equipos, /torneo_jugadores y /torneo_tarjetas
// (ver services/torneo*.js) y con lo que validan las Security Rules.
export const CATEGORIA_TORNEO = {
  MASTER: 'master',
  LIBRE: 'libre',
}

export const CATEGORIA_TORNEO_LABELS = {
  [CATEGORIA_TORNEO.MASTER]: 'Master',
  [CATEGORIA_TORNEO.LIBRE]: 'Libre',
}

export const TIPO_TARJETA = {
  AMARILLA: 'amarilla',
  ROJA: 'roja',
}

export const TIPO_TARJETA_LABELS = {
  [TIPO_TARJETA.AMARILLA]: 'Amarilla',
  [TIPO_TARJETA.ROJA]: 'Roja',
}

// Tokens de color del design system (ver src/index.css) para pintar
// cada tipo de tarjeta de forma consistente en toda la UI.
export const TIPO_TARJETA_STYLES = {
  [TIPO_TARJETA.AMARILLA]: { texto: 'text-warning', fondo: 'bg-warning-soft' },
  [TIPO_TARJETA.ROJA]: { texto: 'text-danger', fondo: 'bg-danger-soft' },
}

// Valor por defecto para categorias que todavia no tienen su propio
// umbral guardado en /torneo_config/{categoria} (ver
// torneoConfigService.obtenerUmbralAmarillas). El umbral real es
// configurable por el Maestro, por separado para Master y Libre.
// Una roja directa suspende siempre, sin importar este umbral.
export const UMBRAL_SUSPENSION_AMARILLAS_DEFAULT = 2

// Opciones que se ofrecen en el selector de configuracion (ver
// TabAmonestados). No hay ninguna razon tecnica para este rango
// especifico, solo cubre los valores que se usan en la practica.
export const OPCIONES_UMBRAL_AMARILLAS = [2, 3, 4, 5]

// Cantidad de veces que un jugador puede ser suspendido por tarjeta
// roja directa antes de quedar eliminado del campeonato (no solo
// suspendido). A diferencia del umbral de amarillas, no tiene un
// valor por defecto: si el Maestro no lo configura para una
// categoria, nunca se elimina a nadie automaticamente.
export const OPCIONES_UMBRAL_ROJAS = [1, 2, 3, 4]
