import { useEffect, useState } from 'react'
import { listarEquiposDelTorneo } from '../../../services/torneoEquiposService'
import { suscribirPartidosDelTorneo, habilitarAlineacionDeFecha } from '../../../services/torneoPartidosService'
import { CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import { claveDia, estadoPartido } from '../../../utils/partidosPorDia'
import { formatearHoraCorta } from '../../../utils/fixtureTorneo'
import { textoMinutoEnCurso } from '../../../utils/golesPorTiempo'
import { EscudoEquipo } from '../../shared/EscudoEquipo'
import { TarjetaIcono } from '../../shared/TarjetaIcono'
import ModalProgramarFechas from '../ModalProgramarFechas'
import ControlPartido from '../ControlPartido'

// Tarjeta de acceso rapido de la pantalla de Inicio. `destacada` la pinta
// del color de marca y le da doble ancho (grid-cols-2) - se usa para
// "Programar fechas", la accion principal de esta pantalla.
function BotonAccion({ icon, label, sub, destacada, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-1.5 rounded-2xl border p-4 text-left shadow-sm transition-transform active:scale-[0.98] ${
        destacada ? 'col-span-2 border-brand bg-brand' : 'border-line bg-surface'
      }`}
    >
      <span className="flex h-8 items-center text-2xl">{icon}</span>
      <span className={`text-sm font-bold ${destacada ? 'text-white' : 'text-ink'}`}>{label}</span>
      {sub && <span className={`text-xs ${destacada ? 'text-white/80' : 'text-ink-soft'}`}>{sub}</span>}
    </button>
  )
}

// Fila de UN partido de hoy: los dos equipos lado a lado, como en las
// apps de resultados (ver TabPartidosPublica) - el nombre baja a una
// segunda linea si es largo (break-words) en vez de cortarse con "...",
// asi que la fila sigue siendo una sola por partido sin perder ningun
// caracter del nombre. Un boton para entrar directo a Control (los ya
// jugados no lo necesitan).
function FilaPartidoHoy({ partido, estado, local, visitante, bloqueadoPor, ahora, onAbrirControl }) {
  return (
    <li className="flex items-center gap-2 py-2">
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        <span className="min-w-0 break-words text-right text-xs font-medium leading-tight text-ink">
          {local?.nombre || '—'}
        </span>
        <EscudoEquipo nombre={local?.nombre} fotoUrl={local?.fotoPortadaUrl} tamanoClase="h-7 w-7" textoClase="text-[10px]" />
      </div>
      <div className="shrink-0 px-1 text-center">
        {estado === 'fin' ? (
          <span className="money text-sm font-bold text-ink">
            {partido.golesLocal}-{partido.golesVisitante}
          </span>
        ) : estado === 'vivo' ? (
          <>
            <span className="money block text-sm font-bold text-danger">
              {partido.golesLocalEnVivo ?? 0}-{partido.golesVisitanteEnVivo ?? 0}
            </span>
            <span className="block text-[10px] font-semibold text-danger">{textoMinutoEnCurso(partido, ahora) || 'En vivo'}</span>
          </>
        ) : (
          <span className="text-xs font-semibold text-ink-soft">{formatearHoraCorta(partido.fecha)}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <EscudoEquipo nombre={visitante?.nombre} fotoUrl={visitante?.fotoPortadaUrl} tamanoClase="h-7 w-7" textoClase="text-[10px]" />
        <span className="min-w-0 break-words text-xs font-medium leading-tight text-ink">{visitante?.nombre || '—'}</span>
      </div>
      {estado !== 'fin' && (
        <button
          onClick={() => onAbrirControl(partido)}
          disabled={Boolean(bloqueadoPor)}
          title={
            bloqueadoPor
              ? `Terminá primero el partido de Fecha ${bloqueadoPor.fechaNumero}`
              : 'Alineación y eventos del partido'
          }
          className="shrink-0 rounded-lg border border-line bg-paper px-2 py-1.5 text-xs disabled:opacity-40"
        >
          📋
        </button>
      )}
    </li>
  )
}

// Los partidos de hoy de UNA categoria, con su propio boton de "Habilitar
// delegados" (mismo criterio que TabFechas: toca los que todavia no
// arrancaron ni tienen resultado) - separado de categoria en categoria
// por si dos categorias juegan el mismo dia.
function GrupoCategoriaHoy({ categoria, partidos, estadoDe, equipoDe, bloqueadoPorDe, ahora, onAbrirControl }) {
  const [habilitando, setHabilitando] = useState(false)
  const [error, setError] = useState(null)

  const pendientesSinArrancar = partidos.filter((p) => p.golesLocal == null && p.horaInicio == null)
  const habilitados =
    pendientesSinArrancar.length > 0 && pendientesSinArrancar.every((p) => p.alineacionAbiertaLocal && p.alineacionAbiertaVisitante)

  async function alternarDelegados() {
    if (habilitados && !confirm('¿Cerrar la alineación de los delegados de hoy? Ya no van a poder armarla ni cambiarla.')) {
      return
    }
    setHabilitando(true)
    setError(null)
    try {
      await habilitarAlineacionDeFecha(pendientesSinArrancar.map((p) => p.id), !habilitados)
    } catch (err) {
      console.error('[TabInicio] habilitarAlineacionDeFecha', err)
      setError('No se pudo cambiar el permiso de los delegados.')
    } finally {
      setHabilitando(false)
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{CATEGORIA_TORNEO_LABELS[categoria]}</p>
        {pendientesSinArrancar.length > 0 && (
          <button
            onClick={alternarDelegados}
            disabled={habilitando}
            className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
              habilitados ? 'border-success/30 bg-success-soft text-success' : 'border-line bg-surface text-ink-soft'
            }`}
          >
            {habilitando ? '…' : habilitados ? '✓ Delegados' : '👥 Habilitar delegados'}
          </button>
        )}
      </div>
      {error && <p className="mb-1 text-[11px] text-danger">{error}</p>}
      <ul className="divide-y divide-line">
        {partidos.map((p) => (
          <FilaPartidoHoy
            key={p.id}
            partido={p}
            estado={estadoDe(p)}
            local={equipoDe(p.equipoLocalId)}
            visitante={equipoDe(p.equipoVisitanteId)}
            bloqueadoPor={bloqueadoPorDe(p)}
            ahora={ahora}
            onAbrirControl={onAbrirControl}
          />
        ))}
      </ul>
    </div>
  )
}

