import { useEffect, useRef, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarPartidosPorCategoria } from '../../../services/torneoPartidosService'
import { listarJugadoresPorCategoria } from '../../../services/torneoJugadoresService'
import { listarGolesPorCategoria, eliminarGol } from '../../../services/torneoGolesService'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import { BotonExportarExcel } from '../../shared/BotonExportarExcel'
import { BotonDescargarTabla } from '../../shared/BotonDescargarTabla'
import TablaGoleadoresCategoria from '../TablaGoleadoresCategoria'
import ModalAgregarGol from '../ModalAgregarGol'

export default function TabGoleadores({ torneoId }) {
  const tablaRef = useRef(null)
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
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
  const [fechaFiltro, setFechaFiltro] = useState('') // '' = todas las fechas

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
    setFechaFiltro('')
  }, [categoria])

  function nombreJugador(id) {
    return jugadores.find((j) => j.id === id)?.nombre || '—'
  }
  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  const fechasConGoles = [...new Set(goles.filter((g) => g.fechaNumero != null).map((g) => g.fechaNumero))].sort((a, b) => a - b)
  const hayGolesSinFecha = goles.some((g) => g.fechaNumero == null)
  const golesFiltrados =
    fechaFiltro === ''
      ? goles
      : fechaFiltro === 'sin-fecha'
        ? goles.filter((g) => g.fechaNumero == null)
        : goles.filter((g) => g.fechaNumero === Number(fechaFiltro))

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
          <div className="mt-6 mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">
              Historial de goles ({golesFiltrados.length})
            </h2>
            {fechasConGoles.length > 0 && (
              <select
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                className="shrink-0 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus-visible:border-brand"
              >
                <option value="">Todas las fechas</option>
                {fechasConGoles.map((f) => (
                  <option key={f} value={f}>Fecha {f}</option>
                ))}
                {hayGolesSinFecha && <option value="sin-fecha">Sin fecha</option>}
              </select>
            )}
          </div>
          {golesFiltrados.length === 0 ? (
            <p className="text-sm text-ink-soft">No hay goles en esa fecha.</p>
          ) : (
          <ul className="space-y-2">
            {golesFiltrados.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-ink">
                    ⚽ {nombreJugador(g.jugadorId)}{' '}
                    <span className="money font-semibold text-brand">
                      {g.cantidad} gol{g.cantidad === 1 ? '' : 'es'}
                    </span>
                  </p>
                  <p className="text-xs text-ink-soft">
                    {nombreEquipo(g.equipoId)}
                    {g.fechaNumero != null ? ` · Fecha ${g.fechaNumero}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleEliminarGol(g)}
                  disabled={eliminando === g.id}
                  className="shrink-0 rounded-lg border border-danger/30 px-2.5 py-1 text-xs text-danger disabled:opacity-50"
                >
                  {eliminando === g.id ? '…' : 'Eliminar'}
                </button>
              </li>
            ))}
          </ul>
          )}
        </>
      )}

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
