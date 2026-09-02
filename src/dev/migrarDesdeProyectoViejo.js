// Script de un solo uso para copiar los datos del torneo que ya
// existian en el proyecto de Firebase de prestamos-web
// (prestamos-20f1c) a este proyecto nuevo. Se importa y dispara desde
// un boton temporal en TabEquipos.jsx - borrar este archivo y ese
// boton despues de usarlo una vez.
//
// Lee el proyecto viejo SIN loguearse (una segunda instancia de la
// app de Firebase apuntando a el) porque las colecciones torneo_* son
// de lectura publica ahi (ver firestore.rules de prestamos-web). Solo
// se puede escribir en el proyecto nuevo si ya iniciaste sesion como
// Maestro aca.
//
// OJO: no copia la subcoleccion privada /privado (DNI/telefono de
// jugadores) - esa requeriria sesion tambien en el proyecto viejo. Si
// hace falta conservar esos datos, avisale a Claude para armar ese
// paso aparte.
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore'
import { db as dbNuevo } from '../config/firebase'

const CONFIG_PROYECTO_VIEJO = {
  apiKey: 'AIzaSyAVvVjEv5Q2hla_5Dzr6YYdwUwAeWBoU2c',
  authDomain: 'prestamos-20f1c.firebaseapp.com',
  projectId: 'prestamos-20f1c',
  storageBucket: 'prestamos-20f1c.firebasestorage.app',
}

function obtenerDbProyectoViejo() {
  const existente = getApps().find((a) => a.name === 'proyecto-viejo')
  const app = existente || initializeApp(CONFIG_PROYECTO_VIEJO, 'proyecto-viejo')
  return getFirestore(app)
}

const COLECCIONES = [
  'torneo_equipos',
  'torneo_jugadores',
  'torneo_partidos',
  'torneo_tarjetas',
  'torneo_ajustes',
]

// El proyecto viejo guardaba la config con id fijo ('general',
// 'master', 'libre'...) porque solo existia un torneo. Aca cada
// colegio (torneoId) tiene su propio doc, asi que el id compuesto
// tiene que armarse de nuevo en vez de copiarse tal cual - ver
// torneoConfigService.js (idConfigGeneral / idConfigCategoria).
function idConfigNuevo(torneoId, idViejo) {
  return idViejo === 'general' ? `${torneoId}_general` : `${torneoId}_${idViejo}`
}

export async function migrarDesdeProyectoViejo(torneoId, onProgreso) {
  const dbViejo = obtenerDbProyectoViejo()
  const log = (msg) => onProgreso?.(msg)
  const resumen = {}

  for (const coleccion of COLECCIONES) {
    log(`Copiando ${coleccion}…`)
    const snap = await getDocs(collection(dbViejo, coleccion))

    // Mismo id de documento en el proyecto nuevo: asi los equipoId /
    // jugadorId / partidoId que se referencian entre colecciones
    // siguen apuntando al lugar correcto. Se le agrega torneoId a
    // cada doc para que quede aislado del resto de colegios (ver
    // reglas de firestore.rules).
    const batch = writeBatch(dbNuevo)
    snap.docs.forEach((d) => {
      batch.set(doc(dbNuevo, coleccion, d.id), { ...d.data(), torneoId })
    })
    if (!snap.empty) await batch.commit()

    resumen[coleccion] = snap.size
  }

  log('Copiando torneo_config…')
  const snapConfig = await getDocs(collection(dbViejo, 'torneo_config'))
  const batchConfig = writeBatch(dbNuevo)
  snapConfig.docs.forEach((d) => {
    batchConfig.set(doc(dbNuevo, 'torneo_config', idConfigNuevo(torneoId, d.id)), { ...d.data(), torneoId })
  })
  if (!snapConfig.empty) await batchConfig.commit()
  resumen.torneo_config = snapConfig.size

  log('Listo.')
  return resumen
}
