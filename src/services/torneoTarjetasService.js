import {
  collection,
  doc,
  runTransaction,
  updateDoc,
  writeBatch,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { TIPO_TARJETA, UMBRAL_SUSPENSION_AMARILLAS_DEFAULT } from '../models/torneo'

// Duracion por defecto (en fechas) de la suspension automatica por
// acumular amarillas - regla estandar de "te perdes la siguiente
// fecha". Para roja directa la duracion la elige el Maestro al cargar
// la tarjeta (ver fechasSuspension).
const DURACION_SUSPENSION_AMARILLAS = 1

// torneo_config es una coleccion compartida entre todos los tenants,
// asi que el id del documento tiene que incluir el torneoId para que
// dos torneos no pisen la config del otro (ver torneoConfigService).
function idConfigCategoria(torneoId, categoria) {
  return `${torneoId}_${categoria}`
}

function leerUmbrales(configSnap) {
  const data = configSnap.exists() ? configSnap.data() : {}
  return {
    umbralAmarillas: data.umbralAmarillas || UMBRAL_SUSPENSION_AMARILLAS_DEFAULT,
    umbralRojas: data.umbralRojas || null,
  }
}

// Registra una tarjeta y, en la misma transaccion, actualiza los
// contadores del jugador y su bandera de suspension. Se usa
// runTransaction (en vez del getDocs/reduce del resto de la app)
// porque aca si hay un contador real que puede perder una escritura
// concurrente - todo lo demas en este modulo se recalcula al vuelo.
//
// Si el jugador ya esta suspendido (o eliminado), se rechaza el
// registro: mientras no juegue, no hay partido en el que pueda
// ganarse una tarjeta nueva. El Maestro tiene que levantar la
// suspension primero (TabAmonestados).
//
// `fechaNumero` es la fecha del fixture en la que se gano la tarjeta
// (null si la tarjeta no esta atada a ninguna fecha). Cuando viene con
// fecha:
//  - no se permite cargar una tarjeta en una fecha igual o anterior a
//    la ultima que ya tiene ese jugador (tienen que ir en orden).
//  - si la tarjeta dispara una suspension, se calcula automaticamente
//    desde-hasta (en fechas) para que se active y se levante sola a
//    medida que se van completando fechas (ver
//    reconciliarSuspensionesPorFecha), sin que el Maestro tenga que
//    acordarse de levantarla a mano.
export async function registrarTarjeta({ torneoId, jugadorId, equipoId, categoria, tipo, partidoId, fecha, motivo, fechasSuspension, fechaNumero }) {
  const jugadorRef = doc(db, 'torneo_jugadores', jugadorId)
  const configRef = doc(db, 'torneo_config', idConfigCategoria(torneoId, categoria))
  const tarjetaRef = doc(collection(db, 'torneo_tarjetas'))
  const fechaNum = fechaNumero != null ? Number(fechaNumero) : null

  if (fechaNum != null) {
    const anterioresSnap = await getDocs(query(collection(db, 'torneo_tarjetas'), where('jugadorId', '==', jugadorId)))
    const ultimaFecha = anterioresSnap.docs.reduce((max, d) => Math.max(max, d.data().fechaNumero ?? 0), 0)
    if (fechaNum <= ultimaFecha) {
      throw new Error(`Este jugador ya tiene una tarjeta en la Fecha ${ultimaFecha}. Elige la Fecha ${ultimaFecha + 1} o una posterior.`)
    }
  }

  await runTransaction(db, async (tx) => {
    const jugadorSnap = await tx.get(jugadorRef)
    if (!jugadorSnap.exists()) throw new Error('El jugador ya no existe.')
    const jugador = jugadorSnap.data()

    if (jugador.suspendido) {
      throw new Error('Este jugador ya esta suspendido. Levanta la suspension antes de registrar otra tarjeta.')
    }

    const configSnap = await tx.get(configRef)
    const { umbralAmarillas, umbralRojas } = leerUmbrales(configSnap)

    const cambios = {}
    if (tipo === TIPO_TARJETA.AMARILLA) {
      const nuevasAmarillas = (jugador.amarillasAcumuladas || 0) + 1
      cambios.amarillasAcumuladas = nuevasAmarillas
      if (nuevasAmarillas >= umbralAmarillas) {
        cambios.suspendido = true
        cambios.motivoSuspension = `${umbralAmarillas} amarillas acumuladas`
        cambios.suspendidoDesde = serverTimestamp()
        if (fechaNum != null) {
          cambios.suspendidoDesdeFecha = fechaNum + 1
          cambios.suspendidoHastaFecha = fechaNum + DURACION_SUSPENSION_AMARILLAS
        }
      }
    } else {
      const nuevasRojas = (jugador.rojasAcumuladas || 0) + 1
      cambios.rojasAcumuladas = nuevasRojas
      cambios.suspendido = true
      cambios.motivoSuspension = 'Tarjeta roja directa'
      cambios.suspendidoDesde = serverTimestamp()
      cambios.fechasSuspension = fechasSuspension ? Number(fechasSuspension) : null
      if (fechaNum != null) {
        cambios.suspendidoDesdeFecha = fechaNum + 1
        cambios.suspendidoHastaFecha = fechaNum + (fechasSuspension ? Number(fechasSuspension) : 1)
      }

      if (umbralRojas && nuevasRojas >= umbralRojas) {
        cambios.eliminado = true
        cambios.motivoEliminacion = `${nuevasRojas} suspensiones por tarjeta roja directa`
      }
    }

    tx.update(jugadorRef, cambios)
    tx.set(tarjetaRef, {
      torneoId,
      jugadorId,
      equipoId,
      categoria,
      tipo,
      partidoId: partidoId || null,
      fecha,
      fechaNumero: fechaNum,
      motivo: motivo?.trim() || null,
      fechasSuspension: tipo === TIPO_TARJETA.ROJA && fechasSuspension ? Number(fechasSuspension) : null,
      creadoEn: serverTimestamp(),
    })
  })

  return tarjetaRef.id
}

// Corrige una tarjeta cargada por error: descuenta el contador
// correspondiente y recalcula si el jugador sigue suspendido/eliminado
// con los contadores resultantes.
export async function eliminarTarjeta(tarjetaId) {
  const tarjetaRef = doc(db, 'torneo_tarjetas', tarjetaId)

  await runTransaction(db, async (tx) => {
    const tarjetaSnap = await tx.get(tarjetaRef)
    if (!tarjetaSnap.exists()) return
    const tarjeta = tarjetaSnap.data()

    const jugadorRef = doc(db, 'torneo_jugadores', tarjeta.jugadorId)
    const jugadorSnap = await tx.get(jugadorRef)

    if (jugadorSnap.exists()) {
      const configSnap = await tx.get(doc(db, 'torneo_config', idConfigCategoria(tarjeta.torneoId, tarjeta.categoria)))
      const { umbralAmarillas, umbralRojas } = leerUmbrales(configSnap)

      const jugador = jugadorSnap.data()
      const amarillas = Math.max(
        0,
        (jugador.amarillasAcumuladas || 0) - (tarjeta.tipo === TIPO_TARJETA.AMARILLA ? 1 : 0)
      )
      const rojas = Math.max(
        0,
        (jugador.rojasAcumuladas || 0) - (tarjeta.tipo === TIPO_TARJETA.ROJA ? 1 : 0)
      )
      const sigueEliminado = Boolean(umbralRojas && rojas >= umbralRojas)
      const sigueSuspendido = sigueEliminado || amarillas >= umbralAmarillas || rojas >= 1

      tx.update(jugadorRef, {
        amarillasAcumuladas: amarillas,
        rojasAcumuladas: rojas,
        suspendido: sigueSuspendido,
        motivoSuspension: sigueSuspendido ? jugador.motivoSuspension || null : null,
        suspendidoDesde: sigueSuspendido ? jugador.suspendidoDesde || null : null,
        fechasSuspension: sigueSuspendido ? jugador.fechasSuspension || null : null,
        suspendidoDesdeFecha: sigueSuspendido ? jugador.suspendidoDesdeFecha || null : null,
        suspendidoHastaFecha: sigueSuspendido ? jugador.suspendidoHastaFecha || null : null,
        eliminado: sigueEliminado,
        motivoEliminacion: sigueEliminado ? jugador.motivoEliminacion || null : null,
      })
    }

    tx.delete(tarjetaRef)
  })
}

export async function listarTarjetasPorCategoria(torneoId, categoria) {
  const q = query(
    collection(db, 'torneo_tarjetas'),
    where('torneoId', '==', torneoId),
    where('categoria', '==', categoria)
  )
  const snap = await getDocs(q)
  const tarjetas = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  tarjetas.sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0))
  return tarjetas
}

