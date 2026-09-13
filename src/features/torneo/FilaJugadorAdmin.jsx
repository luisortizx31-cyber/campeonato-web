import { construirLinkWhatsapp } from '../../utils/whatsapp'
import { WhatsappIcon } from '../shared/WhatsappIcon'
import { AvatarFoto } from '../shared/AvatarFoto'

// Fila de un jugador con las acciones de administracion (ver datos
// privados, editar, eliminar, foto) - se reutiliza en la lista plana
// de resultados de busqueda (TabJugadores) y en la pestaña Jugadores
// de la ficha de una promocion (DetalleEquipo).
export function FilaJugadorAdmin({ jugador, datosVisible, onVerDatos, onEditar, onEliminar, eliminando, onCambiarFoto, subiendoFoto, onQuitarFoto }) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <AvatarFoto
            fotoUrl={jugador.fotoUrl}
            texto={jugador.nombre?.trim()?.charAt(0)?.toUpperCase() || '—'}
            onCambiarFoto={onCambiarFoto}
            subiendoFoto={subiendoFoto}
            onQuitarFoto={onQuitarFoto}
          />
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
