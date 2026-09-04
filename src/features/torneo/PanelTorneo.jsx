import { useEffect, useState } from 'react'
import { logout } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import TabEquipos from './tabs/TabEquipos'
import TabFechas from './tabs/TabFechas'
import TabPosiciones from './tabs/TabPosiciones'
import TabGoleadores from './tabs/TabGoleadores'
import TabJugadores from './tabs/TabJugadores'
import TabAmonestados from './tabs/TabAmonestados'
import TabBases from './tabs/TabBases'
import TabConfiguracion from './tabs/TabConfiguracion'

const TABS = [
  { id: 'equipos', label: 'Equipos', icon: '🛡️', Componente: TabEquipos },
  { id: 'fechas', label: 'Fechas', icon: '🗓️', Componente: TabFechas },
  { id: 'posiciones', label: 'Posiciones', icon: '📊', Componente: TabPosiciones },
  { id: 'goleadores', label: 'Goleadores', icon: '⚽', Componente: TabGoleadores },
  { id: 'jugadores', label: 'Jugadores', icon: '👥', Componente: TabJugadores },
  { id: 'amonestados', label: 'Amonestados', icon: '🟨', Componente: TabAmonestados },
  { id: 'bases', label: 'Bases', icon: '📄', Componente: TabBases },
  { id: 'configuracion', label: 'Configuración', icon: '⚙️', Componente: TabConfiguracion },
]

// Se guarda en sessionStorage (no localStorage: es solo para que un
// refresh de la pagina no tire al Maestro de nuevo a Equipos, no hace
// falta que sobreviva a cerrar la pestaña) para que un F5 en medio de
// cualquier pestaña -incluido el Control de Partido dentro de
// Fechas, ver TabFechas- deje todo tal cual estaba.
const TAB_STORAGE_KEY = 'campeonato_tabActiva'

export default function PanelTorneo() {
  const { torneoId } = useAuth()
  const [tabActiva, setTabActiva] = useState(() => {
    try {
      const guardada = sessionStorage.getItem(TAB_STORAGE_KEY)
      return TABS.some((t) => t.id === guardada) ? guardada : 'equipos'
    } catch {
      return 'equipos'
    }
  })
  const [linkCopiado, setLinkCopiado] = useState(false)

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
        <Componente torneoId={torneoId} onIrAPosiciones={() => setTabActiva('posiciones')} />
      </main>
    </div>
  )
}
