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
import { FASE_LIGUILLA } from '../models/torneo'
import { nombreRonda } from '../utils/liguillaTorneo'
import { listarGolesPorCategoria } from './torneoGolesService'
import { listarTarjetasPorCategoria, eliminarTarjeta } from './torneoTarjetasService'

// Estado del cuadro eliminatorio de una categoria - un solo doc en
// /torneo_liguilla/{torneoId}_{categoria} (mismo patron de id que
// /torneo_config, para que dos tenants nunca puedan pisarse el mismo
// doc), con el snapshot CONGELADO de clasificados (y quien tuvo el
// bye) apenas se confirma la Ronda 1. Se congela a proposito: si
// despues se corrige algo de la Tabla de Posiciones, el "mejor
// perdedor" y la reconstruccion del cuadro (ver
// liguillaTorneo.reconstruirBracket) siguen siendo estables en vez de
// recalcularse con datos que ya cambiaron.
//
// { torneoId, categoria, qualifiers: [{equipoId, posicion}, ...], byeEquipoId, generadoEn }

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

// Ronda 1: guarda el snapshot de clasificados/bye Y crea los partidos
// en un solo batch (atomico) - `qualifiers` y `cruces` ya vienen
// confirmados (y posiblemente reordenados a mano) desde TabLiguilla.
// Los partidos quedan con la misma forma minima que los del fixture
// regular (ver torneoPartidosService.generarFixture) mas `fase` (para
// distinguirlos de la temporada regular) y `ganadorId` (solo se usa si
// terminan empatados, ver definirGanadorPartidoLiguilla).
export async function iniciarLiguilla({ torneoId, categoria, qualifiers, byeEquipoId, cruces }) {
  const fechaNumero = await siguienteFechaNumero(torneoId, categoria)
  const jornada = nombreRonda(qualifiers.length)

  const batch = writeBatch(db)
  batch.set(doc(db, 'torneo_liguilla', idEstadoLiguilla(torneoId, categoria)), {
    torneoId,
    categoria,
    qualifiers,
    byeEquipoId: byeEquipoId || null,
    generadoEn: serverTimestamp(),
  })
  cruces.forEach(([equipoLocalId, equipoVisitanteId]) => {
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
      creadoEn: serverTimestamp(),
    })
  })
  await batch.commit()
  return fechaNumero
}

// Ronda 2 en adelante: el doc de estado ya existe, solo se crean los
// partidos de la ronda nueva.
export async function generarRondaLiguilla({ torneoId, categoria, cruces }) {
  const fechaNumero = await siguienteFechaNumero(torneoId, categoria)
  const jornada = nombreRonda(cruces.length * 2)

  const batch = writeBatch(db)
  cruces.forEach(([equipoLocalId, equipoVisitanteId]) => {
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
      creadoEn: serverTimestamp(),
    })
  })
  await batch.commit()
  return fechaNumero
}

// Solo hace falta cuando un partido de liguilla termina empatado (no
// hay definicion de penales en la app) - el Maestro elige a mano quien
// avanza desde TabLiguilla. No toca golesLocal/golesVisitante.
export async function definirGanadorPartidoLiguilla(partidoId, ganadorId) {
  await updateDoc(doc(db, 'torneo_partidos', partidoId), { ganadorId })
}

// Borra SOLO la liguilla (sus partidos + goles + tarjetas + el
// snapshot de estado) sin tocar la temporada regular - blast radius
// acotado, a diferencia de "Reiniciar TODA la temporada". Las
// tarjetas se borran una por una con eliminarTarjeta (no en el batch
// de abajo) para que cada una revierta el contador de
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
