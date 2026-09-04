import { useEffect, useState } from 'react'
import { crearColegio, listarColegios, alternarSuspensionColegio, editarColegio } from '../../../services/superadminService'

function sugerirTorneoId(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const FORM_VACIO = { nombreColegio: '', torneoId: '', email: '', password: '' }
const FORM_EDITAR_VACIO = { nombre: '', email: '', password: '' }

// Solo se monta si esSuperAdmin (ver TabConfiguracion) - da de alta
// colegios/torneos nuevos sin pasar por la consola de Firebase, y
// muestra los ya creados con su correo/contraseña para poder
// pasarselos de nuevo al cliente si los pierde (ver
// superadminService: /colegios NUNCA es de lectura publica). Tambien
// permite editar esos datos y deshabilitar/habilitar el acceso de un
// colegio sin borrar nada - no hay opcion de "eliminar" a proposito.
export default function SeccionColegios() {
  const [colegios, setColegios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [enviando, setEnviando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)
  const [editando, setEditando] = useState(null) // colegio siendo editado, o null
  const [formEditar, setFormEditar] = useState(FORM_EDITAR_VACIO)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [errorEdicion, setErrorEdicion] = useState(null)
  const [alternando, setAlternando] = useState(null) // torneoId cuyo estado se esta cambiando
  const [linkCopiado, setLinkCopiado] = useState(null) // torneoId cuyo link se acaba de copiar

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

  function abrirEditar(colegio) {
    setMostrarForm(false)
    setErrorEdicion(null)
    setFormEditar({ nombre: colegio.nombre || '', email: colegio.email || '', password: '' })
    setEditando(colegio)
  }

  function actualizarEdicion(campo, valor) {
    setFormEditar((f) => ({ ...f, [campo]: valor }))
  }

  async function handleGuardarEdicion(e) {
    e.preventDefault()
    if (!editando) return
    setErrorEdicion(null)
    setGuardandoEdicion(true)
    try {
      await editarColegio({
        torneoId: editando.torneoId,
        emailActual: editando.email,
        passwordActual: editando.password,
        nombreNuevo: formEditar.nombre,
        emailNuevo: formEditar.email,
        passwordNuevo: formEditar.password.trim() || null,
      })
      setEditando(null)
      await cargar()
    } catch (err) {
      console.error('[SeccionColegios]', err)
      setErrorEdicion(err.message || 'No se pudieron guardar los cambios.')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  async function handleCopiarLink(torneoId) {
    const url = `${window.location.origin}/campeonato/${torneoId}`
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopiado(torneoId)
      setTimeout(() => setLinkCopiado((actual) => (actual === torneoId ? null : actual)), 2000)
    } catch (err) {
      console.error('[SeccionColegios] No se pudo copiar el link:', err)
    }
  }

  async function handleAlternarSuspension(colegio) {
    const suspender = !colegio.suspendido
    if (suspender && !confirm(`¿Deshabilitar a "${colegio.nombre}"? No van a poder entrar ni al panel ni al link público hasta que lo vuelvas a habilitar.`)) {
      return
    }
    setAlternando(colegio.torneoId)
    setError(null)
    try {
      await alternarSuspensionColegio(colegio.torneoId, suspender)
      await cargar()
    } catch (err) {
      console.error('[SeccionColegios]', err)
      setError(err.message || 'No se pudo cambiar el estado del colegio.')
    } finally {
      setAlternando(null)
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          Colegios {colegios.length > 0 && `(${colegios.length})`}
        </h2>
        <button
          onClick={() => {
            setEditando(null)
            setMostrarForm((v) => !v)
          }}
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

      {editando && (
        <form onSubmit={handleGuardarEdicion} className="mb-4 space-y-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-ink">Editar {editando.nombre}</p>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Nombre del colegio</label>
            <input
              type="text"
              required
              value={formEditar.nombre}
              onChange={(e) => actualizarEdicion('nombre', e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Correo de acceso</label>
            <input
              type="email"
              required
              value={formEditar.email}
              onChange={(e) => actualizarEdicion('email', e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Nueva contraseña</label>
            <input
              type="text"
              minLength={6}
              value={formEditar.password}
              onChange={(e) => actualizarEdicion('password', e.target.value)}
              placeholder="Dejar en blanco para no cambiarla"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          {errorEdicion && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorEdicion}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="flex-1 rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardandoEdicion}
              className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}
      {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {!cargando && !error && colegios.length === 0 && (
        <p className="text-sm text-ink-soft">
          Todavía no creaste ningún colegio desde acá. (Los que se dieron de alta directo por consola de Firebase no aparecen en esta lista.)
        </p>
      )}

      {!cargando && colegios.length > 0 && (
        <ul className="space-y-2">
          {colegios.map((c) => (
            <li key={c.id} className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {c.nombre}
                    {c.suspendido && (
                      <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                        Deshabilitado
                      </span>
                    )}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-ink-soft">
                    <li><span className="text-ink-soft">Correo:</span> <span className="text-ink">{c.email}</span></li>
                    <li><span className="text-ink-soft">Contraseña:</span> <span className="text-ink">{c.password}</span></li>
                    <li className="break-all">
                      <span className="text-ink-soft">Link:</span>{' '}
                      <button
                        type="button"
                        onClick={() => handleCopiarLink(c.torneoId)}
                        title="Copiar link"
                        className="text-ink underline decoration-dotted underline-offset-2"
                      >
                        {window.location.origin}/campeonato/{c.torneoId} {linkCopiado === c.torneoId ? '✓' : '🔗'}
                      </button>
                    </li>
                  </ul>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <button
                    onClick={() => abrirEditar(c)}
                    className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleAlternarSuspension(c)}
                    disabled={alternando === c.torneoId}
                    className={`rounded-lg border px-2.5 py-1 text-xs disabled:opacity-50 ${
                      c.suspendido ? 'border-success/30 text-success' : 'border-danger/30 text-danger'
                    }`}
                  >
                    {alternando === c.torneoId ? '…' : c.suspendido ? 'Habilitar' : 'Deshabilitar'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
