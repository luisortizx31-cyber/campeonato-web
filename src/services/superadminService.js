import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, setDoc, collection, query, orderBy, getDocs, serverTimestamp } from 'firebase/firestore'
import { db, firebaseConfig } from '../config/firebase'

// Da de alta un colegio/torneo (tenant) nuevo desde el panel, sin
// pasar por la consola de Firebase. El alta de un usuario de
// Authentication con createUserWithEmailAndPassword deja logueada esa
// cuenta nueva en la instancia de Auth que se use - si usaramos la
// instancia principal (la del superadmin logueado), lo dejaria a el
// deslogueado y logueado como el colegio recien creado. Por eso se
// levanta una segunda instancia de la app de Firebase solo para este
// alta puntual, y se descarta apenas termina.
export async function crearColegio({ torneoId, nombreColegio, email, password }) {
  const idLimpio = torneoId.trim().toLowerCase()
  if (!/^[a-z0-9-]+$/.test(idLimpio)) {
    throw new Error(
      'El identificador del torneo solo puede tener minúsculas, números y guiones (sin espacios ni tildes).'
    )
  }

  const torneoExistente = await getDoc(doc(db, 'torneos', idLimpio))
  if (torneoExistente.exists()) {
    throw new Error(`Ya existe un torneo con el identificador "${idLimpio}".`)
  }

  const appSecundaria = initializeApp(firebaseConfig, `alta-colegio-${Date.now()}`)
  let uid
  try {
    const authSecundaria = getAuth(appSecundaria)
    const credential = await createUserWithEmailAndPassword(authSecundaria, email, password)
    uid = credential.user.uid
  } finally {
    await deleteApp(appSecundaria)
  }

  await setDoc(doc(db, 'usuarios', uid), { role: 'master', torneoId: idLimpio })
  await setDoc(doc(db, 'torneos', idLimpio), { nombre: nombreColegio.trim() })

  // /colegios guarda el correo y la contraseña para poder mostrarselos
  // de nuevo al superAdmin mas adelante (ver listarColegios) - a
  // diferencia de /torneos, esta coleccion NUNCA es de lectura publica
  // (ver firestore.rules), porque queda la contrasena en texto plano.
  await setDoc(doc(db, 'colegios', idLimpio), {
    torneoId: idLimpio,
    nombre: nombreColegio.trim(),
    email,
    password,
    uid,
    creadoEn: serverTimestamp(),
  })

  return { uid, torneoId: idLimpio }
}

export async function listarColegios() {
  const snap = await getDocs(query(collection(db, 'colegios'), orderBy('creadoEn', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
