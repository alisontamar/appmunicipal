# Base de Datos ÚNICA — App móvil de guardias + Plataforma web GAMC

Documento de reconciliación. Toma las **12 tablas** del `Resumen_BD_Web_GAMC.pdf` y
las corrige/completa para que **la app móvil y la web usen la misma base**.

Regla de oro del modelo:

- **Las cuentas se crean SOLO desde la web.** El Super Admin registra `user` (web) y
  `guardia` (campo). La app **no** tiene endpoint de registro: su primer contacto es
  el login, que además **activa** al guardia (fija su contraseña) en el primer acceso.
- El móvil **escribe** `turno`, `guardia_telemetria`, `hecho`, `hecho_evidencia`, `mandado`.
- El móvil **solo lee** `epi`, `ruta_plantilla`, `patrulla`, `zona_critica_activa`, y su propio `guardia`.
- El móvil **nunca** toca `user`, `role`, `role_permission`, `audit_log` (el `audit_log`
  lo escribe la capa API, no el cliente).

---

## 1. Quién escribe / quién lee

| Tabla | Web escribe | Móvil escribe | Móvil lee |
|---|:--:|:--:|:--:|
| `epi` | ✅ | — | ✅ |
| `role`, `role_permission` | ✅ | — | — |
| `user` | ✅ (solo Super Admin crea) | — | — |
| `guardia` | ✅ (crea/activa/desactiva) | ✅ solo su `password_hash` + `estado` en la activación | ✅ (su ficha) |
| `tipo_hecho` | ✅ | — | ✅ (catálogo del formulario) |
| `ruta_plantilla` | ✅ | — | ✅ |
| `patrulla` | ✅ (asigna) | ✅ solo `estado`/`turno_id` al iniciar-cerrar | ✅ (su patrulla del día) |
| `turno` | — | ✅ | ✅ |
| `guardia_telemetria` | ✅ solo campos `sos_*` al atender | ✅ (GPS ~30 s + SOS) | — |
| `hecho`, `hecho_evidencia` | ✅ solo `estado`/`estado_cambiado_*` | ✅ (alta) | ✅ (su historial) |
| `mandado` | — | ✅ | ✅ (su historial) |
| `zona_critica_activa` | ✅ (job) | — | ✅ (mapa de calor, opcional) |
| `audit_log` | ✅ (API) | — | — |

---

## 2. Correcciones respecto al PDF

| # | Problema detectado | Corrección en esta BD |
|---|---|---|
| 1 | La app maneja **mandados** (modelo, API, pantalla, historial) y la web **no tenía tabla**. | Se agrega `mandado` (la llena el móvil, la web solo lee). |
| 2 | La app enviaba el **SOS por un endpoint aparte** (`AlertaSos`), la web lo modeló como bandera en telemetría. | Se unifica: `guardia_telemetria.es_sos` + `sos_estado`/`sos_atendido_por`/`sos_atendido_en`. **La app deja de usar `api/sos.ts` como entidad**: el SOS es una fila de telemetría con `es_sos = true`. |
| 3 | La app guardaba `recorrido[]` y `distanciaMetros` **dentro del turno**. | El recorrido vive en `guardia_telemetria`. `turno.distancia_metros` lo calcula la API al cerrar con `fn_turno_distancia()`. |
| 4 | `Guardia.distrito` era **texto libre** (`"Distrito 10 - EPI Sur"`). | `guardia.epi_id` → FK a `epi`. Se elimina el texto libre. |
| 5 | La web asume **activación en el primer login del móvil**, pero `auth.login` de la app no lo hace. | `guardia.estado = 'pendiente_activacion'` + `activacion_token`. Flujo de activación en la sección 5. |
| 6 | **Catálogo de tipos de hecho** distinto entre app (`robo/asalto/violencia/accidente/disturbio/otro`) y web (`atraco/robo/hurto…`). | Tabla `tipo_hecho` administrable desde la web; la app la consume. `hecho.tipo_hecho_id` en vez de enum fijo. |
| 7 | La app **no tiene modelo de patrulla/ruta**; el mapa usa un polígono fijo (`mockZonaAsignada`). | `patrulla` + `ruta_plantilla` + vista `v_patrulla_vigente`. El móvil pide su patrulla del día. |
| 8 | Recuperación de contraseña (RF-APP-02) sin soporte. | Tabla `password_reset` (sirve para `user` y `guardia`). |
| 9 | `Incidente.evidenciaUrls[]` (varias URLs) sin lugar definido. | Tabla hija `hecho_evidencia` (`foto`/`video`). |
| 10 | Estados / enums sin acordar. | Enums fijados: `turno_estado`, `patrulla_estado`, `hecho_estado`(=`reportado/en_revision/cerrado`, igual que la app), `nivel_riesgo`(`bajo/medio/alto/muy_alto`). |
| 11 | Intervalo GPS: app 15 s / 25 m vs web ~30 s. | Se documenta **30 s / 30 m** como objetivo; es config del cliente, no de esquema. |
| 12 | IDs `string` arbitrarios en la app. | Todos los PK son `uuid` (`gen_random_uuid()`). Timestamps `timestamptz` en UTC ISO-8601. |

