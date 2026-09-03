import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Todas las credenciales vienen de variables de entorno (.env / Vercel
// Environment Variables) - ver .env.local.example. Estas claves de
// Firebase para apps web NO son secretas por diseño (Google las
// documenta como publicas); la seguridad real vive en firestore.rules
// y storage.rules.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.projectId) {
  console.error(
    '[firebase] Faltan variables de entorno VITE_FIREBASE_*. ' +
      'Revisa tu archivo .env.local (copia .env.local.example) o la ' +
      'configuracion de Environment Variables en Vercel.'
  )
}

// Se exporta tambien la config (no el app) para que
// superadminService.js pueda levantar una segunda instancia de
// Firebase Auth al dar de alta un colegio nuevo, sin pisar la sesion
// del superadmin logueado.
export { firebaseConfig }

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
