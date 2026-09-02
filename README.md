# Campeonato

App para administrar torneos amateur de futbol (equipos, jugadores,
fixture por fechas, resultados, tarjetas/suspensiones, tabla de
posiciones) con una pagina publica de solo lectura para compartir por
WhatsApp. Separada de `prestamos-web` — proyecto de Firebase propio.

## Puesta en marcha

1. `npm install`
2. Copia `.env.local.example` a `.env.local` y completa los valores
   con la configuracion de tu proyecto de Firebase (Firebase Console >
   Configuracion del proyecto > Tus apps > app Web) y el token de
   VerificaPE (se puede reusar el de prestamos-web).
3. Reemplaza `PONER-AQUI-EL-ID-DEL-PROYECTO-DE-FIREBASE` en
   `.firebaserc` por el ID real del proyecto.
4. Crea en Firebase Authentication (Email/contraseña) el usuario
   administrador, y en Firestore un documento en
   `/usuarios/{uid-de-ese-usuario}` con el campo `role: "master"`
   (mismo uid que te dio Authentication).
5. Despliega las reglas: `firebase deploy --only firestore:rules,storage`
6. `npm run dev`

## Rutas

- `/` — panel de administracion (requiere login)
- `/login` — inicio de sesion
- `/campeonato` — pagina publica, sin login, para compartir

## Pendiente

- Migrar los datos de prueba/reales que ya existian en el proyecto de
  Firebase de `prestamos-web` (categoria Master con el fixture real
  "VII Campeonato de Ex Alumnos 2026") a este proyecto nuevo, si se
  quiere conservarlos en vez de arrancar de cero.
- Desplegar en Vercel (o el hosting que se elija) apuntando a esta
  carpeta como proyecto independiente.
