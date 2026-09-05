// Genera el fixture "todos contra todos" de una categoria usando el
// metodo del circulo (round-robin estandar): se fija el primer
// equipo y el resto rota una posicion en cada fecha, emparejando
// simetricos desde los extremos. No toca Firestore - lo usa
// torneoPartidosService.generarFixture para escribir los partidos.
//
// Con cantidad impar de equipos se agrega un "descanso" (null) que
// no genera partido esa fecha para el equipo emparejado con el.
//
// Devuelve un array de fechas; cada fecha es un array de
// [equipoLocalId, equipoVisitanteId].
export function generarRondas(equipoIds, idaYVuelta) {
  let lista = [...equipoIds]
  if (lista.length % 2 !== 0) lista.push(null)
  const n = lista.length
  const numRondas = n - 1

  const rondas = []
  for (let ronda = 0; ronda < numRondas; ronda++) {
    const partidosRonda = []
    for (let i = 0; i < n / 2; i++) {
      const a = lista[i]
      const b = lista[n - 1 - i]
      if (a !== null && b !== null) {
        // Alterna quien es local para no dejar siempre del mismo lado
        // al equipo fijo (lista[0]).
        partidosRonda.push(ronda % 2 === 0 ? [a, b] : [b, a])
      }
    }
    rondas.push(partidosRonda)

    const ultimo = lista.pop()
    lista.splice(1, 0, ultimo)
  }

  if (!idaYVuelta) return rondas

  const rondasVuelta = rondas.map((ronda) => ronda.map(([local, visitante]) => [visitante, local]))
  return [...rondas, ...rondasVuelta]
}

// Cuantas fechas resultarian de generar el fixture - se usa para
// mostrar una vista previa antes de confirmar (ver TabFechas).
export function calcularNumeroFechas(numEquipos, idaYVuelta) {
  if (numEquipos < 2) return 0
  const numRondas = numEquipos % 2 === 0 ? numEquipos - 1 : numEquipos
  return idaYVuelta ? numRondas * 2 : numRondas
}

// "En que fecha vamos": la mayor fecha cuyos partidos estan TODOS
// jugados (con resultado cargado). 0 si ninguna fecha esta completa
// todavia. Se usa para levantar automaticamente las suspensiones
// cuando ya se jugaron TODAS las fechas que duraban (ver
// torneoTarjetasService.reconciliarSuspensionesPorFecha) - ahi si
// tiene que estar completa la fecha entera, porque la suspension cubre
// todos los partidos de esa fecha, no uno solo.
export function calcularFechaActual(partidos) {
  const fechas = [...new Set(partidos.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))]
  let actual = 0
  for (const f of fechas) {
    const completa = partidos.filter((p) => p.fechaNumero === f).every((p) => p.golesLocal != null)
    if (completa && f > actual) actual = f
  }
  return actual
}

// Fechas donde el EQUIPO indicado ya jugo su partido (no hace falta
// que el resto de la fecha este completa) - se usa para el selector
// de fecha al cargar una tarjeta o un gol "sueltos" (ver
// ModalAgregarTarjeta/ModalAgregarGol): sin equipoId, antes se
// ofrecia cualquier fecha donde CUALQUIER partido de la categoria ya
// tuviera resultado, lo que dejaba elegir una fecha en la que el
// equipo del jugador ni siquiera habia jugado todavia, solo porque
// algun otro partido de esa misma fecha si.
export function calcularFechasConPartidoJugado(partidos, equipoId) {
  const relevantes = equipoId
    ? partidos.filter((p) => p.equipoLocalId === equipoId || p.equipoVisitanteId === equipoId)
    : partidos
  const fechas = [...new Set(relevantes.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))]
  return fechas
    .filter((f) => relevantes.some((p) => p.fechaNumero === f && p.golesLocal != null))
    .sort((a, b) => a - b)
}

// Formato corto para mostrar el dia/hora programado de un partido
// (campo `fecha`, ver torneoPartidosService.actualizarFechaProgramada)
// tanto en el panel admin como en la pagina publica - un solo lugar
// para no repetir el formato en los dos.
export function formatearFechaProgramada(timestamp) {
  const fecha = timestamp.toDate()
  const dia = fecha.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })
  const hora = fecha.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' })
  return `${dia} · ${hora}`
}

// Version mas compacta (sin el dia de la semana) para la etiqueta
// chica debajo de cada pastilla "Fecha N" en el selector de
// TabFechasPublica, que tiene mucho menos espacio horizontal que la
// tarjeta del partido.
export function formatearFechaCompacta(timestamp) {
  const fecha = timestamp.toDate()
  const dia = fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
  const hora = fecha.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' })
  return `${dia} · ${hora}`
}

// Orden de los partidos DENTRO de una misma Fecha (ver TabFechas y
// TabFechasPublica): primero los que todavia no se jugaron (de menor
// a mayor hora programada, los sin horario al final), y recien
// despues los ya jugados - un partido jugado con un horario temprano
// (ej. 12:00 a.m. por defecto) no debe aparecer mezclado arriba de
// los pendientes, ya se jugo y no hace falta seguir viendolo primero.
export function compararPartidosPorHorario(a, b) {
  const aJugado = a.golesLocal != null
  const bJugado = b.golesLocal != null
  if (aJugado !== bJugado) return aJugado ? 1 : -1
  return (a.fecha?.toMillis?.() ?? Infinity) - (b.fecha?.toMillis?.() ?? Infinity)
}

function parEquipos(partido) {
  return [partido.equipoLocalId, partido.equipoVisitanteId].sort().join('|')
}

// Si "ida" (null) o "vuelta" de un partido, comparandolo contra el
// resto de partidos de la MISMA categoria: cuando el mismo par de
// equipos (sin importar quien es local) aparece en dos fechas
// distintas, la de numero menor es la ida y la otra la vuelta. No
// depende de como se creo el fixture (generado automatico o cargado a
// mano con ModalAgregarPartidoFecha) - se deduce solo de los cruces
// ya guardados. Devuelve null si ese par solo aparece una vez (fixture
// a una sola vuelta, o partido suelto sin revancha).
export function calcularLegPartido(partido, partidos) {
  if (partido.fechaNumero == null) return null
  const par = parEquipos(partido)
  const mismoPar = partidos
    .filter((p) => p.fechaNumero != null && parEquipos(p) === par)
    .map((p) => p.fechaNumero)
  if (mismoPar.length < 2) return null
  const primera = Math.min(...mismoPar)
  return partido.fechaNumero === primera ? 'ida' : 'vuelta'
}
