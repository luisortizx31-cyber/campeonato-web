import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarJugadoresPorCategoria } from '../../../services/torneoJugadoresService'
import { listarTarjetasPorCategoria } from '../../../services/torneoTarjetasService'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS, TIPO_TARJETA_LABELS, TIPO_TARJETA_STYLES } from '../../../models/torneo'
import { colorEquipo, inicialEquipo } from '../../../utils/colorEquipo'

export default function TabAmonestadosPublica({ torneoId }) {
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const [equipos, setEquipos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [tarjetas, setTarjetas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [busquedaHistorial, setBusquedaHistorial] = useState('')

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

  const busquedaNormalizada = busquedaHistorial.trim().toLowerCase()
  const tarjetasFiltradas = busquedaNormalizada
    ? tarjetas.filter((t) => nombreJugador(t.jugadorId).toLowerCase().includes(busquedaNormalizada))
    : tarjetas

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
            <ul className="mb-6 space-y-3">
              {suspendidos.map((j) => {
                const equipo = nombreEquipo(j.equipoId)
                const color = colorEquipo(equipo)
                const desde = j.suspendidoDesdeFecha
                const hasta = j.suspendidoHastaFecha
                const vuelve = hasta != null ? hasta + 1 : null
                return (
                  <li key={j.id} className="overflow-hidden rounded-2xl border border-danger/30 bg-surface shadow-sm">
                    <div className="flex items-center gap-3 bg-danger-soft px-4 py-3">
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${color.bg} ${color.text}`}
                      >
                        {inicialEquipo(equipo)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-ink">{j.nombre}</p>
                        <span className="inline-block rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink-soft">
                          {equipo}
                        </span>
                      </div>
                    </div>

                    {(desde != null || hasta != null) && (
                      <div className="grid grid-cols-2 divide-x divide-line border-t border-danger/20">
                        <div className="px-4 py-2.5 text-center">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">No juega</p>
                          <p className="text-lg font-bold text-danger">
                            Fecha {desde}{hasta != null && hasta !== desde ? `–${hasta}` : ''}
                          </p>
                        </div>
                        <div className="px-4 py-2.5 text-center">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">Vuelve a jugar</p>
                          <p className="text-lg font-bold text-success">
                            {vuelve != null ? `Fecha ${vuelve}` : '—'}
                          </p>
                        </div>
                      </div>
                    )}

                    <p className="border-t border-danger/20 px-4 py-2 text-xs text-ink-soft">
                      {j.motivoSuspension}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">
              Historial de tarjetas {tarjetas.length > 0 && `(${tarjetas.length})`}
            </h2>
            {tarjetas.length > 0 && (
              <button
                onClick={() => setMostrarHistorial((v) => !v)}
                className="shrink-0 text-xs font-medium text-brand"
              >
                {mostrarHistorial ? 'Ocultar' : 'Ver historial'}
              </button>
            )}
          </div>

          {tarjetas.length === 0 ? (
            <p className="text-sm text-ink-soft">Todavía no hay tarjetas cargadas.</p>
          ) : mostrarHistorial ? (
            <>
              <input
                type="search"
                value={busquedaHistorial}
                onChange={(e) => setBusquedaHistorial(e.target.value)}
                placeholder="Buscar jugador…"
                className="mb-3 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 outline-none focus-visible:border-brand"
              />
              {tarjetasFiltradas.length === 0 ? (
                <p className="text-sm text-ink-soft">No hay ninguna tarjeta que coincida con "{busquedaHistorial}".</p>
              ) : (
                <ul className="space-y-2">
                  {tarjetasFiltradas.map((t) => {
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
          ) : null}
        </>
      )}
    </div>
  )
}