// Botón manual "Levantar suspensión" / "Reincorporar" - para cuando el
// Maestro quiere forzar el levantamiento antes de tiempo (o
// reincorporar a un eliminado).
//
// Resetea amarillasAcumuladas a 0 (igual que reconciliarSuspensionesPorFecha,
// el levantamiento automatico) - si no, el jugador quedaba con las
// amarillas viejas ya cumplidas y la primera tarjeta nueva lo volvia a
// suspender al toque.
//
// NO resetea rojasAcumuladas a proposito: ese contador es el que hace
// funcionar la eliminacion automatica por reincidencia (umbralRojas,
// ver Amonestados) - si se reseteara aca, un jugador podria acumular
// rojas toda la temporada sin llegar nunca a esa eliminacion.
export async function limpiarSuspension(jugadorId) {
  await updateDoc(doc(db, 'torneo_jugadores', jugadorId), {
    suspendido: false,
    motivoSuspension: null,
    suspendidoDesde: null,
    fechasSuspension: null,
    suspendidoDesdeFecha: null,
    suspendidoHastaFecha: null,
    eliminado: false,
    motivoEliminacion: null,
    amarillasAcumuladas: 0,
  })
}

// Si el EQUIPO de un jugador ya jugo (con resultado cargado) todos los
// partidos que tenia programados entre `desdeFecha` y `hastaFecha`
// (su ventana de suspension). Una fecha en la que ese equipo no tenia
// partido (descanso, por numero impar de equipos) no cuenta ni suma
// ni resta - simplemente se salta. No hace falta que el RESTO de la
// categoria haya jugado esas fechas: alcanza con que el partido de
// ESE equipo ya se haya jugado.
function equipoCumplioSuspension(partidos, equipoId, desdeFecha, hastaFecha) {
  for (let f = desdeFecha; f <= hastaFecha; f++) {
    const partidosDelEquipo = partidos.filter(
      (p) => p.fechaNumero === f && (p.equipoLocalId === equipoId || p.equipoVisitanteId === equipoId)
    )
    if (partidosDelEquipo.some((p) => p.golesLocal == null)) return false
  }
  return true
}

