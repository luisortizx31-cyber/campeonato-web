import { collection, doc, addDoc, deleteDoc, getDocs, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'

// Registra que un jugador anoto `cantidad` goles en una fecha puntual
// - igual que las tarjetas (ver torneoTarjetasService). `partidoId` es
// opcional: null para un gol "suelto" cargado desde la pestaña
// Goleadores, o el id del partido cuando se carga desde ControlPartido
// (asi el marcador en vivo de ese partido puede sumar sus goles). La
// tabla de goleadores nunca guarda un contador: se recalcula siempre
// sumando estos registros (ver utils/tablaGoleadores.calcularTablaGoleadores),
// asi que corregir un gol cargado de mas/de menos es simplemente
// agregar o eliminar un registro.
export async function registrarGol({ torneoId, categoria, jugadorId, equipoId, fechaNumero, cantidad, partidoId }) {
  const ref = await addDoc(collection(db, 'torneo_goles'), {
    torneoId,
    categoria,
    jugadorId,
    equipoId,
    fechaNumero: fechaNumero !== '' && fechaNumero != null ? Number(fechaNumero) : null,
    cantidad: Number(cantidad) || 1,
    partidoId: partidoId || null,
    creadoEn: serverTimestamp(),
  })
  return ref.id
}

export async function eliminarGol(golId) {
  await deleteDoc(doc(db, 'torneo_goles', golId))
}

export async function listarGolesPorCategoria(torneoId, categoria) {
  const q = query(
    collection(db, 'torneo_goles'),
    where('torneoId', '==', torneoId),
    where('categoria', '==', categoria)
  )
  const snap = await getDocs(q)
  const goles = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  goles.sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0))
  return goles
}

// Goles de UN partido puntual (ver ControlPartido) - para armar el
// marcador en vivo sumandolos por equipo.
export async function listarGolesPorPartido(partidoId) {
  const q = query(collection(db, 'torneo_goles'), where('partidoId', '==', partidoId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Igual que listarGolesPorPartido pero en tiempo real - la usa
// CanchaPublica para que el publico vea aparecer un gol sin refrescar
// la pagina. Devuelve la funcion para cancelar la suscripcion.
export function suscribirGolesPorPartido(partidoId, onCambio) {
  const q = query(collection(db, 'torneo_goles'), where('partidoId', '==', partidoId))
  return onSnapshot(q, (snap) => {
    onCambio(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}
