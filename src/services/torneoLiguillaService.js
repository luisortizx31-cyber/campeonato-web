import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { FASE_LIGUILLA, FORMATO_LIGUILLA } from '../models/torneo'
import { nombreRonda } from '../utils/liguillaTorneo'
import { generarRondas } from '../utils/fixtureTorneo'
import { listarGolesPorCategoria } from './torneoGolesService'
import { listarTarjetasPorCategoria, eliminarTarjeta } from './torneoTarjetasService'

// Estado de la liguilla de una categoria - un solo doc en
// /torneo_liguilla/{torneoId}_{categoria} (mismo patron de id que
// /torneo_config, para que dos tenants nunca puedan pisarse el mismo
// doc), con el snapshot CONGELADO de clasificados (y quien tuvo el
// bye, si el formato es ELIMINACION) apenas se confirma. Se congela a
// proposito: si despues se corrige algo de la Tabla de Posiciones, el
// "mejor perdedor" y la reconstruccion del cuadro (ver
// liguillaTorneo.reconstruirBracket) siguen siendo estables en vez de
// recalcularse con datos que ya cambiaron.
//
// { torneoId, categoria, formato, qualifiers: [{equipoId, posicion}, ...], byeEquipoId, generadoEn }

function idEstadoLiguilla(torneoId, categoria) {
  return `${torneoId}_${categoria}`
}

export async function obtenerEstadoLiguilla(torneoId, categoria) {
  const snap = await getDoc(doc(db, 'torneo_liguilla', idEstadoLiguilla(torneoId, categoria)))
  return snap.exists() ? snap.data() : null
}

async function siguienteFechaNumero(torneoId, categoria) {
  const snap = await getDocs(
    query(
      collection(db, 'torneo_partidos'),
      where('torneoId', '==', torneoId),
      where('categoria', '==', categoria)
    )
  )
  return snap.docs.reduce((max, d) => Math.max(max, d.data().fechaNumero || 0), 0) + 1
}

// Un partido de liguilla tiene la misma forma minima que uno del
// fixture regular (ver torneoPartidosService.generarFixture) mas
// `fase` (para distinguirlo de la temporada regular), `ganadorId`
// (solo se usa si el cruce termina empatado, ver
// definirGanadorPartidoLiguilla) y `rondaLiguilla` (solo formato
// ELIMINACION - identifica a que ronda del cuadro pertenece,
// independiente del fechaNumero: un cruce ida y vuelta ocupa DOS
// fechas pero es la MISMA ronda, ver liguillaTorneo.reconstruirBracket).
function crearPartidoDoc(batch, { torneoId, categoria, equipoLocalId, equipoVisitanteId, jornada, fechaNumero, rondaLiguilla }) {
  const ref = doc(collection(db, 'torneo_partidos'))
  batch.set(ref, {
    torneoId,
    categoria,
    equipoLocalId,
    equipoVisitanteId,
    golesLocal: null,
    golesVisitante: null,
    ganadorId: null,
    fecha: null,
    jornada,
    fechaNumero,
    fase: FASE_LIGUILLA,
    ...(rondaLiguilla != null ? { rondaLiguilla } : {}),
    creadoEn: serverTimestamp(),
  })
}

// Crea los partidos de una tanda de cruces del CUADRO eliminatorio -
// cada cruce se decide individualmente a un partido o ida y vuelta
// (ver EditorCruces en TabLiguilla, no es una eleccion para toda la
// ronda). Todas las "idas" (o el partido unico, si un cruce no tiene
// vuelta) comparten un fechaNumero; si algun cruce de la tanda es ida
// y vuelta, todas las "vueltas" comparten el fechaNumero siguiente -
// mismo criterio que una fecha del fixture regular (varios partidos
// simultaneos bajo el mismo numero de fecha).
function crearCrucesEliminacion(batch, { torneoId, categoria, cruces, rondaLiguilla, jornada, fechaNumero }) {
  cruces.forEach(({ equipoLocalId, equipoVisitanteId, idaYVuelta }) => {
    crearPartidoDoc(batch, {
      torneoId,
      categoria,
      equipoLocalId,
      equipoVisitanteId,
      jornada: idaYVuelta ? `${jornada} · Ida` : jornada,
      fechaNumero,
      rondaLiguilla,
    })
    if (idaYVuelta) {
      crearPartidoDoc(batch, {
        torneoId,
        categoria,
        equipoLocalId: equipoVisitanteId,
        equipoVisitanteId: equipoLocalId,
        jornada: `${jornada} · Vuelta`,
        fechaNumero: fechaNumero + 1,
        rondaLiguilla,
      })
    }
  })
}

