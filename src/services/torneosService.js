import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

// Solo lectura por ahora: el alta de un torneo nuevo (tenant) se hace
// a mano por consola de Firebase (crear el usuario en Authentication +
// su doc en /usuarios/{uid} con role:"master" y torneoId + este doc en
// /torneos/{torneoId}) - no hay todavia un flujo de autoregistro. Ver
// README.md.
export async function obtenerTorneo(torneoId) {
  const snap = await getDoc(doc(db, 'torneos', torneoId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}
