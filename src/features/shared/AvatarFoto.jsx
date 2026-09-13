import { useRef } from 'react'

// Avatar circular con foto (si ya se subio una) o un texto de respaldo
// (inicial de nombre, etc) mientras tanto - usado para la foto de un
// jugador (ver FilaJugadorAdmin) y la foto de portada de un equipo/
// promocion (ver TabEquipos). onCambiarFoto es opcional: sin el (ej.
// listas de solo lectura del lado publico) el avatar no es clickeable
// y no aparece el boton de "Quitar".
export function AvatarFoto({
  fotoUrl,
  texto,
  tamanoClase = 'h-9 w-9',
  colorBg = 'bg-paper',
  colorText = 'text-ink-soft',
  onCambiarFoto,
  subiendoFoto,
  onQuitarFoto,
}) {
  const inputRef = useRef(null)

  const contenido = subiendoFoto ? (
    <span className="text-[9px] text-ink-soft">…</span>
  ) : fotoUrl ? (
    <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    <span className={`text-xs font-bold ${colorText}`}>{texto}</span>
  )

  if (!onCambiarFoto) {
    return (
      <span className={`flex ${tamanoClase} shrink-0 items-center justify-center overflow-hidden rounded-full ${colorBg}`}>
        {contenido}
      </span>
    )
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onCambiarFoto(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={subiendoFoto}
        title="Cambiar foto"
        className={`flex ${tamanoClase} items-center justify-center overflow-hidden rounded-full border border-dashed border-line ${colorBg} disabled:opacity-60`}
      >
        {contenido}
      </button>
      {onQuitarFoto && fotoUrl && !subiendoFoto && (
        <button onClick={onQuitarFoto} className="text-[10px] text-ink-soft underline decoration-dotted">
          Quitar
        </button>
      )}
    </div>
  )
}
