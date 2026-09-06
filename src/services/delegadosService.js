import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { collection, doc, getDoc, setDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { db, firebaseConfig } from '../config/firebase'

// El doc de /torneo_delegados queda indexado por equipoId (no por uid)
// a proposito: asi ControlPartido puede leer "el delegado de este
// equipo" con un getDoc() directo en vez de una query con 'in', que
// en las Security Rules de Firestore terminaba en permission-denied
// (una query de lista con una condicion que depende de otro documento,
// como esMaestro()/miTorneoId(), no queda garantizada por el shape de
// la query en si - un getDoc de UN solo doc conocido si es seguro).
// Implica que solo puede haber UN delegado activo por equipo a la vez
// (ver crearDelegado, que lo verifica antes de sobreescribir).
function idDelegadoDeEquipo(equipoId) {
  return equipoId
}

// Da de alta un delegado (acceso restringido a UN equipo, ver
// firestore.rules) desde Configuracion. Mismo rodeo que
// superadminService.crearColegio: createUserWithEmailAndPassword deja
// logueada esa cuenta nueva en la instancia de Auth que se use, asi
// que se hace en una instancia secundaria descartable para no
// deslogear al Maestro que esta creando el delegado.
export async function crearDelegado({ torneoId, equipoId, equipoNombre, nombreDelegado, email, password }) {
  const existenteSnap = await getDoc(doc(db, 'torneo_delegados', idDelegadoDeEquipo(equipoId)))
  if (existenteSnap.exists() && !existenteSnap.data().deshabilitado) {
    throw new Error('Este equipo ya tiene un delegado activo. Deshabilitalo primero si querés reemplazarlo.')
  }

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

  await setDoc(doc(db, 'torneo_delegados', idDelegadoDeEquipo(equipoId)), {
    uid,
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

// Un delegado logueado lee el doc de SU PROPIO equipo (ver
// firestore.rules) para saber si el Maestro lo deshabilito (ver
// PaginaPublicaTorneo) - su credencial de Firebase Auth sigue siendo
// valida, este es el unico lugar donde se corta el acceso.
export async function obtenerDelegadoDeEquipo(equipoId) {
  const snap = await getDoc(doc(db, 'torneo_delegados', idDelegadoDeEquipo(equipoId)))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// El delegado (si tiene uno activo) de CADA lado de un partido puntual
// - la usa ControlPartido para saber si mostrar el boton de
// habilitar/cerrar alineacion. Dos getDoc() de un solo documento
// conocido en vez de una query de lista (ver idDelegadoDeEquipo).
export async function obtenerDelegadosDePartido(equipoLocalId, equipoVisitanteId) {
  const [local, visitante] = await Promise.all([
    obtenerDelegadoDeEquipo(equipoLocalId),
    obtenerDelegadoDeEquipo(equipoVisitanteId),
  ])
  return {
    local: local && !local.deshabilitado ? local : null,
    visitante: visitante && !visitante.deshabilitado ? visitante : null,
  }
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
export async function alternarDelegado(delegadoId, deshabilitado) {
  await setDoc(doc(db, 'torneo_delegados', delegadoId), { deshabilitado }, { merge: true })
}
