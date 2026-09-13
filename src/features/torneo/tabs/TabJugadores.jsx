import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import {
  listarJugadoresPorCategoria,
  eliminarJugador,
  obtenerDatosPrivadosJugador,
  actualizarFotoJugador,
  eliminarFotoJugador,
} from '../../../services/torneoJugadoresService'
import { obtenerConfigCategoria, actualizarInscripcionesCerradas } from '../../../services/torneoConfigService'
import { colorEquipo } from '../../../utils/colorEquipo'
import { EscudoEquipo } from '../../shared/EscudoEquipo'
import { SelectorCategoria } from '../../shared/SelectorCategoria'
import ModalRegistrarJugador from '../ModalRegistrarJugador'
import { FilaJugadorAdmin } from '../FilaJugadorAdmin'
import DetalleEquipo from '../DetalleEquipo'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'

export default function TabJugadores({ torneoId, categoriasActivas }) {
  const [categoria, setCategoria] = useState(() => categoriasActivas[0])
  const swipeCategoria = useSwipeHorizontal(categoriasActivas, categoria, setCategoria)
  const [equipos, setEquipos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [equipoDetalle, setEquipoDetalle] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | 'nuevo' | jugador a editar
  const [equipoNuevoId, setEquipoNuevoId] = useState('')
  const [eliminando, setEliminando] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)
  const [datosVisibles, setDatosVisibles] = useState({}) // { [jugadorId]: 'cargando' | { dni, telefono } | 'error' }
  const [subiendoFotoId, setSubiendoFotoId] = useState(null)
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
    setEquipoDetalle(null)
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneoId, categoria])

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
      await eliminarJugador(jugador.id, jugador.torneoId)
      cargar()
    } catch (err) {
      console.error('[TabJugadores]', err)
      setErrorAccion(err.message || 'No se pudo eliminar el jugador.')
    } finally {
      setEliminando(null)
    }
  }

  async function handleCambiarFoto(jugador, archivo) {
    setSubiendoFotoId(jugador.id)
    setErrorAccion(null)
    try {
      await actualizarFotoJugador(torneoId, jugador.id, archivo)
      await cargar()
    } catch (err) {
      console.error('[TabJugadores] handleCambiarFoto', err)
      setErrorAccion(err.message || 'No se pudo subir la foto.')
    } finally {
      setSubiendoFotoId(null)
    }
  }

  async function handleQuitarFoto(jugador) {
    setSubiendoFotoId(jugador.id)
    setErrorAccion(null)
    try {
      await eliminarFotoJugador(torneoId, jugador.id)
      await cargar()
    } catch (err) {
      console.error('[TabJugadores] handleQuitarFoto', err)
      setErrorAccion('No se pudo quitar la foto.')
    } finally {
      setSubiendoFotoId(null)
    }
  }

  if (equipoDetalle) {
    return (
      <DetalleEquipo
        torneoId={torneoId}
        equipo={equipoDetalle}
        categoria={categoria}
        maximoJugadoresInscritos={maximoJugadoresInscritos}
        onCerrar={() => {
          setEquipoDetalle(null)
          cargar()
        }}
      />
    )
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
                  onCambiarFoto={(file) => handleCambiarFoto(j, file)}
                  subiendoFoto={subiendoFotoId === j.id}
                  onQuitarFoto={() => handleQuitarFoto(j)}
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
            const color = colorEquipo(eq.nombre)
            return (
              <li key={eq.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className={`flex items-center justify-between gap-2 ${color.bg}`}>
                  <button
                    onClick={() => setEquipoDetalle(eq)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left"
                  >
                    <EscudoEquipo nombre={eq.nombre} fotoUrl={eq.fotoPortadaUrl} />
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
                      onClick={() => setEquipoDetalle(eq)}
                      className="flex items-center gap-1 pr-2 text-xs font-medium text-ink-soft"
                    >
                      {jugadoresEquipo.length} jugador{jugadoresEquipo.length === 1 ? '' : 'es'}
                      <span>›</span>
                    </button>
                  </span>
                </div>
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