/**
 * Primera pantalla que ve el Maestro al entrar al panel (ver
 * PanelTorneo) - una bienvenida con el nombre del torneo, los partidos
 * programados para HOY (los de otros dias, atrasados o no, no
 * aparecen) con boton de Control y de habilitar delegados, y accesos
 * rapidos a lo que se usa mas seguido. "Programar fechas" abre el
 * asistente (ver ModalProgramarFechas) para elegir categoria, fecha y
 * cargar los horarios sin tener que pasar primero por la pestaña Fechas.
 */
export default function TabInicio({ torneoId, categoriasActivas, nombreTorneo, onIrATab }) {
  const [equipos, setEquipos] = useState([])
  const [partidos, setPartidos] = useState([])
  const [mostrarWizard, setMostrarWizard] = useState(false)
  const [partidoControl, setPartidoControl] = useState(null)
  // Se actualiza cada minuto para que un partido pase a "en vivo" (o el
  // dia cambie a la medianoche) sin que haga falta refrescar la pagina
  // (mismo criterio que TabPartidosPublica).
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelado = false
    listarEquiposDelTorneo(torneoId)
      .then((eq) => {
        if (!cancelado) setEquipos(eq)
      })
      .catch((err) => console.error('[TabInicio] listarEquiposDelTorneo', err))
    return () => {
      cancelado = true
    }
  }, [torneoId])

  useEffect(() => {
    return suscribirPartidosDelTorneo(torneoId, setPartidos)
  }, [torneoId])

  function equipoDe(id) {
    return equipos.find((e) => e.id === id)
  }
  function nombreEquipo(id) {
    return equipoDe(id)?.nombre || '—'
  }

  // Control de partido reemplaza toda esta pantalla (igual que en
  // Fechas) - los datos de arriba ya estan en vivo (suscribirPartidosDelTorneo),
  // asi que no hace falta refrescar nada al volver.
  if (partidoControl) {
    return (
      <ControlPartido
        torneoId={torneoId}
        categoria={partidoControl.categoria}
        partido={partidoControl}
        nombreEquipo={nombreEquipo}
        onVolver={() => setPartidoControl(null)}
      />
    )
  }

  const hoyClave = claveDia(new Date(ahora))
  const partidosHoy = partidos
    .filter((p) => categoriasActivas.includes(p.categoria) && p.fecha && claveDia(p.fecha.toDate()) === hoyClave)
    .sort((a, b) => a.fecha.toMillis() - b.fecha.toMillis())
  const categoriasHoy = [...new Set(partidosHoy.map((p) => p.categoria))]

  function estadoDe(partido) {
    return estadoPartido(partido, ahora)
  }

  // Mismo criterio que TabFechas: mientras un partido de una fecha
  // ANTERIOR (de la misma categoria) haya arrancado y no se haya
  // finalizado, no se deja abrir Control de una fecha posterior.
  function bloqueadoPorDe(partido) {
    const sinFinalizarDeCategoria = partidos.filter(
      (p) => p.categoria === partido.categoria && p.golesLocal == null && (p.titularesLocal?.length > 0 || p.titularesVisitante?.length > 0)
    )
    return sinFinalizarDeCategoria.find((p) => p.id !== partido.id && p.fechaNumero < partido.fechaNumero)
  }

  return (
    <div>
      {/* Hero con degrade + circulos decorativos, como la tarjeta del
          goleador (ver TarjetaGoleador) - mismo lenguaje visual que el
          resto de la app, no un estilo nuevo. */}
      <div className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark via-brand to-[#0c261d] p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-white/5" />
        <p className="relative text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Panel del Maestro</p>
        <h1 className="relative mt-1 text-2xl font-extrabold leading-tight">{nombreTorneo || 'Tu campeonato'}</h1>
        <p className="relative mt-1 text-sm text-white/80">¿Qué querés hacer hoy?</p>
      </div>

      {/* Tarjeta "flotante": se monta sobre el hero con un margen negativo,
          como en los tableros que muestran un dato destacado justo debajo
          de la cabecera. Solo los partidos de HOY - uno de ayer que quedo
          sin arrancar, o uno de la semana que viene, no aparecen aca. */}
      {partidosHoy.length > 0 && (
        <div className="relative -mt-14 mb-6 space-y-3 overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-xl">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
            📅 Partidos de hoy
          </p>
          {categoriasHoy.map((categoria) => (
            <GrupoCategoriaHoy
              key={categoria}
              categoria={categoria}
              partidos={partidosHoy.filter((p) => p.categoria === categoria)}
              estadoDe={estadoDe}
              equipoDe={equipoDe}
              bloqueadoPorDe={bloqueadoPorDe}
              ahora={ahora}
              onAbrirControl={setPartidoControl}
            />
          ))}
        </div>
      )}

      {/* Ya no hay barra de pestañas arriba (ver PanelTorneo): esta grilla
          es el UNICO punto de navegacion a cada seccion, asi que cubre
          las mismas 11 que antes vivian ahi - nada quedo sin acceso. */}
      <div className="grid grid-cols-2 gap-3">
        <BotonAccion
          icon="📅"
          label="Programar fechas"
          sub="Elegí la categoría, la fecha y armá los horarios"
          destacada
          onClick={() => setMostrarWizard(true)}
        />
        <BotonAccion icon="🗓️" label="Fechas" onClick={() => onIrATab('fechas')} />
        <BotonAccion icon="⚽" label="Goleadores" onClick={() => onIrATab('goleadores')} />
        <BotonAccion icon="📊" label="Posiciones" onClick={() => onIrATab('posiciones')} />
        <BotonAccion icon="🏆" label="Liguilla" onClick={() => onIrATab('liguilla')} />
        <BotonAccion
          icon={<TarjetaIcono tipo="amarilla" className="h-7 w-5" />}
          label="Amonestados"
          onClick={() => onIrATab('amonestados')}
        />
        <BotonAccion icon="📢" label="Reclamos" onClick={() => onIrATab('reclamos')} />
        <BotonAccion icon="🛡️" label="Equipos" onClick={() => onIrATab('equipos')} />
        <BotonAccion icon="👥" label="Jugadores" onClick={() => onIrATab('jugadores')} />
        <BotonAccion icon="📄" label="Bases" onClick={() => onIrATab('bases')} />
        <BotonAccion icon="📣" label="Publicidad" onClick={() => onIrATab('publicidad')} />
        <BotonAccion icon="⚙️" label="Configuración" onClick={() => onIrATab('configuracion')} />
      </div>

      {mostrarWizard && (
        <ModalProgramarFechas
          torneoId={torneoId}
          categoriasActivas={categoriasActivas}
          onCerrar={() => setMostrarWizard(false)}
          onIrATab={onIrATab}
        />
      )}
    </div>
  )
}
