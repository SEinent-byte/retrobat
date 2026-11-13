# Especificación técnica — Launcher RetroBat con licencias y trial

**Versión:** 1.1 (borrador)
**Fecha:** 2026-11-13
**Estado:** Listo para implementación del MVP

> **Este documento es el roadmap.** La construcción se hará paso a paso en sesiones posteriores, leyendo primero `CLAUDE.md`. El avance se va comiteando, pusheando y documentando de forma incremental (no excesiva, para no sobrecargar el contexto). Setup inicial (repo GitHub, tokens, dashboards) se hará con asistencia de Playwright abriendo las páginas necesarias.

> **Stack: 100 % Cloudflare.** Web admin en **Pages**, API en **Workers**, datos en **D1**, ROMs en **R2**, trabajos programados en **Cron Triggers**. D1 no se pausa por inactividad (a diferencia de Supabase free), así que no hace falta un cron de keep-alive.

---

## 1. Resumen del producto

Launcher de escritorio para Windows, construido sobre RetroBat, que distribuye juegos retro bajo un modelo de suscripción de pago. El usuario inicia sesión con su cuenta de Google, obtiene una prueba gratuita de 7 días con un catálogo limitado y, al terminar la prueba, paga una suscripción para acceder al catálogo completo. El sistema incluye controles contra el abuso de cuentas múltiples y contra la manipulación del reloj del sistema.

### Componentes

| Componente | Tecnología | Función |
|-----------|-----------|---------|
| Cliente | C# / .NET 8 + WPF, Windows | Interfaz, login, lanzar emuladores, descargas, anti-tamper |
| Backend API | Cloudflare Workers | Autenticación, licencias, trial, pagos |
| Web de administración | Cloudflare Pages | Panel del dueño (llama a la misma API de Workers) |
| Base de datos | Cloudflare D1 (SQLite) | Usuarios, dispositivos, trials, suscripciones |
| Almacenamiento de juegos | Cloudflare R2 | ROMs y assets, servidos con URLs firmadas |
| Trabajos programados | Cloudflare Cron Triggers | Abuse-scoring y mantenimiento |
| Autenticación | Google OAuth 2.0 (PKCE) | Identidad del usuario |
| Descargas | aria2 (empaquetado en el cliente) | Descargas múltiples y reanudables |

### Dominio

- **MVP:** `tuapp.workers.dev` (HTTPS gratis e inmediato de Cloudflare).
- **Lanzamiento público:** dominio propio (.com/.net, ~$10/año) apuntado a Cloudflare. Al migrar, actualizar el redirect URI en Google Cloud Console (cambio de ~5 min).

---

## 2. Arquitectura

```
┌──────────────────────────────┐        ┌───────────────────────────┐
│  Cliente WPF (.NET 8)         │        │  Cloudflare Workers (API) │
│                               │        │                           │
│  - Login Google OAuth         │ HTTPS  │  - /auth/*                │
│  - Device fingerprint         │◄──────►│  - /license/*             │
│  - Estado de licencia (cache) │        │  - /catalog/*             │
│  - Lanzador de emuladores     │        │  - /download/*            │
│  - Gestor de descargas aria2  │        │  - /billing/*             │
│  - Anti-tamper reloj          │        │                           │
└──────────────────────────────┘        └─────────────┬─────────────┘
                                                       │
                                   ┌───────────────────┼───────────────────┐
                                   │                   │                   │
                             ┌─────▼─────┐      ┌──────▼──────┐     ┌──────▼──────┐
                             │  D1 (SQL) │      │   R2 (ROMs) │     │  Proveedor  │
                             │           │      │             │     │  de pagos   │
                             └───────────┘      └─────────────┘     └─────────────┘
```

Principio clave: **el cliente nunca es la fuente de verdad**. El estado de licencia y trial se valida siempre en el servidor. El cliente guarda una copia en caché (firmada) solo para funcionar unos minutos sin red, pero toda decisión de acceso real se confirma contra la API.

### 2.1 Modularidad (buena práctica transversal)

Todo se construye modular, con límites claros y acoplamiento bajo. Estructura sugerida (monorepo):

