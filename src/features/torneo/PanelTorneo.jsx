import { useEffect, useState } from 'react'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import { obtenerConfigTorneo } from '../../services/torneoConfigService'
import { obtenerTorneo } from '../../services/torneosService'
import { CATEGORIAS_ACTIVAS_DEFAULT } from '../../models/torneo'
import TabInicio from './tabs/TabInicio'
import TabEquipos from './tabs/TabEquipos'
import TabFechas from './tabs/TabFechas'
import TabPosiciones from './tabs/TabPosiciones'
import TabLiguilla from './tabs/TabLiguilla'
import TabGoleadores from './tabs/TabGoleadores'
import TabJugadores from './tabs/TabJugadores'
import TabAmonestados from './tabs/TabAmonestados'
import TabReclamos from './tabs/TabReclamos'
import TabBases from './tabs/TabBases'
import TabPublicidad from './tabs/TabPublicidad'
import TabConfiguracion from './tabs/TabConfiguracion'
import { TarjetaIcono } from '../shared/TarjetaIcono'

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: '🏠', Componente: TabInicio },
  { id: 'fechas', label: 'Fechas', icon: '🗓️', Componente: TabFechas },
  { id: 'posiciones', label: 'Posiciones', icon: '📊', Componente: TabPosiciones },
  { id: 'liguilla', label: 'Liguilla', icon: '🏆', Componente: TabLiguilla },
  { id: 'goleadores', label: 'Goleadores', icon: '⚽', Componente: TabGoleadores },
  { id: 'amonestados', label: 'Amonestados', icon: <TarjetaIcono tipo="amarilla" />, Componente: TabAmonestados },
  { id: 'reclamos', label: 'Reclamos', icon: '📢', Componente: TabReclamos },
  { id: 'equipos', label: 'Equipos', icon: '🛡️', Componente: TabEquipos },
  { id: 'jugadores', label: 'Jugadores', icon: '👥', Componente: TabJugadores },
  { id: 'bases', label: 'Bases', icon: '📄', Componente: TabBases },
  { id: 'publicidad', label: 'Publicidad', icon: '📣', Componente: TabPublicidad },
  { id: 'configuracion', label: 'Configuración', icon: '⚙️', Componente: TabConfiguracion },
]

// Se guarda en sessionStorage (no localStorage: es solo para que un
// refresh de la pagina no tire al Maestro de nuevo a Inicio, no hace
// falta que sobreviva a cerrar la pestaña) para que un F5 en medio de
// cualquier seccion -incluido el Control de Partido dentro de Fechas,
// ver TabFechas- deje todo tal cual estaba.
const TAB_STORAGE_KEY = 'campeonato_tabActiva'

export default function PanelTorneo() {
  const { torneoId } = useAuth()
  const [tabActiva, setTabActiva] = useState(() => {
    try {
      const guardada = sessionStorage.getItem(TAB_STORAGE_KEY)
      return TABS.some((t) => t.id === guardada) ? guardada : 'inicio'
    } catch {
      return 'inicio'
    }
  })
  const [linkCopiado, setLinkCopiado] = useState(false)

  // Arranca en el default (no null) para que los tabs se monten igual
  // de rapido que hoy - si el torneo tiene otra config guardada, se
  // actualiza un instante despues y el selector de categoria de cada
  // tab se autocorrige solo (ver SelectorCategoria).
  const [categoriasActivas, setCategoriasActivas] = useState(CATEGORIAS_ACTIVAS_DEFAULT)
  // Nombre del torneo, para la bienvenida de Inicio (ver TabInicio) -
  // null mientras carga, no bloquea el resto del panel.
  const [nombreTorneo, setNombreTorneo] = useState(null)

  useEffect(() => {
    let cancelado = false
    Promise.all([obtenerConfigTorneo(torneoId), obtenerTorneo(torneoId)])
      .then(([config, torneo]) => {
        if (cancelado) return
        setCategoriasActivas(config.categoriasActivas)
        setNombreTorneo(torneo?.nombre || null)
      })
      .catch((err) => console.error('[PanelTorneo] cargar config/torneo', err))
    return () => {
      cancelado = true
    }
  }, [torneoId])

  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, tabActiva)
    } catch {
      // Sin sessionStorage (modo privado, etc) simplemente no persiste.
    }
  }, [tabActiva])

  const tab = TABS.find((t) => t.id === tabActiva) ?? TABS[0]
  const Componente = tab.Componente

  async function copiarLinkPublico() {
    const url = `${window.location.origin}/campeonato/${torneoId}`
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 2000)
    } catch (err) {
      console.error('[PanelTorneo] No se pudo copiar el link:', err)
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-10">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-4">
        <div>
          <p className="font-mono text-xs tracking-widest text-ink-soft uppercase">Campeonato</p>
          <h1 className="text-lg font-semibold text-ink">{tab.label}</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* Unica forma de volver a Inicio desde cualquier seccion, ya
              que no hay barra de pestañas (ver TabInicio, sus accesos
              rapidos son la unica via para ir HACIA una seccion) - en
              Inicio mismo no hace falta, ya estas ahi. */}
          {tabActiva !== 'inicio' && (
            <button
              onClick={() => setTabActiva('inicio')}
              title="Volver a Inicio"
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft active:scale-95 transition-transform"
            >
              🏠
            </button>
          )}
          <button
            onClick={copiarLinkPublico}
            title="Copiar link público"
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft active:scale-95 transition-transform"
          >
            {linkCopiado ? '✓' : '🔗'}
          </button>
          <button
            onClick={() => logout()}
            title="Salir"
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Ya no hay una barra de pestañas: Inicio es el unico punto de
          navegacion (sus accesos rapidos, ver TabInicio) y el boton 🏠
          de arriba es la vuelta desde cualquier seccion. */}
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Componente
          torneoId={torneoId}
          categoriasActivas={categoriasActivas}
          onCategoriasActualizadas={setCategoriasActivas}
          nombreTorneo={nombreTorneo}
          onIrATab={setTabActiva}
        />
      </main>
    </div>
  )
}
