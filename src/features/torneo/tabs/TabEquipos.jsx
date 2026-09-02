import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria, eliminarEquipo } from '../../../services/torneoEquiposService'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import ModalCrearEquipo from '../ModalCrearEquipo'
import { migrarDesdeProyectoViejo } from '../../../dev/migrarDesdeProyectoViejo'

export default function TabEquipos({ torneoId }) {
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const [equipos, setEquipos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | 'nuevo' | equipo a editar
  const [eliminando, setEliminando] = useState(null)
  const [errorEliminar, setErrorEliminar] = useState(null)

  // BOTON TEMPORAL DE UN SOLO USO - borrar junto con
  // src/dev/migrarDesdeProyectoViejo.js despues de usarlo.
  const [migrando, setMigrando] = useState(false)
  const [progresoMigracion, setProgresoMigracion] = useState('')
  const [resultadoMigracion, setResultadoMigracion] = useState(null)
  const [errorMigracion, setErrorMigracion] = useState(null)

  async function handleMigrar() {
    if (!confirm(
      'Esto copia los equipos, jugadores, fechas, tarjetas, config y ajustes que ya existen en el ' +
      'proyecto de Firebase de prestamos-web hacia ESTE proyecto (sobreescribe si ya hay datos con ' +
      'el mismo id aca). No borra nada del proyecto viejo. ¿Continuar?'
    )) return
    setMigrando(true)
    setResultadoMigracion(null)
    setErrorMigracion(null)
    try {
      const resultado = await migrarDesdeProyectoViejo(torneoId, setProgresoMigracion)
      setResultadoMigracion(resultado)
      cargar()
    } catch (err) {
      console.error('[TabEquipos] migrarDesdeProyectoViejo', err)
      setErrorMigracion(err.message || 'No se pudo migrar los datos.')
    } finally {
      setMigrando(false)
    }
  }

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setEquipos(await listarEquiposPorCategoria(torneoId, categoria))
    } catch (err) {
      console.error('[TabEquipos]', err)
      setError('No se pudieron cargar los equipos.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [torneoId, categoria])

  async function handleEliminar(equipo) {
    if (!confirm(`¿Eliminar el equipo "${equipo.nombre}"?`)) return
    setEliminando(equipo.id)
    setErrorEliminar(null)
    try {
      await eliminarEquipo(equipo.id)
      cargar()
    } catch (err) {
      console.error('[TabEquipos]', err)
      setErrorEliminar(err.message || 'No se pudo eliminar el equipo.')
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

      <div className="mb-4 rounded-xl border border-warning/30 bg-warning-soft p-3">
        <p className="mb-2 text-xs text-warning">
          ⚠ Botón temporal de un solo uso: copia los datos del torneo que ya existían en el proyecto
          de préstamos hacia este proyecto nuevo.
        </p>
        <button
          onClick={handleMigrar}
          disabled={migrando}
          className="rounded-lg border border-warning/40 bg-surface px-3 py-1.5 text-xs font-medium text-warning disabled:opacity-50"
        >
          {migrando ? progresoMigracion || 'Migrando…' : 'Migrar datos del proyecto viejo'}
        </button>
        {errorMigracion && (
          <p className="mt-2 text-xs text-danger">{errorMigracion}</p>
        )}
        {resultadoMigracion && (
          <ul className="mt-2 space-y-0.5 text-xs text-success">
            {Object.entries(resultadoMigracion).map(([coleccion, cantidad]) => (
              <li key={coleccion}>✓ {coleccion}: {cantidad}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setModal('nuevo')}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          + Nuevo equipo
        </button>
      </div>

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {errorEliminar && (
        <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorEliminar}</p>
      )}

      {!cargando && !error && equipos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
          Todavia no hay equipos en {CATEGORIA_TORNEO_LABELS[categoria]}.
        </div>
      )}

      <ul className="space-y-2.5">
        {equipos.map((eq) => (
          <li key={eq.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{eq.nombre}</p>
                {eq.delegadoNombre && (
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Delegado: {eq.delegadoNombre}
                    {eq.delegadoTelefono && ` · ${eq.delegadoTelefono}`}
                  </p>
                )}
                {eq.subdelegadoNombre && (
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Subdelegado: {eq.subdelegadoNombre}
                    {eq.subdelegadoTelefono && ` · ${eq.subdelegadoTelefono}`}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setModal(eq)}
                  className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleEliminar(eq)}
                  disabled={eliminando === eq.id}
                  className="rounded-lg border border-danger/30 px-2.5 py-1 text-xs text-danger disabled:opacity-50"
                >
                  {eliminando === eq.id ? '…' : 'Eliminar'}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {modal && (
        <ModalCrearEquipo
          torneoId={torneoId}
          categoria={categoria}
          equipo={modal === 'nuevo' ? null : modal}
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
