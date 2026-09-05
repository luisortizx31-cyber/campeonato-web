import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../../services/authService'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { cargando: cargandoAuth, estaAutenticado, error: errorAuth } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  // login() solo confirma la credencial contra Firebase Auth - el
  // perfil (rol, torneoId) lo trae AuthContext aparte, de forma
  // asincrona, apenas nota el cambio de sesion (onAuthStateChanged +
  // lectura a Firestore). Antes se navegaba a "/" apenas login()
  // resolvia, pero en ese momento el perfil todavia no habia
  // terminado de cargar: ProtectedRoute veia estaAutenticado=false y
  // rebotaba de vuelta a /login, obligando a iniciar sesion una
  // segunda vez (para entonces el perfil ya habia cargado en segundo
  // plano). Ahora se espera a que AuthContext termine de resolver
  // antes de navegar.
  useEffect(() => {
    if (!enviando || cargandoAuth) return
    if (estaAutenticado) {
      navigate('/', { replace: true })
    } else if (errorAuth) {
      setError('No se pudo completar el inicio de sesión.')
      setEnviando(false)
    }
  }, [enviando, cargandoAuth, estaAutenticado, errorAuth, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await login(email.trim(), password)
      // La navegacion la dispara el efecto de arriba, apenas
      // AuthContext termine de resolver el perfil - no antes.
    } catch (err) {
      console.error('[LoginPage]', err)
      setError('Correo o contraseña incorrectos.')
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-ink">Campeonato</h1>
        <p className="mb-6 text-sm text-ink-soft">Ingresa con tu cuenta de administrador.</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-ink">Correo</label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink">Contraseña</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
