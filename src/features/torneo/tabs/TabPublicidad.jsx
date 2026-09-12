import { useEffect, useRef, useState } from 'react'
import {
  listarPublicidad,
  crearPublicidad,
  actualizarImagenPublicidad,
  actualizarEnlacePublicidad,
  alternarActivaPublicidad,
  reordenarPublicidad,
  eliminarPublicidad,
} from '../../../services/torneoPublicidadService'
import { PublicidadBanner } from '../PublicidadBanner'

/**
 * Administra los banners de publicidad que rotan en el link publico
 * (ver PublicidadBanner.jsx) - crear, cambiar la imagen o el link,
 * activar/desactivar sin borrar, reordenar, y ver cuantas impresiones
 * y clics lleva cada uno. La vista previa de arriba usa el MISMO
 * componente que ve el publico, asi que "lo que ves es lo que hay".
 */
export default function TabPublicidad({ torneoId }) {
  const [anuncios, setAnuncios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [subiendoNuevo, setSubiendoNuevo] = useState(false)
  const [enlaceNuevo, setEnlaceNuevo] = useState('')
  const [procesandoId, setProcesandoId] = useState(null)
  const inputNuevoRef = useRef(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      setAnuncios(await listarPublicidad(torneoId))
    } catch (err) {
      console.error('[TabPublicidad]', err)
      setError('No se pudieron cargar los anuncios.')
    } finally {
      setCargando(false)
      setPreviewKey((k) => k + 1)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneoId])

  async function handleCrear(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setError(null)
    setSubiendoNuevo(true)
    try {
      await crearPublicidad({ torneoId, archivo, enlaceUrl: enlaceNuevo, orden: anuncios.length })
      setEnlaceNuevo('')
      await cargar()
    } catch (err) {
      console.error('[TabPublicidad] crearPublicidad', err)
      setError(err.message || 'No se pudo crear el anuncio.')
    } finally {
      setSubiendoNuevo(false)
      if (inputNuevoRef.current) inputNuevoRef.current.value = ''
    }
  }

  async function handleCambiarImagen(anuncioId, file) {
    setError(null)
    setProcesandoId(anuncioId)
    try {
      await actualizarImagenPublicidad(torneoId, anuncioId, file)
      await cargar()
    } catch (err) {
      console.error('[TabPublicidad] actualizarImagenPublicidad', err)
      setError(err.message || 'No se pudo cambiar la imagen.')
    } finally {
      setProcesandoId(null)
    }
  }

  async function handleGuardarEnlace(anuncioId, enlaceUrl) {
    setError(null)
    setProcesandoId(anuncioId)
    try {
      await actualizarEnlacePublicidad(anuncioId, enlaceUrl)
      await cargar()
    } catch (err) {
      console.error('[TabPublicidad] actualizarEnlacePublicidad', err)
      setError('No se pudo guardar el link.')
    } finally {
      setProcesandoId(null)
    }
  }

  async function handleAlternarActiva(anuncio) {
    setError(null)
    setProcesandoId(anuncio.id)
    try {
      await alternarActivaPublicidad(anuncio.id, !anuncio.activa)
      await cargar()
    } catch (err) {
      console.error('[TabPublicidad] alternarActivaPublicidad', err)
      setError('No se pudo cambiar el estado del anuncio.')
    } finally {
      setProcesandoId(null)
    }
  }

  async function handleMover(indice, delta) {
    const destino = indice + delta
    if (destino < 0 || destino >= anuncios.length) return
    const nuevo = [...anuncios]
    ;[nuevo[indice], nuevo[destino]] = [nuevo[destino], nuevo[indice]]
    setAnuncios(nuevo)
    try {
      await reordenarPublicidad(nuevo)
      setPreviewKey((k) => k + 1)
    } catch (err) {
      console.error('[TabPublicidad] reordenarPublicidad', err)
      setError('No se pudo guardar el nuevo orden.')
      await cargar()
    }
  }

  async function handleEliminar(anuncio) {
    if (!confirm('¿Eliminar este anuncio? No se puede deshacer.')) return
    setError(null)
    setProcesandoId(anuncio.id)
    try {
      await eliminarPublicidad(torneoId, anuncio.id)
      await cargar()
    } catch (err) {
      console.error('[TabPublicidad] eliminarPublicidad', err)
      setError('No se pudo eliminar el anuncio.')
      setProcesandoId(null)
    }
  }

  const activos = anuncios.filter((a) => a.activa).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-ink">Publicidad</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Banners que rotan arriba de todas las pestañas del link público. Subí uno o varios,
          activá los que quieras mostrar ahora y desactivá o cambiá los demás sin perder sus
          estadísticas.
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Vista previa · así lo ve el público{activos > 1 ? ` (rota entre ${activos})` : ''}
        </p>
        {activos === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
            Ningún anuncio activo todavía - no se muestra nada en el link público.
          </div>
        ) : (
          <PublicidadBanner torneoId={torneoId} refreshKey={previewKey} preview />
        )}
      </div>

      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {cargando ? (
        <p className="text-sm text-ink-soft">Cargando…</p>
      ) : (
        <div className="space-y-3">
          {anuncios.map((anuncio, i) => (
            <TarjetaAnuncio
              key={anuncio.id}
              anuncio={anuncio}
              procesando={procesandoId === anuncio.id}
              esPrimero={i === 0}
              esUltimo={i === anuncios.length - 1}
              onMover={(delta) => handleMover(i, delta)}
              onCambiarImagen={(file) => handleCambiarImagen(anuncio.id, file)}
              onGuardarEnlace={(url) => handleGuardarEnlace(anuncio.id, url)}
              onAlternarActiva={() => handleAlternarActiva(anuncio)}
              onEliminar={() => handleEliminar(anuncio)}
            />
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-line bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-ink">+ Nuevo anuncio</p>
        <label className="mb-1 block text-xs font-medium text-ink-soft">
          Link al tocar el anuncio (opcional - WhatsApp, Instagram, su página…)
        </label>
        <input
          type="url"
          value={enlaceNuevo}
          onChange={(e) => setEnlaceNuevo(e.target.value)}
          placeholder="https://wa.me/51999999999"
          disabled={subiendoNuevo}
          className="mb-3 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
        />
        <input
          ref={inputNuevoRef}
          type="file"
          accept="image/*"
          onChange={handleCrear}
          disabled={subiendoNuevo}
          className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
        />
        {subiendoNuevo && <p className="mt-2 text-xs text-ink-soft">Subiendo…</p>}
      </div>
    </div>
  )
}

function TarjetaAnuncio({
  anuncio,
  procesando,
  esPrimero,
  esUltimo,
  onMover,
  onCambiarImagen,
  onGuardarEnlace,
  onAlternarActiva,
  onEliminar,
}) {
  const [enlace, setEnlace] = useState(anuncio.enlaceUrl || '')
  const inputImagenRef = useRef(null)

  return (
    <div className={`rounded-2xl border bg-surface p-4 ${anuncio.activa ? 'border-line' : 'border-line opacity-60'}`}>
      <div className="flex gap-3">
        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-line bg-paper">
          {anuncio.imagenUrl ? (
            <img src={anuncio.imagenUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-ink-soft">Subiendo…</div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <button
              onClick={onAlternarActiva}
              disabled={procesando}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50 ${
                anuncio.activa ? 'bg-success-soft text-success' : 'bg-ink-soft/10 text-ink-soft'
              }`}
            >
              {anuncio.activa ? '● Activo' : '○ Inactivo'}
            </button>
            <span className="text-[11px] text-ink-soft">
              👁️ {anuncio.impresiones || 0} · 🖱️ {anuncio.clics || 0}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="url"
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              placeholder="Sin link (imagen sola)"
              className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1.5 text-xs text-ink outline-none focus-visible:border-brand"
            />
            {enlace !== (anuncio.enlaceUrl || '') && (
              <button
                onClick={() => onGuardarEnlace(enlace)}
                disabled={procesando}
                className="shrink-0 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Guardar
              </button>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <button
            onClick={() => onMover(-1)}
            disabled={esPrimero || procesando}
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-line text-xs text-ink-soft disabled:opacity-30"
          >
            ▲
          </button>
          <button
            onClick={() => onMover(1)}
            disabled={esUltimo || procesando}
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-line text-xs text-ink-soft disabled:opacity-30"
          >
            ▼
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <input
          ref={inputImagenRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onCambiarImagen(file)
            e.target.value = ''
          }}
        />
        <button
          onClick={() => inputImagenRef.current?.click()}
          disabled={procesando}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft disabled:opacity-50"
        >
          {procesando ? 'Procesando…' : '🖼️ Cambiar imagen'}
        </button>
        <button
          onClick={onEliminar}
          disabled={procesando}
          className="ml-auto rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>
    </div>
  )
}
