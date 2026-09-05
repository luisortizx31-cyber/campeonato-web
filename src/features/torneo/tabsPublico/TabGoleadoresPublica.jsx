import { useRef, useState } from 'react'
import { BotonDescargarTabla } from '../../shared/BotonDescargarTabla'
import TablaGoleadoresCategoria from '../TablaGoleadoresCategoria'
import { SelectorCategoria } from '../../shared/SelectorCategoria'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'

// Solo lectura: ranking de goleadores por categoria, sin ningun
// control para cargar/editar - los goles se cargan desde el panel
// admin (TabGoleadores).
export default function TabGoleadoresPublica({ torneoId, categoriasActivas }) {
  const tablaRef = useRef(null)
  const [categoria, setCategoria] = useState(() => categoriasActivas[0])
  const swipeCategoria = useSwipeHorizontal(categoriasActivas, categoria, setCategoria)

  return (
    <div>
      <SelectorCategoria categorias={categoriasActivas} activa={categoria} onCambiar={setCategoria} />

      <div {...swipeCategoria}>
      <div className="mb-2 flex justify-end">
        <BotonDescargarTabla targetRef={tablaRef} nombreArchivo={`goleadores-${categoria}`} />
      </div>

      <TablaGoleadoresCategoria ref={tablaRef} torneoId={torneoId} categoria={categoria} />
      </div>
    </div>
  )
}