Nota geometría: polígonos y trazados van como `jsonb` (`[[lng,lat], …]`) para que el
script corra en PostgreSQL puro. Para consultas espaciales reales (punto-en-`epi`,
cálculo de `zona_critica_activa`) se recomienda migrar esas columnas a **PostGIS**
(`geometry(Polygon,4326)` / `geography(Point,4326)`).

---

## 3. Mapeo de nombres app ↔ BD

| App (`src/types`, `src/api`) | BD |
|---|---|
| `Guardia.distrito` | `guardia.epi_id` (→ `epi.nombre`) |
| `Guardia.rol` (etiqueta) | *(se elimina; el rol web es de `user`, no de `guardia`)* |
| `Turno.fotoInicioUrl` | `turno.selfie_inicio_url` |
| `Turno.ubicacionInicio` / `horaInicio` | `turno.lat_inicio` + `lng_inicio` + `hora_inicio` |
| `Turno.ubicacionFin` / `horaFin` | `turno.lat_fin` + `lng_fin` + `hora_fin` |
| `Turno.recorrido[]` | filas de `guardia_telemetria` (`turno_id`) |
| `Turno.distanciaMetros` | `turno.distancia_metros` (calculado al cerrar) |
| `Incidente` | `hecho` |
| `Incidente.tipo` | `hecho.tipo_hecho_id` (→ `tipo_hecho.codigo`) |
| `Incidente.nivelRiesgo` | `hecho.nivel_riesgo` |
| `Incidente.evidenciaUrls[]` | `hecho_evidencia.url` |
| `Incidente.estado` | `hecho.estado` (`reportado/en_revision/cerrado`) |
| `Mandado` | `mandado` |
| `AlertaSos` (`api/sos.ts`) | `guardia_telemetria` con `es_sos = true` |
| `enviarUbicacion(turnoId, punto)` | `insert into guardia_telemetria` |
| `mockZonaAsignada` | `v_patrulla_vigente.trazado` (de `ruta_plantilla`) |

---

## 4. Script SQL (PostgreSQL 14+)

Ejecutar una sola vez sobre una base vacía:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f bd_unificada.sql
```

```sql
-- =============================================================================
-- GAMC · Seguridad Ciudadana — Base de datos ÚNICA (app móvil + plataforma web)
-- PostgreSQL 14+   ·   snake_case · PK uuid · timestamptz UTC (ISO-8601)
-- Polígonos/trazados: jsonb [[lng,lat], ...] (WGS84). Ver NOTA PostGIS en el .md.
-- =============================================================================
begin;

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. TIPOS ENUM
-- ---------------------------------------------------------------------------
create type user_estado     as enum ('activo','inactivo','suspendido');
create type guardia_estado  as enum ('pendiente_activacion','activo','inactivo','suspendido');
create type turno_estado    as enum ('en_servicio','finalizado','anulado');
create type patrulla_estado as enum ('asignada','en_curso','completada','cancelada');
create type hecho_estado    as enum ('reportado','en_revision','cerrado');
create type nivel_riesgo    as enum ('bajo','medio','alto','muy_alto');
create type sujeto_auth     as enum ('user','guardia');
create type evidencia_tipo  as enum ('foto','video');

-- ---------------------------------------------------------------------------
-- 2. CATÁLOGOS / CONFIGURACIÓN  (los administra la WEB)
-- ---------------------------------------------------------------------------

