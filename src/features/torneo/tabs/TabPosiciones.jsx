import { useEffect, useRef, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarAjustesPorCategoria, eliminarAjustePuntos } from '../../../services/torneoAjustesService'
import { obtenerConfigCategoria, actualizarEquiposEliminados } from '../../../services/torneoConfigService'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import { BotonExportarExcel } from '../../shared/BotonExportarExcel'
import { BotonDescargarTabla } from '../../shared/BotonDescargarTabla'
import TablaPosicionesCategoria from '../TablaPosicionesCategoria'
import ModalAjustarPuntos from '../ModalAjustarPuntos'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'

export default function TabPosiciones({ torneoId }) {
  const tablaRef = useRef(null)
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const swipeCategoria = useSwipeHorizontal(Object.values(CATEGORIA_TORNEO), categoria, setCategoria)
  const [equipos, setEquipos] = useState([])
  const [ajustes, setAjustes] = useState([])
  const [config, setConfig] = useState(null) // { equiposEliminados }
  // Valor del input de "equipos eliminados" mientras se edita - separado
  // de `config` para que borrar/escribir no guarde en Firestore ni
  // refresque la tabla en cada tecla, solo al confirmar (blur/Enter).
  const [inputEquiposEliminados, setInputEquiposEliminados] = useState('0')
  const [guardandoConfig, setGuardandoConfig] = useState(false)
  const [filasExport, setFilasExport] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [modal, setModal] = useState(false)
  const [eliminando, setEliminando] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)

  async function cargarAuxiliares() {
    const [eq, aj, cfg] = await Promise.all([
      listarEquiposPorCategoria(torneoId, categoria),
      // Coleccion nueva - si su regla de Firestore todavia no esta
      // desplegada, que el resto de la pestaña siga andando igual.
      listarAjustesPorCategoria(torneoId, categoria).catch((err) => {
        console.error('[TabPosiciones] listarAjustesPorCategoria', err)
        return []
      }),
      obtenerConfigCategoria(torneoId, categoria),
    ])
    setEquipos(eq)
    setAjustes(aj)
    setConfig(cfg)
  }

  useEffect(() => {
    cargarAuxiliares()
  }, [torneoId, categoria, refreshKey])

  // Sincroniza el input con lo que hay guardado cada vez que se trae
  // la config de nuevo (cambio de categoria, o despues de guardar) -
  // nunca mientras el usuario esta escribiendo, porque eso no dispara
  // un refetch (ver handleGuardarEquiposEliminados).
  useEffect(() => {
    setInputEquiposEliminados(String(config?.equiposEliminados ?? 0))
  }, [config])

  function handleCambiarEquiposEliminados(valor) {
    if (valor === '' || /^\d+$/.test(valor)) {
      setInputEquiposEliminados(valor)
    }
  }

  async function handleGuardarEquiposEliminados() {
    const cantidad = Math.max(0, Math.min(Number(inputEquiposEliminados) || 0, equipos.length))
    setInputEquiposEliminados(String(cantidad))
    if (cantidad === (config?.equiposEliminados ?? 0)) return
    setGuardandoConfig(true)
    setErrorAccion(null)
    try {
      await actualizarEquiposEliminados(torneoId, categoria, cantidad)
      setConfig((c) => ({ ...c, equiposEliminados: cantidad }))
      // TablaPosicionesCategoria trae su propia copia de la config (la
      // comparte con la pagina publica) - sin esto, la zona de
      // eliminacion que se ve en la tabla de abajo quedaba desactualizada
      // hasta recargar la pagina.
      setRefreshKey((k) => k + 1)
    } catch (err) {
      console.error('[TabPosiciones]', err)
      setErrorAccion('No se pudo guardar la cantidad de equipos eliminados.')
    } finally {
      setGuardandoConfig(false)
    }
  }

  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  async function handleEliminarAjuste(ajuste) {
    if (!confirm('¿Deshacer este ajuste de puntos?')) return
    setEliminando(ajuste.id)
    setErrorAccion(null)
    try {
      await eliminarAjustePuntos(ajuste.id)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      console.error('[TabPosiciones]', err)
      setErrorAccion(err.message || 'No se pudo deshacer el ajuste.')
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
      {equipos.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
          <label htmlFor="equipos-eliminados" className="text-sm text-ink-soft">
            Equipos eliminados (últimos de la tabla)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="equipos-eliminados"
              type="number"
              min="0"
              max={equipos.length}
              value={inputEquiposEliminados}
              disabled={!config || guardandoConfig}
              onChange={(e) => handleCambiarEquiposEliminados(e.target.value)}
              onBlur={handleGuardarEquiposEliminados}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur()
              }}
              className="no-spinner w-16 rounded-lg border border-line bg-paper px-2 py-1.5 text-center text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
            />
            <span className="text-sm text-ink-soft">de {equipos.length}</span>
          </div>
        </div>
      )}

      <div className="mb-4 flex justify-end gap-2">
        <BotonExportarExcel
          nombreArchivo={`posiciones-${categoria}`}
          nombreHoja="Posiciones"
          label="Excel"
          columnas={[
            { header: 'Equipo', key: 'nombre', width: 25 },
            { header: 'PJ', key: 'pj', width: 6 },
            { header: 'PG', key: 'pg', width: 6 },
            { header: 'PE', key: 'pe', width: 6 },
            { header: 'PP', key: 'pp', width: 6 },
            { header: 'GF', key: 'gf', width: 6 },
            { header: 'GC', key: 'gc', width: 6 },
            { header: 'DG', key: 'dg', width: 6 },
            { header: 'Pts', key: 'pts', width: 6 },
          ]}
          filas={filasExport}
        />
        <BotonDescargarTabla targetRef={tablaRef} nombreArchivo={`posiciones-${categoria}`} />
        <button
          onClick={() => setModal(true)}
          disabled={equipos.length === 0}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          + Ajustar puntos
        </button>
      </div>

      <TablaPosicionesCategoria
        ref={tablaRef}
        torneoId={torneoId}
        categoria={categoria}
        refreshKey={refreshKey}
        onFilas={setFilasExport}
      />

      {errorAccion && (
        <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorAccion}</p>
      )}

      {ajustes.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-sm font-semibold text-ink">Ajustes aplicados</h2>
          <ul className="space-y-2">
            {ajustes.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-ink">
                    {nombreEquipo(a.equipoId)}{' '}
                    <span className={`money font-semibold ${a.puntos > 0 ? 'text-success' : 'text-danger'}`}>
                      {a.puntos > 0 ? '+' : ''}{a.puntos} pts
                    </span>
                  </p>
                  <p className="text-xs text-ink-soft">
                    {a.creadoEn?.toDate?.().toLocaleDateString('es-PE') || ''}
                    {a.motivo && ` · ${a.motivo}`}
                  </p>
                </div>
                <button
                  onClick={() => handleEliminarAjuste(a)}
                  disabled={eliminando === a.id}
                  className="shrink-0 rounded-lg border border-danger/30 px-2.5 py-1 text-xs text-danger disabled:opacity-50"
                >
                  {eliminando === a.id ? '…' : 'Deshacer'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      </div>

      {modal && (
        <ModalAjustarPuntos
          torneoId={torneoId}
          categoria={categoria}
          equipos={equipos}
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
