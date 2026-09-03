import { collection, doc, addDoc, deleteDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'

// Registra que un jugador anoto `cantidad` goles en una fecha puntual
// - igual que las tarjetas (ver torneoTarjetasService), no esta atado
// a un partido especifico, se carga "suelto" desde la pestaña
// Goleadores. La tabla de goleadores nunca guarda un contador: se
// recalcula siempre sumando estos registros (ver
// utils/tablaGoleadores.calcularTablaGoleadores), asi que corregir un
// gol cargado de mas/de menos es simplemente agregar o eliminar un
// registro.
export async function registrarGol({ torneoId, categoria, jugadorId, equipoId, fechaNumero, cantidad }) {
  const ref = await addDoc(collection(db, 'torneo_goles'), {
    torneoId,
    categoria,
    jugadorId,
    equipoId,
    fechaNumero: fechaNumero !== '' && fechaNumero != null ? Number(fechaNumero) : null,
    cantidad: Number(cantidad) || 1,
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
