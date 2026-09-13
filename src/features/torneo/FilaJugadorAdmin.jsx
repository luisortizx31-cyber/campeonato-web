import { useRef } from 'react'
import { construirLinkWhatsapp } from '../../utils/whatsapp'
import { WhatsappIcon } from '../shared/WhatsappIcon'

// Avatar circular del jugador: su foto si ya subio una (ver
// DetalleEquipo / torneoJugadoresService.actualizarFotoJugador), o la
// inicial del nombre mientras tanto - mismo criterio que EscudoEquipo
// para equipos. onCambiarFoto es opcional: sin el (ej. listas de solo
// lectura) el avatar no es clickeable.
function AvatarJugador({ nombre, fotoUrl, onCambiarFoto, subiendoFoto }) {
  const inputRef = useRef(null)
  const inicial = nombre?.trim()?.charAt(0)?.toUpperCase() || '—'

  const contenido = subiendoFoto ? (
    <span className="text-[9px] text-ink-soft">…</span>
  ) : fotoUrl ? (
    <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    <span className="text-xs font-bold text-ink-soft">{inicial}</span>
  )

  if (!onCambiarFoto) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper">
        {contenido}
      </span>
    )
  }

  return (
    <>
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
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-line bg-paper disabled:opacity-60"
      >
        {contenido}
      </button>
    </>
  )
}

// Fila de un jugador con las acciones de administracion (ver datos
// privados, editar, eliminar, foto) - se reutiliza en la lista plana
// de resultados de busqueda (TabJugadores) y en la pestaña Jugadores
// de la ficha de una promocion (DetalleEquipo).
export function FilaJugadorAdmin({ jugador, datosVisible, onVerDatos, onEditar, onEliminar, eliminando, onCambiarFoto, subiendoFoto, onQuitarFoto }) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex shrink-0 flex-col items-center gap-1">
            <AvatarJugador
              nombre={jugador.nombre}
              fotoUrl={jugador.fotoUrl}
              onCambiarFoto={onCambiarFoto}
              subiendoFoto={subiendoFoto}
            />
            {onQuitarFoto && jugador.fotoUrl && !subiendoFoto && (
              <button
                onClick={onQuitarFoto}
                className="text-[10px] text-ink-soft underline decoration-dotted"
              >
                Quitar
              </button>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {jugador.nombre} {jugador.numeroCamiseta && <span className="text-ink-soft">#{jugador.numeroCamiseta}</span>}
              {jugador.esJale && (
                <span className="ml-1 rounded-full bg-warning-soft px-1.5 py-0.5 align-middle text-[10px] font-bold text-warning">
                  JALE
                </span>
              )}
            </p>
            {jugador.eliminado ? (
              <span className="mt-1 inline-block rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                ❌ Eliminado{jugador.motivoEliminacion ? ` · ${jugador.motivoEliminacion}` : ''}
              </span>
            ) : jugador.suspendido ? (
              <span className="mt-1 inline-block rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                Suspendido{jugador.motivoSuspension ? ` · ${jugador.motivoSuspension}` : ''}
              </span>
            ) : null}
            {datosVisible !== undefined && (
              <div className="mt-1 flex items-center gap-2">
                {datosVisible === 'cargando' ? (
                  <p className="text-xs text-ink-soft">Cargando…</p>
                ) : datosVisible === 'error' ? (
                  <p className="text-xs text-danger">Error al cargar.</p>
                ) : (
                  <>
                    <p className="font-mono text-xs text-ink-soft">
                      DNI: {datosVisible.dni || 'Sin registrar'}
                      {datosVisible.telefono && ` · ${datosVisible.telefono}`}
                    </p>
                    {construirLinkWhatsapp(datosVisible.telefono) && (
                      <a
                        href={construirLinkWhatsapp(datosVisible.telefono)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-success"
                        aria-label={`Escribir a ${jugador.nombre} por WhatsApp`}
                      >
                        <WhatsappIcon className="h-4 w-4" />
                      </a>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex gap-2">
            <button onClick={onVerDatos} className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft">
              {datosVisible !== undefined ? 'Ocultar' : 'Ver datos'}
            </button>
            <button onClick={onEditar} className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft">
              Editar
            </button>
          </div>
          <button
            onClick={onEliminar}
            disabled={eliminando}
            className="rounded-lg border border-danger/30 px-2.5 py-1 text-xs text-danger disabled:opacity-50"
          >
            {eliminando ? '…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </li>
  )
}
