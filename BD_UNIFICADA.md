-- ============================================================
-- GAMC · Seguridad Ciudadana — Schema completo para Supabase
-- Pega esto entero en Supabase → SQL Editor → Run
-- ============================================================

create extension if not exists pgcrypto;

-- 1. ENUMS
create type user_estado     as enum ('activo','inactivo','suspendido');
create type guardia_estado  as enum ('pendiente_activacion','activo','inactivo','suspendido');
create type guardia_estado_operativo as enum ('fuera_de_servicio','en_servicio','emergencia');
create type turno_estado    as enum ('en_servicio','finalizado','anulado');
create type patrulla_estado as enum ('asignada','en_curso','completada','cancelada');
create type hecho_estado    as enum ('reportado','en_revision','cerrado');
create type nivel_riesgo    as enum ('bajo','medio','alto','muy_alto');
create type sujeto_auth     as enum ('user','guardia');
create type evidencia_tipo  as enum ('foto','video');

-- 2. CATÁLOGOS
create table epi (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,
  nombre     text not null,
  poligono   jsonb,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table role (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  nombre      text not null,
  descripcion text
);

create table role_permission (
  id             uuid primary key default gen_random_uuid(),
  role_id        uuid not null references role(id) on delete cascade,
  recurso        text not null,
  puede_ver      boolean not null default false,
  puede_crear    boolean not null default false,
  puede_editar   boolean not null default false,
  puede_eliminar boolean not null default false,
  unique (role_id, recurso)
);

create table tipo_hecho (
  id     uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  label  text not null,
  activo boolean not null default true,
  orden  int not null default 100
);

-- 3. USUARIOS
create table "user" (
  id                    uuid primary key default gen_random_uuid(),
  role_id               uuid not null references role(id),
  primer_nombre         text not null,
  segundo_nombre        text,
  apellido_paterno      text not null,
  apellido_materno      text not null,
  nombre                text not null generated always as (
                          btrim(regexp_replace(
                            primer_nombre || ' ' || coalesce(segundo_nombre, '') || ' ' || apellido_paterno || ' ' || apellido_materno,
                            '\s+', ' ', 'g'
                          ))
                        ) stored,
  email                 text not null unique,
  usuario               text not null unique,
  ci                    text unique,
  telefono              text,
  fecha_nacimiento      date,
  password_hash         text not null,
  estado                user_estado not null default 'activo',
  debe_cambiar_password boolean not null default true,
  creado_por            uuid references "user"(id),
  ultimo_login          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table guardia (
  id                    uuid primary key default gen_random_uuid(),
  epi_id                uuid references epi(id),
  primer_nombre         text not null,
  segundo_nombre        text,
  apellido_paterno      text not null,
  apellido_materno      text not null,
  nombre                text not null generated always as (
                          btrim(regexp_replace(
                            primer_nombre || ' ' || coalesce(segundo_nombre, '') || ' ' || apellido_paterno || ' ' || apellido_materno,
                            '\s+', ' ', 'g'
                          ))
                        ) stored,
  ci                    text not null unique,
  usuario               text not null unique,
  password_hash         text,
  telefono              text not null,
  foto_url              text,
  fecha_nacimiento      date not null,
  estado                guardia_estado not null default 'pendiente_activacion',
  estado_operativo      guardia_estado_operativo not null default 'fuera_de_servicio',
  activacion_token      text,
  activacion_expira     timestamptz,
  debe_cambiar_password boolean not null default true,
  creado_por            uuid not null references "user"(id),
  activado_en           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index ix_guardia_epi on guardia (epi_id);
create index ix_guardia_estado_operativo on guardia (estado_operativo);

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

create table refresh_token (
  id             uuid primary key default gen_random_uuid(),
  sujeto_tipo    sujeto_auth not null,
  sujeto_id      uuid not null,
  token_hash     text not null unique,
  familia        uuid not null,
  expira_en      timestamptz not null,
  revocada       boolean not null default false,
  reemplazada_por uuid references refresh_token(id),
  ip             inet,
  user_agent     text,
  created_at     timestamptz not null default now(),
  used_at        timestamptz
);
create index ix_refresh_sujeto on refresh_token (sujeto_tipo, sujeto_id) where not revocada;
create index ix_refresh_familia on refresh_token (familia);

-- 4. PATRULLAJE
create table ruta_plantilla (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  epi_id      uuid references epi(id),
  trazado     jsonb,
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
  nombre               text,
  descripcion          text,
  poligono_geojson     jsonb,
  turno_id             uuid,
  iniciada_en          timestamptz,
  completada_en        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index ix_patrulla_guardia_fecha on patrulla (guardia_id, fecha);
create index ix_patrulla_estado on patrulla (estado);

-- 5. OPERACIÓN EN CAMPO
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
  distancia_metros  numeric(12,2) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index ix_turno_guardia on turno (guardia_id, hora_inicio desc);
create unique index ux_turno_abierto_por_guardia
  on turno (guardia_id) where estado = 'en_servicio';

alter table patrulla
  add constraint fk_patrulla_turno foreign key (turno_id) references turno(id);

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
  sos_estado       text,
  sos_atendido_por uuid references "user"(id),
  sos_atendido_en  timestamptz,
  capturado_en     timestamptz not null,
  recibido_en      timestamptz not null default now()
);
create index ix_tele_turno   on guardia_telemetria (turno_id, capturado_en);
create index ix_tele_guardia on guardia_telemetria (guardia_id, capturado_en desc);
create index ix_tele_sos     on guardia_telemetria (capturado_en desc) where es_sos;

create table hecho (
  id                  uuid primary key default gen_random_uuid(),
  turno_id            uuid references turno(id),
  guardia_id          uuid not null references guardia(id),
  tipo_hecho_id       uuid not null references tipo_hecho(id),
  descripcion         text not null,
  nivel_riesgo        nivel_riesgo not null,
  lat                 double precision not null,
  lng                 double precision not null,
  epi_id              uuid references epi(id),
  direccion           text,
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

-- 6. DERIVADOS / AUDITORÍA
create table zona_critica_activa (
  id              uuid primary key default gen_random_uuid(),
  epi_id          uuid references epi(id),
  centro_lat      double precision not null,
  centro_lng      double precision not null,
  radio_m         numeric(10,2),
  poligono        jsonb,
  direccion       text,
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
  actor_tipo    text not null default 'user',
  accion        text not null,
  recurso       text,
  recurso_id    text,
  detalle       jsonb,
  ip            inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index ix_audit_created on audit_log (created_at desc);
create index ix_audit_actor   on audit_log (actor_user_id, created_at desc);

-- 7. FUNCIONES Y TRIGGERS
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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

create or replace function audit_log_inmutable() returns trigger as $$
begin
  raise exception 'audit_log es inmutable: % no permitido', tg_op;
end;
$$ language plpgsql;
create trigger trg_audit_no_update before update or delete on audit_log
  for each row execute function audit_log_inmutable();

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

-- 8. VISTAS
create or replace view v_guardia_ubicacion_actual as
select distinct on (guardia_id)
  guardia_id, turno_id, lat, lng, es_sos, sos_estado, capturado_en
from guardia_telemetria
order by guardia_id, capturado_en desc;

create or replace view v_sos_pendiente as
select tel.*, g.nombre as guardia_nombre
from guardia_telemetria tel
join guardia g on g.id = tel.guardia_id
where tel.es_sos and coalesce(tel.sos_estado,'pendiente') = 'pendiente'
order by tel.capturado_en desc;

create or replace view v_patrulla_vigente as
select p.*, r.trazado, r.nombre as ruta_nombre
from patrulla p
left join ruta_plantilla r on r.id = p.ruta_plantilla_id
where p.estado in ('asignada','en_curso') and p.fecha = current_date;

-- 9. DATOS SEMILLA ESTRUCTURALES
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
  ('hurto','Hurto',40), ('violencia','Violencia',50), ('emergencia','Emergencia',60),
  ('robo_vehículo','Robo de Vehículo',70), ('robo_domicilio','Robo a Domicilio',80),
  ('accidente','Accidente',90), ('disturbio','Disturbio',100),
  ('vandalismo','Vandalismo',110), ('otro','Otro',999);