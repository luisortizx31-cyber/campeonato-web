import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import {
  listarJugadoresPorCategoria,
  eliminarJugador,
  obtenerDatosPrivadosJugador,
} from '../../../services/torneoJugadoresService'
import { obtenerConfigCategoria, actualizarInscripcionesCerradas } from '../../../services/torneoConfigService'
import { construirLinkWhatsapp } from '../../../utils/whatsapp'
import { colorEquipo } from '../../../utils/colorEquipo'
import { WhatsappIcon } from '../../shared/WhatsappIcon'
import { EscudoEquipo } from '../../shared/EscudoEquipo'
import { SelectorCategoria } from '../../shared/SelectorCategoria'
import ModalRegistrarJugador from '../ModalRegistrarJugador'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'

// Fila de un jugador con las acciones de administracion (ver datos
// privados, editar, eliminar) - se reutiliza tanto en la lista plana
// de resultados de busqueda como dentro de cada seccion de equipo.
function FilaJugadorAdmin({ jugador, datosVisible, onVerDatos, onEditar, onEliminar, eliminando }) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {jugador.nombre} {jugador.numeroCamiseta && <span className="text-ink-soft">#{jugador.numeroCamiseta}</span>}
            {jugador.esJale && (
              <span className="ml-1 rounded-full bg-warning-soft px-1.5 py-0.5 align-middle text-[10px] font-bold text-warning">
                JALE
              </span>
            )}
          </p>
          {jugador.eliminado ? (
            <span className="mt-1 inline-block rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
              ❌ Eliminado{jugador.motivoEliminacion ? ` · ${jugador.motivoEliminacion}` : ''}
            </span>
          ) : jugador.suspendido ? (
            <span className="mt-1 inline-block rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
              Suspendido{jugador.motivoSuspension ? ` · ${jugador.motivoSuspension}` : ''}
            </span>
          ) : null}
          {datosVisible !== undefined && (
            <div className="mt-1 flex items-center gap-2">
              {datosVisible === 'cargando' ? (
                <p className="text-xs text-ink-soft">Cargando…</p>
              ) : datosVisible === 'error' ? (
                <p className="text-xs text-danger">Error al cargar.</p>
              ) : (
                <>
                  <p className="font-mono text-xs text-ink-soft">
                    DNI: {datosVisible.dni || 'Sin registrar'}
                    {datosVisible.telefono && ` · ${datosVisible.telefono}`}
                  </p>
                  {construirLinkWhatsapp(datosVisible.telefono) && (
                    <a
                      href={construirLinkWhatsapp(datosVisible.telefono)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-success"
                      aria-label={`Escribir a ${jugador.nombre} por WhatsApp`}
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
            <button onClick={onVerDatos} className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft">
              {datosVisible !== undefined ? 'Ocultar' : 'Ver datos'}
            </button>
            <button onClick={onEditar} className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft">
              Editar
            </button>
          </div>
          <button
            onClick={onEliminar}
            disabled={eliminando}
            className="rounded-lg border border-danger/30 px-2.5 py-1 text-xs text-danger disabled:opacity-50"
          >
            {eliminando ? '…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </li>
  )
}

export default function TabJugadores({ torneoId, categoriasActivas }) {
  const [categoria, setCategoria] = useState(() => categoriasActivas[0])
  const swipeCategoria = useSwipeHorizontal(categoriasActivas, categoria, setCategoria)
  const [equipos, setEquipos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [expandidos, setExpandidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | 'nuevo' | jugador a editar
  const [equipoNuevoId, setEquipoNuevoId] = useState('')
  const [eliminando, setEliminando] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)
  const [datosVisibles, setDatosVisibles] = useState({}) // { [jugadorId]: 'cargando' | { dni, telefono } | 'error' }
  const [maximoJugadoresInscritos, setMaximoJugadoresInscritos] = useState(null)
  const [inscripcionesCerradas, setInscripcionesCerradas] = useState(false)
  const [cambiandoInscripciones, setCambiandoInscripciones] = useState(false)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [eq, js, cfg] = await Promise.all([
        listarEquiposPorCategoria(torneoId, categoria),
        listarJugadoresPorCategoria(torneoId, categoria),
        obtenerConfigCategoria(torneoId, categoria),
      ])
      setEquipos(eq)
      setJugadores(js)
      setMaximoJugadoresInscritos(cfg.maximoJugadoresInscritos)
      setInscripcionesCerradas(cfg.inscripcionesCerradas)
    } catch (err) {
      console.error('[TabJugadores]', err)
      setError('No se pudieron cargar los jugadores.')
    } finally {
      setCargando(false)
    }
  }

  async function toggleInscripciones() {
    const nuevoValor = !inscripcionesCerradas
    setCambiandoInscripciones(true)
    try {
      await actualizarInscripcionesCerradas(torneoId, categoria, nuevoValor)
      setInscripcionesCerradas(nuevoValor)
    } catch (err) {
      console.error('[TabJugadores] toggleInscripciones', err)
      setErrorAccion('No se pudo cambiar el estado de las inscripciones.')
    } finally {
      setCambiandoInscripciones(false)
    }
  }

  useEffect(() => {
    setBusqueda('')
    setExpandidos([])
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneoId, categoria])

  function toggleExpandido(equipoId) {
    setExpandidos((e) => (e.includes(equipoId) ? e.filter((id) => id !== equipoId) : [...e, equipoId]))
  }

  function abrirNuevo(equipoId = '') {
    setEquipoNuevoId(equipoId)
    setModal('nuevo')
  }

  const busquedaNormalizada = busqueda.trim().toLowerCase()
  const jugadoresBuscados = busquedaNormalizada
    ? jugadores.filter((j) => j.nombre?.toLowerCase().includes(busquedaNormalizada))
    : []

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
      <SelectorCategoria categorias={categoriasActivas} activa={categoria} onCambiar={setCategoria} />

      <div {...swipeCategoria}>
      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Inscripciones de delegados</p>
          <p className="text-xs text-ink-soft">
            {inscripcionesCerradas
              ? 'Cerradas: los delegados solo pueden ver su plantel, no inscribir ni editar.'
              : 'Abiertas: los delegados pueden inscribir jugadores de su equipo.'}
          </p>
        </div>
        <button
          onClick={toggleInscripciones}
          disabled={cambiandoInscripciones}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
            inscripcionesCerradas
              ? 'border-danger/30 bg-danger-soft text-danger'
              : 'border-success/30 bg-success-soft text-success'
          }`}
        >
          {cambiandoInscripciones ? '…' : inscripcionesCerradas ? '🔒 Cerradas' : '🔓 Abiertas'}
        </button>
      </div>

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => abrirNuevo()}
          disabled={equipos.length === 0}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          + Nuevo jugador
        </button>
      </div>

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar jugador por nombre…"
        className="mb-4 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 outline-none focus-visible:border-brand"
      />

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

      {!cargando && !error && equipos.length > 0 && busquedaNormalizada && (
        jugadoresBuscados.length === 0 ? (
          <p className="text-sm text-ink-soft">No hay ningún jugador que coincida con "{busqueda}".</p>
        ) : (
          <ul className="space-y-2">
            {jugadoresBuscados.map((j) => (
              <li key={j.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <FilaJugadorAdmin
                  jugador={j}
                  datosVisible={datosVisibles[j.id]}
                  onVerDatos={() => handleVerDatos(j.id)}
                  onEditar={() => setModal(j)}
                  onEliminar={() => handleEliminar(j)}
                  eliminando={eliminando === j.id}
                />
              </li>
            ))}
          </ul>
        )
      )}

      {!cargando && !error && equipos.length > 0 && !busquedaNormalizada && (
        <ul className="space-y-2">
          {equipos.map((eq) => {
            const jugadoresEquipo = jugadores.filter((j) => j.equipoId === eq.id)
            const abierto = expandidos.includes(eq.id)
            const color = colorEquipo(eq.nombre)
            return (
              <li key={eq.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className={`flex items-center justify-between gap-2 ${color.bg}`}>
                  <button
                    onClick={() => toggleExpandido(eq.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left"
                  >
                    <EscudoEquipo nombre={eq.nombre} />
                    <span className={`truncate font-bold ${color.text}`}>{eq.nombre}</span>
                  </button>
                  <span className="flex shrink-0 items-center gap-1 pr-2">
                    <button
                      onClick={() => abrirNuevo(eq.id)}
                      title={`Agregar jugador a ${eq.nombre}`}
                      className={`rounded-full px-2 py-1 text-sm font-bold ${color.text}`}
                    >
                      +
                    </button>
                    <button
                      onClick={() => toggleExpandido(eq.id)}
                      className="flex items-center gap-1 pr-2 text-xs font-medium text-ink-soft"
                    >
                      {jugadoresEquipo.length} jugador{jugadoresEquipo.length === 1 ? '' : 'es'}
                      <span className={`transition-transform ${abierto ? 'rotate-180' : ''}`}>⌄</span>
                    </button>
                  </span>
                </div>
                {abierto && (
                  <ul className="divide-y divide-line border-t border-line bg-paper">
                    {jugadoresEquipo.length === 0 ? (
                      <li className="px-4 py-3 text-center text-xs text-ink-soft">Sin jugadores todavía.</li>
                    ) : (
                      jugadoresEquipo.map((j) => (
                        <FilaJugadorAdmin
                          key={j.id}
                          jugador={j}
                          datosVisible={datosVisibles[j.id]}
                          onVerDatos={() => handleVerDatos(j.id)}
                          onEditar={() => setModal(j)}
                          onEliminar={() => handleEliminar(j)}
                          eliminando={eliminando === j.id}
                        />
                      ))
                    )}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
      </div>

      {modal && (
        <ModalRegistrarJugador
          torneoId={torneoId}
          categoria={categoria}
          equipos={equipos}
          jugadores={jugadores}
          maximoJugadoresInscritos={maximoJugadoresInscritos}
          equipoIdInicial={equipoNuevoId || undefined}
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
