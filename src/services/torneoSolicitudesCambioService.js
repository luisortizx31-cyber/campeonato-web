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
export function suscribirSolicitudesPendientesPorPartido(partidoId, onCambio) {
  const q = query(
    collection(db, 'torneo_solicitudes_cambio'),
    where('partidoId', '==', partidoId),
    where('estado', '==', 'pendiente')
  )
  return onSnapshot(q, (snap) => onCambio(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

// La usa AlineacionPartidoDelegado para que el delegado vea si su
// pedido ya fue aprobado o rechazado, sin tener que preguntarle al
// Maestro.
export function suscribirSolicitudesPorPartidoYEquipo(partidoId, equipoId, onCambio) {
  const q = query(
    collection(db, 'torneo_solicitudes_cambio'),
    where('partidoId', '==', partidoId),
    where('equipoId', '==', equipoId)
  )
  return onSnapshot(q, (snap) => onCambio(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

// Aplica el cambio de verdad (el saliente vuelve a Jugadores, el
// entrante pasa a Titular) y recien ahi marca la solicitud como
// aprobada - si el cambio fallara, la solicitud queda pendiente para
// reintentar en vez de marcarse como resuelta sin haberse aplicado.
export async function aprobarSolicitud(solicitud) {
  await Promise.all([
    actualizarTitular(solicitud.partidoId, solicitud.equipo, solicitud.jugadorSaleId, false),
    actualizarSuplente(solicitud.partidoId, solicitud.equipo, solicitud.jugadorSaleId, false),
    actualizarTitular(solicitud.partidoId, solicitud.equipo, solicitud.jugadorEntraId, true),
    actualizarSuplente(solicitud.partidoId, solicitud.equipo, solicitud.jugadorEntraId, false),
  ])
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
