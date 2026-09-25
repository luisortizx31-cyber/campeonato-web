import { formatearFechaProgramada } from './fixtureTorneo'

// Reglas para programar los horarios de los partidos de una misma Fecha
// (ver ModalReprogramarFecha y el editor de horario de cada partido en
// TabFechas): los partidos se juegan uno tras otro, asi que un partido
// tiene que empezar DESPUES del anterior, y dos partidos no pueden tener
// exactamente el mismo horario. Sirve para desactivar en el selector
// (SelectorFechaHora) los horarios que no se pueden elegir.

// `items` es [{ id, fecha }] en el orden en que se muestran los
// partidos (fecha es un Date de JS, o null si todavia no tienen
// horario). Devuelve un Map id -> { minimo, ocupados }:
//  - minimo: el horario mas tardio entre los partidos que estan ARRIBA
//    en la lista (null si no hay ninguno con horario) - el partido tiene
//    que empezar despues de ese.
//  - ocupados: los horarios (en milisegundos) de todos los OTROS
//    partidos - no se pueden repetir.
export function calcularRestricciones(items) {
  const restricciones = new Map()
  let maximoArriba = null
  items.forEach((item, indice) => {
    const ocupados = new Set(items.filter((otro, j) => j !== indice && otro.fecha).map((otro) => otro.fecha.getTime()))
    restricciones.set(item.id, { minimo: maximoArriba, ocupados })
    if (item.fecha && (!maximoArriba || item.fecha.getTime() > maximoArriba.getTime())) maximoArriba = item.fecha
  })
  return restricciones
}

// Texto del problema de `fecha` (Date) frente a la restriccion, o null si
// el horario se puede usar.
export function motivoHorarioInvalido(fecha, restriccion) {
  if (!fecha || !restriccion) return null
  if (restriccion.ocupados?.has(fecha.getTime())) return 'Ya hay otro partido a esa hora.'
  if (restriccion.minimo && fecha.getTime() <= restriccion.minimo.getTime()) {
    return `Tiene que ser después de ${formatearFechaProgramada(restriccion.minimo)}.`
  }
  return null
}
