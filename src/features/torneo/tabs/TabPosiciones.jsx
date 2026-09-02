import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarAjustesPorCategoria, eliminarAjustePuntos } from '../../../services/torneoAjustesService'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import { BotonExportarExcel } from '../../shared/BotonExportarExcel'
import TablaPosicionesCategoria from '../TablaPosicionesCategoria'
import ModalAjustarPuntos from '../ModalAjustarPuntos'

export default function TabPosiciones({ torneoId }) {
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const [equipos, setEquipos] = useState([])
  const [ajustes, setAjustes] = useState([])
  const [filasExport, setFilasExport] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [modal, setModal] = useState(false)
  const [eliminando, setEliminando] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)

  async function cargarAuxiliares() {
    const [eq, aj] = await Promise.all([
      listarEquiposPorCategoria(torneoId, categoria),
      // Coleccion nueva - si su regla de Firestore todavia no esta
      // desplegada, que el resto de la pestaña siga andando igual.
      listarAjustesPorCategoria(torneoId, categoria).catch((err) => {
        console.error('[TabPosiciones] listarAjustesPorCategoria', err)
        return []
      }),
    ])
    setEquipos(eq)
    setAjustes(aj)
  }

  useEffect(() => {
    cargarAuxiliares()
  }, [torneoId, categoria, refreshKey])

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
        <button
          onClick={() => setModal(true)}
          disabled={equipos.length === 0}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          + Ajustar puntos
        </button>
      </div>

      <TablaPosicionesCategoria torneoId={torneoId} categoria={categoria} refreshKey={refreshKey} onFilas={setFilasExport} />

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
