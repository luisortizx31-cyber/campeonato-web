import { useState } from 'react'
import { crearDelegado } from '../../services/delegadosService'

// Genera una contraseña simple de 8 caracteres (letras+numeros, sin
// simbolos) para no obligar al Maestro a inventar una - la puede
// cambiar a mano en el campo de abajo si prefiere otra. Se guarda en
// texto plano en /torneo_delegados justo para poder mostrarla de
// nuevo despues (ver delegadosService.crearDelegado).
function generarPassword() {
  const caracteres = 'abcdefghjkmnpqrstuvwxyz23456789'
  let clave = ''
  for (let i = 0; i < 8; i++) {
    clave += caracteres[Math.floor(Math.random() * caracteres.length)]
  }
  return clave
}

/**
 * Da de alta un delegado con acceso restringido a UN equipo (ver
 * firestore.rules) - lo usa desde la pagina publica de su torneo para
 * inscribir jugadores de ese equipo nada mas. El correo+contraseña
 * quedan guardados para que el Maestro se los pueda compartir.
 */
export default function ModalCrearDelegado({ torneoId, equipos, onCerrar, onGuardado }) {
  const [form, setForm] = useState({
    equipoId: '',
    nombreDelegado: '',
    email: '',
    password: generarPassword(),
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.equipoId) {
      setError('Elige el equipo del delegado.')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    const equipo = equipos.find((eq) => eq.id === form.equipoId)
    setEnviando(true)
    try {
      await crearDelegado({
        torneoId,
        equipoId: form.equipoId,
        equipoNombre: equipo?.nombre || '',
        nombreDelegado: form.nombreDelegado,
        email: form.email.trim(),
        password: form.password,
      })
      onGuardado()
    } catch (err) {
      console.error('[ModalCrearDelegado]', err)
      setError(
        err.code === 'auth/email-already-in-use'
          ? 'Ese correo ya está en uso por otra cuenta.'
          : err.message || 'No se pudo crear el delegado.'
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h1 className="text-lg font-semibold text-ink">Nuevo delegado</h1>
          <button onClick={onCerrar} className="text-2xl leading-none text-ink-soft px-1">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-4">
            <label className="block text-sm font-medium text-ink mb-1">Equipo</label>
            <select
              required
              value={form.equipoId}
              onChange={(e) => actualizar('equipoId', e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            >
              <option value="">Elegir…</option>
              {equipos.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.nombre}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-soft">
              Este delegado solo va a poder inscribir jugadores y ver la alineación de este equipo.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink mb-1">Nombre del delegado (opcional)</label>
            <input
              type="text"
              value={form.nombreDelegado}
              onChange={(e) => actualizar('nombreDelegado', e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink mb-1">Correo de acceso</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => actualizar('email', e.target.value)}
              placeholder="delegado@correo.com"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          <div className="mb-1">
            <label className="block text-sm font-medium text-ink mb-1">Contraseña</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => actualizar('password', e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-ink outline-none focus-visible:border-brand"
              />
              <button
                type="button"
                onClick={() => actualizar('password', generarPassword())}
                className="shrink-0 rounded-lg border border-line px-3 text-xs font-medium text-ink-soft"
              >
                🔀 Nueva
              </button>
            </div>
          </div>
          <p className="mb-4 text-xs text-ink-soft">
            Anotala para compartírsela al delegado — después la vas a poder ver de nuevo en esta
            misma lista.
          </p>

          {error && (
            <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando || equipos.length === 0}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Creando…' : 'Crear delegado'}
          </button>
        </form>
      </div>
    </div>
  )
}
