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
import { calcularFechaActual } from '../../../utils/fixtureTorneo'
import { TIPO_TARJETA_LABELS, TIPO_TARJETA_STYLES } from '../../../models/torneo'
import { colorEquipo } from '../../../utils/colorEquipo'
import ModalAgregarTarjeta from '../ModalAgregarTarjeta'
import { SelectorCategoria } from '../../shared/SelectorCategoria'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'

// Fila de una tarjeta dentro del historial - se repite tanto agrupada
// por fecha (ver abajo) como en la lista plana de resultados de
// busqueda.
function FilaTarjeta({ tarjeta, nombreJugador, nombreEquipo, onEliminar, eliminando }) {
  // tipoEfectivo puede diferir de tipo (ej. la 2da amarilla del mismo
  // partido se procesa como roja, ver finalizarTarjetasPartido en
  // torneoTarjetasService) - hay que mostrar el efecto REAL que tuvo la
  // tarjeta, si no una expulsion por doble amarilla queda mostrada como
  // una amarilla mas. Las tarjetas todavia sin procesar (en borrador,
  // partido no finalizado) no tienen tipoEfectivo todavia - ahi se cae
  // al tipo tal cual se cargo.
  const tipoMostrado = tarjeta.tipoEfectivo || tarjeta.tipo
  const estilo = TIPO_TARJETA_STYLES[tipoMostrado]
  return (
    <li className="flex items-center justify-between gap-2 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${estilo.fondo} ${estilo.texto}`}>
          {TIPO_TARJETA_LABELS[tipoMostrado]}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{nombreJugador(tarjeta.jugadorId)}</p>
          <p className="text-xs text-ink-soft">
            {nombreEquipo(tarjeta.equipoId)}
            {' · '}
            {tarjeta.fecha?.toDate?.().toLocaleDateString('es-PE') || ''}
            {tarjeta.motivo && ` · ${tarjeta.motivo}`}
          </p>
          {/* Tarjeta "en borrador": se cargo desde Cancha pero el
              partido nunca se finalizo, asi que todavia no le toco
              nada al contador del jugador (ver registrarTarjetaPartido) */}
          {tarjeta.procesada === false && (
            <p className="mt-0.5 text-xs font-semibold text-warning">
              ⚠ Sin finalizar el partido - todavía no afecta al jugador
            </p>
          )}
        </div>
      </div>
      <button
        onClick={onEliminar}
        disabled={eliminando}
        className="shrink-0 rounded-lg border border-danger/30 px-2.5 py-1 text-xs text-danger disabled:opacity-50"
      >
        {eliminando ? '…' : 'Eliminar'}
      </button>
    </li>
  )
}