```
/backend        Cloudflare Workers
  /routes       auth, license, catalog, download, play, billing, admin  (un módulo por área)
  /services     lógica de negocio (trial, scoring, licencias) sin tocar HTTP
  /db           acceso a D1, migraciones del esquema
  /lib          utilidades compartidas (JWT, firma R2, hashing)
/client         App WPF .NET 8
  /Core         fingerprint, licencia, anti-tamper (sin UI)
  /Services     cliente API, descargas aria2, lanzador de emuladores
  /UI           vistas WPF (MVVM)
/admin-web      Panel de administración — Cloudflare Pages (llama a la API de Workers)
/shared         tipos/contratos de la API compartidos
```

Reglas de modularidad:
- Cada módulo expone una interfaz; la lógica de negocio no conoce HTTP ni UI.
- Las consolas, planes y reglas de abuso son **datos/config**, no código embebido → añadir una consola o un plan no toca el core.
- Contratos de API versionados en `/shared` para que cliente y backend no se desincronicen.
- Todo al control de versiones (repo), con migraciones de DB versionadas.

---

## 3. Modelo de datos (D1 / SQLite)

```sql
-- Usuarios (identidad Google)
CREATE TABLE users (
  id              TEXT PRIMARY KEY,          -- uuid interno
  google_sub      TEXT UNIQUE NOT NULL,      -- 'sub' del token de Google
  email           TEXT NOT NULL,
  created_at      INTEGER NOT NULL,          -- epoch ms
  blocked         INTEGER NOT NULL DEFAULT 0,
  abuse_score     INTEGER NOT NULL DEFAULT 0, -- scoring silencioso (§8.2)
  under_review    INTEGER NOT NULL DEFAULT 0  -- degradación, no bloqueo
);

-- Dispositivos (huella de hardware multicapa, §8.1)
CREATE TABLE devices (
  fingerprint     TEXT PRIMARY KEY,          -- hash(MachineGuid + combo hardware)
  machine_guid    TEXT,                      -- ancla: HKLM\...\Cryptography\MachineGuid
  signals_json    TEXT,                      -- combo crudo: CPU, RAM, disco, MAC, pantalla
  first_seen_at   INTEGER NOT NULL,
  last_seen_at    INTEGER NOT NULL,
  blocked         INTEGER NOT NULL DEFAULT 0,
  abuse_score     INTEGER NOT NULL DEFAULT 0
);

-- Activaciones de trial (REGLA ANTI-FARM)
CREATE TABLE trials (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  device_fingerprint TEXT NOT NULL REFERENCES devices(fingerprint),
  started_at      INTEGER NOT NULL,          -- primer login, no registro
  expires_at      INTEGER NOT NULL,          -- started_at + 7 días
  UNIQUE(device_fingerprint)                 -- 1 trial por hardware, pase lo que pase
);

-- Suscripciones de pago
CREATE TABLE subscriptions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  plan            TEXT NOT NULL,             -- TBD: nombres/precios de planes
  status          TEXT NOT NULL,            -- active | canceled | expired
  provider_ref    TEXT,                     -- id de la suscripción en el proveedor
  started_at      INTEGER NOT NULL,
  current_period_end INTEGER,
  canceled_at     INTEGER                   -- cancelación = efecto inmediato
);

-- Consolas / sistemas (lista cerrada, entidad de primera clase)
CREATE TABLE systems (
  id              TEXT PRIMARY KEY,         -- p.ej. 'nes', 'snes', 'gba'
  name            TEXT NOT NULL,            -- 'Nintendo Entertainment System'
  retrobat_folder TEXT NOT NULL,            -- carpeta en roms\<folder> de RetroBat
  default_core    TEXT,                     -- emulador/core por defecto
  extensions      TEXT NOT NULL,            -- CSV de extensiones válidas: '.nes,.zip'
  sort_order      INTEGER NOT NULL DEFAULT 0
);

-- Catálogo de juegos (SIEMPRE atado a una consola válida)
CREATE TABLE games (
  id              TEXT PRIMARY KEY,
  system_id       TEXT NOT NULL REFERENCES systems(id), -- FK: no hay juego sin consola válida
  title           TEXT NOT NULL,
  r2_key          TEXT NOT NULL,            -- ruta en R2
  rom_filename    TEXT NOT NULL,            -- nombre real del archivo (con extensión)
  size_bytes      INTEGER NOT NULL,
  trial_eligible  INTEGER NOT NULL DEFAULT 0, -- jugable en trial de forma permanente
  free_from       INTEGER,                  -- ventana temporal free (epoch ms), NULL = sin ventana
  free_until      INTEGER                   -- juego gratis para usuarios free un par de días
);

-- Analítica de uso (qué juegan más)
CREATE TABLE play_events (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  game_id         TEXT NOT NULL REFERENCES games(id),
  started_at      INTEGER NOT NULL,
  duration_sec    INTEGER                   -- opcional, al cerrar el emulador
);

-- Administradores del panel web (solo el dueño por ahora)
CREATE TABLE admins (
  id              TEXT PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  created_at      INTEGER NOT NULL
);
```

