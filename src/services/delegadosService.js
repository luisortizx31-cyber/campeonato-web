import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { collection, doc, getDoc, setDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { db, firebaseConfig } from '../config/firebase'

// Da de alta un delegado (acceso restringido a UN equipo, ver
// firestore.rules) desde Configuracion. Mismo rodeo que
// superadminService.crearColegio: createUserWithEmailAndPassword deja
// logueada esa cuenta nueva en la instancia de Auth que se use, asi
// que se hace en una instancia secundaria descartable para no
// deslogear al Maestro que esta creando el delegado.
export async function crearDelegado({ torneoId, equipoId, equipoNombre, nombreDelegado, email, password }) {
  const appSecundaria = initializeApp(firebaseConfig, `alta-delegado-${Date.now()}`)
  let uid
  try {
    const authSecundaria = getAuth(appSecundaria)
    const credential = await createUserWithEmailAndPassword(authSecundaria, email, password)
    uid = credential.user.uid
  } finally {
    await deleteApp(appSecundaria)
  }

  // /usuarios es lo que leen las Security Rules (rolDe/miEquipoIdDelegado)
  // para autorizar cada escritura - /torneo_delegados de abajo es solo
  // la lista+contraseña que ve el Maestro en Configuracion.
  await setDoc(doc(db, 'usuarios', uid), { role: 'delegado', torneoId, equipoId })

  await setDoc(doc(db, 'torneo_delegados', uid), {
    torneoId,
    equipoId,
    equipoNombre,
    nombreDelegado: nombreDelegado.trim(),
    email,
    password,
    deshabilitado: false,
    creadoEn: serverTimestamp(),
  })

  return uid
}

// Un delegado logueado lee SU PROPIO doc (ver firestore.rules) para
// saber si el Maestro lo deshabilito (ver PaginaPublicaTorneo) - su
// credencial de Firebase Auth sigue siendo valida, este es el unico
// lugar donde se corta el acceso.
export async function obtenerDelegado(uid) {
  const snap = await getDoc(doc(db, 'torneo_delegados', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Delegados de UNO o dos equipos puntuales (los dos lados de un
// partido) - la usa ControlPartido para saber si mostrar el boton de
// habilitar/cerrar alineacion para cada lado. Excluye los
// deshabilitados: si el Maestro le cerro el acceso al delegado, el
// boton no tiene sentido mostrarlo.
export async function listarDelegadosPorEquipos(equipoIds) {
  if (equipoIds.length === 0) return []
  const snap = await getDocs(query(collection(db, 'torneo_delegados'), where('equipoId', 'in', equipoIds)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => !d.deshabilitado)
}

export async function listarDelegados(torneoId) {
  const snap = await getDocs(query(collection(db, 'torneo_delegados'), where('torneoId', '==', torneoId)))
  const delegados = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  delegados.sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0))
  return delegados
}

// No se puede borrar de verdad la cuenta de Authentication ni el doc
// de /usuarios desde el cliente (requeriria Admin SDK, que este
// proyecto no usa - mismo motivo que un colegio nunca se borra, solo
// se suspende). "Eliminar" un delegado en realidad lo deshabilita: su
// login contra Firebase Auth sigue funcionando, pero
// PaginaPublicaTorneo corta el acceso apenas ve este flag en su
// propio documento.
export async function alternarDelegado(uid, deshabilitado) {
  await setDoc(doc(db, 'torneo_delegados', uid), { deshabilitado }, { merge: true })
}
