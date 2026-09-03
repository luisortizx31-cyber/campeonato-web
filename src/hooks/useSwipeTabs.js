import { useRef } from 'react'

const UMBRAL_PX = 50

/**
 * Detecta un swipe horizontal (deslizar el dedo a la izquierda o a la
 * derecha) sobre el elemento donde se enganchen los handlers que
 * devuelve, y cambia de pestaña activa en consecuencia - asi no hace
 * falta tocar cada pestaña con el dedo para cambiarla. No interfiere
 * con el scroll vertical normal (un swipe mas vertical que horizontal
 * se ignora).
 *
 * `tabs` es el array de pestañas (con `id`), en el mismo orden en que
 * se muestran - el swipe se mueve una posición hacia adelante/atrás en
 * ese orden, sin dar la vuelta en los extremos.
 */
export function useSwipeTabs(tabs, tabActiva, setTabActiva) {
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

    const indiceActual = tabs.findIndex((tab) => tab.id === tabActiva)
    if (indiceActual === -1) return
    const siguiente = deltaX < 0 ? indiceActual + 1 : indiceActual - 1
    if (siguiente < 0 || siguiente >= tabs.length) return
    setTabActiva(tabs[siguiente].id)
  }

  return { onTouchStart, onTouchEnd }
}
