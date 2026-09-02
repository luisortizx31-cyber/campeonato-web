import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import {
  listarJugadoresPorCategoria,
  eliminarJugador,
  obtenerDatosPrivadosJugador,
} from '../../../services/torneoJugadoresService'
import { construirLinkWhatsapp } from '../../../utils/whatsapp'
import { WhatsappIcon } from '../../shared/WhatsappIcon'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import ModalRegistrarJugador from '../ModalRegistrarJugador'

export default function TabJugadores({ torneoId }) {
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const [equipos, setEquipos] = useState([])
  const [equipoFiltro, setEquipoFiltro] = useState('')
  const [jugadores, setJugadores] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | 'nuevo' | jugador a editar
  const [eliminando, setEliminando] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)
  const [datosVisibles, setDatosVisibles] = useState({}) // { [jugadorId]: 'cargando' | { dni, telefono } | 'error' }

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [eq, js] = await Promise.all([
        listarEquiposPorCategoria(torneoId, categoria),
        listarJugadoresPorCategoria(torneoId, categoria),
      ])
      setEquipos(eq)
      setJugadores(js)
    } catch (err) {
      console.error('[TabJugadores]', err)
      setError('No se pudieron cargar los jugadores.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    setEquipoFiltro('')
    cargar()
  }, [torneoId, categoria])

  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  const jugadoresFiltrados = jugadores.filter((j) => {
    if (equipoFiltro && j.equipoId !== equipoFiltro) return false
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return j.nombre?.toLowerCase().includes(q)
  })

  async function handleVerDatos(jugadorId) {
    if (datosVisibles[jugadorId] !== undefined) {
      setDatosVisibles((d) => {
        const resto = { ...d }
        delete resto[jugadorId]
        return resto
      })
      return
    }
    setDatosVisibles((d) => ({ ...d, [jugadorId]: 'cargando' }))
    try {
      const datos = await obtenerDatosPrivadosJugador(jugadorId)
      setDatosVisibles((d) => ({ ...d, [jugadorId]: datos }))
    } catch (err) {
      console.error('[TabJugadores]', err)
      setDatosVisibles((d) => ({ ...d, [jugadorId]: 'error' }))
    }
  }

  async function handleEliminar(jugador) {
    if (!confirm(`¿Eliminar a "${jugador.nombre}"?`)) return
    setEliminando(jugador.id)
    setErrorAccion(null)
    try {
      await eliminarJugador(jugador.id)
      cargar()
    } catch (err) {
      console.error('[TabJugadores]', err)
      setErrorAccion(err.message || 'No se pudo eliminar el jugador.')
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

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setModal('nuevo')}
          disabled={equipos.length === 0}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          + Nuevo jugador
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <select
          value={equipoFiltro}
          onChange={(e) => setEquipoFiltro(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus-visible:border-brand"
        >
          <option value="">Todos los equipos</option>
          {equipos.map((eq) => (
            <option key={eq.id} value={eq.id}>{eq.nombre}</option>
          ))}
        </select>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 outline-none focus-visible:border-brand"
        />
      </div>

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {errorAccion && (
        <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorAccion}</p>
      )}

      {!cargando && !error && equipos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
          Primero crea equipos en Equipos para poder registrar jugadores.
        </div>
      )}

      {!cargando && !error && equipos.length > 0 && jugadoresFiltrados.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
          No hay jugadores que coincidan.
        </div>
      )}

      <ul className="space-y-2">
        {jugadoresFiltrados.map((j) => (
          <li key={j.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">
                  {j.nombre} {j.numeroCamiseta && <span className="text-ink-soft">#{j.numeroCamiseta}</span>}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">{nombreEquipo(j.equipoId)}</p>
                {j.eliminado ? (
                  <span className="mt-1 inline-block rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                    ❌ Eliminado{j.motivoEliminacion ? ` · ${j.motivoEliminacion}` : ''}
                  </span>
                ) : j.suspendido ? (
                  <span className="mt-1 inline-block rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                    Suspendido{j.motivoSuspension ? ` · ${j.motivoSuspension}` : ''}
                  </span>
                ) : null}
                {datosVisibles[j.id] !== undefined && (
                  <div className="mt-1 flex items-center gap-2">
                    {datosVisibles[j.id] === 'cargando' ? (
                      <p className="text-xs text-ink-soft">Cargando…</p>
                    ) : datosVisibles[j.id] === 'error' ? (
                      <p className="text-xs text-danger">Error al cargar.</p>
                    ) : (
                      <>
                        <p className="font-mono text-xs text-ink-soft">
                          DNI: {datosVisibles[j.id].dni || 'Sin registrar'}
                          {datosVisibles[j.id].telefono && ` · ${datosVisibles[j.id].telefono}`}
                        </p>
                        {construirLinkWhatsapp(datosVisibles[j.id].telefono) && (
                          <a
                            href={construirLinkWhatsapp(datosVisibles[j.id].telefono)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-success"
                            aria-label={`Escribir a ${j.nombre} por WhatsApp`}
                          >
                            <WhatsappIcon className="h-4 w-4" />
                          </a>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVerDatos(j.id)}
                    className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft"
                  >
                    {datosVisibles[j.id] !== undefined ? 'Ocultar' : 'Ver datos'}
                  </button>
                  <button
                    onClick={() => setModal(j)}
                    className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft"
                  >
                    Editar
                  </button>
                </div>
                <button
                  onClick={() => handleEliminar(j)}
                  disabled={eliminando === j.id}
                  className="rounded-lg border border-danger/30 px-2.5 py-1 text-xs text-danger disabled:opacity-50"
                >
                  {eliminando === j.id ? '…' : 'Eliminar'}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {modal && (
        <ModalRegistrarJugador
          torneoId={torneoId}
          categoria={categoria}
          equipos={equipos}
          equipoIdInicial={equipoFiltro || undefined}
          jugador={modal === 'nuevo' ? null : modal}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null)
            cargar()
          }}
        />
      )}
    </div>
  )
}
