import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { obtenerConfigTorneo } from '../../services/torneoConfigService'
import { obtenerTorneo } from '../../services/torneosService'
import { login, logout } from '../../services/authService'
import { obtenerDelegadoDeEquipo } from '../../services/delegadosService'
import { useAuth } from '../../context/AuthContext'
import { CATEGORIAS_ACTIVAS_DEFAULT } from '../../models/torneo'
import TabPosicionesPublica from './tabsPublico/TabPosicionesPublica'
import TabFechasPublica from './tabsPublico/TabFechasPublica'
import TabGoleadoresPublica from './tabsPublico/TabGoleadoresPublica'
import TabJugadoresPublica from './tabsPublico/TabJugadoresPublica'
import TabAmonestadosPublica from './tabsPublico/TabAmonestadosPublica'
import TabMiEquipoDelegado from './tabsPublico/TabMiEquipoDelegado'

const TABS_PUBLICAS = [
  { id: 'fechas', label: 'Fechas', icon: '🗓️', Componente: TabFechasPublica },
  { id: 'posiciones', label: 'Tabla de Posiciones', icon: '📊', Componente: TabPosicionesPublica },
  { id: 'goleadores', label: 'Goleadores', icon: '⚽', Componente: TabGoleadoresPublica },
  { id: 'amonestados', label: 'Amonestados', icon: '🟨', Componente: TabAmonestadosPublica },
  { id: 'jugadores', label: 'Jugadores', icon: '👥', Componente: TabJugadoresPublica },
]

const TAB_MI_EQUIPO = { id: 'miequipo', label: 'Mi equipo', icon: '⭐', Componente: TabMiEquipoDelegado }

// Se guarda en sessionStorage (no localStorage: solo para que un
// refresh de pagina no vuelva siempre a la pestaña por defecto,
// Fechas) - mismo patron que ya usa PanelTorneo.jsx del lado admin.
const TAB_STORAGE_KEY = 'campeonato_publico_tabActiva'

