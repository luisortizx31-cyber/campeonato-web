import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
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

  return { uid, torneoId: idLimpio }
}
