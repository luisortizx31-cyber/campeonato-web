import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarJugadoresPorCategoria } from '../../../services/torneoJugadoresService'
import { listarPartidosPorCategoria } from '../../../services/torneoPartidosService'
import {
  listarTarjetasPorCategoria,
  eliminarTarjeta,
  limpiarSuspension,
  reconciliarSuspensionesPorFecha,
} from '../../../services/torneoTarjetasService'
import {
  obtenerConfigCategoria,
  actualizarUmbralAmarillas,
  actualizarUmbralRojas,
} from '../../../services/torneoConfigService'
import { calcularFechaActual } from '../../../utils/fixtureTorneo'
import {
  CATEGORIA_TORNEO,
  CATEGORIA_TORNEO_LABELS,
  TIPO_TARJETA_LABELS,
  TIPO_TARJETA_STYLES,
  OPCIONES_UMBRAL_AMARILLAS,
  OPCIONES_UMBRAL_ROJAS,
} from '../../../models/torneo'
import ModalAgregarTarjeta from '../ModalAgregarTarjeta'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'

export default function TabAmonestados({ torneoId }) {
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const swipeCategoria = useSwipeHorizontal(Object.values(CATEGORIA_TORNEO), categoria, setCategoria)
  const [equipos, setEquipos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [tarjetas, setTarjetas] = useState([])
  const [partidos, setPartidos] = useState([])
  const [fechaActual, setFechaActual] = useState(0)
  const [config, setConfig] = useState(null) // { umbralAmarillas, umbralRojas }
  const [guardandoUmbral, setGuardandoUmbral] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(false)
  const [procesando, setProcesando] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [busquedaHistorial, setBusquedaHistorial] = useState('')

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [eq, ts, cfg, ps] = await Promise.all([
        listarEquiposPorCategoria(torneoId, categoria),
        listarTarjetasPorCategoria(torneoId, categoria),
        obtenerConfigCategoria(torneoId, categoria),
        listarPartidosPorCategoria(torneoId, categoria),
      ])
      const fechaActualCalculada = calcularFechaActual(ps)

      // Levanta solas las suspensiones de los jugadores cuyo equipo ya
      // jugo su partido dentro de la ventana de suspension, antes de
      // traer a los jugadores - asi la lista de suspendidos que se ve
      // abajo ya sale al dia.
      await reconciliarSuspensionesPorFecha(torneoId, categoria, ps)
      const js = await listarJugadoresPorCategoria(torneoId, categoria)

      setEquipos(eq)
      setJugadores(js)
      setTarjetas(ts)
      setConfig(cfg)
      setPartidos(ps)
      setFechaActual(fechaActualCalculada)
    } catch (err) {
      console.error('[TabAmonestados]', err)
      setError('No se pudieron cargar las tarjetas.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [torneoId, categoria])

  async function handleCambiarUmbralAmarillas(nuevoUmbral) {
    setConfig((c) => ({ ...c, umbralAmarillas: Number(nuevoUmbral) }))
    setGuardandoUmbral(true)
    setErrorAccion(null)
    try {
      await actualizarUmbralAmarillas(torneoId, categoria, nuevoUmbral)
    } catch (err) {
      console.error('[TabAmonestados]', err)
      setErrorAccion('No se pudo guardar el umbral de suspensión.')
    } finally {
      setGuardandoUmbral(false)
    }
  }

  async function handleCambiarUmbralRojas(nuevoUmbral) {
    const valor = nuevoUmbral ? Number(nuevoUmbral) : null
    setConfig((c) => ({ ...c, umbralRojas: valor }))
    setGuardandoUmbral(true)
    setErrorAccion(null)
    try {
      await actualizarUmbralRojas(torneoId, categoria, valor)
    } catch (err) {
      console.error('[TabAmonestados]', err)
      setErrorAccion('No se pudo guardar el umbral de eliminación.')
    } finally {
      setGuardandoUmbral(false)
    }
  }

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

  async function handleLevantarSuspension(jugador) {
    const pregunta = jugador.eliminado
      ? `¿Reincorporar a "${jugador.nombre}" al campeonato?`
      : `¿Levantar la suspensión de "${jugador.nombre}"?`
    if (!confirm(pregunta)) return
    setProcesando(jugador.id)
    setErrorAccion(null)
    try {
      await limpiarSuspension(jugador.id)
      cargar()
    } catch (err) {
      console.error('[TabAmonestados]', err)
      setErrorAccion(err.message || 'No se pudo levantar la suspensión.')
    } finally {
      setProcesando(null)
    }
  }

  async function handleEliminarTarjeta(tarjeta) {
    if (!confirm('¿Eliminar esta tarjeta? Se corregirá el contador del jugador.')) return
    setProcesando(tarjeta.id)
    setErrorAccion(null)
    try {
      await eliminarTarjeta(tarjeta.id)
      cargar()
    } catch (err) {
      console.error('[TabAmonestados]', err)
      setErrorAccion(err.message || 'No se pudo eliminar la tarjeta.')
    } finally {
      setProcesando(null)
    }
  }

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

      <div {...swipeCategoria}>
      {!cargando && (
        <p className="mb-2.5 text-xs text-ink-soft">
          Fecha actual: {fechaActual > 0 ? fechaActual : '— (ninguna fecha completa todavía)'}
        </p>
      )}

      <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
        <label htmlFor="umbral-amarillas" className="text-sm text-ink-soft">
          Suspender al llegar a
        </label>
        <div className="flex items-center gap-2">
          <select
            id="umbral-amarillas"
            value={config?.umbralAmarillas ?? ''}
            disabled={!config || guardandoUmbral}
            onChange={(e) => handleCambiarUmbralAmarillas(e.target.value)}
            className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
          >
            {OPCIONES_UMBRAL_AMARILLAS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="text-sm text-ink-soft">amarillas</span>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
        <label htmlFor="umbral-rojas" className="text-sm text-ink-soft">
          Eliminar del campeonato al
        </label>
        <div className="flex items-center gap-2">
          <select
            id="umbral-rojas"
            value={config?.umbralRojas ?? ''}
            disabled={!config || guardandoUmbral}
            onChange={(e) => handleCambiarUmbralRojas(e.target.value)}
            className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
          >
            <option value="">Nunca</option>
            {OPCIONES_UMBRAL_ROJAS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="text-sm text-ink-soft">suspensiones por roja</span>
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setModal(true)}
          disabled={equipos.length === 0}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          + Agregar tarjeta
        </button>
      </div>

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {errorAccion && (
        <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorAccion}</p>
      )}

      {!cargando && !error && (
        <>
          {eliminados.length > 0 && (
            <>
              <h2 className="mb-2 text-sm font-semibold text-ink">
                Eliminados del campeonato ({eliminados.length})
              </h2>
              <ul className="mb-6 space-y-2">
                {eliminados.map((j) => (
                  <li
                    key={j.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-danger bg-danger-soft px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">❌ {j.nombre}</p>
                      <p className="text-xs text-ink-soft">
                        {nombreEquipo(j.equipoId)} · {j.motivoEliminacion}
                      </p>
                    </div>
                    <button
                      onClick={() => handleLevantarSuspension(j)}
                      disabled={procesando === j.id}
                      className="shrink-0 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-ink disabled:opacity-50"
                    >
                      {procesando === j.id ? '…' : 'Reincorporar'}
                    </button>
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
                <li
                  key={j.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{j.nombre}</p>
                    <p className="text-xs text-ink-soft">
                      {nombreEquipo(j.equipoId)} · {j.motivoSuspension}
                      {j.fechasSuspension ? ` · ${j.fechasSuspension} fecha(s)` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleLevantarSuspension(j)}
                    disabled={procesando === j.id}
                    className="shrink-0 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-ink disabled:opacity-50"
                  >
                    {procesando === j.id ? '…' : 'Levantar suspensión'}
                  </button>
                </li>
              ))}
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
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
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
                              {t.motivo && ` · ${t.motivo}`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleEliminarTarjeta(t)}
                          disabled={procesando === t.id}
                          className="shrink-0 rounded-lg border border-danger/30 px-2.5 py-1 text-xs text-danger disabled:opacity-50"
                        >
                          {procesando === t.id ? '…' : 'Eliminar'}
                        </button>
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

      {modal && (
        <ModalAgregarTarjeta
          torneoId={torneoId}
          categoria={categoria}
          equipos={equipos}
          tarjetas={tarjetas}
          partidos={partidos}
          onCerrar={() => setModal(false)}
          onGuardado={() => {
            setModal(false)
            cargar()
          }}
        />
      )}
    </div>
  )
}
