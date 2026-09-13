import { useEffect, useRef, useState } from 'react'
import {
  listarJugadoresPorEquipo,
  eliminarJugador,
  obtenerDatosPrivadosJugador,
  actualizarFotoJugador,
  eliminarFotoJugador,
} from '../../services/torneoJugadoresService'
import {
  listarFotosEquipo,
  agregarFotoEquipo,
  actualizarDescripcionFotoEquipo,
  eliminarFotoEquipo,
  MAXIMO_FOTOS_GALERIA,
} from '../../services/torneoGaleriaEquipoService'
import { actualizarHistoriaEquipo } from '../../services/torneoEquiposService'
import { colorEquipo } from '../../utils/colorEquipo'
import { EscudoEquipo } from '../shared/EscudoEquipo'
import { FilaJugadorAdmin } from './FilaJugadorAdmin'
import ModalRegistrarJugador from './ModalRegistrarJugador'

const TABS = [
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'galeria', label: 'Galería de fotos' },
  { id: 'historia', label: 'Historia' },
]

/**
 * Ficha de una promocion/equipo (ver TabJugadores, al tocar una fila) -
 * el Maestro entra aca para ver y administrar sus jugadores (con foto de
 * cada uno), la galeria de fotos de recuerdo (maximo
 * MAXIMO_FOTOS_GALERIA) y la historia de la promocion. Contraparte de
 * solo lectura: DetalleEquipoPublica.
 */
export default function DetalleEquipo({ torneoId, equipo, categoria, maximoJugadoresInscritos, onCerrar }) {
  const [tab, setTab] = useState('jugadores')
  const color = colorEquipo(equipo.nombre)

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onCerrar}
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft"
        >
          ← Volver
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <EscudoEquipo nombre={equipo.nombre} fotoUrl={equipo.fotoPortadaUrl} />
          <span className={`truncate text-base font-bold ${color.text}`}>{equipo.nombre}</span>
        </div>
      </div>

      <nav className="mb-4 flex gap-1 rounded-xl border border-line bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium sm:text-sm ${
              tab === t.id ? 'bg-brand text-white' : 'text-ink-soft'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'jugadores' && (
        <PestanaJugadores
          torneoId={torneoId}
          categoria={categoria}
          equipo={equipo}
          maximoJugadoresInscritos={maximoJugadoresInscritos}
        />
      )}
      {tab === 'galeria' && <PestanaGaleria torneoId={torneoId} equipo={equipo} />}
      {tab === 'historia' && <PestanaHistoria equipo={equipo} />}
    </div>
  )
}

