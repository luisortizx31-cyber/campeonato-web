import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { obtenerConfigTorneo } from '../../services/torneoConfigService'
import { obtenerTorneo } from '../../services/torneosService'
import TabPosicionesPublica from './tabsPublico/TabPosicionesPublica'
import TabFechasPublica from './tabsPublico/TabFechasPublica'
import TabJugadoresPublica from './tabsPublico/TabJugadoresPublica'
import TabAmonestadosPublica from './tabsPublico/TabAmonestadosPublica'

const TABS = [
  { id: 'posiciones', label: 'Tabla de Posiciones', icon: '📊', Componente: TabPosicionesPublica },
  { id: 'fechas', label: 'Fechas', icon: '🗓️', Componente: TabFechasPublica },
  { id: 'jugadores', label: 'Jugadores', icon: '👥', Componente: TabJugadoresPublica },
  { id: 'amonestados', label: 'Amonestados', icon: '🟨', Componente: TabAmonestadosPublica },
]

// Pagina publica de UN torneo (tenant) - sin login, pensada para
// compartir el link por WhatsApp (ver PanelTorneo.jsx, boton "Copiar
// link público"). El :torneoId de la URL dice de que colegio son los
// datos. Solo lectura: ninguna accion de esta pagina ni de sus tabs
// escribe en Firestore.
export default function PaginaPublicaTorneo() {
  const { torneoId } = useParams()
  const [tabActiva, setTabActiva] = useState('posiciones')
  const [basesUrl, setBasesUrl] = useState(null)
  const [nombreTorneo, setNombreTorneo] = useState(null)
  const [torneoNoEncontrado, setTorneoNoEncontrado] = useState(false)

  useEffect(() => {
    let cancelado = false
    obtenerTorneo(torneoId)
      .then((t) => {
        if (cancelado) return
        if (!t) {
          setTorneoNoEncontrado(true)
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
      .then((c) => setBasesUrl(c.basesUrl))
      .catch((err) => console.error('[PaginaPublicaTorneo]', err))
  }, [torneoId])

  const tab = TABS.find((t) => t.id === tabActiva) ?? TABS[0]
  const Componente = tab.Componente

  if (torneoNoEncontrado) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-ink-soft">
        Este link de campeonato no existe o ya no está disponible.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper pb-10">
      <header className="border-b border-line bg-surface px-4 py-4">
        <p className="font-mono text-xs tracking-widest text-ink-soft uppercase">
          {nombreTorneo || 'Campeonato'}
        </p>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-ink">{tab.label}</h1>
          {basesUrl && (
            <a
              href={basesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft"
            >
              📄 Bases del torneo
            </a>
          )}
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
        <Componente torneoId={torneoId} />
      </main>
    </div>
  )
}
