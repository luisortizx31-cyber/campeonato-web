import { useRef } from 'react'

const UMBRAL_PX = 50

/**
 * Detecta un swipe horizontal (deslizar el dedo a la izquierda o a la
 * derecha) sobre el elemento donde se enganchen los handlers que
 * devuelve, y mueve `activo` una posición hacia adelante/atrás dentro
 * de `items` (sin dar la vuelta en los extremos). No interfiere con
 * el scroll vertical normal (un swipe más vertical que horizontal se
 * ignora).
 *
 * `items` es un array plano de valores (ids, números de fecha, etc.)
 * en el mismo orden en que se muestran.
 */
export function useSwipeHorizontal(items, activo, setActivo) {
  const inicio = useRef(null)

  function onTouchStart(e) {
    const t = e.touches[0]
    inicio.current = { x: t.clientX, y: t.clientY }
  }

  function onTouchEnd(e) {
    if (!inicio.current) return
    const t = e.changedTouches[0]
    const deltaX = t.clientX - inicio.current.x
    const deltaY = t.clientY - inicio.current.y
    inicio.current = null

    if (Math.abs(deltaX) < UMBRAL_PX || Math.abs(deltaX) < Math.abs(deltaY)) return

    const indiceActual = items.indexOf(activo)
    if (indiceActual === -1) return
    const siguiente = deltaX < 0 ? indiceActual + 1 : indiceActual - 1
    if (siguiente < 0 || siguiente >= items.length) return
    setActivo(items[siguiente])
  }

  return { onTouchStart, onTouchEnd }
}
