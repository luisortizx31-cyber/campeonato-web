import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Envuelve una pagina y exige que haya una sesion activa. Conveniencia
 * de UX - la seguridad real de los datos vive en las Firestore
 * Security Rules (esMaestro()), esta capa nunca debe ser la unica
 * barrera.
 */
export function ProtectedRoute({ children }) {
  const { cargando, estaAutenticado, torneoId } = useAuth()

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-soft">
        Cargando…
      </div>
    )
  }

  if (!estaAutenticado) {
    return <Navigate to="/login" replace />
  }

  // Multi-tenant: todo usuario administrador tiene que tener un
  // torneoId asignado (ver /usuarios/{uid}). Sin esto no hay forma de
  // saber que datos le pertenecen - se trata como estado inconsistente
  // en vez de dejarlo pasar sin torneo.
  if (!torneoId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-ink-soft">
        Tu cuenta no tiene un torneo asignado. Contacta al administrador.
      </div>
    )
  }

  return children
}
