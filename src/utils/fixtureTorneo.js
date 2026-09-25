import { FASE_LIGUILLA } from '../models/torneo'

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
  const fecha = timestamp.toDate ? timestamp.toDate() : timestamp
  const dia = fecha.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${dia} · ${formatearHora12(timestamp)}`
}

// Hora siempre en formato de 12 horas con AM/PM en mayusculas ("4:30 PM",
// "12:00 AM") - se arma a mano en vez de toLocaleTimeString porque este
// devuelve "p. m." (con puntos y espacios raros) segun el navegador. Es
// el unico formato de hora que se muestra para los horarios programados.
export function formatearHora12(timestamp) {
  const fecha = timestamp.toDate ? timestamp.toDate() : timestamp
  let horas = fecha.getHours() % 12
  if (horas === 0) horas = 12
  const meridiano = fecha.getHours() >= 12 ? 'PM' : 'AM'
  return `${horas}:${String(fecha.getMinutes()).padStart(2, '0')} ${meridiano}`
}

// Dia y hora por separado, para la etiqueta de dos lineas debajo de
// cada pastilla "Fecha N" en el selector de TabFechasPublica (ej.
// "sáb, 5 set" arriba y "12 am" abajo) - en una sola linea el formato
// completo de formatearFechaProgramada no entra en el poco espacio
// horizontal que tiene esa pastilla.
export function formatearDiaCorto(timestamp) {
  return timestamp.toDate().toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Dia completo para el encabezado grande al entrar a una Fecha ("Viernes
// 25 de setiembre") - a diferencia de formatearDiaCorto (abreviado, para
// la pastilla chica del selector), este lleva el nombre del dia y del
// mes enteros. toLocaleDateString los devuelve en minuscula.
export function formatearDiaLargo(timestamp) {
  const fecha = timestamp.toDate ? timestamp.toDate() : timestamp
  const texto = fecha.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// Hora en 12h sin los minutos cuando son :00 (ej. "12 AM" en vez de
// "12:00 AM") - mas compacta que formatearHora12 para esa misma
// etiqueta de dos lineas.
export function formatearHoraCorta(timestamp) {
  const fecha = timestamp.toDate()
  const minutos = fecha.getMinutes()
  let horas = fecha.getHours() % 12
  if (horas === 0) horas = 12
  const meridiano = fecha.getHours() >= 12 ? 'PM' : 'AM'
  return minutos === 0 ? `${horas} ${meridiano}` : `${horas}:${String(minutos).padStart(2, '0')} ${meridiano}`
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
  // La liguilla tiene su propia ida y vuelta: un cruce de liguilla solo se
  // compara con otros de liguilla (y uno de la temporada regular solo con
  // los de la regular), aunque sean los mismos dos equipos - si no, la
  // liguilla aparecia como "vuelta" de un partido de la temporada.
  const esLiguilla = partido.fase === FASE_LIGUILLA
  const par = parEquipos(partido)
  const mismoPar = partidos
    .filter((p) => p.fechaNumero != null && (p.fase === FASE_LIGUILLA) === esLiguilla && parEquipos(p) === par)
    .map((p) => p.fechaNumero)
  if (mismoPar.length < 2) return null
  const primera = Math.min(...mismoPar)
  return partido.fechaNumero === primera ? 'ida' : 'vuelta'
}

// Si la Fecha es de la liguilla (cuadro eliminatorio o grupo final, ver
// torneoLiguillaService): sus partidos llevan fase === FASE_LIGUILLA.
export function esFechaLiguilla(fechaNumero, partidos) {
  return partidos.some((p) => p.fechaNumero === fechaNumero && p.fase === FASE_LIGUILLA)
}

// "Liguilla ida" / "Liguilla vuelta" segun el leg de calcularLegPartido
// (o de una fecha entera); "Liguilla" a secas si es a un solo partido.
export function etiquetaLiguilla(leg) {
  if (leg === 'ida') return 'Liguilla ida'
  if (leg === 'vuelta') return 'Liguilla vuelta'
  return 'Liguilla'
}

// "Fecha 11", "Fecha 11–12" (seguidas) o "Fecha 11, 13" (salteadas).
export function textoFechas(fechas) {
  const orden = [...fechas].sort((a, b) => a - b)
  if (orden.length === 1) return `Fecha ${orden[0]}`
  const seguidas = orden.every((f, i) => i === 0 || f === orden[i - 1] + 1)
  return seguidas ? `Fecha ${orden[0]}–${orden[orden.length - 1]}` : `Fecha ${orden.join(', ')}`
}