function PestanaJugadores({ torneoId, categoria, equipo, maximoJugadoresInscritos }) {
  const [jugadores, setJugadores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | 'nuevo' | jugador a editar
  const [eliminando, setEliminando] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)
  const [datosVisibles, setDatosVisibles] = useState({})
  const [subiendoFotoId, setSubiendoFotoId] = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setJugadores(await listarJugadoresPorEquipo(equipo.id))
    } catch (err) {
      console.error('[DetalleEquipo] PestanaJugadores', err)
      setError('No se pudieron cargar los jugadores.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipo.id])

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
      console.error('[DetalleEquipo] handleVerDatos', err)
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
      console.error('[DetalleEquipo] handleEliminar', err)
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
      console.error('[DetalleEquipo] handleCambiarFoto', err)
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
      console.error('[DetalleEquipo] handleQuitarFoto', err)
      setErrorAccion('No se pudo quitar la foto.')
    } finally {
      setSubiendoFotoId(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setModal('nuevo')}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          + Nuevo jugador
        </button>
      </div>

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {errorAccion && (
        <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorAccion}</p>
      )}

      {!cargando && !error && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {jugadores.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-soft">Sin jugadores todavía.</li>
          ) : (
            jugadores.map((j) => (
              <FilaJugadorAdmin
                key={j.id}
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
            ))
          )}
        </ul>
      )}

      {modal && (
        <ModalRegistrarJugador
          torneoId={torneoId}
          categoria={categoria}
          equipos={[equipo]}
          jugadores={jugadores}
          maximoJugadoresInscritos={maximoJugadoresInscritos}
          equipoIdInicial={equipo.id}
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

function PestanaGaleria({ torneoId, equipo }) {
  const [fotos, setFotos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const inputNuevaRef = useRef(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setFotos(await listarFotosEquipo(equipo.id))
    } catch (err) {
      console.error('[DetalleEquipo] PestanaGaleria', err)
      setError('No se pudieron cargar las fotos.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipo.id])

  async function handleAgregar(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setError(null)
    setSubiendo(true)
    try {
      await agregarFotoEquipo({ torneoId, equipoId: equipo.id, archivo, descripcion: '' })
      await cargar()
    } catch (err) {
      console.error('[DetalleEquipo] handleAgregar', err)
      setError(err.message || 'No se pudo agregar la foto.')
    } finally {
      setSubiendo(false)
      if (inputNuevaRef.current) inputNuevaRef.current.value = ''
    }
  }

  async function handleGuardarDescripcion(foto, descripcion) {
    setError(null)
    try {
      await actualizarDescripcionFotoEquipo(foto.id, descripcion)
      await cargar()
    } catch (err) {
      console.error('[DetalleEquipo] handleGuardarDescripcion', err)
      setError('No se pudo guardar la descripción.')
    }
  }

  async function handleEliminar(foto) {
    if (!confirm('¿Eliminar esta foto? No se puede deshacer.')) return
    setError(null)
    try {
      await eliminarFotoEquipo(torneoId, equipo.id, foto.id)
      await cargar()
    } catch (err) {
      console.error('[DetalleEquipo] handleEliminar foto', err)
      setError('No se pudo eliminar la foto.')
    }
  }

  return (
    <div>
      {cargando ? (
        <p className="text-sm text-ink-soft">Cargando…</p>
      ) : (
        <div className="space-y-3">
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

          {fotos.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
              Todavía no hay fotos en la galería de esta promoción.
            </div>
          )}

          {fotos.map((foto) => (
            <TarjetaFoto
              key={foto.id}
              foto={foto}
              onGuardarDescripcion={(desc) => handleGuardarDescripcion(foto, desc)}
              onEliminar={() => handleEliminar(foto)}
            />
          ))}

          <div className="rounded-2xl border border-dashed border-line bg-surface p-5 text-center">
            <p className="mb-3 text-sm font-medium text-ink">
              {fotos.length}/{MAXIMO_FOTOS_GALERIA} fotos
            </p>
            <input
              ref={inputNuevaRef}
              type="file"
              accept="image/*"
              onChange={handleAgregar}
              disabled={subiendo || fotos.length >= MAXIMO_FOTOS_GALERIA}
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
            />
            {subiendo && <p className="mt-2 text-xs text-ink-soft">Subiendo…</p>}
            {fotos.length >= MAXIMO_FOTOS_GALERIA && (
              <p className="mt-2 text-xs text-ink-soft">Ya llegaste al máximo de fotos por promoción.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TarjetaFoto({ foto, onGuardarDescripcion, onEliminar }) {
  const [descripcion, setDescripcion] = useState(foto.descripcion || '')

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex gap-3">
        <div className="h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-paper">
          {foto.url ? (
            <img src={foto.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-ink-soft">Subiendo…</div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-soft">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej. Final del torneo 2019"
            rows={2}
            className="w-full flex-1 rounded-lg border border-line bg-paper px-2 py-1.5 text-xs text-ink outline-none focus-visible:border-brand"
          />
          <div className="flex items-center gap-2">
            {descripcion !== (foto.descripcion || '') && (
              <button
                onClick={() => onGuardarDescripcion(descripcion)}
                className="rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-white"
              >
                Guardar
              </button>
            )}
            <button
              onClick={onEliminar}
              className="ml-auto rounded-lg border border-danger/30 px-2.5 py-1 text-xs font-medium text-danger"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PestanaHistoria({ equipo }) {
  const [historia, setHistoria] = useState(equipo.historia || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [guardado, setGuardado] = useState(false)

  async function handleGuardar() {
    setGuardando(true)
    setError(null)
    setGuardado(false)
    try {
      await actualizarHistoriaEquipo(equipo.id, historia)
      setGuardado(true)
    } catch (err) {
      console.error('[DetalleEquipo] PestanaHistoria', err)
      setError('No se pudo guardar la historia.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <textarea
        value={historia}
        onChange={(e) => {
          setHistoria(e.target.value)
          setGuardado(false)
        }}
        placeholder="Contá la historia de esta promoción: cómo se formó el equipo, anécdotas, logros…"
        rows={10}
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none focus-visible:border-brand"
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {guardado && <p className="mt-2 text-sm text-success">✓ Guardado</p>}
      <button
        onClick={handleGuardar}
        disabled={guardando || historia === (equipo.historia || '')}
        className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  )
}
