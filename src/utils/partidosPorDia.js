// Helpers de la pestaña publica "Partidos" (ver TabPartidosPublica): agrupa
// los partidos por el DIA de su fecha programada (campo `fecha`, ver
// torneoPartidosService.actualizarFechaProgramada), sin importar la
// categoria ni el numero de Fecha del fixture. Todo en hora local del
// celular de quien mira - un dia es el dia de calendario de su zona.

// Un partido arrancado (horaInicio) y nunca finalizado deja de contarse
// como "en vivo" pasado este tiempo - si el Maestro se olvido de tocar
// Finalizar, no queremos un "EN VIVO" eterno en el listado publico.
const HORAS_MAX_EN_VIVO = 8

const MS_DIA = 24 * 60 * 60 * 1000

// 'fin' (ya tiene resultado), 'vivo' (arranco y todavia no termino) o
// 'pendiente'. El criterio de "vivo" es horaInicio (se marca al tocar
// "Arrancar partido" en ControlPartido), no el hecho de tener
// alineacion cargada (el delegado arma titulares con dias de
// anticipacion) ni marcador en vivo (ControlPartido lo escribe en 0
// apenas se abre el partido, aunque todavia no haya arrancado).
export function estadoPartido(partido, ahora) {
  if (partido.golesLocal != null && partido.golesVisitante != null) return 'fin'
  const inicio = partido.horaInicio?.toMillis?.()
  if (inicio != null) return ahora - inicio < HORAS_MAX_EN_VIVO * 60 * 60 * 1000 ? 'vivo' : 'pendiente'
  return 'pendiente'
}

// Dia de calendario local como texto ordenable ('2026-09-24').
export function claveDia(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

function fechaDeClave(clave) {
  const [anio, mes, dia] = clave.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

// Dias distintos (ordenados) en los que hay al menos un partido con
// fecha programada. Los partidos sin `fecha` no aparecen: no hay a que
// dia asignarlos.
export function diasConPartidos(partidos) {
  const claves = new Set()
  for (const p of partidos) {
    if (p.fecha?.toDate) claves.add(claveDia(p.fecha.toDate()))
  }
  return [...claves].sort()
}

// "AYER" / "HOY" / "MAÑANA" o, para el resto, "SÁB 5 SET".
export function etiquetaDia(clave, hoyClave) {
  const diferencia = Math.round((fechaDeClave(clave) - fechaDeClave(hoyClave)) / MS_DIA)
  if (diferencia === -1) return 'AYER'
  if (diferencia === 0) return 'HOY'
  if (diferencia === 1) return 'MAÑANA'
  const fecha = fechaDeClave(clave)
  const sinPunto = (texto) => texto.replace('.', '')
  const diaSemana = sinPunto(fecha.toLocaleDateString('es-PE', { weekday: 'short' }))
  const mes = sinPunto(fecha.toLocaleDateString('es-PE', { month: 'short' }))
  return `${diaSemana} ${fecha.getDate()} ${mes}`.toUpperCase()
}

// Dia con el que abre la pestaña: hoy si hay partidos hoy; si no, el
// proximo dia con partidos; y si ya no queda ninguno por delante, el
// ultimo que hubo - asi nunca se abre en una pantalla vacia cuando el
// campeonato tiene actividad cerca.
export function diaInicial(dias, hoyClave) {
  if (dias.length === 0) return hoyClave
  if (dias.includes(hoyClave)) return hoyClave
  return dias.find((d) => d > hoyClave) ?? dias[dias.length - 1]
}