### Regla anti-farm (la clave del negocio)

Regla base, a nivel de **hardware**, no de cuenta:

```sql
SELECT COUNT(*) FROM trials WHERE device_fingerprint = @fp;
-- Si > 0: se niega el nuevo trial sin importar el google_sub.
```

Consecuencias:
- Un usuario no puede crear 10 cuentas de Google para tener 70 días gratis en la misma PC.
- Si un usuario legítimo cambia de PC, su cuenta de Google ya consumió su trial histórico (restricción adicional opcional: también limitar por `user_id`), así que tampoco se duplica.
- Primer login en PC nueva con cuenta que ya tuvo trial en otra parte → sin trial, pasa por caja.

> **Principio rector:** nadie resuelve esto al 100 %, y no es el objetivo. El objetivo es que **abusar cueste más de lo que vale el trial**. Si reventar el límite toma 40 min de VM + VPN + número nuevo, la mayoría paga o se va. El diseño apunta a subir ese costo, no a un bloqueo perfecto.

La defensa es multicapa (ver §8.1). Un fingerprint de 3 componentes por sí solo es frágil: los scripts de reseteo de trial sobrescriben exactamente esos valores. Por eso se combinan varias señales y, sobre todo, se **puntúa en silencio en lugar de bloquear al instante** (ver §8.2).

---

## 4. Autenticación (Google OAuth 2.0)

Flujo **Authorization Code + PKCE con redirect loopback** (RFC 8252, el estándar para apps de escritorio). El cliente WPF es un *public client*: no lleva client secret embebido.

1. El cliente genera `code_verifier` + `code_challenge` (PKCE) y abre un socket en la interfaz loopback: `http://127.0.0.1:{puerto_efímero}/callback`. En Windows, abrir el socket con `SO_EXCLUSIVEADDRUSE` (evita que otra app secuestre el puerto). Usar la IP loopback literal, **no** `localhost`.
2. El cliente abre el navegador del sistema en la URL de consentimiento de Google con `redirect_uri` = esa URL loopback y el `code_challenge`.
3. Google redirige a `http://127.0.0.1:{puerto}/callback?code=...`; el socket local del cliente captura el `code` y cierra el puerto.
4. El cliente envía `{ code, code_verifier }` al Worker: `POST /auth/exchange`.
5. El Worker (cliente confidencial) intercambia `code` + `code_verifier` con el token endpoint de Google, valida el `id_token`, extrae `sub` y `email`.
6. El Worker crea/actualiza el usuario y emite un **token de sesión propio** (JWT firmado con secret del Worker, expiración corta + refresh token).
7. El cliente guarda el token de sesión de forma segura (ver §8.3).

> No usar el `id_token` de Google directamente como sesión. Emitir token propio para controlar expiración, revocación y bloqueo.
>
> El redirect loopback (no `https://<dominio>/callback`) evita depender de un dominio para el login y es lo recomendado por RFC 8252. El redirect URI loopback se registra en Google Cloud Console; Google permite cualquier puerto para loopback.

Endpoints:
- `POST /auth/exchange` — recibe `{ code, code_verifier }`, intercambia con Google, emite sesión.
- `POST /auth/refresh` — renueva el token de sesión.
- `POST /auth/logout` — revoca el refresh token.

---

## 5. Lógica de trial

