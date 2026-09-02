import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarJugadoresPorCategoria } from '../../../services/torneoJugadoresService'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'

// Solo lectura: nunca consulta la subcoleccion privada de DNI, ni la
// ofrece de ninguna forma - esta vista es publica.
export default function TabJugadoresPublica({ torneoId }) {
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const [equipos, setEquipos] = useState([])
  const [equipoFiltro, setEquipoFiltro] = useState('')
  const [jugadores, setJugadores] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    setEquipoFiltro('')
    setCargando(true)
    Promise.all([listarEquiposPorCategoria(torneoId, categoria), listarJugadoresPorCategoria(torneoId, categoria)])
      .then(([eq, js]) => {
        if (cancelado) return
        setEquipos(eq)
        setJugadores(js)
      })
      .catch((err) => console.error('[TabJugadoresPublica]', err))
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [torneoId, categoria])

  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  const jugadoresFiltrados = equipoFiltro
    ? jugadores.filter((j) => j.equipoId === equipoFiltro)
    : jugadores

  return (
    <div>
      <div className="mb-4 flex overflow-hidden rounded-xl border border-line">
        {Object.values(CATEGORIA_TORNEO).map((c) => (
          <button
            key={c}
            onClick={() => setCategoria(c)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              categoria === c ? 'bg-brand text-white' : 'bg-surface text-ink-soft'
            }`}
          >
            {CATEGORIA_TORNEO_LABELS[c]}
          </button>
        ))}
      </div>

      <select
        value={equipoFiltro}
        onChange={(e) => setEquipoFiltro(e.target.value)}
        className="mb-4 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus-visible:border-brand"
      >
        <option value="">Todos los equipos</option>
        {equipos.map((eq) => (
          <option key={eq.id} value={eq.id}>{eq.nombre}</option>
        ))}
      </select>

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}

      {!cargando && jugadoresFiltrados.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
          Todavía no hay jugadores registrados.
        </div>
      )}

      <ul className="space-y-2">
        {jugadoresFiltrados.map((j) => (
          <li key={j.id} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {j.nombre} {j.numeroCamiseta && <span className="text-ink-soft">#{j.numeroCamiseta}</span>}
              </p>
              <p className="text-xs text-ink-soft">{nombreEquipo(j.equipoId)}</p>
            </div>
            {j.eliminado ? (
              <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                ❌ Eliminado
              </span>
            ) : j.suspendido ? (
              <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                Suspendido
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