// Ronda 1 del CUADRO eliminatorio: guarda el snapshot de
// clasificados/bye Y crea los partidos en un solo batch (atomico) -
// `qualifiers` y `cruces` (con su `idaYVuelta` cruce por cruce) ya
// vienen confirmados (y posiblemente reordenados/editados a mano)
// desde TabLiguilla.
export async function iniciarLiguilla({ torneoId, categoria, qualifiers, byeEquipoId, cruces }) {
  const fechaNumero = await siguienteFechaNumero(torneoId, categoria)
  const jornada = nombreRonda(qualifiers.length)

  const batch = writeBatch(db)
  batch.set(doc(db, 'torneo_liguilla', idEstadoLiguilla(torneoId, categoria)), {
    torneoId,
    categoria,
    formato: FORMATO_LIGUILLA.ELIMINACION,
    qualifiers,
    byeEquipoId: byeEquipoId || null,
    generadoEn: serverTimestamp(),
  })
  crearCrucesEliminacion(batch, { torneoId, categoria, cruces, rondaLiguilla: 1, jornada, fechaNumero })
  await batch.commit()
  return fechaNumero
}

// Ronda 2 en adelante del cuadro: el doc de estado ya existe, solo se
// crean los partidos de la ronda nueva. `rondaLiguilla` la calcula
// TabLiguilla a partir del cuadro ya reconstruido (cantidad de rondas
// existentes + 1).
export async function generarRondaLiguilla({ torneoId, categoria, rondaLiguilla, cruces }) {
  const fechaNumero = await siguienteFechaNumero(torneoId, categoria)
  const jornada = nombreRonda(cruces.length * 2)

  const batch = writeBatch(db)
  crearCrucesEliminacion(batch, { torneoId, categoria, cruces, rondaLiguilla, jornada, fechaNumero })
  await batch.commit()
  return fechaNumero
}

// Formato GRUPO ("todos contra todos"): arma el fixture con el mismo
// generador que usa la temporada regular (utils/fixtureTorneo -
// metodo del circulo) - `idaYVuelta` es una sola eleccion para todo
// el grupo (no cruce por cruce: mezclar cantidad de partidos por par
// dentro de un todos-contra-todos rompe el armado de fechas parejo).
// No usa `rondaLiguilla` - la tabla de este grupo (ver
// calcularTablaPosiciones) se calcula sobre TODOS sus partidos juntos,
// no ronda por ronda como el cuadro.
export async function iniciarLiguillaGrupo({ torneoId, categoria, qualifiers, idaYVuelta }) {
  const equipoIds = qualifiers.map((q) => q.equipoId)
  const rondas = generarRondas(equipoIds, idaYVuelta)
  const fechaNumeroInicial = await siguienteFechaNumero(torneoId, categoria)

  const batch = writeBatch(db)
  batch.set(doc(db, 'torneo_liguilla', idEstadoLiguilla(torneoId, categoria)), {
    torneoId,
    categoria,
    formato: FORMATO_LIGUILLA.GRUPO,
    qualifiers,
    byeEquipoId: null,
    generadoEn: serverTimestamp(),
  })
  rondas.forEach((partidosRonda, indice) => {
    partidosRonda.forEach(([equipoLocalId, equipoVisitanteId]) => {
      crearPartidoDoc(batch, {
        torneoId,
        categoria,
        equipoLocalId,
        equipoVisitanteId,
        jornada: `Liguilla · Fecha ${indice + 1}`,
        fechaNumero: fechaNumeroInicial + indice,
      })
    })
  })
  await batch.commit()
  return fechaNumeroInicial
}

