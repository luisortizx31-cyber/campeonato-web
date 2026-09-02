import { collection, doc, addDoc, deleteDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'

// Bonificaciones/sanciones de puntos que el Maestro aplica a mano a un
// equipo (ej. "+2 por desfile", "-1 por conducta antideportiva") -
// independientes de los resultados de partidos. calcularTablaPosiciones
// suma estos puntos a los que salen de la tabla, para que quede un
// registro de POR QUE cambiaron en vez de solo editar el numero final.
export async function agregarAjustePuntos({ torneoId, categoria, equipoId, puntos, motivo }) {
  const ref = await addDoc(collection(db, 'torneo_ajustes'), {
    torneoId,
    categoria,
    equipoId,
    puntos: Number(puntos),
    motivo: motivo?.trim() || null,
    creadoEn: serverTimestamp(),
  })
  return ref.id
}

export async function listarAjustesPorCategoria(torneoId, categoria) {
  const q = query(
    collection(db, 'torneo_ajustes'),
    where('torneoId', '==', torneoId),
    where('categoria', '==', categoria)
  )
  const snap = await getDocs(q)
  const ajustes = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  ajustes.sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0))
  return ajustes
}

export async function eliminarAjustePuntos(ajusteId) {
  await deleteDoc(doc(db, 'torneo_ajustes', ajusteId))
}