// Levanta automaticamente las suspensiones (NO las eliminaciones, esas
// son permanentes/manuales) de los jugadores cuyo equipo ya cumplio su
// ventana de fechas de suspension (ver equipoCumplioSuspension) - se
// evalua por equipo, no por si la categoria entera termino esa fecha,
// porque el equipo del suspendido puede haber jugado ya aunque otro
// partido de la misma fecha este pendiente (reprogramado, etc).
// Se llama cada vez que se cargan Fechas o Amonestados, para que el
// Maestro nunca tenga que acordarse de tocar "Levantar suspensión" a
// mano.
export async function reconciliarSuspensionesPorFecha(torneoId, categoria, partidos) {
  const snap = await getDocs(
    query(
      collection(db, 'torneo_jugadores'),
      where('torneoId', '==', torneoId),
      where('categoria', '==', categoria),
      where('suspendido', '==', true)
    )
  )

  const batch = writeBatch(db)
  let huboCambios = false

  snap.docs.forEach((d) => {
    const jugador = d.data()
    if (jugador.eliminado) return
    if (jugador.suspendidoDesdeFecha == null || jugador.suspendidoHastaFecha == null) return
    if (!equipoCumplioSuspension(partidos, jugador.equipoId, jugador.suspendidoDesdeFecha, jugador.suspendidoHastaFecha)) return

    batch.update(d.ref, {
      suspendido: false,
      motivoSuspension: null,
      suspendidoDesde: null,
      fechasSuspension: null,
      suspendidoDesdeFecha: null,
      suspendidoHastaFecha: null,
      amarillasAcumuladas: 0,
    })
    huboCambios = true
  })

  if (huboCambios) await batch.commit()
}
