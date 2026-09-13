import { useEffect, useState } from 'react'
import { listarJugadoresPorEquipo } from '../../services/torneoJugadoresService'
import { listarFotosEquipo } from '../../services/torneoGaleriaEquipoService'
import { colorEquipo } from '../../utils/colorEquipo'
import { EscudoEquipo } from '../shared/EscudoEquipo'
import { FilaJugadorPublica } from './FilaJugadorPublica'

const TABS = [
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'galeria', label: 'Galería de fotos' },
  { id: 'historia', label: 'Historia' },
]

/**
 * Ficha publica de solo lectura de una promocion/equipo (ver
 * TabJugadoresPublica, al tocar una fila) - contraparte de DetalleEquipo,
 * sin ningun control de editar/subir/borrar.
 */
export default function DetalleEquipoPublica({ equipo, onCerrar }) {
  const [tab, setTab] = useState('jugadores')
  const color = colorEquipo(equipo.nombre)

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onCerrar}
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft"
        >
          ← Volver
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <EscudoEquipo nombre={equipo.nombre} fotoUrl={equipo.fotoPortadaUrl} />
          <span className={`truncate text-base font-bold ${color.text}`}>{equipo.nombre}</span>
        </div>
      </div>

      <nav className="mb-4 flex gap-1 rounded-xl border border-line bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium sm:text-sm ${
              tab === t.id ? 'bg-brand text-white' : 'text-ink-soft'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'jugadores' && <PestanaJugadoresPublica equipo={equipo} />}
      {tab === 'galeria' && <PestanaGaleriaPublica equipo={equipo} />}
      {tab === 'historia' && <PestanaHistoriaPublica equipo={equipo} />}
    </div>
  )
}

function PestanaJugadoresPublica({ equipo }) {
  const [jugadores, setJugadores] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    listarJugadoresPorEquipo(equipo.id)
      .then((js) => {
        if (!cancelado) setJugadores(js)
      })
      .catch((err) => console.error('[DetalleEquipoPublica] PestanaJugadoresPublica', err))
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [equipo.id])

  if (cargando) return <p className="text-sm text-ink-soft">Cargando…</p>

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {jugadores.length === 0 ? (
        <li className="px-4 py-6 text-center text-sm text-ink-soft">Sin jugadores todavía.</li>
      ) : (
        jugadores.map((j) => <FilaJugadorPublica key={j.id} jugador={j} />)
      )}
    </ul>
  )
}

function PestanaGaleriaPublica({ equipo }) {
  const [fotos, setFotos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    listarFotosEquipo(equipo.id)
      .then((fs) => {
        if (!cancelado) setFotos(fs)
      })
      .catch((err) => console.error('[DetalleEquipoPublica] PestanaGaleriaPublica', err))
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [equipo.id])

  if (cargando) return <p className="text-sm text-ink-soft">Cargando…</p>

  if (fotos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
        Todavía no hay fotos en la galería de esta promoción.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {fotos.map((foto) => (
        <div key={foto.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
          {foto.url && <img src={foto.url} alt={foto.descripcion || ''} className="h-56 w-full object-cover" />}
          {foto.descripcion && <p className="px-4 py-3 text-sm text-ink-soft">{foto.descripcion}</p>}
        </div>
      ))}
    </div>
  )
}

function PestanaHistoriaPublica({ equipo }) {
  if (!equipo.historia) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
        Sin historia registrada todavía.
      </div>
    )
  }
  return (
    <div className="whitespace-pre-wrap rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink">
      {equipo.historia}
    </div>
  )
}