export default function TabAmonestados({ torneoId, categoriasActivas }) {
  const [categoria, setCategoria] = useState(() => categoriasActivas[0])
  const swipeCategoria = useSwipeHorizontal(categoriasActivas, categoria, setCategoria)
  const [equipos, setEquipos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [tarjetas, setTarjetas] = useState([])
  const [partidos, setPartidos] = useState([])
  const [fechaActual, setFechaActual] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(false)
  const [procesando, setProcesando] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [busquedaHistorial, setBusquedaHistorial] = useState('')
  const [expandidosHistorial, setExpandidosHistorial] = useState([])

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [eq, ts, ps] = await Promise.all([
        listarEquiposPorCategoria(torneoId, categoria),
        listarTarjetasPorCategoria(torneoId, categoria),
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

  function nombreJugador(id) {
    return jugadores.find((j) => j.id === id)?.nombre || '—'
  }
  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  const eliminados = jugadores.filter((j) => j.eliminado)
  const suspendidos = jugadores.filter((j) => j.suspendido && !j.eliminado)

  function toggleExpandidoHistorial(clave) {
    setExpandidosHistorial((e) => (e.includes(clave) ? e.filter((k) => k !== clave) : [...e, clave]))
  }

  const fechasConTarjetas = [...new Set(tarjetas.filter((t) => t.fechaNumero != null).map((t) => t.fechaNumero))].sort((a, b) => a - b)
  const tarjetasSinFecha = tarjetas.filter((t) => t.fechaNumero == null)

  const busquedaNormalizada = busquedaHistorial.trim().toLowerCase()
  const tarjetasBuscadas = busquedaNormalizada
    ? tarjetas.filter((t) => nombreJugador(t.jugadorId).toLowerCase().includes(busquedaNormalizada))
    : []

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
      <SelectorCategoria categorias={categoriasActivas} activa={categoria} onCambiar={setCategoria} />

      <div {...swipeCategoria}>
      {!cargando && (
        <p className="mb-2.5 text-xs text-ink-soft">
          Fecha actual: {fechaActual > 0 ? fechaActual : '— (ninguna fecha completa todavía)'}
        </p>
      )}

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

              {busquedaNormalizada ? (
                tarjetasBuscadas.length === 0 ? (
                  <p className="text-sm text-ink-soft">No hay ninguna tarjeta que coincida con "{busquedaHistorial}".</p>
                ) : (
                  <ul className="space-y-2">
                    {tarjetasBuscadas.map((t) => (
                      <li key={t.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                        <FilaTarjeta
                          tarjeta={t}
                          nombreJugador={nombreJugador}
                          nombreEquipo={nombreEquipo}
                          onEliminar={() => handleEliminarTarjeta(t)}
                          eliminando={procesando === t.id}
                        />
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <ul className="space-y-2">
                  {fechasConTarjetas.map((f) => {
                    const tarjetasFecha = tarjetas.filter((t) => t.fechaNumero === f)
                    const abierto = expandidosHistorial.includes(f)
                    const color = colorEquipo(`Fecha ${f}`)
                    return (
                      <li key={f} className="overflow-hidden rounded-2xl border border-line bg-surface">
                        <button
                          onClick={() => toggleExpandidoHistorial(f)}
                          className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left ${color.bg}`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color.bg} ${color.text}`}>
                              {f}
                            </span>
                            <span className={`truncate font-bold ${color.text}`}>Fecha {f}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-ink-soft">
                            {tarjetasFecha.length} tarjeta{tarjetasFecha.length === 1 ? '' : 's'}
                            <span className={`transition-transform ${abierto ? 'rotate-180' : ''}`}>⌄</span>
                          </span>
                        </button>
                        {abierto && (
                          <ul className="divide-y divide-line border-t border-line bg-paper">
                            {tarjetasFecha.map((t) => (
                              <FilaTarjeta
                                key={t.id}
                                tarjeta={t}
                                nombreJugador={nombreJugador}
                                nombreEquipo={nombreEquipo}
                                onEliminar={() => handleEliminarTarjeta(t)}
                                eliminando={procesando === t.id}
                              />
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}

                  {tarjetasSinFecha.length > 0 && (
                    <li className="overflow-hidden rounded-2xl border border-line bg-surface">
                      <button
                        onClick={() => toggleExpandidoHistorial('sin-fecha')}
                        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                      >
                        <span className="truncate font-bold text-ink-soft">Sin fecha asociada</span>
                        <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-ink-soft">
                          {tarjetasSinFecha.length} tarjeta{tarjetasSinFecha.length === 1 ? '' : 's'}
                          <span className={`transition-transform ${expandidosHistorial.includes('sin-fecha') ? 'rotate-180' : ''}`}>⌄</span>
                        </span>
                      </button>
                      {expandidosHistorial.includes('sin-fecha') && (
                        <ul className="divide-y divide-line border-t border-line bg-paper">
                          {tarjetasSinFecha.map((t) => (
                            <FilaTarjeta
                              key={t.id}
                              tarjeta={t}
                              nombreJugador={nombreJugador}
                              nombreEquipo={nombreEquipo}
                              onEliminar={() => handleEliminarTarjeta(t)}
                              eliminando={procesando === t.id}
                            />
                          ))}
                        </ul>
                      )}
                    </li>
                  )}
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
