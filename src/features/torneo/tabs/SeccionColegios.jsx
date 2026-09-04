import { useEffect, useState } from 'react'
import { crearColegio, listarColegios } from '../../../services/superadminService'

function sugerirTorneoId(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const FORM_VACIO = { nombreColegio: '', torneoId: '', email: '', password: '' }

// Solo se monta si esSuperAdmin (ver TabConfiguracion) - da de alta
// colegios/torneos nuevos sin pasar por la consola de Firebase, y
// muestra los ya creados con su correo/contraseña para poder
// pasarselos de nuevo al cliente si los pierde (ver
// superadminService: /colegios NUNCA es de lectura publica).
export default function SeccionColegios() {
  const [colegios, setColegios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [enviando, setEnviando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const lista = await listarColegios()
      setColegios(lista)
    } catch (err) {
      console.error('[SeccionColegios]', err)
      setError('No se pudieron cargar los colegios.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorForm(null)
    setEnviando(true)
    try {
      const torneoId = form.torneoId.trim() || sugerirTorneoId(form.nombreColegio)
      await crearColegio({
        torneoId,
        nombreColegio: form.nombreColegio,
        email: form.email,
        password: form.password,
      })
      setForm(FORM_VACIO)
      setMostrarForm(false)
      await cargar()
    } catch (err) {
      console.error('[SeccionColegios]', err)
      setErrorForm(err.message || 'No se pudo crear el colegio.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          Colegios {colegios.length > 0 && `(${colegios.length})`}
        </h2>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white"
        >
          {mostrarForm ? 'Cancelar' : '+ Nuevo colegio'}
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-2xl border border-line bg-surface p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Nombre del colegio</label>
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
            <label className="mb-1 block text-sm font-medium text-ink">Identificador (para la URL)</label>
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
            <label className="mb-1 block text-sm font-medium text-ink">Correo de acceso</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => actualizar('email', e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Contraseña</label>
            <input
              type="text"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => actualizar('password', e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          {errorForm && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorForm}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Creando…' : 'Crear colegio'}
          </button>
        </form>
      )}

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}
      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {!cargando && !error && colegios.length === 0 && (
        <p className="text-sm text-ink-soft">
          Todavía no creaste ningún colegio desde acá. (Los que se dieron de alta directo por consola de Firebase no aparecen en esta lista.)
        </p>
      )}

      {!cargando && colegios.length > 0 && (
        <ul className="space-y-2">
          {colegios.map((c) => (
            <li key={c.id} className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
              <p className="font-semibold text-ink">{c.nombre}</p>
              <ul className="mt-1 space-y-0.5 text-ink-soft">
                <li><span className="text-ink-soft">Correo:</span> <span className="text-ink">{c.email}</span></li>
                <li><span className="text-ink-soft">Contraseña:</span> <span className="text-ink">{c.password}</span></li>
                <li className="break-all">
                  <span className="text-ink-soft">Link:</span>{' '}
                  <span className="text-ink">{window.location.origin}/campeonato/{c.torneoId}</span>
                </li>
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