// Pagina publica de UN torneo (tenant) - sin login, pensada para
// compartir el link por WhatsApp (ver PanelTorneo.jsx, boton "Copiar
// link público"). El :torneoId de la URL dice de que colegio son los
// datos. Solo lectura: ninguna accion de esta pagina ni de sus tabs
// escribe en Firestore.
export default function PaginaPublicaTorneo() {
  const { torneoId } = useParams()
  const { perfil, estaAutenticado } = useAuth()
  const [tabActiva, setTabActiva] = useState(() => {
    try {
      const guardada = sessionStorage.getItem(TAB_STORAGE_KEY)
      return [...TABS_PUBLICAS, TAB_MI_EQUIPO].some((t) => t.id === guardada) ? guardada : 'fechas'
    } catch {
      return 'fechas'
    }
  })
  const [basesUrl, setBasesUrl] = useState(null)
  const [categoriasActivas, setCategoriasActivas] = useState(CATEGORIAS_ACTIVAS_DEFAULT)
  const [nombreTorneo, setNombreTorneo] = useState(null)
  const [torneoNoEncontrado, setTorneoNoEncontrado] = useState(false)
  const [torneoSuspendido, setTorneoSuspendido] = useState(false)
  const [mostrarLoginDelegado, setMostrarLoginDelegado] = useState(false)
  const [emailDelegado, setEmailDelegado] = useState('')
  const [passwordDelegado, setPasswordDelegado] = useState('')
  const [enviandoLogin, setEnviandoLogin] = useState(false)
  const [errorLogin, setErrorLogin] = useState(null)

  // Un delegado (ver TabConfiguracion -> Delegados de equipo) inicia
  // sesion desde este mismo link publico - la misma sesion de
  // Firebase Auth que usa el panel admin, asi que si en el mismo
  // navegador habia un Maestro logueado en otra pestaña, esto lo
  // reemplaza (limitacion aceptada: no vale la pena una segunda
  // instancia de Firebase solo para esto).
  const esMiDelegado = estaAutenticado && perfil?.role === 'delegado' && perfil?.torneoId === torneoId

  const [delegadoDeshabilitado, setDelegadoDeshabilitado] = useState(false)
  useEffect(() => {
    if (!esMiDelegado || !perfil?.equipoId) {
      setDelegadoDeshabilitado(false)
      return
    }
    let cancelado = false
    obtenerDelegadoDeEquipo(perfil.equipoId)
      .then((d) => {
        if (!cancelado && d?.deshabilitado) {
          setDelegadoDeshabilitado(true)
          logout()
        }
      })
      .catch((err) => console.error('[PaginaPublicaTorneo] obtenerDelegadoDeEquipo', err))
    return () => {
      cancelado = true
    }
  }, [esMiDelegado, perfil?.equipoId])

  async function handleLoginDelegado(e) {
    e.preventDefault()
    setErrorLogin(null)
    setEnviandoLogin(true)
    try {
      await login(emailDelegado.trim(), passwordDelegado)
      setMostrarLoginDelegado(false)
      setEmailDelegado('')
      setPasswordDelegado('')
      // Cambia a la pestaña "Mi equipo" de una vez - si no, el login
      // exitoso solo se nota porque aparece una pestaña nueva en la
      // barra, facil de no ver si se quedan mirando la pestaña actual.
      setTabActiva('miequipo')
    } catch (err) {
      console.error('[PaginaPublicaTorneo] handleLoginDelegado', err)
      if (err.code === 'auth/too-many-requests') {
        setErrorLogin('Demasiados intentos fallidos - esperá un momento y volvé a probar.')
      } else if (err.code === 'auth/network-request-failed') {
        setErrorLogin('Sin conexión a internet - revisá tu señal e intentá de nuevo.')
      } else {
        setErrorLogin('Correo o contraseña incorrectos.')
      }
    } finally {
      setEnviandoLogin(false)
    }
  }

  useEffect(() => {
    let cancelado = false
    obtenerTorneo(torneoId)
      .then((t) => {
        if (cancelado) return
        if (!t) {
          setTorneoNoEncontrado(true)
          return
        }
        // El superAdmin puede deshabilitar un colegio desde
        // Configuracion (ver SeccionColegios) - corta el acceso tanto
        // al panel admin como a esta pagina publica, sin borrar datos.
        if (t.suspendido) {
          setTorneoSuspendido(true)
          return
        }
        setNombreTorneo(t.nombre || null)
        document.title = t.nombre ? `Campeonato · ${t.nombre}` : 'Campeonato'
      })
      .catch((err) => console.error('[PaginaPublicaTorneo]', err))
    return () => {
      cancelado = true
      document.title = 'Campeonato'
    }
  }, [torneoId])

  useEffect(() => {
    obtenerConfigTorneo(torneoId)
      .then((c) => {
        setBasesUrl(c.basesUrl)
        setCategoriasActivas(c.categoriasActivas)
      })
      .catch((err) => console.error('[PaginaPublicaTorneo]', err))
  }, [torneoId])

  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, tabActiva)
    } catch {
      // Sin sessionStorage (modo privado, etc) simplemente no persiste.
    }
  }, [tabActiva])

  const mostrarMiEquipo = esMiDelegado && !delegadoDeshabilitado
  const TABS = mostrarMiEquipo ? [TAB_MI_EQUIPO, ...TABS_PUBLICAS] : TABS_PUBLICAS
  const tab = TABS.find((t) => t.id === tabActiva) ?? TABS[0]
  const Componente = tab.Componente

  if (torneoNoEncontrado) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-ink-soft">
        Este link de campeonato no existe o ya no está disponible.
      </div>
    )
  }

  if (torneoSuspendido) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-ink-soft">
        Este campeonato está deshabilitado temporalmente.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper pb-10">
      <header className="border-b border-line bg-surface px-4 py-4">
        <p className="truncate text-xl font-bold tracking-tight text-ink">
          {nombreTorneo || 'Campeonato'}
        </p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <h1 className="text-sm font-medium text-ink-soft">{tab.label}</h1>
          <div className="flex shrink-0 items-center gap-2">
            {basesUrl && (
              <a
                href={basesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft"
              >
                📄 Bases
              </a>
            )}
            {!mostrarMiEquipo && (
              <button
                onClick={() => setMostrarLoginDelegado((v) => !v)}
                className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft"
              >
                🔑 Delegados
              </button>
            )}
          </div>
        </div>

        {delegadoDeshabilitado && (
          <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
            Tu acceso de delegado fue deshabilitado. Contacta al Maestro del torneo.
          </p>
        )}

        {mostrarLoginDelegado && !mostrarMiEquipo && (
          <form onSubmit={handleLoginDelegado} className="mt-3 rounded-xl border border-line bg-paper p-3">
            <p className="mb-2 text-xs font-semibold text-ink-soft">Acceso de delegados de equipo</p>
            <div className="mb-2 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                required
                autoComplete="username"
                placeholder="Correo"
                value={emailDelegado}
                onChange={(e) => setEmailDelegado(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-brand"
              />
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Contraseña"
                value={passwordDelegado}
                onChange={(e) => setPasswordDelegado(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-brand"
              />
            </div>
            {errorLogin && (
              <p className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                ⚠ {errorLogin}
              </p>
            )}
            <button
              type="submit"
              disabled={enviandoLogin}
              className="w-full rounded-lg bg-brand py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {enviandoLogin ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        )}
      </header>

      <nav className="flex border-b border-line bg-surface overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTabActiva(t.id)}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tabActiva === t.id
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-soft'
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <Componente torneoId={torneoId} categoriasActivas={categoriasActivas} />
      </main>
    </div>
  )
}