- **Inicio:** al **primer login** del usuario en un dispositivo (no en el registro). Más justo: el reloj cuenta desde que el usuario realmente puede jugar.
- **Duración:** 7 días (`expires_at = started_at + 7*24*3600*1000`).
- **Catálogo:** solo juegos con `trial_eligible = 1`.
- **Fin del trial:** sin suscripción activa → se bloquea el catálogo completo; quedan disponibles solo los juegos trial (o ninguno, decisión de negocio TBD).

Endpoint:
- `POST /license/activate-trial` — body: `{ fingerprint }`. Valida la regla anti-farm, crea la fila en `trials`, devuelve `expires_at`.
- `GET  /license/status` — devuelve el estado efectivo del usuario+dispositivo: `trial_active | trial_expired | subscribed | none`, con `expires_at` / `current_period_end`.

### Opcional v2 (anotado, fuera del MVP)
- Juego rotativo cada 24 h en el trial: un juego destacado adicional que cambia diariamente.

---

## 6. Anti-manipulación del reloj

El trial depende del tiempo; el usuario podría atrasar el reloj de Windows para extenderlo. Medidas en capas:

1. **La verdad es del servidor.** `GET /license/status` compara `expires_at` contra la hora del Worker, no la del cliente. Sin red no se puede extender nada de forma permanente.
2. **Marca de tiempo monótona local.** El cliente guarda en el Registro de Windows (`HKCU\Software\<App>`) la última hora vista del servidor. Si el reloj local retrocede respecto a ese valor guardado → se detecta tampering y se fuerza revalidación online / bloqueo.
3. **Clave en Registro protegida.** El valor se guarda cifrado/firmado (ver §8) para que el usuario no pueda editarlo a mano.
4. **Ventana offline corta.** La caché de licencia firmada caduca en pocos minutos; pasada la ventana, exige conexión.

> Decisión de implementación: usar `Microsoft.Win32.Registry` para leer/escribir la marca. No depender de la hora del sistema para ninguna decisión de acceso definitiva.

---

## 7. Catálogo y descargas

### 7.1 Consolas como entidad de primera clase (juego → consola correcta)

Las consolas viven en la tabla `systems` (lista cerrada). `games.system_id` es **FK** a ella. Tres capas evitan asignar un juego a la consola equivocada:

1. **FK en DB.** Insertar un juego con `system_id` inexistente falla. No existen consolas fantasma.
2. **Dropdown en el admin.** Al añadir un juego se elige la consola de la lista existente, nunca con texto libre. No se puede crear "nintendo" mal escrito.
3. **Validación de extensión.** Cada `system` declara `extensions`. Al subir la ROM, si su extensión no está en la lista de esa consola → rechazo (atrapa "subí un `.gba` a NES").

Cada `system` guarda `retrobat_folder` + `default_core`: el cliente coloca la ROM en `roms\<retrobat_folder>` y la lanza con el core correcto, sin adivinar.

### Catálogo
- `GET /catalog` — lista de juegos visibles según el estado de licencia (trial → solo `trial_eligible`; suscrito → todo).

### Descargas
- `POST /download/url` — body: `{ game_id }`. El Worker valida la licencia y devuelve una **URL presignada de R2** con expiración corta.
- Generación de la URL presignada en el Worker: `aws4fetch` (`AwsClient` con `signQuery: true`) o `@aws-sdk/s3-request-presigner` contra el endpoint S3 de R2, con `X-Amz-Expires` corto (p.ej. 300 s). Credenciales S3 de R2 guardadas como secrets del Worker.
- El cliente pasa la URL a **aria2** (empaquetado como binario junto al .exe).
- aria2 permite:
  - Descargas múltiples simultáneas.
  - Reanudación tras corte.
  - Límite de velocidad opcional (**apagado por defecto**).
- El cliente verifica el hash del archivo descargado antes de marcar el juego como instalado.

> Las URLs firmadas evitan exponer las ROMs públicamente: solo un usuario con licencia válida obtiene una URL, y caduca rápido.

---

## 8. Seguridad del cliente y anti-abuso

### 8.1 Identidad de máquina multicapa

Ninguna señal identifica por sí sola; el conjunto sí. Se recogen varias capas y se envían al servidor como un paquete de señales (no solo un hash):

