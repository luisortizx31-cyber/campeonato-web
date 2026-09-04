import { useEffect, useRef, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarPartidosPorCategoria } from '../../../services/torneoPartidosService'
import { listarJugadoresPorCategoria } from '../../../services/torneoJugadoresService'
import { listarGolesPorCategoria, eliminarGol } from '../../../services/torneoGolesService'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import { colorEquipo } from '../../../utils/colorEquipo'
import { BotonExportarExcel } from '../../shared/BotonExportarExcel'
import { BotonDescargarTabla } from '../../shared/BotonDescargarTabla'
import TablaGoleadoresCategoria from '../TablaGoleadoresCategoria'
import ModalAgregarGol from '../ModalAgregarGol'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'

// Fila de un gol dentro del historial - se repite tanto agrupada por
// fecha (ver abajo) como en la lista plana de resultados de busqueda,
// donde ademas hay que mostrar a que fecha pertenece (agrupada, ya se
// ve en el encabezado de la seccion).
function FilaGol({ gol, nombreJugador, nombreEquipo, mostrarFecha, onEliminar, eliminando }) {
  return (
    <li className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate text-ink">
          ⚽ {nombreJugador(gol.jugadorId)}{' '}
          <span className="money font-semibold text-brand">
            {gol.cantidad} gol{gol.cantidad === 1 ? '' : 'es'}
          </span>
        </p>
        <p className="text-xs text-ink-soft">
          {nombreEquipo(gol.equipoId)}
          {mostrarFecha && gol.fechaNumero != null ? ` · Fecha ${gol.fechaNumero}` : ''}
        </p>
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

export default function TabGoleadores({ torneoId }) {
  const tablaRef = useRef(null)
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const swipeCategoria = useSwipeHorizontal(Object.values(CATEGORIA_TORNEO), categoria, setCategoria)
  const [equipos, setEquipos] = useState([])
  const [partidos, setPartidos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [goles, setGoles] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filasExport, setFilasExport] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [modal, setModal] = useState(false)
  const [eliminando, setEliminando] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [expandidos, setExpandidos] = useState([])

  async function cargarAuxiliares() {
    setCargando(true)
    try {
      const [eq, ps, js, gs] = await Promise.all([
        listarEquiposPorCategoria(torneoId, categoria),
        listarPartidosPorCategoria(torneoId, categoria),
        listarJugadoresPorCategoria(torneoId, categoria),
        // Coleccion nueva - si su regla de Firestore todavia no esta
        // desplegada, que el resto de la pestaña siga andando igual.
        listarGolesPorCategoria(torneoId, categoria).catch((err) => {
          console.error('[TabGoleadores] listarGolesPorCategoria', err)
          return []
        }),
      ])
      setEquipos(eq)
      setPartidos(ps)
      setJugadores(js)
      setGoles(gs)
    } catch (err) {
      console.error('[TabGoleadores]', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarAuxiliares()
  }, [torneoId, categoria, refreshKey])

  useEffect(() => {
    setBusqueda('')
    setExpandidos([])
  }, [categoria])

  function nombreJugador(id) {
    return jugadores.find((j) => j.id === id)?.nombre || '—'
  }
  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  function toggleExpandido(clave) {
    setExpandidos((e) => (e.includes(clave) ? e.filter((k) => k !== clave) : [...e, clave]))
  }

  const fechasConGoles = [...new Set(goles.filter((g) => g.fechaNumero != null).map((g) => g.fechaNumero))].sort((a, b) => a - b)
  const golesSinFecha = goles.filter((g) => g.fechaNumero == null)

  const busquedaNormalizada = busqueda.trim().toLowerCase()
  const golesBuscados = busquedaNormalizada
    ? goles.filter((g) => nombreJugador(g.jugadorId).toLowerCase().includes(busquedaNormalizada))
    : []

  async function handleEliminarGol(gol) {
    if (!confirm('¿Eliminar este gol registrado?')) return
    setEliminando(gol.id)
    setErrorAccion(null)
    try {
      await eliminarGol(gol.id)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      console.error('[TabGoleadores]', err)
      setErrorAccion(err.message || 'No se pudo eliminar el gol.')
    } finally {
      setEliminando(null)
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
      <div className="mb-4 flex justify-end gap-2">
        <BotonExportarExcel
          nombreArchivo={`goleadores-${categoria}`}
          nombreHoja="Goleadores"
          label="Excel"
          columnas={[
            { header: 'Jugador', key: 'nombre', width: 25 },
            { header: 'Equipo', key: 'equipoNombre', width: 20 },
            { header: 'Goles', key: 'goles', width: 8 },
          ]}
          filas={filasExport}
        />
        <BotonDescargarTabla targetRef={tablaRef} nombreArchivo={`goleadores-${categoria}`} />
        <button
          onClick={() => setModal(true)}
          disabled={equipos.length === 0}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          + Agregar gol
        </button>
      </div>

      <TablaGoleadoresCategoria
        ref={tablaRef}
        torneoId={torneoId}
        categoria={categoria}
        refreshKey={refreshKey}
        onFilas={setFilasExport}
      />

      {errorAccion && (
        <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorAccion}</p>
      )}

      {!cargando && goles.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-sm font-semibold text-ink">
            Historial de goles ({goles.length})
          </h2>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar jugador…"
            className="mb-3 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 outline-none focus-visible:border-brand"
          />

          {busquedaNormalizada ? (
            golesBuscados.length === 0 ? (
              <p className="text-sm text-ink-soft">No hay ningún gol que coincida con "{busqueda}".</p>
            ) : (
              <ul className="space-y-2">
                {golesBuscados.map((g) => (
                  <li key={g.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                    <FilaGol
                      gol={g}
                      nombreJugador={nombreJugador}
                      nombreEquipo={nombreEquipo}
                      mostrarFecha
                      onEliminar={() => handleEliminarGol(g)}
                      eliminando={eliminando === g.id}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ul className="space-y-2">
              {fechasConGoles.map((f) => {
                const golesFecha = goles.filter((g) => g.fechaNumero === f)
                const abierto = expandidos.includes(f)
                const color = colorEquipo(`Fecha ${f}`)
                return (
                  <li key={f} className="overflow-hidden rounded-2xl border border-line bg-surface">
                    <button
                      onClick={() => toggleExpandido(f)}
                      className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left ${color.bg}`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color.bg} ${color.text}`}>
                          {f}
                        </span>
                        <span className={`truncate font-bold ${color.text}`}>Fecha {f}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-ink-soft">
                        {golesFecha.length} gol{golesFecha.length === 1 ? '' : 'es'}
                        <span className={`transition-transform ${abierto ? 'rotate-180' : ''}`}>⌄</span>
                      </span>
                    </button>
                    {abierto && (
                      <ul className="divide-y divide-line border-t border-line bg-paper">
                        {golesFecha.map((g) => (
                          <FilaGol
                            key={g.id}
                            gol={g}
                            nombreJugador={nombreJugador}
                            nombreEquipo={nombreEquipo}
                            onEliminar={() => handleEliminarGol(g)}
                            eliminando={eliminando === g.id}
                          />
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}

              {golesSinFecha.length > 0 && (
                <li className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <button
                    onClick={() => toggleExpandido('sin-fecha')}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  >
                    <span className="truncate font-bold text-ink-soft">Sin fecha asociada</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-ink-soft">
                      {golesSinFecha.length} gol{golesSinFecha.length === 1 ? '' : 'es'}
                      <span className={`transition-transform ${expandidos.includes('sin-fecha') ? 'rotate-180' : ''}`}>⌄</span>
                    </span>
                  </button>
                  {expandidos.includes('sin-fecha') && (
                    <ul className="divide-y divide-line border-t border-line bg-paper">
                      {golesSinFecha.map((g) => (
                        <FilaGol
                          key={g.id}
                          gol={g}
                          nombreJugador={nombreJugador}
                          nombreEquipo={nombreEquipo}
                          onEliminar={() => handleEliminarGol(g)}
                          eliminando={eliminando === g.id}
                        />
                      ))}
                    </ul>
                  )}
                </li>
              )}
            </ul>
          )}
        </>
      )}
      </div>

      {modal && (
        <ModalAgregarGol
          torneoId={torneoId}
          categoria={categoria}
          equipos={equipos}
          partidos={partidos}
          onCerrar={() => setModal(false)}
          onGuardado={() => {
            setModal(false)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}
