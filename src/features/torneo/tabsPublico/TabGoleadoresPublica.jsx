import { useRef, useState } from 'react'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import { BotonDescargarTabla } from '../../shared/BotonDescargarTabla'
import TablaGoleadoresCategoria from '../TablaGoleadoresCategoria'

// Solo lectura: ranking de goleadores por categoria, sin ningun
// control para cargar/editar - los goles se cargan desde el panel
// admin (TabGoleadores).
export default function TabGoleadoresPublica({ torneoId }) {
  const tablaRef = useRef(null)
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)

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
        <BotonDescargarTabla targetRef={tablaRef} nombreArchivo={`goleadores-${categoria}`} />
      </div>

      <TablaGoleadoresCategoria ref={tablaRef} torneoId={torneoId} categoria={categoria} />
    </div>
  )
}
