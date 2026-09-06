import { useEffect, useRef, useState } from 'react'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import { obtenerConfigTorneo } from '../../services/torneoConfigService'
import { CATEGORIAS_ACTIVAS_DEFAULT } from '../../models/torneo'
import TabEquipos from './tabs/TabEquipos'
import TabFechas from './tabs/TabFechas'
import TabPosiciones from './tabs/TabPosiciones'
import TabGoleadores from './tabs/TabGoleadores'
import TabJugadores from './tabs/TabJugadores'
import TabAmonestados from './tabs/TabAmonestados'
import TabReclamos from './tabs/TabReclamos'
import TabBases from './tabs/TabBases'
import TabConfiguracion from './tabs/TabConfiguracion'

const TABS = [
  { id: 'fechas', label: 'Fechas', icon: '🗓️', Componente: TabFechas },
  { id: 'equipos', label: 'Equipos', icon: '🛡️', Componente: TabEquipos },
  { id: 'posiciones', label: 'Posiciones', icon: '📊', Componente: TabPosiciones },
  { id: 'goleadores', label: 'Goleadores', icon: '⚽', Componente: TabGoleadores },
  { id: 'jugadores', label: 'Jugadores', icon: '👥', Componente: TabJugadores },
  { id: 'amonestados', label: 'Amonestados', icon: '🟨', Componente: TabAmonestados },
  { id: 'reclamos', label: 'Reclamos', icon: '📢', Componente: TabReclamos },
  { id: 'bases', label: 'Bases', icon: '📄', Componente: TabBases },
  { id: 'configuracion', label: 'Configuración', icon: '⚙️', Componente: TabConfiguracion },
]

// Se guarda en sessionStorage (no localStorage: es solo para que un
// refresh de la pagina no tire al Maestro de nuevo a la pestaña por
// defecto (Fechas), no hace falta que sobreviva a cerrar la pestaña)
// para que un F5 en medio de cualquier pestaña -incluido el Control
// de Partido dentro de Fechas, ver TabFechas- deje todo tal cual estaba.
const TAB_STORAGE_KEY = 'campeonato_tabActiva'

export default function PanelTorneo() {
  const { torneoId } = useAuth()
  const [tabActiva, setTabActiva] = useState(() => {
    try {
      const guardada = sessionStorage.getItem(TAB_STORAGE_KEY)
      return TABS.some((t) => t.id === guardada) ? guardada : 'fechas'
    } catch {
      return 'fechas'
    }
  })
  const [linkCopiado, setLinkCopiado] = useState(false)

  // Arranca en el default (no null) para que los tabs se monten igual
  // de rapido que hoy - si el torneo tiene otra config guardada, se
  // actualiza un instante despues y el selector de categoria de cada
  // tab se autocorrige solo (ver SelectorCategoria).
  const [categoriasActivas, setCategoriasActivas] = useState(CATEGORIAS_ACTIVAS_DEFAULT)

  useEffect(() => {
    let cancelado = false
    obtenerConfigTorneo(torneoId)
      .then((c) => {
        if (!cancelado) setCategoriasActivas(c.categoriasActivas)
      })
      .catch((err) => console.error('[PanelTorneo] obtenerConfigTorneo', err))
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

  // La barra de pestañas se desplaza horizontal (overflow-x-auto) -
  // sin esto, al restaurar una pestaña lejos del final (ej.
  // Configuración) despues de un refresh, la barra arranca scrolleada
  // al principio y hay que arrastrarla a mano para ver cual quedo
  // activa.
  const barraTabsRef = useRef(null)
  useEffect(() => {
    if (!barraTabsRef.current) return
    const activo = barraTabsRef.current.querySelector(`[data-tab="${tabActiva}"]`)
    activo?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
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

      <nav ref={barraTabsRef} className="flex border-b border-line bg-surface overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            data-tab={t.id}
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
        <Componente
          torneoId={torneoId}
          categoriasActivas={categoriasActivas}
          onIrAPosiciones={() => setTabActiva('posiciones')}
          onCategoriasActualizadas={setCategoriasActivas}
        />
      </main>
    </div>
  )
}