**Capa de hardware / SO (Windows):**
- `MachineGuid` del Registro (`HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`) — ancla principal.
- Combo de hardware vía WMI: modelo de CPU, nº de núcleos, RAM total, serial del disco (`Win32_DiskDrive`), serial de placa (`Win32_BaseBoard`), dirección MAC, resolución de pantalla.
- `fingerprint = SHA-256(MachineGuid + combo)`.

> Por qué el combo y no un solo valor: los scripts de "reset de trial" sobrescriben siempre los mismos archivos/claves. Cuantas más señales independientes, más caro falsificarlas todas de forma coherente.

**Capa de red (lado servidor, el cliente no la controla):**
- IP de origen, rango del ISP, si viene de datacenter o VPN conocida, zona horaria, idioma del sistema.
- Señal fuerte: N cuentas nuevas desde la misma IP residencial en poco tiempo → salta solo.

**Fricción en el registro (opcional, decidir nivel):**
- Bloqueo de dominios de correo desechables.
- Verificación por teléfono (un número cuesta dinero y es finito, a diferencia de un correo).
- Tarjeta sin cobro al activar el trial — brutalmente efectivo: limita los intentos al número de tarjetas reales de la persona. Decisión de negocio (TBD, puede sumar fricción legítima).

### 8.2 Scoring silencioso (no bloqueo instantáneo)

Regla de oro del diseño anti-abuso:

> **No bloquear en el momento del registro. Puntuar en silencio.**

Si se bloquea al instante, se le da al abusador un canal de feedback inmediato: prueba, falla, ajusta, repite hasta pasar. En cambio, si se deja crear la cuenta y luego se **degrada** (menos ancho de banda, cola de descarga más lenta, catálogo recortado, o marca para revisión manual), el abusador no sabe qué señal lo delató, y se rompe el ciclo de prueba y error.

Implementación:
- El servidor corre **correlaciones después del registro**, no solo en el momento: mismo fingerprint, misma IP, mismo patrón horario, mismos juegos/paths.
- La regla `UNIQUE(device_fingerprint)` en `trials` es la capa dura; el score es la capa blanda que atrapa lo que esquiva el hash.
- Guardar un campo `abuse_score` y un estado `under_review` en `users`/`devices`; la degradación es gradual, no un portazo.

### 8.3 Protección de secretos y comunicación (cliente)

- **Almacenamiento de secretos:** token de sesión y marca de tiempo en Registro, protegidos con **DPAPI** (`ProtectedData`, ámbito `CurrentUser`). Atados al usuario de Windows; no portables a otra máquina sin re-login.
- **Comunicación:** solo HTTPS. Pin del certificado opcional (v2).
- **No confiar en el cliente:** toda validación crítica (licencia, trial, descarga) se repite en el servidor.

---

## 9. Pagos / facturación

- `POST /billing/checkout` — crea una sesión de pago en el proveedor, devuelve URL.
- `POST /billing/webhook` — recibe eventos del proveedor (pago exitoso, renovación, fallo, cancelación) y actualiza `subscriptions`.
- **Cancelación:** efecto **inmediato** (decisión de negocio ya tomada). Al cancelar, `status = canceled` y el acceso al catálogo completo se corta al instante.

### TBD (no bloquea el MVP)
- Proveedor de pagos concreto.
- Nombres y precios de los planes (mensual/anual, tiers).

---

## 10. Panel de administración (web)

Web separada del launcher, para el dueño. Login propio de admin (cuenta en tabla `admins`, no es el OAuth de los usuarios). Capacidades:

- **Usuarios:** ver registrados, su estado (trial / suscrito / expirado), su dispositivo y `abuse_score`.
- **Gestión de tiempo:** extender o cambiar el periodo de prueba de un usuario a algo más funcional; otorgar tiempo manual. Un plan de pago da más tiempo automáticamente.
- **Actualización automática:** el estado del usuario en el launcher se refresca solo contra `GET /license/status`; cualquier cambio del admin aplica sin reinstalar.
- **Analítica:** ranking de juegos más jugados (desde `play_events`), seguimiento de uso.
- **Juego temporal free:** marcar un juego como gratis para usuarios free durante unos días (setea `free_from`/`free_until`). Al expirar la ventana, sale del catálogo free solo.
- **Consolas y juegos:** ver todas las consolas (`systems`); dentro de cada consola, añadir un juego. La consola se elige de un **dropdown** (lista cerrada), nunca texto libre → imposible asignar a consola equivocada (ver §7.1). La subida valida la extensión contra las permitidas de esa consola.
- **Designar administradores:** promover a un usuario existente a admin (lo inserta en `admins` por su email). Solo un admin puede hacerlo.
- **Seguimiento en vivo:** ver qué usuario está jugando qué juego (desde `play_events`).
- **Descuentos y promos:** TBD (etapa posterior).