// Agrega un cruce suelto a mano - para cuando el sorteo se hizo por
// fuera de la app, o para un partido que el asistente automatico no
// contempla (ej. un desempate, un repechaje, el 3er puesto). Sirve
// para los dos formatos: en ELIMINACION hay que indicar a que
// `rondaLiguilla` pertenece (normalmente la que esta en curso); en
// GRUPO se deja null (ahi no hay concepto de ronda del cuadro, cuenta
// para la tabla del grupo igual que cualquier otro partido).
export async function agregarPartidoManualLiguilla({
  torneoId,
  categoria,
  equipoLocalId,
  equipoVisitanteId,
  idaYVuelta,
  rondaLiguilla = null,
  jornada,
}) {
  if (equipoLocalId === equipoVisitanteId) {
    throw new Error('Los dos equipos del cruce no pueden ser el mismo.')
  }
  const fechaNumero = await siguienteFechaNumero(torneoId, categoria)

  const batch = writeBatch(db)
  crearPartidoDoc(batch, {
    torneoId,
    categoria,
    equipoLocalId,
    equipoVisitanteId,
    jornada: idaYVuelta ? `${jornada} · Ida` : jornada,
    fechaNumero,
    rondaLiguilla,
  })
  if (idaYVuelta) {
    crearPartidoDoc(batch, {
      torneoId,
      categoria,
      equipoLocalId: equipoVisitanteId,
      equipoVisitanteId: equipoLocalId,
      jornada: `${jornada} · Vuelta`,
      fechaNumero: fechaNumero + 1,
      rondaLiguilla,
    })
  }
  await batch.commit()
}

// Solo hace falta cuando un cruce de liguilla termina empatado en el
// agregado (no hay definicion de penales en la app) - el Maestro
// elige a mano quien avanza desde TabLiguilla. Se guarda en el
// partido DECISIVO del cruce (el unico si es a un partido, o la
// vuelta si es ida y vuelta - ver liguillaTorneo.agruparPorCruce). No
// toca golesLocal/golesVisitante.
export async function definirGanadorPartidoLiguilla(partidoId, ganadorId) {
  await updateDoc(doc(db, 'torneo_partidos', partidoId), { ganadorId })
}

// Borra SOLO la liguilla (sus partidos + goles + tarjetas + el
// snapshot de estado) sin tocar la temporada regular - blast radius
// acotado, a diferencia de "Reiniciar TODA la temporada". Sirve para
// los dos formatos por igual (filtra por `fase`, no por `formato`).
// Las tarjetas se borran una por una con eliminarTarjeta (no en el
// batch de abajo) para que cada una revierta el contador de
// amarillas/rojas/suspension del jugador correspondiente, igual que
// borrar una tarjeta a mano desde Amonestados.
export async function reiniciarLiguilla(torneoId, categoria) {
  const partidosSnap = await getDocs(
    query(
      collection(db, 'torneo_partidos'),
      where('torneoId', '==', torneoId),
      where('categoria', '==', categoria),
      where('fase', '==', FASE_LIGUILLA)
    )
  )
  const idsLiguilla = new Set(partidosSnap.docs.map((d) => d.id))

  const [goles, tarjetas, solicitudesSnap] = await Promise.all([
    listarGolesPorCategoria(torneoId, categoria),
    listarTarjetasPorCategoria(torneoId, categoria),
    getDocs(
      query(
        collection(db, 'torneo_solicitudes_cambio'),
        where('torneoId', '==', torneoId),
        where('categoria', '==', categoria)
      )
    ),
  ])

  const tarjetasLiguilla = tarjetas.filter((t) => idsLiguilla.has(t.partidoId))
  for (const tarjeta of tarjetasLiguilla) {
    await eliminarTarjeta(tarjeta.id)
  }

  const batch = writeBatch(db)
  partidosSnap.docs.forEach((d) => batch.delete(d.ref))
  goles.filter((g) => idsLiguilla.has(g.partidoId)).forEach((g) => batch.delete(doc(db, 'torneo_goles', g.id)))
  solicitudesSnap.docs
    .filter((d) => idsLiguilla.has(d.data().partidoId))
    .forEach((d) => batch.delete(d.ref))
  batch.delete(doc(db, 'torneo_liguilla', idEstadoLiguilla(torneoId, categoria)))
  await batch.commit()
}
