import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebase'

// Login simple por email + contraseña (a diferencia de prestamos-web,
// aca no hace falta el esquema DNI+PIN: hay un solo tipo de usuario,
// el administrador del campeonato).
export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function logout() {
  await signOut(auth)
}

/**
 * Lee el documento /usuarios/{uid} para obtener el rol. El rol vive en
 * Firestore (no en Custom Claims) para evitar depender de Cloud
 * Functions / plan Blaze. Las Security Rules validan el rol leyendo
 * este mismo documento con get().
 */
export async function obtenerPerfilUsuario(uid) {
  const ref = doc(db, 'usuarios', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    throw new Error(
      `No existe perfil en /usuarios/${uid}. Todo usuario de Auth debe tener un documento espejo en Firestore con su rol.`
    )
  }
  return { uid, ...snap.data() }
}

export function suscribirseAEstadoAuth(callback) {
  return onAuthStateChanged(auth, callback)
}
