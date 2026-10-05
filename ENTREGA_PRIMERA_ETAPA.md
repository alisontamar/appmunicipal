# Acta de Entrega — Primera Etapa
### Software de Seguridad Ciudadana — Gobierno Autónomo Municipal de Cochabamba

> Borrador de trabajo para completar/corregir `SOLICITUD DR.docx`. Los bloques
> marcados con **[COMPLETAR: ...]** son datos que solo ustedes pueden llenar
> (fechas, nombres, CI, horas de capacitación). Todo lo demás ya está corregido
> contra el estado real del repo (`README.md`, `CORRECCIONES.md`, `.env`).

**Fecha:** [COMPLETAR: ej. 22 de septiembre de 2026]
**Dirigido a:** [COMPLETAR: nombre/cargo del destinatario en la Dirección de Seguridad Ciudadana]

---

## 1. Objeto

Solicito se pueda colaborar con la realización de un documento que tiene por
objeto formalizar la entrega de la Primera Etapa del Software de Seguridad
Ciudadana, así como la documentación técnica correspondiente y el plan de
transferencia de conocimiento tipo open source para el personal operativo de
seguridad ciudadana del Gobierno Autónomo Municipal de Cochabamba.

## 2. Alcance del proyecto y delimitación de la Primera Etapa

El proyecto ha sido estructurado en fases para garantizar una implantación
progresiva y eficiente. El alcance específico de esta entrega comprende:

- **Módulo implementado:** Registro y Control de Guardias Municipales, compuesto
  por:
  - **App móvil** (Android, Expo/React Native) para el guardia en campo: inicio
    y cierre de turno con verificación por cámara, geolocalización en vivo,
    registro de incidentes y mandados/tareas, botón de alerta SOS, mapa de la
    ronda e historial de turnos.
  - **Panel web** de monitoreo y control operativo para el personal
    administrativo (alta de guardias, asignación de rutas, seguimiento en
    tiempo real, atención de alertas SOS).
- **Estado de la entrega:** el sistema se entrega funcional, habiendo superado
  pruebas de integración entre la app móvil, el panel web y el backend. Quedan
  identificadas mejoras menores de robustez (detalladas en la sección de notas
  técnicas) que no bloquean el uso operativo de esta primera etapa.
- **Infraestructura y alojamiento:** el software se encuentra desplegado y
  operativo sobre los siguientes servicios en la nube:
  - **Vercel** — hosting del panel web.
  - **Render** — hosting del backend/API.
  - **Supabase** — base de datos, autenticación, almacenamiento de evidencias
    (fotos/video) y funciones de borde (recuperación de contraseña).
- **Fases posteriores:** posterior a la validación e implantación de esta
  primera etapa, se dará continuidad al desarrollo del sistema mediante una
  Segunda Etapa, en la cual se integrarán nuevos módulos y funcionalidades
  complementarias.

## 3. Componentes y entregables incluidos

En el marco de esta entrega, se ponen a disposición los siguientes componentes:

**Plataforma de software (acceso funcional):**
- App móvil de Registro y Control de Guardias Municipales (turnos, incidentes,
  mandados, SOS, mapa en vivo).
- Panel web de monitoreo y administración.
- Gestión de perfiles, roles y permisos de acceso al sistema.

**Manual de usuario:**
- Guía detallada con capturas de pantalla y explicaciones paso a paso para el
  uso correcto de las funciones del sistema (app móvil y panel web).
- Procedimientos de solución de dudas frecuentes y buenas prácticas de uso.

**Plan de capacitación:**
- Capacitación al personal operativo/técnico: dirigido a administradores y
  personal encargado del control administrativo de los guardias (uso del
  panel web).
- Capacitación a usuarios finales: sesiones prácticas dirigidas al personal de
  campo o guardias municipales que interactuarán directamente con la app
  móvil.

## 4. Plan de capacitaciones propuesto

| Módulo / Público objetivo | Contenido principal | Modalidad / Duración |
|---|---|---|
| Administradores y personal técnico | Gestión de usuarios, asignación de rutas, seguimiento en tiempo real, atención de alertas SOS, generación de reportes | Teórico-práctico ([COMPLETAR: X horas]) |
| Usuarios finales / guardias municipales | Uso de la app móvil, inicio/cierre de turno, registro de incidentes y mandados, uso del botón SOS | Práctico ([COMPLETAR: X horas]) |

## 5. Próximos pasos y continuidad

Con la recepción y conformidad de esta primera etapa:

- Se iniciará el ciclo de capacitaciones de acuerdo con el cronograma
  acordado.
- Se coordinará la reunión de inicio (kick-off) para la planificación de la
  Segunda Etapa del sistema.

## 6. Notas técnicas (transparencia para la entrega)

- El seguimiento en tiempo real (mapa, SOS, rutas asignadas) funciona por
  *polling* (consultas periódicas), no por notificación push instantánea; hay
  un pequeño delay entre que algo cambia en el panel web y que el guardia lo
  ve en la app (y viceversa).
- El GPS en segundo plano (app minimizada o pantalla apagada) requiere una
  build nativa de la app (APK) (no funciona en Expo Go); a la fecha de esta entrega
  el seguimiento se valida con la app en primer plano.
- El modo sin conexión (guardar y sincronizar después) está limitado a la cola
  de reintentos de pings de ubicación; no cubre aún todos los flujos
  (incidentes/mandados) sin señal.

---

## Equipo de desarrollo

Atentamente,

**EQUIPO DE DESARROLLO**

| Nombre | CI |
|---|---|
| Rodrigo Kevin Pacheco Halsey| [COMPLETAR] |
| [Alison tamara Gomez Villavicencio] | [COMPLETAR] |
| Cristian Alejandro Rios Romero | [COMPLETAR] |
| Leonardo Zenon Sejas Mamani | [COMPLETAR] |
