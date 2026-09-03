import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { crearColegio } from '../../services/superadminService'

function sugerirTorneoId(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const FORM_VACIO = { nombreColegio: '', torneoId: '', email: '', password: '' }

export default function PanelSuperAdmin() {
  const { esSuperAdmin } = useAuth()
  const [form, setForm] = useState(FORM_VACIO)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [creado, setCreado] = useState(null)

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const torneoId = form.torneoId.trim() || sugerirTorneoId(form.nombreColegio)
      const resultado = await crearColegio({
        torneoId,
        nombreColegio: form.nombreColegio,
        email: form.email,
        password: form.password,
      })
      setCreado({ ...resultado, email: form.email, password: form.password })
      setForm(FORM_VACIO)
    } catch (err) {
      console.error('[PanelSuperAdmin]', err)
      setError(err.message || 'No se pudo crear el colegio.')
    } finally {
      setEnviando(false)
    }
  }

  if (!esSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-ink-soft">
        No tenés permiso para ver esta página.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper pb-10">
      <header className="border-b border-line bg-surface px-4 py-4">
        <p className="font-mono text-xs tracking-widest text-ink-soft uppercase">Campeonato</p>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-ink">Nuevo colegio</h1>
          <Link
            to="/"
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft"
          >
            ← Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {creado && (
          <div className="mb-6 rounded-2xl border border-line bg-surface p-4 text-sm">
            <p className="mb-2 font-semibold text-ink">✓ Colegio creado</p>
            <p className="text-ink-soft">Pasale al cliente estos datos para que inicie sesión:</p>
            <ul className="mt-2 space-y-1 text-ink">
              <li><span className="text-ink-soft">Correo:</span> {creado.email}</li>
              <li><span className="text-ink-soft">Contraseña:</span> {creado.password}</li>
              <li>
                <span className="text-ink-soft">Link público:</span>{' '}
                {window.location.origin}/campeonato/{creado.torneoId}
              </li>
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Nombre del colegio</label>
            <input
              type="text"
              required
              value={form.nombreColegio}
              onChange={(e) => actualizar('nombreColegio', e.target.value)}
              placeholder="Ej: Colegio San Martín"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Identificador (para la URL)</label>
            <input
              type="text"
              value={form.torneoId}
              onChange={(e) => actualizar('torneoId', e.target.value)}
              placeholder={form.nombreColegio ? sugerirTorneoId(form.nombreColegio) : 'sanmartin'}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
            <p className="mt-1 text-xs text-ink-soft">
              Si lo dejás vacío, se genera solo a partir del nombre. Solo minúsculas, números y guiones.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Correo de acceso</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => actualizar('email', e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Contraseña</label>
            <input
              type="text"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => actualizar('password', e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Creando…' : 'Crear colegio'}
          </button>
        </form>
      </main>
    </div>
  )
}
