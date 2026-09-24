// Visor a pantalla completa para ver una foto en grande (foto de
// portada de equipo, foto de jugador) - se cierra tocando el fondo, la
// X, o Escape. Se usa desde AvatarFoto y EscudoEquipo.
import { useEffect } from 'react'

export function VisorFoto({ url, onCerrar }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCerrar])

  // El visor se renderiza dentro del elemento que contiene el escudo/
  // avatar (una fila clickeable en Jugadores o Partidos), y un click
  // React burbujea por el arbol de componentes aunque el visor sea
  // position:fixed - sin esto, cerrar la foto tambien disparaba el click
  // de esa fila (abrir la promocion / el partido).
  function cerrar(e) {
    e.stopPropagation()
    onCerrar()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-6"
      onClick={cerrar}
    >
      <button
        onClick={cerrar}
        aria-label="Cerrar"
        className="absolute right-4 top-4 text-3xl leading-none text-white"
      >
        ×
      </button>
      <img
        src={url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain"
      />
    </div>
  )
}
