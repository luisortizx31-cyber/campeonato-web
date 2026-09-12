import { useEffect, useState } from 'react'
import { listarPublicidad, registrarImpresionPublicidad, registrarClicPublicidad } from '../../services/torneoPublicidadService'

const INTERVALO_ROTACION_MS = 7000
// sessionStorage: ids de anuncios ya contados como impresion en ESTA
// sesion - una impresion por visitante por anuncio, no una por cada
// vez que la rotacion lo vuelve a mostrar en pantalla.
const CLAVE_VISTAS = 'campeonato_publicidad_vistas'

function yaSeConto(anuncioId) {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_VISTAS) || '[]').includes(anuncioId)
  } catch {
    return false
  }
}
function marcarContado(anuncioId) {
  try {
    const vistos = JSON.parse(sessionStorage.getItem(CLAVE_VISTAS) || '[]')
    if (!vistos.includes(anuncioId)) {
      sessionStorage.setItem(CLAVE_VISTAS, JSON.stringify([...vistos, anuncioId]))
    }
  } catch {
    // Sin sessionStorage (modo privado, etc) - en el peor caso esta
    // visita puntual se cuenta de mas, no rompe nada.
  }
}

/**
 * Banner de publicidad de la pagina publica - rota entre los
 * anuncios ACTIVOS del torneo (ver TabPublicidad, panel admin) con un
 * fundido suave. Si no hay ninguno activo no renderiza nada (no deja
 * un hueco vacio). Cada anuncio suma una impresion por visitante por
 * sesion (no una por cada vez que rota a la vista) y un clic cada vez
 * que lo tocan.
 *
 * `preview` (usado en TabPublicidad para mostrarle al Maestro como
 * queda ANTES/DESPUES de publicar cambios) desactiva el registro de
 * impresiones/clics - se ve identico a como lo veria el publico, pero
 * mirarlo desde el panel admin no ensucia las estadisticas reales.
 */
export function PublicidadBanner({ torneoId, refreshKey, preview = false }) {
  const [anuncios, setAnuncios] = useState([])
  const [indice, setIndice] = useState(0)

  useEffect(() => {
    let cancelado = false
    listarPublicidad(torneoId)
      .then((lista) => {
        if (cancelado) return
        setAnuncios(lista.filter((a) => a.activa && a.imagenUrl))
        setIndice(0)
      })
      .catch((err) => console.error('[PublicidadBanner]', err))
    return () => {
      cancelado = true
    }
  }, [torneoId, refreshKey])

  useEffect(() => {
    if (anuncios.length <= 1) return
    const id = setInterval(() => {
      setIndice((i) => (i + 1) % anuncios.length)
    }, INTERVALO_ROTACION_MS)
    return () => clearInterval(id)
  }, [anuncios.length])

  useEffect(() => {
    if (preview) return
    const actual = anuncios[indice]
    if (!actual || yaSeConto(actual.id)) return
    marcarContado(actual.id)
    registrarImpresionPublicidad(actual.id).catch((err) =>
      console.error('[PublicidadBanner] registrarImpresionPublicidad', err)
    )
  }, [anuncios, indice, preview])

  if (anuncios.length === 0) return null

  function handleClick(anuncio) {
    if (!preview) {
      registrarClicPublicidad(anuncio.id).catch((err) =>
        console.error('[PublicidadBanner] registrarClicPublicidad', err)
      )
    }
    if (anuncio.enlaceUrl) {
      window.open(anuncio.enlaceUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <span className="absolute left-2 top-2 z-10 rounded-full bg-ink/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
        Publicidad
      </span>
      <div className="relative aspect-[3/1] w-full">
        {anuncios.map((anuncio, i) => (
          <img
            key={anuncio.id}
            src={anuncio.imagenUrl}
            alt="Publicidad"
            onClick={() => handleClick(anuncio)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              i === indice ? 'opacity-100' : 'pointer-events-none opacity-0'
            } ${anuncio.enlaceUrl ? 'cursor-pointer' : ''}`}
          />
        ))}
      </div>
      {anuncios.length > 1 && (
        <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
          {anuncios.map((anuncio, i) => (
            <span
              key={anuncio.id}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${i === indice ? 'bg-white' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
