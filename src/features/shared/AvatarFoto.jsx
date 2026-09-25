import { useRef, useState } from 'react'
import { VisorFoto } from './VisorFoto'
import { RecortadorFoto } from './RecortadorFoto'

// Avatar circular con foto (si ya se subio una) o un texto de respaldo
// (inicial de nombre, etc) mientras tanto - usado para la foto de un
// jugador (ver FilaJugadorAdmin) y la foto de portada de un equipo/
// promocion (ver TabEquipos).
//
// Si ya hay foto, tocar el circulo la abre en grande (VisorFoto) en vez
// de subir una nueva - para cambiarla o quitarla estan los links de
// texto de abajo, que solo aparecen si se paso onCambiarFoto (modo
// admin). Sin foto y en modo admin, tocar el circulo abre el selector
// de archivo directo (no hay nada que agrandar todavia).
//
// Al elegir un archivo NO se sube directo: primero se abre el recortador
// (RecortadorFoto) para mover/acercar/girar la foto, y recien al
// confirmar se llama a onCambiarFoto con la foto ya recortada.
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
  const [verGrande, setVerGrande] = useState(false)
  const [porRecortar, setPorRecortar] = useState(null) // File elegido, esperando recorte

  const contenido = subiendoFoto ? (
    <span className="text-[9px] text-ink-soft">…</span>
  ) : fotoUrl ? (
    <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    <span className={`text-xs font-bold ${colorText}`}>{texto}</span>
  )

  function handleClickAvatar() {
    if (subiendoFoto) return
    if (fotoUrl) {
      setVerGrande(true)
    } else if (onCambiarFoto) {
      inputRef.current?.click()
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      {onCambiarFoto && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) setPorRecortar(file)
            e.target.value = ''
          }}
        />
      )}
      <button
        type="button"
        onClick={handleClickAvatar}
        disabled={subiendoFoto || (!fotoUrl && !onCambiarFoto)}
        title={fotoUrl ? 'Ver foto' : onCambiarFoto ? 'Subir foto' : undefined}
        className={`flex ${tamanoClase} items-center justify-center overflow-hidden rounded-full ${colorBg} ${
          onCambiarFoto ? 'border border-dashed border-line' : ''
        } disabled:opacity-60`}
      >
        {contenido}
      </button>
      {onCambiarFoto && (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-[10px] text-ink-soft underline decoration-dotted"
          >
            {fotoUrl ? 'Cambiar' : 'Subir'}
          </button>
          {onQuitarFoto && fotoUrl && !subiendoFoto && (
            <button type="button" onClick={onQuitarFoto} className="text-[10px] text-ink-soft underline decoration-dotted">
              Quitar
            </button>
          )}
        </div>
      )}
      {verGrande && fotoUrl && <VisorFoto url={fotoUrl} onCerrar={() => setVerGrande(false)} />}
      {porRecortar && (
        <RecortadorFoto
          archivo={porRecortar}
          onCancelar={() => setPorRecortar(null)}
          onConfirmar={(recortada) => {
            setPorRecortar(null)
            onCambiarFoto(recortada)
          }}
        />
      )}
    </div>
  )
}