Endpoints `/admin/*` protegidos por sesión de admin (ver tabla §11). Toda acción de admin se registra para auditoría.

### Elegibilidad efectiva en trial / free

Un usuario sin suscripción puede jugar un juego si:

```
trial_eligible = 1
  OR (free_from <= now AND now <= free_until)   -- ventana temporal del admin
```

---

## 11. API — resumen de endpoints

| Método | Ruta | Auth | Función |
|--------|------|------|---------|
| POST | `/auth/exchange` | — (PKCE) | Intercambia `code`+`code_verifier`, emite sesión |
| POST | `/auth/refresh` | refresh | Renueva token |
| POST | `/auth/logout` | sesión | Revoca sesión |
| POST | `/license/activate-trial` | sesión | Activa trial (regla anti-farm) |
| GET | `/license/status` | sesión | Estado efectivo de licencia |
| GET | `/catalog` | sesión | Catálogo según licencia (incluye ventana free) |
| POST | `/download/url` | sesión | URL firmada de R2 |
| POST | `/play/event` | sesión | Registra inicio/fin de partida (analítica) |
| POST | `/billing/checkout` | sesión | Sesión de pago |
| POST | `/billing/webhook` | firma del proveedor | Eventos de pago |
| GET | `/admin/users` | admin | Lista/busca usuarios |
| POST | `/admin/users/:id/grant` | admin | Extiende/cambia trial o tiempo |
| GET | `/admin/analytics/top-games` | admin | Juegos más jugados |
| GET | `/admin/analytics/now-playing` | admin | Quién juega qué ahora |
| GET | `/admin/systems` | admin | Lista de consolas |
| POST | `/admin/systems` | admin | Crea/edita consola |
| POST | `/admin/games` | admin | Añade juego (valida `system_id` + extensión) |
| POST | `/admin/games/:id/free-window` | admin | Setea `free_from`/`free_until` |
| POST | `/admin/admins` | admin | Promueve usuario a admin |

---

## 12. Decisiones pendientes (TBD)

| # | Tema | Default asumido mientras tanto |
|---|------|-------------------------------|
| 1 | Nombres y precios de planes | — (pendiente) |
| 2 | Qué juegos son `trial_eligible` | Flag por juego; lo define el negocio |
| 3 | Proveedor de pagos | — (pendiente) |
| 4 | Dominio propio | `tuapp.workers.dev` hasta el lanzamiento |
| 5 | Tolerancia del fingerprint a cambios de hardware | Ancla en `MachineGuid` + score por combo; sin match exacto rígido |
| 6 | Juego rotativo 24 h en trial | Fuera del MVP (v2) |
| 7 | Al expirar el trial sin pago, ¿quedan juegos jugables? | Solo `trial_eligible`, o ninguno |
| 8 | Nivel de fricción en registro (teléfono / tarjeta sin cobro) | Solo bloqueo de dominios desechables en MVP; tarjeta = v2 |
| 9 | Umbrales de `abuse_score` y tipo de degradación | Marcar `under_review`; definir pesos y acción al implementar |
| 10 | Métodos de pago por país | No definido; se decide tras tener el core armado |
| 11 | Sistema de descuentos / promos | Etapa posterior |

---

## 13. Fase 0 — Preparación del entorno y estrategia de trabajo

Fase previa a cualquier código de funcionalidad. Objetivo: dejar el entorno listo para que Claude trabaje rápido y en paralelo, con interacción del usuario solo en puntos muy concretos (logins, aprobaciones, pegar tokens).

### 13.0.1 Repositorio y control de versiones

