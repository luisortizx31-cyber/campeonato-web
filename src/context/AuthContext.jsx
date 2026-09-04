import { createContext, useContext, useEffect, useState } from 'react'
import { suscribirseAEstadoAuth, obtenerPerfilUsuario } from '../services/authService'
import { obtenerTorneo } from '../services/torneosService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuarioAuth, setUsuarioAuth] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [torneoSuspendido, setTorneoSuspendido] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = suscribirseAEstadoAuth(async (user) => {
      setError(null)
      setUsuarioAuth(user)

      if (!user) {
        setPerfil(null)
        setTorneoSuspendido(false)
        setCargando(false)
        return
      }

      try {
        const perfilUsuario = await obtenerPerfilUsuario(user.uid)
        setPerfil(perfilUsuario)
        // El superAdmin puede deshabilitar el acceso de un colegio sin
        // borrar sus datos (ver TabConfiguracion -> SeccionColegios) -
        // el flag vive en /torneos/{torneoId}, no en el propio perfil,
        // asi que hace falta esta lectura aparte.
        if (perfilUsuario.torneoId) {
          const torneo = await obtenerTorneo(perfilUsuario.torneoId)
          setTorneoSuspendido(torneo?.suspendido === true)
        } else {
          setTorneoSuspendido(false)
        }
      } catch (err) {
        // Si el usuario existe en Auth pero no tiene documento en
        // /usuarios, es un estado inconsistente - lo tratamos como
        // error visible en vez de dejar pasar a alguien sin rol.
        setError(err)
        setPerfil(null)
      } finally {
        setCargando(false)
      }
    })

    return unsubscribe
  }, [])

  const value = {
    usuarioAuth,
    perfil,
    role: perfil?.role ?? null,
    // A que torneo (tenant) pertenece este usuario - ver /usuarios/{uid}
    // en Firestore. Todas las pantallas del panel lo toman de aca en
    // vez de manejarlo por su cuenta, para que sea imposible operar
    // sobre el torneo equivocado.
    torneoId: perfil?.torneoId ?? null,
    // Deshabilitado por un superAdmin (ver SeccionColegios) - bloquea
    // el panel admin ademas de la pagina publica, sin borrar datos.
    torneoSuspendido,
    // Puede dar de alta colegios/torneos nuevos y deshabilitarlos
    // desde Configuracion - ver models/roles.js.
    esSuperAdmin: perfil?.superAdmin === true,
    cargando,
    error,
    estaAutenticado: Boolean(usuarioAuth && perfil),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return context
}
