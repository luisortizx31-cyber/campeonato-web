import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarJugadoresPorCategoria } from '../../../services/torneoJugadoresService'
import { listarTarjetasPorCategoria } from '../../../services/torneoTarjetasService'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS, TIPO_TARJETA_LABELS, TIPO_TARJETA_STYLES } from '../../../models/torneo'

export default function TabAmonestadosPublica({ torneoId }) {
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const [equipos, setEquipos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [tarjetas, setTarjetas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    Promise.all([
      listarEquiposPorCategoria(torneoId, categoria),
      listarJugadoresPorCategoria(torneoId, categoria),
      listarTarjetasPorCategoria(torneoId, categoria),
    ])
      .then(([eq, js, ts]) => {
        if (cancelado) return
        setEquipos(eq)
        setJugadores(js)
        setTarjetas(ts)
      })
      .catch((err) => console.error('[TabAmonestadosPublica]', err))
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [torneoId, categoria])

  function nombreJugador(id) {
    return jugadores.find((j) => j.id === id)?.nombre || '—'
  }
  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  const eliminados = jugadores.filter((j) => j.eliminado)
  const suspendidos = jugadores.filter((j) => j.suspendido && !j.eliminado)

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

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}

      {!cargando && (
        <>
          {eliminados.length > 0 && (
            <>
              <h2 className="mb-2 text-sm font-semibold text-ink">
                Eliminados del campeonato ({eliminados.length})
              </h2>
              <ul className="mb-6 space-y-2">
                {eliminados.map((j) => (
                  <li key={j.id} className="rounded-xl border border-danger bg-danger-soft px-4 py-3">
                    <p className="text-sm font-semibold text-ink">❌ {j.nombre}</p>
                    <p className="text-xs text-ink-soft">{nombreEquipo(j.equipoId)} · {j.motivoEliminacion}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mb-2 text-sm font-semibold text-ink">
            Jugadores suspendidos {suspendidos.length > 0 && `(${suspendidos.length})`}
          </h2>
          {suspendidos.length === 0 ? (
            <p className="mb-6 text-sm text-ink-soft">Nadie está suspendido en esta categoría.</p>
          ) : (
            <ul className="mb-6 space-y-2">
              {suspendidos.map((j) => (
                <li key={j.id} className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{j.nombre}</p>
                  <p className="text-xs text-ink-soft">
                    {nombreEquipo(j.equipoId)} · {j.motivoSuspension}
                    {j.fechasSuspension ? ` · ${j.fechasSuspension} fecha(s)` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-2 text-sm font-semibold text-ink">
            Historial de tarjetas {tarjetas.length > 0 && `(${tarjetas.length})`}
          </h2>
          {tarjetas.length === 0 ? (
            <p className="text-sm text-ink-soft">Todavía no hay tarjetas cargadas.</p>
          ) : (
            <ul className="space-y-2">
              {tarjetas.map((t) => {
                const estilo = TIPO_TARJETA_STYLES[t.tipo]
                return (
                  <li key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estilo.fondo} ${estilo.texto}`}>
                        {TIPO_TARJETA_LABELS[t.tipo]}
                      </span>
                      <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                        {t.fechaNumero != null ? `Fecha ${t.fechaNumero}` : 'Sin fecha'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{nombreJugador(t.jugadorId)}</p>
                      <p className="text-xs text-ink-soft">
                        {nombreEquipo(t.equipoId)}
                        {' · '}
                        {t.fecha?.toDate?.().toLocaleDateString('es-PE') || ''}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