- `git init`; crear repo **privado** en GitHub y push inicial.
- `.gitignore`: `node_modules/`, `.env`, `.dev.vars`, `.wrangler/`, artefactos de build de .NET (`bin/`, `obj/`), ROMs locales, binarios de aria2.
- Monorepo con workspaces (pnpm): crear las carpetas `/backend`, `/admin-web`, `/client`, `/shared` con README placeholder cada una.
- Trabajo en ramas por feature; `main` protegida. Conventional Commits.

### 13.0.2 Servicios y cuentas (interacción puntual del usuario, vía navegador)

Claude abre el navegador (Playwright / extensión) para guiar estos pasos; el usuario solo hace login, aprueba y pega tokens:

- **Cloudflare:** `wrangler login`; crear Worker, base de datos **D1**, bucket **R2**, proyecto **Pages**. Guardar account id.
- **Google Cloud Console:** proyecto OAuth; crear **OAuth client tipo "Desktop app"**; registrar el redirect loopback. Guardar client id (+ secret, usado por el Worker).
- **GitHub:** repo privado + PAT para push/CI.
- **Tokens que proveerá el usuario:** Cloudflare API token, GitHub PAT, Google client id/secret. Todos como secrets, nunca commiteados.

### 13.0.3 Herramientas y configuración base

- Node + **pnpm**, **wrangler**, **drizzle-kit** (ORM/migraciones para D1), **.NET 8 SDK**.
- Archivos base: `package.json` (workspaces), `wrangler.toml` (bindings D1/R2), `drizzle.config.ts`, `tsconfig.json`, linter/formatter (Biome o ESLint+Prettier).
- Secrets locales en `.dev.vars`; producción con `wrangler secret put`.

### 13.0.4 Estrategia multiagente (paralelismo sin choques)

Regla central: **los agentes nunca escriben en el mismo archivo a la vez.** Dos mecanismos:

1. **Aislamiento por git worktree.** Cada agente de trabajo corre en su propio worktree (`isolation: "worktree"`) → copias independientes del repo, sin pisarse; se mergean al terminar.
2. **Scope por módulo.** Fronteras del monorepo = fronteras de agente:
   - `agente-backend` → solo `/backend`
   - `agente-admin` → solo `/admin-web`
   - `agente-client` → solo `/client`

**Orden obligatorio para habilitar el paralelismo:**

1. Primero se definen y commitean los **contratos de API en `/shared`** (tipos de request/response, esquema). Se "congelan".
2. Recién entonces se lanzan en paralelo `agente-backend`, `agente-admin`, `agente-client`, cada uno contra esos contratos.
3. Un paso de **integración** (agente o hilo principal) revisa, mergea los worktrees y corre los gates.

> Si un contrato de `/shared` cambia a mitad, se detiene el fan-out, se re-congela y se re-sincroniza. No se edita `/shared` desde un agente de módulo.

### 13.0.5 Gates de calidad (antes de cada merge)

Typecheck + lint/format + tests del módulo. CI opcional en GitHub Actions. Nada se mergea a `main` con gates en rojo.

---

## 14. Orden de implementación sugerido (MVP)

> **Paso 0 = Fase 0 (§13)**: repo, servicios, herramientas, estrategia multiagente. Completar antes de lo siguiente.

1. `/shared`: contratos de API + esquema (se congela antes del fan-out).
2. Backend: esquema D1 + endpoints `/auth/exchange`, `/auth/refresh` y `/license/status`.
3. Cliente: login Google OAuth (loopback + PKCE) + fingerprint + mostrar estado de licencia.
4. Backend: `/license/activate-trial` con regla anti-farm.
5. Cliente: anti-tamper de reloj (marca en Registro + validación server).
6. Backend: tabla `systems` + seed de consolas RetroBat; catálogo + `/download/url` con R2 presignado + ventana free.
7. Cliente: integración aria2 (descargas múltiples) + lanzar emulador RetroBat (usa `retrobat_folder`/`default_core`) + `POST /play/event`.
8. Panel de administración web: login admin, usuarios, grant de tiempo, consolas+juegos (dropdown+validación de extensión), top-games, now-playing, ventana free, promover admin.
9. Pagos: `/billing/*` + webhook.
10. Dominio propio + ajuste del redirect URI en Google Cloud.
