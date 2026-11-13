# CLAUDE.md — Launcher RetroBat (licencias + trial)

Guía operativa para cualquier sesión de Claude Code en este proyecto. Léela entera antes de tocar nada.

## Qué es esto

Launcher de escritorio Windows sobre RetroBat que distribuye juegos retro por suscripción, con login Google, prueba de 7 días, anti-abuso de cuentas y panel de administración web.

**La fuente de verdad del diseño es `SPEC.md`.** Es el roadmap completo (arquitectura, modelo de datos, endpoints, lógica de trial, anti-abuso, orden de implementación en §13). Antes de implementar un paso, lee la sección correspondiente del spec.

## Stack (100 % Cloudflare)

- **API backend:** Cloudflare Workers.
- **Web de administración:** Cloudflare Pages (consume la misma API de Workers).
- **Base de datos:** Cloudflare D1 (SQLite). No se pausa por inactividad.
- **Almacenamiento de ROMs:** Cloudflare R2 (egress $0), servidas con URLs presignadas de expiración corta.
- **Trabajos programados:** Cloudflare Cron Triggers (abuse-scoring, mantenimiento).
- **Cliente:** C# / .NET 8 + WPF, Windows. Integra RetroBat, aria2, Registro de Windows.
- **Auth:** Google OAuth 2.0, Authorization Code + PKCE con redirect loopback (RFC 8252).
- **Herramientas:** `wrangler` (Workers/D1/R2/Pages), `dotnet` (cliente).

## Estructura (monorepo)

```
/backend      Workers: /routes /services /db /lib   (ver SPEC §2.1)
/admin-web    Pages (panel del dueño)
/client       WPF .NET 8: /Core /Services /UI (MVVM)
/shared       contratos/tipos de la API compartidos
SPEC.md       roadmap y diseño (fuente de verdad)
CLAUDE.md     este archivo
```

## Principios de código (obligatorios)

- **Modularidad ante todo.** Límites claros, acoplamiento bajo. La lógica de negocio no conoce HTTP ni UI.
- **Consolas, planes y reglas de abuso son datos/config, no código embebido.** Añadir una consola o un plan no debe tocar el core.
- **El cliente nunca es la fuente de verdad.** Toda decisión de licencia/trial/descarga se valida en el servidor.
- Contratos de API versionados en `/shared` para que cliente y backend no se desincronicen.
- Migraciones de D1 versionadas.
- Código, comentarios, nombres y mensajes de commit en **inglés**. Conversación con el usuario en **español**.

## Trabajo en paralelo (multiagente, sin choques)

Regla central: **dos agentes nunca escriben el mismo archivo a la vez.** Detalle en `SPEC.md §13.0.4`.

- **Aislamiento por git worktree:** cada agente de trabajo corre con `isolation: "worktree"` (copia propia del repo), se mergea al terminar.
- **Scope por módulo:** `agente-backend`→`/backend`, `agente-admin`→`/admin-web`, `agente-client`→`/client`. Un agente no sale de su carpeta.
- **Orden para habilitar el fan-out:** (1) definir y **congelar** los contratos en `/shared`; (2) lanzar los agentes de módulo en paralelo; (3) integración + gates + merge.
- `/shared` **nunca** se edita desde un agente de módulo. Si cambia, se detiene el fan-out y se re-sincroniza.
- Gates antes de cada merge: typecheck + lint/format + tests. Nada entra a `main` en rojo.
- Claude puede abrir el navegador (Playwright / extensión) para dashboards (Cloudflare, Google Cloud, GitHub). El usuario interviene solo en logins, aprobaciones y pegar tokens.

## Flujo de trabajo

1. Trabaja **paso a paso** siguiendo el orden de `SPEC.md §14` (y completa antes la **Fase 0 / §13**). Un paso a la vez; confirma antes de saltar de fase.
2. **Commitea y pushea de forma incremental** al completar cada pieza funcional, con Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). No acumular cambios enormes en un solo commit.
3. **Documenta conforme avanzas, pero sin exceso** (para no sobrecargar el contexto): actualiza `SPEC.md`/README solo cuando cambie una decisión de diseño real.
4. No trabajes en `main` directo: rama por feature.
5. El setup inicial (repo GitHub, dashboards de Cloudflare, Google Cloud Console) se hará con el usuario, posiblemente abriendo páginas con Playwright. El usuario proveerá tokens cuando haga falta.

## Secretos y tokens

- **Nunca** commitear secretos. R2 keys, client secret de Google, JWT secret → `wrangler secret put` (prod) y `.dev.vars` (local, en `.gitignore`).
- `.env`, `.dev.vars`, credenciales y tokens siempre en `.gitignore`.
- No poner datos personales del usuario en requests a servicios externos sin permiso.

## Primer administrador

El dueño (primer admin) se siembra a mano en la tabla `admins` de D1. Desde el panel, un admin puede promover a otros usuarios.

## Pendientes clave (ver SPEC §12)

Precios/nombres de planes, proveedor de pagos, métodos de pago por país, umbrales de `abuse_score`, nivel de fricción en registro, descuentos. No bloquean el MVP.
