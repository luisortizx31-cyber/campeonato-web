import { useEffect, useRef, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import { BotonDescargarTabla } from '../../shared/BotonDescargarTabla'
import TablaPosicionesCategoria from '../TablaPosicionesCategoria'

export default function TabPosicionesPublica({ torneoId }) {
  const tablaRef = useRef(null)
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const [equipos, setEquipos] = useState([])
  const [mostrarDelegados, setMostrarDelegados] = useState(false)

  useEffect(() => {
    listarEquiposPorCategoria(torneoId, categoria)
      .then(setEquipos)
      .catch((err) => console.error('[TabPosicionesPublica]', err))
  }, [torneoId, categoria])

  const equiposConDelegado = equipos.filter((e) => e.delegadoNombre || e.subdelegadoNombre)

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

      <div className="mb-2 flex justify-end">
        <BotonDescargarTabla targetRef={tablaRef} nombreArchivo={`posiciones-${categoria}`} />
      </div>

      <TablaPosicionesCategoria ref={tablaRef} torneoId={torneoId} categoria={categoria} />

      {equiposConDelegado.length > 0 && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <button
            onClick={() => setMostrarDelegados((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-semibold text-ink"
          >
            Delegados de equipo
            <span className={`text-ink-soft transition-transform ${mostrarDelegados ? 'rotate-180' : ''}`}>⌄</span>
          </button>
          {mostrarDelegados && (
            <ul className="mt-3 space-y-3">
              {equiposConDelegado.map((eq) => (
                <li key={eq.id} className="text-sm">
                  <p className="mb-1 font-medium text-ink">{eq.nombre}</p>
                  {eq.delegadoNombre && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-ink-soft">Delegado: {eq.delegadoNombre}</span>
                      {eq.delegadoTelefono && (
                        <a href={`tel:${eq.delegadoTelefono}`} className="shrink-0 text-brand">
                          {eq.delegadoTelefono}
                        </a>
                      )}
                    </div>
                  )}
                  {eq.subdelegadoNombre && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-ink-soft">Subdelegado: {eq.subdelegadoNombre}</span>
                      {eq.subdelegadoTelefono && (
                        <a href={`tel:${eq.subdelegadoTelefono}`} className="shrink-0 text-brand">
                          {eq.subdelegadoTelefono}
                        </a>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
