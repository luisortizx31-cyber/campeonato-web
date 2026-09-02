import { useState } from 'react'
import { crearEquipo, actualizarEquipo } from '../../services/torneoEquiposService'
import { consultarDni } from '../../services/dniLookupService'
import { CATEGORIA_TORNEO_LABELS } from '../../models/torneo'

/**
 * Modal para crear o editar un equipo. La categoria no es un campo
 * del formulario: viene fija del toggle Master/Libre de TabEquipos,
 * para que sea imposible crear un equipo "en la categoria
 * equivocada" por error de tipeo.
 */
export default function ModalCrearEquipo({ torneoId, categoria, equipo, onCerrar, onGuardado }) {
  const esEdicion = Boolean(equipo)
  const [form, setForm] = useState({
    nombre: equipo?.nombre || '',
    delegadoNombre: equipo?.delegadoNombre || '',
    delegadoTelefono: equipo?.delegadoTelefono || '',
    subdelegadoNombre: equipo?.subdelegadoNombre || '',
    subdelegadoTelefono: equipo?.subdelegadoTelefono || '',
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      if (esEdicion) {
        await actualizarEquipo(equipo.id, form)
      } else {
        await crearEquipo({ torneoId, categoria, ...form })
      }
      onGuardado()
    } catch (err) {
      console.error('[ModalCrearEquipo]', err)
      setError(err.message || 'No se pudo guardar el equipo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h1 className="text-lg font-semibold text-ink">
            {esEdicion ? 'Editar equipo' : 'Nuevo equipo'} · {CATEGORIA_TORNEO_LABELS[categoria]}
          </h1>
          <button onClick={onCerrar} className="text-2xl leading-none text-ink-soft px-1">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <Campo label="Nombre del equipo" value={form.nombre} onChange={(v) => actualizar('nombre', v)} />

          <CampoPersonaConDni
            titulo="Delegado (opcional)"
            nombre={form.delegadoNombre}
            telefono={form.delegadoTelefono}
            onNombreChange={(v) => actualizar('delegadoNombre', v)}
            onTelefonoChange={(v) => actualizar('delegadoTelefono', v)}
          />

          <CampoPersonaConDni
            titulo="Subdelegado (opcional)"
            nombre={form.subdelegadoNombre}
            telefono={form.subdelegadoTelefono}
            onNombreChange={(v) => actualizar('subdelegadoNombre', v)}
            onTelefonoChange={(v) => actualizar('subdelegadoTelefono', v)}
          />

          <p className="mb-4 text-xs text-ink-soft">
            Los teléfonos que llenes se van a ver en el link público del torneo para que los
            equipos se coordinen. Dejalos vacíos si prefieren no compartirlos.
          </p>

          {error && (
            <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-2 w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear equipo'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Campo({ label, value, onChange, type = 'text', required = true }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-ink">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
      />
    </div>
  )
}

// Delegado/subdelegado: se escribe el DNI, y al salir del campo (blur)
// se consulta contra RENIEC (misma API que usa el registro de
// clientes, ver services/dniLookupService) y se autocompleta el
// nombre. El DNI en si no se guarda, es solo un atajo para no tener
// que tipear el nombre completo a mano - el nombre queda editable por
// si hace falta corregirlo.
function CampoPersonaConDni({ titulo, nombre, telefono, onNombreChange, onTelefonoChange }) {
  const [dni, setDni] = useState('')
  const [validacion, setValidacion] = useState(null) // null | 'cargando' | {data} | 'no_encontrado' | 'error_conexion'

  function handleDni(valor) {
    setDni(valor.replace(/\D/g, '').slice(0, 8))
    setValidacion(null)
  }

  async function handleBlurDni() {
    if (dni.length !== 8) return
    setValidacion('cargando')
    try {
      const data = await consultarDni(dni)
      setValidacion({ data })
      if (data?.fullName) onNombreChange(data.fullName)
    } catch (err) {
      console.error('[ModalCrearEquipo] consultarDni', err)
      // fetch() tira TypeError cuando ni siquiera pudo conectarse (ej.
      // CORS en localhost) - eso NO es lo mismo que "DNI no
      // encontrado" (el servicio respondio pero sin datos).
      setValidacion(err instanceof TypeError ? 'error_conexion' : 'no_encontrado')
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-line p-3">
      <p className="mb-3 text-sm font-semibold text-ink">{titulo}</p>

      <div className="mb-3">
        <label className="block text-sm font-medium text-ink">DNI</label>
        <input
          type="text"
          inputMode="numeric"
          value={dni}
          onChange={(e) => handleDni(e.target.value)}
          onBlur={handleBlurDni}
          placeholder="12345678"
          maxLength={8}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-ink outline-none focus-visible:border-brand"
        />
        {validacion === 'cargando' && <p className="mt-1 text-xs text-ink-soft">Buscando…</p>}
        {validacion === 'no_encontrado' && (
          <p className="mt-1 text-xs text-warning">No se encontró información pública de este DNI.</p>
        )}
        {validacion === 'error_conexion' && (
          <p className="mt-1 text-xs text-warning">
            No se pudo conectar con el servicio de verificación (normal en localhost — funciona en
            producción). Completa el nombre a mano.
          </p>
        )}
        {validacion?.data && (
          <p className="mt-1 text-xs text-success">✓ {validacion.data.fullName}</p>
        )}
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium text-ink">Nombre</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => onNombreChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Teléfono</label>
        <input
          type="tel"
          value={telefono}
          onChange={(e) => onTelefonoChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
        />
      </div>
    </div>
  )
}
