import { collection, doc, addDoc, updateDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import { actualizarTitular, actualizarSuplente } from './torneoPartidosService'

// Cuando el partido ya esta "en vivo" (el Maestro entro a Control de
// Partido, ver golesLocalEnVivo/golesVisitanteEnVivo en
// torneoPartidosService.actualizarMarcadorEnVivo), el delegado ya no
// puede sacar a un titular por su cuenta - queda pedido, y recien se
// aplica cuando el Maestro lo aprueba desde ControlPartido. Antes de
// eso (armando la alineacion antes del partido) el delegado sigue
// editando directo, sin pasar por aca - ver AlineacionPartidoDelegado.
export async function crearSolicitudCambio({ torneoId, categoria, partidoId, equipo, equipoId, jugadorSaleId, jugadorEntraId }) {
  await addDoc(collection(db, 'torneo_solicitudes_cambio'), {
    torneoId,
    categoria,
    partidoId,
    equipo,
    equipoId,
    jugadorSaleId,
    jugadorEntraId,
    estado: 'pendiente',
    creadoEn: serverTimestamp(),
    resueltoEn: null,
  })
}

// La usa ControlPartido para mostrar el aviso de "solicitud pendiente"
// apenas aparece una, sin que el Maestro tenga que refrescar.
// `onError` es opcional - sin el, un permission-denied (o cualquier
// otro error) en el listener queda mudo: el aviso se congela con datos
// viejos sin ningun indicio de que algo se rompio.
export function suscribirSolicitudesPendientesPorPartido(partidoId, onCambio, onError) {
  const q = query(
    collection(db, 'torneo_solicitudes_cambio'),
    where('partidoId', '==', partidoId),
    where('estado', '==', 'pendiente')
  )
  return onSnapshot(
    q,
    (snap) => onCambio(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[suscribirSolicitudesPendientesPorPartido]', err)
      onError?.(err)
    }
  )
}

// La usa TabFechas para avisar de un pedido pendiente aunque el
// Maestro no tenga abierto ESE partido puntual en Control de Partido -
// sin esto, el aviso de ControlPartido solo se ve si por casualidad ya
// se esta mirando el partido correcto.
export function suscribirSolicitudesPendientesPorCategoria(torneoId, categoria, onCambio, onError) {
  const q = query(
    collection(db, 'torneo_solicitudes_cambio'),
    where('torneoId', '==', torneoId),
    where('categoria', '==', categoria),
    where('estado', '==', 'pendiente')
  )
  return onSnapshot(
    q,
    (snap) => onCambio(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[suscribirSolicitudesPendientesPorCategoria]', err)
      onError?.(err)
    }
  )
}

// La usa AlineacionPartidoDelegado para que el delegado vea si su
// pedido ya fue aprobado o rechazado, sin tener que preguntarle al
// Maestro.
export function suscribirSolicitudesPorPartidoYEquipo(partidoId, equipoId, onCambio, onError) {
  const q = query(
    collection(db, 'torneo_solicitudes_cambio'),
    where('partidoId', '==', partidoId),
    where('equipoId', '==', equipoId)
  )
  return onSnapshot(
    q,
    (snap) => onCambio(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[suscribirSolicitudesPorPartidoYEquipo]', err)
      onError?.(err)
    }
  )
}

// Aplica el cambio de verdad y recien ahi marca la solicitud como
// aprobada - si el cambio fallara, la solicitud queda pendiente para
// reintentar en vez de marcarse como resuelta sin haberse aplicado.
//
// A donde vuelve el que "sale" depende de la config de la categoria
// (ver torneoConfigService.sustitucionesIlimitadas, TabConfiguracion):
// - false (por defecto, "definitiva"): vuelve a "Jugadores" - no
//   puede volver a entrar en este partido, igual que una sustitucion
//   real de futbol.
// - true ("ilimitadas"): vuelve a "Suplente", asi puede ser elegido
//   de nuevo en otro pedido mas adelante.
//
// jugadorEntraId puede venir null - "sacarlo sin reemplazo" (el
// delegado no tiene suplentes convocados, o simplemente quiere jugar
// con uno menos). En ese caso no hay a quien meter, solo se saca al
// que sale.
export async function aprobarSolicitud(solicitud, { sustitucionesIlimitadas = false } = {}) {
  const acciones = [
    actualizarTitular(solicitud.partidoId, solicitud.equipo, solicitud.jugadorSaleId, false),
    actualizarSuplente(solicitud.partidoId, solicitud.equipo, solicitud.jugadorSaleId, sustitucionesIlimitadas),
  ]
  if (solicitud.jugadorEntraId) {
    acciones.push(
      actualizarTitular(solicitud.partidoId, solicitud.equipo, solicitud.jugadorEntraId, true),
      actualizarSuplente(solicitud.partidoId, solicitud.equipo, solicitud.jugadorEntraId, false)
    )
  }
  await Promise.all(acciones)
  await updateDoc(doc(db, 'torneo_solicitudes_cambio', solicitud.id), {
    estado: 'aprobada',
    resueltoEn: serverTimestamp(),
  })
}

export async function rechazarSolicitud(solicitudId) {
  await updateDoc(doc(db, 'torneo_solicitudes_cambio', solicitudId), {
    estado: 'rechazada',
    resueltoEn: serverTimestamp(),
  })
}

// El delegado cierra el aviso de "aprobado/rechazado" con la "x" (ver
// AlineacionPartidoDelegado) - queda guardado en el propio doc (no en
// el celular) para que no vuelva a aparecer si sale y vuelve a entrar,
// o si mira desde otro dispositivo.
export async function marcarSolicitudVista(solicitudId) {
  await updateDoc(doc(db, 'torneo_solicitudes_cambio', solicitudId), {
    vistoPorDelegado: true,
  })
}
