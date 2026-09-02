# Campeonato

App multitenant para administrar torneos amateur de futbol (equipos,
jugadores, fixture por fechas, resultados, tarjetas/suspensiones,
tabla de posiciones) con una pagina publica de solo lectura para
compartir por WhatsApp. Separada de `prestamos-web` — proyecto de
Firebase propio.

Cada colegio/campeonato (tenant) tiene su propia cuenta y sus datos
quedan aislados del resto via el campo `torneoId` en cada documento y
las Firestore Security Rules (`firestore.rules`). Todos los tenants
comparten el mismo proyecto de Firebase y el mismo deploy de Vercel —
no hace falta un proyecto nuevo por cada colegio.

## Puesta en marcha (una sola vez, del proyecto)

1. `npm install`
2. Copia `.env.local.example` a `.env.local` y completa los valores
   con la configuracion de tu proyecto de Firebase (Firebase Console >
   Configuracion del proyecto > Tus apps > app Web) y el token de
   VerificaPE (se puede reusar el de prestamos-web).
3. Reemplaza `PONER-AQUI-EL-ID-DEL-PROYECTO-DE-FIREBASE` en
   `.firebaserc` por el ID real del proyecto.
4. Despliega las reglas: `firebase deploy --only firestore:rules,storage`
5. `npm run dev`

## Alta de un colegio/campeonato nuevo

No hay todavia un flujo de autoregistro — se hace a mano desde la
consola de Firebase cada vez que se suma un cliente nuevo:

1. **Firebase Console > Authentication > Users > Add user.** Cargale
   un correo y contraseña (pueden ser inventados, no hace falta que el
   correo exista de verdad — no se envia ningun mail de verificacion).
   Copia el **UID** que le asigna.
2. Elegi un `torneoId`: un slug corto sin espacios ni tildes (ej.
   `sanmartin`, `atusparia`). Va a quedar visible en la URL publica.
3. **Firestore > coleccion `usuarios` > documento nuevo:**
   - ID del documento: el UID del paso 1 (exacto, sin espacios)
   - `role` (string) = `master`
   - `torneoId` (string) = el slug del paso 2 — **cuidado al escribirlo,
     que no quede un espacio de mas al final del nombre del campo ni
     del valor**, porque entonces la app no lo reconoce.
4. **Firestore > coleccion `torneos` > documento nuevo:**
   - ID del documento: el mismo slug del paso 2
   - `nombre` (string) = nombre real del colegio/campeonato, para
     mostrar en el panel y en la pagina publica
5. Pasale al cliente el correo/contraseña del paso 1 y el link de
   login (`/login` del deploy de Vercel). Su panel va a estar aislado
   del resto de colegios automaticamente.
6. El link publico de solo lectura para compartir por WhatsApp queda
   en `/campeonato/{torneoId}` — tambien se puede copiar con el boton
   "Copiar link publico" desde dentro del panel, una vez logueado.

## Rutas

- `/` — panel de administracion (requiere login, ve solo su propio torneo)
- `/login` — inicio de sesion
- `/campeonato/:torneoId` — pagina publica de un torneo puntual, sin login

## Pendiente

- Flujo de autoregistro/self-service para que un colegio nuevo pueda
  darse de alta solo (hoy es 100% manual, ver "Alta de un colegio
  nuevo" arriba).
- Migrar los datos de prueba/reales que ya existian en el proyecto de
  Firebase de `prestamos-web` (categoria Master con el fixture real
  "VII Campeonato de Ex Alumnos 2026") a este proyecto, si se quiere
  conservarlos en vez de arrancar de cero (ver boton temporal de
  migracion en la pestaña Equipos y `src/dev/migrarDesdeProyectoViejo.js`).
