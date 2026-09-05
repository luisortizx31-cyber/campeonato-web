import { useEffect } from 'react'
import { CATEGORIA_TORNEO_LABELS } from '../../models/torneo'

// Selector de categoria reutilizado en las pantallas (admin y
// publica) que muestran datos por categoria. `categorias` ya viene
// filtrada a las activas del torneo (ver PanelTorneo/PaginaPublicaTorneo,
// que las cargan una sola vez desde torneoConfigService).
//
// Se autocorrige solo si `activa` deja de estar en `categorias` (por
// ejemplo, el Maestro la desactivo en Configuracion mientras un tab
// seguia apuntando a ella - ver TabFechas, que ademas persiste la
// categoria en sessionStorage) en vez de quedar en un estado invalido.
//
// Con 1 sola categoria activa no hay nada entre que elegir, asi que no
// se renderiza nada.
export function SelectorCategoria({ categorias, activa, onCambiar }) {
  useEffect(() => {
    if (categorias.length > 0 && !categorias.includes(activa)) {
      onCambiar(categorias[0])
    }
  }, [categorias, activa, onCambiar])

  if (categorias.length <= 1) return null

  return (
    <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
      {categorias.map((c) => (
        <button
          key={c}
          onClick={() => onCambiar(c)}
          className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            activa === c ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-soft'
          }`}
        >
          {CATEGORIA_TORNEO_LABELS[c]}
        </button>
      ))}
    </div>
  )
}
