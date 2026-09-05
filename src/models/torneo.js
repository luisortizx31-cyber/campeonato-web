// Constantes del modulo "Campeonato". Coinciden 1:1 con los valores
// guardados en /torneo_equipos, /torneo_jugadores y /torneo_tarjetas
// (ver services/torneo*.js) y con lo que validan las Security Rules.
export const CATEGORIA_TORNEO = {
  MASTER: 'master',
  LIBRE: 'libre',
  INFANTIL: 'infantil',
  SUB8: 'sub8',
  SUB10: 'sub10',
  SUB12: 'sub12',
  SUB15: 'sub15',
  SUB17: 'sub17',
}

export const CATEGORIA_TORNEO_LABELS = {
  [CATEGORIA_TORNEO.MASTER]: 'Master',
  [CATEGORIA_TORNEO.LIBRE]: 'Libre',
  [CATEGORIA_TORNEO.INFANTIL]: 'Infantil',
  [CATEGORIA_TORNEO.SUB8]: 'Sub-8',
  [CATEGORIA_TORNEO.SUB10]: 'Sub-10',
  [CATEGORIA_TORNEO.SUB12]: 'Sub-12',
  [CATEGORIA_TORNEO.SUB15]: 'Sub-15',
  [CATEGORIA_TORNEO.SUB17]: 'Sub-17',
}

// Lista completa de categorias que existen en el sistema, en el orden
// fijo en que se muestran (ver TabConfiguracion, seccion "Categorias
// del campeonato"). Cada torneo elige un subconjunto de esta lista
// (ver categoriasActivas en torneoConfigService) - el resto de la app
// nunca itera sobre esta constante directamente, solo sobre las
// activas de cada torneo.
export const CATEGORIAS_TORNEO_DISPONIBLES = Object.values(CATEGORIA_TORNEO)

// Categorias activas por defecto para torneos creados antes de esta
// funcionalidad (que todavia no tienen categoriasActivas guardado en
// torneo_config) - preserva el comportamiento de siempre, sin
// necesidad de migrar datos.
export const CATEGORIAS_ACTIVAS_DEFAULT = [CATEGORIA_TORNEO.MASTER, CATEGORIA_TORNEO.LIBRE]

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

// Cuantos jugadores juegan por equipo en esta categoria (futbol 6, 7
// u 11) - por defecto 11. Se usa en ControlPartido para guiar cuantos
// titulares corresponde marcar, sin bloquear al Maestro si en un
// partido puntual hay que jugar con menos (lesiones, etc).
export const JUGADORES_POR_EQUIPO_DEFAULT = 11
export const OPCIONES_JUGADORES_POR_EQUIPO = [6, 7, 11]

// Diferencia de gol con la que se cierra un partido por "walkover"
// (abandono): si un equipo se queda con menos jugadores en cancha que
// el minimo configurado (ver minimoJugadoresCancha en
// torneoConfigService y el aviso en ControlPartido), se le da
// vencedor al otro con este marcador fijo (ej. 3-0) - no se suma a
// los goles ya metidos, es el resultado final tal cual, igual que un
// walkover real. null en minimoJugadoresCancha significa "no aplica
// esta regla" (comportamiento por defecto, ningun partido se corta
// solo).
export const DIFERENCIA_WALKOVER_DEFAULT = 3
export const OPCIONES_DIFERENCIA_WALKOVER = [1, 2, 3, 4, 5]

// Tope de jugadores ACTIVOS (no eliminados) que se pueden inscribir
// por equipo en esta categoria - ver ModalRegistrarJugador, que
// bloquea el alta de un jugador nuevo si el equipo ya llego al tope.
// null (o "Sin límite" en Configuracion) significa que no hay tope,
// que es el comportamiento por defecto.
export const OPCIONES_MAXIMO_JUGADORES_INSCRITOS = [10, 12, 15, 18, 20, 25, 30]