-- 2.1 EPI — 5 jurisdicciones de Cochabamba
create table epi (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,          -- norte|central|sud|cona_cona|centro_cercado
  nombre     text not null,
  poligono   jsonb,                         -- [[lng,lat], ...] ; null hasta cargar el oficial
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.2 Roles de la plataforma WEB (NO aplica a guardias)
create table role (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,         -- super_admin|admin|operador_monitoreo
  nombre      text not null,
  descripcion text
);

-- 2.3 Matriz de permisos por rol
create table role_permission (
  id             uuid primary key default gen_random_uuid(),
  role_id        uuid not null references role(id) on delete cascade,
  recurso        text not null,             -- usuarios|guardias|roles|hechos|patrullaje|mapas|auditoria|reportes
  puede_ver      boolean not null default false,
  puede_crear    boolean not null default false,
  puede_editar   boolean not null default false,
  puede_eliminar boolean not null default false,
  unique (role_id, recurso)
);

-- 2.4 Catálogo de tipos de hecho  (resuelve el desfase de catálogos app/web)
create table tipo_hecho (
  id     uuid primary key default gen_random_uuid(),
  codigo text not null unique,              -- robo|asalto|atraco|hurto|violencia|...
  label  text not null,
  activo boolean not null default true,
  orden  int not null default 100
);

-- ---------------------------------------------------------------------------
-- 3. USUARIOS
-- ---------------------------------------------------------------------------

-- 3.1 Usuarios WEB — creados SOLO por Super Admin desde la web
create table "user" (
  id                    uuid primary key default gen_random_uuid(),
  role_id               uuid not null references role(id),
  nombre                text not null,
  email                 text not null unique,
  usuario               text not null unique,
  password_hash         text not null,
  estado                user_estado not null default 'activo',
  debe_cambiar_password boolean not null default true,
  creado_por            uuid references "user"(id),
  ultimo_login          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- 3.2 Guardias — registrados por Super Admin en la WEB,
--     activados en el 1er login del MÓVIL (fijan su contraseña).
create table guardia (
  id                    uuid primary key default gen_random_uuid(),
  epi_id                uuid references epi(id),     -- reemplaza el "distrito" texto libre de la app
  nombre                text not null,
  ci                    text unique,                 -- carné de identidad
  usuario               text not null unique,
  password_hash         text,                        -- null hasta la activación
  telefono              text,
  foto_url              text,
  fecha_nacimiento      date,                        -- agregado a pedido del equipo web
  estado                guardia_estado not null default 'pendiente_activacion',
  activacion_token      text,                        -- lo entrega la web al crear la cuenta
  activacion_expira     timestamptz,
  debe_cambiar_password boolean not null default true,
  creado_por            uuid not null references "user"(id),
  activado_en           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index ix_guardia_epi on guardia (epi_id);

-- 3.3 Recuperación de contraseña (web y app)
create table password_reset (
  id          uuid primary key default gen_random_uuid(),
  sujeto_tipo sujeto_auth not null,
  sujeto_id   uuid not null,
  codigo_hash text not null,
  expira_en   timestamptz not null,
  usado       boolean not null default false,
  created_at  timestamptz not null default now()
);
create index ix_password_reset_sujeto on password_reset (sujeto_tipo, sujeto_id) where not usado;

-- ---------------------------------------------------------------------------
-- 4. PATRULLAJE  (lo define la WEB, lo consume el MÓVIL)
-- ---------------------------------------------------------------------------

create table ruta_plantilla (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  epi_id      uuid references epi(id),
  trazado     jsonb,                         -- [[lng,lat], ...] recorrido/polígono sugerido
  activo      boolean not null default true,
  creado_por  uuid references "user"(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table patrulla (
  id                   uuid primary key default gen_random_uuid(),
  guardia_id           uuid not null references guardia(id),
  ruta_plantilla_id    uuid references ruta_plantilla(id),
  epi_id               uuid references epi(id),
  asignado_por         uuid not null references "user"(id),
  estado               patrulla_estado not null default 'asignada',
  fecha                date not null default current_date,
  hora_inicio_prevista time,
  notas                text,
  turno_id             uuid,                 -- FK a turno; se enlaza al iniciar servicio
  iniciada_en          timestamptz,
  completada_en        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index ix_patrulla_guardia_fecha on patrulla (guardia_id, fecha);
create index ix_patrulla_estado on patrulla (estado);

-- ---------------------------------------------------------------------------
-- 5. OPERACIÓN EN CAMPO  (lo escribe el MÓVIL, la web solo lee)
-- ---------------------------------------------------------------------------

-- 5.1 Turno / servicio
create table turno (
  id                uuid primary key default gen_random_uuid(),
  guardia_id        uuid not null references guardia(id),
  patrulla_id       uuid references patrulla(id),
  estado            turno_estado not null default 'en_servicio',
  selfie_inicio_url text not null,
  lat_inicio        double precision not null,
  lng_inicio        double precision not null,
  hora_inicio       timestamptz not null,
  lat_fin           double precision,
  lng_fin           double precision,
  hora_fin          timestamptz,
  distancia_metros  numeric(12,2) not null default 0,  -- la calcula la API al cerrar
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index ix_turno_guardia on turno (guardia_id, hora_inicio desc);
create unique index ux_turno_abierto_por_guardia
  on turno (guardia_id) where estado = 'en_servicio';  -- 1 turno abierto por guardia

alter table patrulla
  add constraint fk_patrulla_turno foreign key (turno_id) references turno(id);

-- 5.2 Telemetría GPS (~30 s) + bandera SOS
--     (unifica el SOS que la app enviaba por un endpoint aparte)
create table guardia_telemetria (
  id               bigserial primary key,
  guardia_id       uuid not null references guardia(id),
  turno_id         uuid references turno(id),
  lat              double precision not null,
  lng              double precision not null,
  precision_m      numeric(8,2),
  velocidad_mps    numeric(8,2),
  bateria_pct      int,
  es_sos           boolean not null default false,
  sos_estado       text,                    -- null|pendiente|atendido|falsa_alarma
  sos_atendido_por uuid references "user"(id),
  sos_atendido_en  timestamptz,
  capturado_en     timestamptz not null,    -- reloj del dispositivo
  recibido_en      timestamptz not null default now()
);
create index ix_tele_turno   on guardia_telemetria (turno_id, capturado_en);
create index ix_tele_guardia on guardia_telemetria (guardia_id, capturado_en desc);
create index ix_tele_sos     on guardia_telemetria (capturado_en desc) where es_sos;

-- 5.3 Hechos delictivos
create table hecho (
  id                  uuid primary key default gen_random_uuid(),
  turno_id            uuid references turno(id),
  guardia_id          uuid not null references guardia(id),
  tipo_hecho_id       uuid not null references tipo_hecho(id),
  descripcion         text not null,
  nivel_riesgo        nivel_riesgo not null,
  lat                 double precision not null,
  lng                 double precision not null,
  epi_id              uuid references epi(id),   -- se resuelve por el punto
  ocurrido_en         timestamptz not null,
  reportado_en        timestamptz not null default now(),
  estado              hecho_estado not null default 'reportado',
  estado_cambiado_por uuid references "user"(id),
  estado_cambiado_en  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index ix_hecho_estado   on hecho (estado);
create index ix_hecho_ocurrido on hecho (ocurrido_en desc);
create index ix_hecho_epi      on hecho (epi_id);

create table hecho_evidencia (
  id         uuid primary key default gen_random_uuid(),
  hecho_id   uuid not null references hecho(id) on delete cascade,
  url        text not null,
  tipo       evidencia_tipo not null default 'foto',
  created_at timestamptz not null default now()
);

-- 5.4 Mandados / comisiones puntuales del turno  (FALTABA en la BD web)
create table mandado (
  id          uuid primary key default gen_random_uuid(),
  turno_id    uuid not null references turno(id),
  guardia_id  uuid not null references guardia(id),
  descripcion text not null,
  lat         double precision not null,
  lng         double precision not null,
  creado_en   timestamptz not null default now()
);
create index ix_mandado_turno on mandado (turno_id);

-- ---------------------------------------------------------------------------
-- 6. DERIVADOS / AUDITORÍA  (los genera la WEB)
-- ---------------------------------------------------------------------------

create table zona_critica_activa (
  id              uuid primary key default gen_random_uuid(),
  epi_id          uuid references epi(id),
  centro_lat      double precision not null,
  centro_lng      double precision not null,
  radio_m         numeric(10,2),
  poligono        jsonb,
  cantidad_hechos int not null,
  nivel_riesgo    nivel_riesgo not null,
  ventana_desde   timestamptz not null,
  ventana_hasta   timestamptz not null,
  vigente         boolean not null default true,
  calculada_en    timestamptz not null default now()
);
create index ix_zona_vigente on zona_critica_activa (vigente) where vigente;

create table audit_log (
  id            bigserial primary key,
  actor_user_id uuid references "user"(id),
  actor_tipo    text not null default 'user',  -- user|guardia|sistema
  accion        text not null,                 -- login|crear_usuario|asignar_ruta|cambiar_estado_hecho...
  recurso       text,
  recurso_id    text,
  detalle       jsonb,
  ip            inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index ix_audit_created on audit_log (created_at desc);
create index ix_audit_actor   on audit_log (actor_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. FUNCIONES Y TRIGGERS
-- ---------------------------------------------------------------------------

-- 7.1 updated_at automático
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['epi','"user"','guardia','ruta_plantilla','patrulla','turno','hecho']
  loop
    execute format(
      'create trigger trg_%s_updated before update on %s
         for each row execute function set_updated_at()',
      replace(t,'"',''), t);
  end loop;
end $$;

-- 7.2 audit_log inmutable
create or replace function audit_log_inmutable() returns trigger as $$
begin
  raise exception 'audit_log es inmutable: % no permitido', tg_op;
end $$ language plpgsql;
create trigger trg_audit_no_update before update or delete on audit_log
  for each row execute function audit_log_inmutable();

-- 7.3 Haversine + distancia total del turno (para cerrar servicio)
create or replace function fn_haversine_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision as $$
  select 2 * 6371000 * asin(sqrt(
    sin(radians(lat2-lat1)/2)^2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2-lng1)/2)^2
  ));
$$ language sql immutable;

create or replace function fn_turno_distancia(p_turno uuid) returns numeric as $$
  with p as (
    select lat, lng,
           lag(lat) over (order by capturado_en) as plat,
           lag(lng) over (order by capturado_en) as plng
    from guardia_telemetria
    where turno_id = p_turno
  )
  select coalesce(round(sum(fn_haversine_m(plat,plng,lat,lng))::numeric, 2), 0)
  from p where plat is not null;
$$ language sql stable;

-- ---------------------------------------------------------------------------
-- 8. VISTAS DE APOYO
-- ---------------------------------------------------------------------------

-- Última posición conocida por guardia (mapa de patrullaje en vivo)
create or replace view v_guardia_ubicacion_actual as
select distinct on (guardia_id)
  guardia_id, turno_id, lat, lng, es_sos, sos_estado, capturado_en
from guardia_telemetria
order by guardia_id, capturado_en desc;

-- SOS sin atender
create or replace view v_sos_pendiente as
select tel.*, g.nombre as guardia_nombre
from guardia_telemetria tel
join guardia g on g.id = tel.guardia_id
where tel.es_sos and coalesce(tel.sos_estado,'pendiente') = 'pendiente'
order by tel.capturado_en desc;

-- Patrulla vigente del guardia (lo que pide el móvil al abrir el mapa)
create or replace view v_patrulla_vigente as
select p.*, r.trazado, r.nombre as ruta_nombre
from patrulla p
left join ruta_plantilla r on r.id = p.ruta_plantilla_id
where p.estado in ('asignada','en_curso') and p.fecha = current_date;

-- ---------------------------------------------------------------------------
-- 9. DATOS SEMILLA
-- ---------------------------------------------------------------------------

insert into role (codigo, nombre, descripcion) values
  ('super_admin',        'Super Administrador',  'Crea cuentas, gestiona roles/permisos, auditoría completa'),
  ('admin',              'Administrador',        'Edita/activa/desactiva usuarios y guardias; no crea cuentas nuevas'),
  ('operador_monitoreo', 'Operador de Monitoreo','Mapas en vivo, rutas, estado de hechos, estadísticas');

insert into role_permission (role_id, recurso, puede_ver, puede_crear, puede_editar, puede_eliminar)
select r.id, x.recurso, x.v, x.c, x.e, x.d
from role r
join (values
  ('super_admin','usuarios',   true,true, true, true),
  ('super_admin','guardias',   true,true, true, true),
  ('super_admin','roles',      true,true, true, true),
  ('super_admin','hechos',     true,false,true, false),
  ('super_admin','patrullaje', true,true, true, true),
  ('super_admin','mapas',      true,false,false,false),
  ('super_admin','auditoria',  true,false,false,false),
  ('super_admin','reportes',   true,false,false,false),
  ('admin','usuarios',   true,false,true, false),
  ('admin','guardias',   true,false,true, false),
  ('admin','roles',      true,false,true, false),
  ('admin','hechos',     true,false,true, false),
  ('admin','patrullaje', true,false,true, false),
  ('admin','mapas',      true,false,false,false),
  ('admin','auditoria',  true,false,false,false),
  ('admin','reportes',   true,false,false,false),
  ('operador_monitoreo','guardias',   true,false,false,false),
  ('operador_monitoreo','hechos',     true,false,true, false),
  ('operador_monitoreo','patrullaje', true,true, true, false),
  ('operador_monitoreo','mapas',      true,false,false,false),
  ('operador_monitoreo','reportes',   true,false,false,false)
) as x(rol,recurso,v,c,e,d) on x.rol = r.codigo;

insert into epi (codigo, nombre) values
  ('norte',          'EPI Norte'),
  ('central',        'EPI Central'),
  ('sud',            'EPI Sud'),
  ('cona_cona',      'EPI Coña Coña'),
  ('centro_cercado', 'EPI Centro Cercado');

insert into tipo_hecho (codigo, label, orden) values
  ('robo','Robo',10), ('asalto','Asalto',20), ('atraco','Atraco',30),
  ('hurto','Hurto',40), ('violencia','Violencia',50), ('accidente','Accidente',60),
  ('disturbio','Disturbio',70), ('vandalismo','Vandalismo',80), ('otro','Otro',999);

-- Super Admin inicial — CAMBIAR email y hash bcrypt antes de usar en real
insert into "user" (role_id, nombre, email, usuario, password_hash, debe_cambiar_password)
select id, 'Super Admin', 'admin@gamc.gob.bo', 'superadmin',
       '$2b$12$REEMPLAZAR_POR_HASH_BCRYPT_REAL', true
from role where codigo = 'super_admin';

commit;
```

---

## 5. Flujo: alta y activación de guardia (usuarios se asignan desde la web)

**Paso 1 — Web (Super Admin crea la cuenta).** No fija contraseña; genera un token.

```sql
insert into guardia (epi_id, nombre, ci, usuario, creado_por,
                     activacion_token, activacion_expira)
values ($epi_id, 'Juan Pérez Mamani', '1234567', 'jperez', $super_admin_id,
        encode(gen_random_bytes(16),'hex'), now() + interval '7 days')
returning id, activacion_token;
```

La web entrega al guardia su `usuario` + `activacion_token` (QR / SMS / en persona).

**Paso 2 — App (primer login).** El guardia ingresa `usuario` + `activacion_token`;
la API valida y le pide crear su contraseña:

```sql
update guardia
set password_hash = $hash_bcrypt,
    estado = 'activo',
    activado_en = now(),
    activacion_token = null,
    activacion_expira = null,
    debe_cambiar_password = false
where usuario = $usuario
  and activacion_token = $token
  and activacion_expira > now()
  and estado = 'pendiente_activacion';
```

**Paso 3 — Logins siguientes.** `usuario` + contraseña normal. Si
`estado <> 'activo'` la API rechaza el acceso (guardia dado de baja/suspendido
desde la web).

**Baja / reactivación (web):** `update guardia set estado = 'inactivo' | 'activo' …`.
La app respeta `estado` en cada login y en el refresh del token.

---

## 6. Checklist de cambios en la app móvil

- `src/types/index.ts`
  - `Guardia`: quitar `distrito` y `rol`; agregar `epiId`, `epiNombre`, `estado`.
  - `Turno`: quitar `recorrido[]`, `incidentes[]`, `mandados[]` embebidos y
    `distanciaMetros` calculado localmente; se obtienen por endpoints aparte.
    Renombrar a `selfieInicioUrl`, `latInicio/lngInicio`, etc. (o mapear en la capa API).
  - `Incidente`: `tipo` → `tipoHechoId` / `tipoCodigo` (viene del catálogo);
    `evidenciaUrls` pasa a colección `hecho_evidencia`.
  - Eliminar la interfaz `AlertaSos` como entidad.
- `src/api/sos.ts` → `POST /telemetria` con `{ es_sos: true, lat, lng, capturado_en }`
  (o `POST /sos` que internamente inserta la fila de telemetría). Ya no hay id de alerta propio.
- `src/api/turnos.ts`
  - `enviarUbicacion`: payload `{ turno_id, lat, lng, capturado_en, bateria_pct?, precision_m? }`.
  - `iniciarServicio`: enlaza la `patrulla` vigente (`patrulla.turno_id`, `estado='en_curso'`).
  - `cerrarServicio`: la API setea `distancia_metros = fn_turno_distancia(id)` y
    `patrulla.estado='completada'`.
  - Intervalo de captura: **30 s / 30 m** (hoy 15 s / 25 m en `utils/location.ts`).
- `src/api/auth.ts`
  - `login`: manejar `estado='pendiente_activacion'` → pantalla "crear contraseña" con token.
  - `requestPasswordReset` / `confirmPasswordReset` → tabla `password_reset`.
- `src/api/incidentes.ts` → `hecho` + `hecho_evidencia`; cargar el catálogo `tipo_hecho`
  al abrir el formulario (reemplaza el arreglo fijo `TIPOS` de `RegisterIncidentScreen`).
- `src/api/mandados.ts` → `mandado` (sin cambios de forma; ya calza).
- `src/screens/map/MapScreen.tsx` → reemplazar `mockZonaAsignada` por
  `GET /patrullas/vigente` (vista `v_patrulla_vigente`, campo `trazado`).
- `src/api/client.ts` → implementar `request()` real (fetch + `Authorization: Bearer <jwt>`).

---

## 7. Notas de integración

- **Auth:** JWT con claim `sub` (uuid) y `tipo` (`user` | `guardia`). La API decide
  permisos: `user` por `role_permission`; `guardia` solo accede a sus propios recursos.
- **Formatos:** todos los `timestamptz` en **UTC ISO-8601** (`2026-09-03T14:20:00Z`).
  Coordenadas en grados decimales WGS84 (`lat`, `lng` separados, no objeto anidado).
- **`hecho.epi_id` y `zona_critica_activa`:** requieren punto-en-polígono. Con `jsonb`
  se resuelve en la capa API; con PostGIS es `ST_Contains(epi.geom, punto)`. Recomendado
  PostGIS en producción para `epi.poligono`, `ruta_plantilla.trazado`,
  `zona_critica_activa.poligono` y un `geography(Point)` generado en `guardia_telemetria`/`hecho`.
- **`zona_critica_activa`:** la llena un job periódico de la web (clustering sobre `hecho`
  de las últimas N horas). El móvil no la escribe; su consumo es opcional (capa "mapa de calor").
- **`audit_log`:** lo escribe siempre la API (no el cliente) en cada acción con efecto:
  login, alta/baja de usuario o guardia, asignación de patrulla, cambio de estado de hecho,
  atención de SOS. Tabla inmutable por trigger.
- **Retención de `guardia_telemetria`:** alto volumen (~2 filas/min por guardia en turno).
  Prever particionado por mes o purga/archivado a los 6–12 meses.

---

## 8. Migración: agregar `fecha_nacimiento` a `guardia`

Si la BD ya fue creada con el script de la sección 4, **no lo vuelvas a correr entero**:
aplica solo el cambio incremental (así deben manejarse todos los cambios futuros —
ver la carpeta `migrations/` recomendada en la sección 9).

```sql
-- migrations/0002_guardia_fecha_nacimiento.sql
alter table guardia
  add column if not exists fecha_nacimiento date;

-- opcional: exigir mayoría de edad
alter table guardia
  add constraint chk_guardia_mayor_edad
  check (fecha_nacimiento is null or fecha_nacimiento <= current_date - interval '18 years');
```

Si estás creando la BD **desde cero**, el `CREATE TABLE guardia` de la sección 4 ya
incluye la columna `fecha_nacimiento date` — no hace falta esta migración.

En la app, el campo es de **solo lectura** (lo carga el Super Admin desde la web al
registrar al guardia): agregar `fechaNacimiento?: string` a la interfaz `Guardia` en
`src/types/index.ts` y una fila más en la tarjeta "Cuenta" de `ProfileScreen.tsx`.

---

## 9. Arquitectura: una sola BD en Postgres para web + móvil (sin Supabase)

Ya que la BD debe quedar en **su propio servidor** (Postgres puro, no Supabase),
la idea clave es esta:

> **No conectes la web y la app directamente a Postgres.** Ninguna de las dos debe tener
> el `usuario`/`contraseña` de la base de datos. Ambas hablan por HTTPS con **un único
> backend API**, y ese backend es el **único** proceso que abre conexión a Postgres.

```
┌────────────┐        HTTPS/JSON        ┌───────────────────┐        libpq (interno)      ┌────────────┐
│  Web (admin│ ───────────────────────▶ │                    │ ───────────────────────────▶│            │
│  /operador)│                          │   Backend API      │                              │ PostgreSQL │
└────────────┘ ◀─────────────────────── │  (Node/Express o   │ ◀────────────────────────────│ (1 sola BD)│
                                         │   NestJS)          │                              │            │
┌────────────┐        HTTPS/JSON        │  - valida JWT      │                              └────────────┘
│  App móvil │ ───────────────────────▶ │  - aplica permisos │        (solo accesible
│  (guardia) │ ◀─────────────────────── │  - único con       │         desde el backend,
└────────────┘                          │    DATABASE_URL    │         puerto 5432 cerrado
                                         └───────────────────┘         al exterior)
```

Esto es exactamente lo que ya está "pre-cableado" en la app: `src/api/client.ts` tiene
`API_BASE_URL = 'http://localhost:4000/api'` y un `request()` que hoy lanza error porque
no hay backend real. El día que exista, la web y la app **apuntan a la misma URL de API**
(cada una con su propio JWT), y esa API es la única que sabe que existe Postgres.

### Pasos concretos para levantarlo en su servidor

1. **Servidor**: una VM/contenedor Linux (Ubuntu/Debian) que administre su gente de
   sistemas — puede ser un servidor físico de la alcaldía o un VPS cualquiera (DigitalOcean,
   AWS EC2, etc.), la diferencia con Supabase es que aquí **ustedes controlan el Postgres**,
   no un proveedor externo.
2. **Instalar Postgres 16** en esa máquina (paquete `postgresql` o contenedor Docker
   `postgres:16`), y correr el script de la sección 4 una sola vez para crear el esquema.
3. **Crear un usuario de BD propio para el backend** (no usar el superusuario `postgres`):
   ```sql
   create role app_backend with login password '••••••' ;
   grant connect on database gamc_seguridad to app_backend;
   grant usage on schema public to app_backend;
   grant select, insert, update, delete on all tables in schema public to app_backend;
   grant usage, select on all sequences in schema public to app_backend;
   ```
4. **Cerrar el puerto 5432 al exterior**: en `postgresql.conf` → `listen_addresses = 'localhost'`
   (si el backend corre en la misma máquina) o a la IP interna de una red privada; en
   `pg_hba.conf` solo permitir esa IP/host; en el firewall del servidor, **no** exponer 5432
   a Internet. Nadie fuera del backend debe poder llegar a la base.
5. **Backend API** (Node.js — Express o NestJS, como ya dice el `README.md` del proyecto):
   - Única pieza que tiene la variable `DATABASE_URL=postgresql://app_backend:••••@localhost:5432/gamc_seguridad`.
   - Expone endpoints REST (`/auth/login`, `/turnos`, `/hechos`, `/patrullas/vigente`, `/telemetria`, `/usuarios`, …) siguiendo la tabla de la sección 1 (quién escribe/lee qué).
   - Valida el JWT en cada request y aplica `role_permission` (para `user`) o "solo mis propios recursos" (para `guardia`).
   - Corre detrás de **Nginx/Caddy con HTTPS** (Let's Encrypt), en un dominio propio (ej. `api.seguridad.gamc.gob.bo`).
6. **Web** y **app móvil** apuntan a esa misma URL pública (`https://api.seguridad.gamc.gob.bo`),
   nunca al Postgres directamente. En la app, eso es cambiar `API_BASE_URL` en `src/api/client.ts`
   por la URL real e implementar `request()` con `fetch` + header `Authorization: Bearer <jwt>`.
7. **Migraciones versionadas**: en vez de reeditar el script de la sección 4 para siempre,
   crear una carpeta `migrations/` con archivos numerados (`0001_init.sql`, `0002_guardia_fecha_nacimiento.sql`, …)
   y correrlos con una herramienta simple (`node-pg-migrate`, `knex migrate`, o incluso un
   script bash que aplique los `.sql` pendientes en orden). Así cualquier ambiente nuevo
   (dev/staging/producción) llega al mismo esquema, y el cambio de hoy (`fecha_nacimiento`)
   es la migración `0002`, no una edición del archivo original.
8. **Backups**: `pg_dump` programado (cron) a un storage aparte; si más adelante se aprueba
   un proveedor administrado, restaurar ese dump ahí sin drama.

### Sobre lo de Supabase

Este esquema no usa nada específico de Supabase (ni RLS, ni `auth.users`, ni extensiones
propietarias) — es **Postgres puro**. Si algún día "se aprueba" Supabase, el mismo script
de la sección 4 corre igual ahí (Supabase es Postgres por debajo); la única diferencia sería
que el backend podría apoyarse en su capa de Auth/REST en vez de un Express propio. O sea:
no se pierde nada por empezar en su propio servidor — la migración a Supabase después,
si se da, es de infraestructura, no de esquema.
```
