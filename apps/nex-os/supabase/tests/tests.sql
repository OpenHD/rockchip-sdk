-- Pruebas de schema-mdm-v8.sql y v9.sql. Las corre run.sh; cada prueba emite "NOTICE: PASS ..." o "NOTICE: FAIL ...".
-- t.as_user(uid, aal) simula el JWT de Supabase; set role anon/authenticated/service_role simula el rol de PostgREST.
\set QUIET on
set client_min_messages = notice;
create schema if not exists t;
create or replace function t.as_user(p uuid, aal text default 'aal2') returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub',p,'aal',aal)::text, false) $$;
create or replace function t.ok(name text, cond boolean) returns void language plpgsql as $$ begin raise notice '% %', case when cond then 'PASS' else 'FAIL' end, name; end $$;
create or replace function t.err(name text, q text, code text) returns void language plpgsql as $$
begin
  execute q;
  raise notice 'FAIL % (sin error)', name;
exception when others then
  if sqlstate = code then raise notice 'PASS % (%)', name, sqlstate; else raise notice 'FAIL % (got % %)', name, sqlstate, sqlerrm; end if;
end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;
create table if not exists t.kv(k text primary key, v text);
grant all on t.kv to anon, authenticated, service_role;
insert into auth.users(id,email) values ('44444444-4444-4444-4444-444444444444','admin@a.com') on conflict do nothing;
insert into mdm_members values ('aaaaaaaa-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','admin') on conflict do nothing;

-- ---------- 1. Sync v8 (anon) ----------
set role anon;
select t.ok('sync: campos nuevos', s->>'status'='paired' and s->>'hardware_id'=repeat('1',64) and s->>'unlock_secret' ~ '^[0-9a-f]{64}$'
   and (s->'attestation_eligible')::boolean and s->'update'='null'::jsonb and s ? 'external_ref'
   and (s->'apps'->0->'pass_attestation') = 'false'::jsonb and s->'apps'->0->>'id'='netflix')
  from (select mdm_device_sync(repeat('a',64), '1.0', '{"mode":"active","build":5}', null, repeat('1',64)) s) x;
-- backfill no pisa: B1 informa el mismo hardware_id que A1
select t.ok('sync: hardware_id duplicado no se copia', s->'hardware_id'='null'::jsonb)
  from (select mdm_device_sync(repeat('c',64), '1.0', null, null, repeat('1',64)) s) x;
select t.ok('sync: token desconocido', mdm_device_sync(repeat('9',64))->>'status'='unknown');
reset role;

-- ---------- 2. Código de desbloqueo ----------
select t.as_user('11111111-1111-1111-1111-111111111111');
set role authenticated;
insert into t.kv select 'code', mdm_unlock_code('dddddddd-0000-0000-0000-000000000001')->>'code';
select t.ok('unlock_code: formato', (select mdm_unlock_code('dddddddd-0000-0000-0000-000000000001')) ?& array['code','valid_on','hours']
   and (select mdm_unlock_code('dddddddd-0000-0000-0000-000000000001')->>'hours')='72');
-- ---------- 3. Secretos ilegibles ----------
select t.err('admin no lee unlock_secret', 'select unlock_secret from mdm_devices', '42501');
select t.err('admin no lee hardware_id', 'select hardware_id from mdm_devices', '42501');
select t.err('admin no lee token_hash', 'select token_hash from mdm_devices', '42501');
select t.err('admin no lee key_hash', 'select key_hash from mdm_api_keys', '42501');
select t.err('admin select * mdm_devices', 'select * from mdm_devices', '42501');
select t.ok('admin lee external_ref', (select count(*) from (select id, external_ref from mdm_devices) z) = 2);
reset role;
select t.as_user('11111111-1111-1111-1111-111111111111', 'aal1');
set role authenticated;
select t.err('aal1 no pide código', $q$select mdm_unlock_code('dddddddd-0000-0000-0000-000000000001')$q$, '42501');
reset role;

-- ---------- 4. Cross-company ----------
select t.as_user('22222222-2222-2222-2222-222222222222');
set role authenticated;
select t.err('B no pide código de A', $q$select mdm_unlock_code('dddddddd-0000-0000-0000-000000000001')$q$, '42501');
select t.err('B no setea ref de A', $q$select mdm_set_external_ref('dddddddd-0000-0000-0000-000000000001','X')$q$, '42501');
select t.err('B no crea clave en A', $q$select mdm_create_api_key('aaaaaaaa-0000-0000-0000-000000000001','x1')$q$, '42501');
select t.err('B no lista claves de A', $q$select * from mdm_list_api_keys('aaaaaaaa-0000-0000-0000-000000000001')$q$, '42501');
select t.ok('B no ve equipos de A', (select count(*) from (select id from mdm_devices) z) = 1);
select mdm_set_external_ref('dddddddd-0000-0000-0000-000000000003','CLI-001');
reset role;

-- ---------- 5. Claves de API ----------
select t.as_user('44444444-4444-4444-4444-444444444444');
set role authenticated;
select t.err('admin (no owner) no crea clave', $q$select mdm_create_api_key('aaaaaaaa-0000-0000-0000-000000000001','x1')$q$, '42501');
reset role;
select t.as_user('11111111-1111-1111-1111-111111111111');
set role authenticated;
insert into t.kv select 'k1', mdm_create_api_key('aaaaaaaa-0000-0000-0000-000000000001','Cobranza')->>'key';
insert into t.kv select 'k2', mdm_create_api_key('aaaaaaaa-0000-0000-0000-000000000001','Vieja')->>'key';
select t.ok('clave: formato nexk_ + 43', v ~ '^nexk_[A-Za-z0-9_-]{43}$') from t.kv where k='k1';
select t.ok('list_api_keys owner', (select count(*) from mdm_list_api_keys('aaaaaaaa-0000-0000-0000-000000000001')) = 2);
select t.ok('tabla api_keys legible sin hash', (select count(*) from (select id, prefix from mdm_api_keys) z) = 2);
select mdm_revoke_api_key((select id from mdm_api_keys where name='Vieja'));
reset role;
select t.ok('key_hash = sha256(clave)', exists (select 1 from mdm_api_keys k, t.kv where t.kv.k='k1' and k.key_hash = encode(extensions.digest(t.kv.v,'sha256'),'hex')));
select t.ok('prefix', exists (select 1 from mdm_api_keys k, t.kv where t.kv.k='k1' and k.prefix = left(t.kv.v, 11)));
insert into t.kv select 'h1', encode(extensions.digest(v,'sha256'),'hex') from t.kv where k='k1';
insert into t.kv select 'h2', encode(extensions.digest(v,'sha256'),'hex') from t.kv where k='k2';

-- ---------- 6. Funciones ISP ----------
set role authenticated;
select t.err('authenticated no ejecuta mdm_isp_get_device', format('select mdm_isp_get_device(%L, %L)', (select v from t.kv where k='h1'), 'dddddddd-0000-0000-0000-000000000001'), '42501');
reset role;
set role anon;
select t.err('anon no ejecuta mdm_isp_list_devices', format('select mdm_isp_list_devices(%L)', (select v from t.kv where k='h1')), '42501');
reset role;
set role service_role;
select t.ok('isp get_device', mdm_isp_get_device((select v from t.kv where k='h1'), 'dddddddd-0000-0000-0000-000000000001') ?& array['id','name','external_ref','locked','lock_reason','paid_until','online','last_seen_at','reported_mode','reported_lock_kind','firmware_version']);
select t.ok('isp online=true tras sync', (mdm_isp_get_device((select v from t.kv where k='h1'), 'DDDDDDDD-0000-0000-0000-000000000001')->'online')='true'::jsonb);
select t.err('isp equipo de otra empresa', format('select mdm_isp_get_device(%L, %L)', (select v from t.kv where k='h1'), 'dddddddd-0000-0000-0000-000000000003'), 'P0002');
select t.err('isp ref de otra empresa', format('select mdm_isp_get_device(%L, %L)', (select v from t.kv where k='h1'), 'ref:CLI-001'), 'P0002');
select t.err('isp clave revocada', format('select mdm_isp_get_device(%L, %L)', (select v from t.kv where k='h2'), 'dddddddd-0000-0000-0000-000000000001'), '28000');
select t.err('isp clave desconocida', format('select mdm_isp_list_devices(%L)', repeat('0',64)), '28000');
select t.err('isp hash malformado', format('select mdm_isp_list_devices(%L)', 'nexk_abc'), '28000');
select t.err('isp id inválido', format('select mdm_isp_get_device(%L, %L)', (select v from t.kv where k='h1'), 'ref:a/b'), '22023');
select t.ok('isp list', jsonb_array_length(mdm_isp_list_devices((select v from t.kv where k='h1'))->'devices') = 2);
select t.ok('isp list limit', jsonb_array_length(mdm_isp_list_devices((select v from t.kv where k='h1'), 1, 1)->'devices') = 1);
select t.ok('isp lock', (mdm_isp_set_lock((select v from t.kv where k='h1'), 'dddddddd-0000-0000-0000-000000000002', true, 'Mora')->>'lock_reason') = 'Mora');
select t.ok('isp external_ref', mdm_isp_set_external_ref((select v from t.kv where k='h1'), 'dddddddd-0000-0000-0000-000000000002', 'CLI-001')->>'external_ref' = 'CLI-001');
select t.ok('isp get por ref', mdm_isp_get_device((select v from t.kv where k='h1'), 'ref:CLI-001')->>'id' = 'dddddddd-0000-0000-0000-000000000002');
select t.err('isp ref duplicada en la empresa', format('select mdm_isp_set_external_ref(%L, %L, %L)', (select v from t.kv where k='h1'), 'dddddddd-0000-0000-0000-000000000001', 'CLI-001'), '23505');
select t.err('isp ref con caracteres inválidos', format('select mdm_isp_set_external_ref(%L, %L, %L)', (select v from t.kv where k='h1'), 'dddddddd-0000-0000-0000-000000000001', 'a b'), '22023');
select t.ok('isp list por ref', jsonb_array_length(mdm_isp_list_devices((select v from t.kv where k='h1'), 50, 0, 'CLI-001')->'devices') = 1);
select t.ok('isp paid_until', mdm_isp_set_paid_until((select v from t.kv where k='h1'), 'ref:CLI-001', current_date + 30)->>'paid_until' = (current_date + 30)::text);
select t.err('isp paid_until lejano', format('select mdm_isp_set_paid_until(%L, %L, %L)', (select v from t.kv where k='h1'), 'ref:CLI-001', current_date + 2000), '22023');
insert into t.kv select 'isp_code', mdm_isp_unlock_code((select v from t.kv where k='h1'), 'dddddddd-0000-0000-0000-000000000001')->>'code';
select t.ok('isp unlock (lock false)', (mdm_isp_set_lock((select v from t.kv where k='h1'), 'ref:CLI-001', false)->'locked')='false'::jsonb);
reset role;
select t.ok('auditoría actor api:Cobranza', (select count(*) from mdm_audit_log where actor is null and actor_label = 'api:Cobranza' and action in ('device.lock','device.unlock','device.external_ref','device.payment','device.unlock_code')) = 5);
select t.ok('pago registrado con nota api', exists (select 1 from mdm_payments where note = 'api:Cobranza'));
select t.ok('código ISP = código admin', (select v from t.kv where k='isp_code') = (select v from t.kv where k='code'));
-- rate limit por clave (120/min)
set role service_role;
do $$
declare i int; v_fail int := 0; h text := (select v from t.kv where k='h1');
begin
  for i in 1..130 loop
    begin
      perform mdm_isp_get_device(h, 'dddddddd-0000-0000-0000-000000000001');
    exception when sqlstate '53400' then v_fail := v_fail + 1;
    end;
  end loop;
  perform t.ok('isp rate limit (' || v_fail || ' rechazadas)', v_fail >= 10);
end $$;
reset role;
delete from mdm_api_rate;

-- ---------- 7. Firmware ----------
select t.as_user('11111111-1111-1111-1111-111111111111');
set role authenticated;
select t.err('owner no publica firmware', $q$select mdm_publish_release('1.0', 10, 'https://x.com/a.img', repeat('a',64), 100, repeat('A',512))$q$, '42501');
select t.err('owner no lista releases', $q$select * from mdm_list_releases()$q$, '42501');
select t.ok('owner no ve tabla releases (RLS)', (select count(*) from mdm_firmware_releases) = 0);
reset role;
select t.as_user('33333333-3333-3333-3333-333333333333');
set role authenticated;
insert into t.kv select 'r10', mdm_publish_release('1.0.0', 10, 'https://cdn.nex.com/fw/nex-10.img', repeat('a',64), 1000, repeat('A',512), 'nota')::text;
insert into t.kv select 'r8', mdm_publish_release('0.9.0', 8, 'https://cdn.nex.com/fw/nex-8.img', repeat('b',64), 900, repeat('B',512))::text;
select t.err('build duplicado', $q$select mdm_publish_release('1.0.1', 10, 'https://x.com/a', repeat('a',64), 1, repeat('A',512))$q$, '23505');
select t.err('url con comilla', $q$select mdm_publish_release('1.0.2', 12, 'https://x.com/a''$(reboot)', repeat('a',64), 1, repeat('A',512))$q$, '22023');
select t.err('url http', $q$select mdm_publish_release('1.0.2', 12, 'http://x.com/a', repeat('a',64), 1, repeat('A',512))$q$, '22023');
select t.err('sha inválido', $q$select mdm_publish_release('1.0.2', 12, 'https://x.com/a', 'zz', 1, repeat('A',512))$q$, '22023');
select mdm_set_firmware_target(null, (select v from t.kv where k='r10')::uuid);
select mdm_set_firmware_target(null, (select v from t.kv where k='r10')::uuid);
select mdm_set_firmware_target('aaaaaaaa-0000-0000-0000-000000000001', (select v from t.kv where k='r8')::uuid);
select t.ok('list releases', (select count(*) from mdm_list_releases()) = 2);
select t.ok('list targets (global + A)', (select count(*) from mdm_list_firmware_targets()) = 2
  and exists (select 1 from mdm_list_firmware_targets() where company_id is null and build = 10));
select mdm_set_catalog_attestation('netflix', true);
reset role;
set role anon;
select t.ok('update: A build 5 → 8 (target empresa)', (mdm_device_sync(repeat('a',64), null, '{"build":5}')->'update'->>'build') = '8');
select t.ok('update: campos', mdm_device_sync(repeat('a',64), null, '{"build":5}')->'update' ?& array['version','build','url','sha256','size','sig']);
select t.ok('update: A build 8 → null', mdm_device_sync(repeat('a',64), null, '{"build":8}')->'update' = 'null'::jsonb);
select t.ok('update: A build 9 → null (no baja)', mdm_device_sync(repeat('a',64), null, '{"build":9}')->'update' = 'null'::jsonb);
select t.ok('update: B sin build → 10 (global)', (mdm_device_sync(repeat('c',64))->'update'->>'build') = '10');
select t.ok('update: B build basura → trata como 0', (mdm_device_sync(repeat('c',64), null, '{"build":"x; rm"}')->'update'->>'build') = '10');
select t.ok('update: B build 10 → null', mdm_device_sync(repeat('c',64), null, '{"build":10}')->'update' = 'null'::jsonb);
select t.ok('pass_attestation en apps', (mdm_device_sync(repeat('a',64))->'apps'->0->'pass_attestation') = 'true'::jsonb);
select t.ok('external_ref en sync', mdm_device_sync(repeat('c',64))->>'external_ref' = 'CLI-001');
reset role;
select t.as_user('33333333-3333-3333-3333-333333333333');
set role authenticated;
select mdm_set_firmware_target('aaaaaaaa-0000-0000-0000-000000000001', null);
reset role;
set role anon;
select t.ok('update: sin target de empresa → global', (mdm_device_sync(repeat('a',64), null, '{"build":5}')->'update'->>'build') = '10');
-- ---------- 8. attestation_eligible ----------
select t.ok('elegible: A2 desbloqueada y pagada', (mdm_device_sync(repeat('b',64))->'attestation_eligible') = 'true'::jsonb);
reset role;
update mdm_devices set locked = true where id = 'dddddddd-0000-0000-0000-000000000002';
set role anon;
select t.ok('no elegible: bloqueada', (mdm_device_sync(repeat('b',64))->'attestation_eligible') = 'false'::jsonb);
reset role;
update mdm_devices set locked = false, paid_until = current_date - 10 where id = 'dddddddd-0000-0000-0000-000000000002';
set role anon;
select t.ok('no elegible: pago vencido', (mdm_device_sync(repeat('b',64))->'attestation_eligible') = 'false'::jsonb);
reset role;
-- ---------- 9. Rotación del secreto al cambiar token ----------
insert into t.kv select 'sec_before', unlock_secret from mdm_devices where id='dddddddd-0000-0000-0000-000000000003';
set role anon;
reset role;
update mdm_devices set hardware_id = repeat('3',64) where id='dddddddd-0000-0000-0000-000000000003';
set role anon;
select t.ok('re-enrolamiento por hardware', mdm_device_register(repeat('f',64), '1.1', repeat('3',64))->>'status' = 'paired');
reset role;
select t.ok('secreto rotado al re-enrolar', unlock_secret <> (select v from t.kv where k='sec_before') and unlock_secret ~ '^[0-9a-f]{64}$')
  from mdm_devices where id='dddddddd-0000-0000-0000-000000000003';
select t.ok('equipo nuevo (register) tiene secreto', (select count(*) from mdm_devices where unlock_secret is null) = 0);
-- ---------- 10. Catálogo y auditoría ----------
select t.as_user('11111111-1111-1111-1111-111111111111');
set role authenticated;
select t.err('owner no cambia pass_attestation', $q$select mdm_set_catalog_attestation('netflix', false)$q$, '42501');
select t.ok('audit unlock_code sin código', not exists (select 1 from mdm_audit_log where action='device.unlock_code' and details ? 'code'));
select t.ok('audit legible con actor_label', (select count(*) from (select actor_label from mdm_audit_log where actor_label is not null) z) >= 5);
reset role;
select t.ok('ninguna función mdm_isp_* ejecutable por anon/authenticated',
  not exists (select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'mdm_isp_%'
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))));
select t.ok('helpers _mdm_* nuevos no ejecutables por authenticated',
  not exists (select 1 from pg_proc p where p.pronamespace='public'::regnamespace
     and p.proname in ('_mdm_audit_as','_mdm_unlock_code','_mdm_unlock_code_for','_mdm_apply_external_ref','_mdm_isp_key','_mdm_isp_device','_mdm_rotate_unlock_secret')
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))));
select t.ok('anon no lee tablas nuevas', not (has_table_privilege('anon','mdm_api_keys','select') or has_table_privilege('anon','mdm_firmware_releases','select') or has_table_privilege('anon','mdm_api_rate','select') or has_table_privilege('authenticated','mdm_api_rate','select')));

-- =====================================================================
-- v9: estados escalonados, datos de pago e historial de estados
-- =====================================================================
reset role;
delete from mdm_api_rate;
delete from mdm_rate_events;

-- ---------- 11. mdm_update_company: validación ----------
select t.as_user('11111111-1111-1111-1111-111111111111');
set role authenticated;
select t.err('company: restrict_days 31', $q$select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null, p_payment_restrict_days => 31)$q$, '22023');
select t.err('company: restrict_days -2', $q$select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null, p_payment_restrict_days => -2)$q$, '22023');
select t.err('company: teléfono con letras', $q$select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null, p_payment_phone => '011-PAGAR')$q$, '22023');
select t.err('company: teléfono corto', $q$select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null, p_payment_phone => '123')$q$, '22023');
select t.err('company: teléfono largo', $q$select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null, p_payment_phone => repeat('1', 33))$q$, '22023');
select t.err('company: url http', $q$select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null, p_payment_url => 'http://pagos.isp.com')$q$, '22023');
select t.err('company: url con comilla', $q$select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null, p_payment_url => 'https://pagos.isp.com/''$(reboot)')$q$, '22023');
select t.err('company: url con espacio', $q$select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null, p_payment_url => 'https://pagos.isp.com/a b')$q$, '22023');
select t.err('company: url > 300', $q$select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null, p_payment_url => 'https://pagos.isp.com/' || repeat('a', 290))$q$, '22023');
select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null,
  p_payment_grace_days => 10, p_payment_restrict_days => 3,
  p_payment_phone => ' +54 (11) 4000-0000 ', p_payment_url => 'https://pagos.isp.com/p?c=1&x=%20#qr');
select t.ok('company: guarda restrict/teléfono/url', payment_restrict_days = 3 and payment_grace_days = 10
    and payment_phone = '+54 (11) 4000-0000' and payment_url = 'https://pagos.isp.com/p?c=1&x=%20#qr')
  from mdm_companies where id = 'aaaaaaaa-0000-0000-0000-000000000001';
-- Firma vieja (sin los parámetros nuevos): no toca restrict/teléfono/url.
select mdm_update_company(p_company => 'aaaaaaaa-0000-0000-0000-000000000001', p_lock_message => 'Bloqueado',
  p_offline_lock_days => 7, p_logo_path => null, p_payment_message => null, p_payment_grace_days => null,
  p_payment_warning_days => null, p_timezone => null);
select t.ok('company: firma vieja conserva campos nuevos', payment_restrict_days = 3 and payment_phone is not null
    and payment_url is not null and lock_message = 'Bloqueado')
  from mdm_companies where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null,
  p_payment_restrict_days => -1, p_payment_phone => '', p_payment_url => '');
select t.ok('company: -1 y '''' borran', payment_restrict_days is null and payment_phone is null and payment_url is null)
  from mdm_companies where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null,
  p_payment_restrict_days => 3, p_payment_phone => '0800-555-1234', p_payment_url => 'https://pagos.isp.com/abonado');
select t.ok('company: audit con campos nuevos', exists (select 1 from mdm_audit_log where action = 'company.update'
    and details ->> 'payment_phone' = '0800-555-1234'));
reset role;
select t.as_user('22222222-2222-2222-2222-222222222222');
set role authenticated;
select t.err('company: B no edita A', $q$select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null, p_payment_phone => '1234567')$q$, '42501');
select t.ok('company: B no ve datos de pago de A', not exists (select 1 from mdm_companies where id = 'aaaaaaaa-0000-0000-0000-000000000001'));
reset role;
select t.as_user('11111111-1111-1111-1111-111111111111', 'aal1');
set role authenticated;
select t.err('company: aal1 no edita', $q$select mdm_update_company('aaaaaaaa-0000-0000-0000-000000000001', null, null, null, p_payment_phone => '1234567')$q$, '42501');
reset role;

-- ---------- 12. Restricción manual desde el panel ----------
select t.as_user('22222222-2222-2222-2222-222222222222');
set role authenticated;
select t.err('restrict: B no restringe equipo de A', $q$select mdm_set_device_restricted('dddddddd-0000-0000-0000-000000000001', true, 'x')$q$, '42501');
reset role;
select t.as_user('11111111-1111-1111-1111-111111111111', 'aal1');
set role authenticated;
select t.err('restrict: aal1 no restringe', $q$select mdm_set_device_restricted('dddddddd-0000-0000-0000-000000000001', true)$q$, '42501');
reset role;
set role anon;
select t.err('restrict: anon no ejecuta', $q$select mdm_set_device_restricted('dddddddd-0000-0000-0000-000000000001', true)$q$, '42501');
reset role;
select t.as_user('44444444-4444-4444-4444-444444444444');
set role authenticated;
select t.err('restrict: equipo inexistente', $q$select mdm_set_device_restricted('dddddddd-0000-0000-0000-0000000000ff', true)$q$, 'P0002');
select t.err('restrict: restricted null', $q$select mdm_set_device_restricted('dddddddd-0000-0000-0000-000000000001', null)$q$, '22023');
select mdm_set_device_restricted('dddddddd-0000-0000-0000-000000000001', true, '  Mora de 15 días  ');
select t.ok('restrict: admin (no owner) restringe', restricted and restrict_reason = 'Mora de 15 días')
  from mdm_devices where id = 'dddddddd-0000-0000-0000-000000000001';
select t.ok('restrict: columnas legibles por el panel', (select count(*) from (select id, restricted, restrict_reason from mdm_devices) z) = 2);
reset role;
select t.ok('restrict: auditado device.restrict', exists (select 1 from mdm_audit_log where action = 'device.restrict'
    and target = 'dddddddd-0000-0000-0000-000000000001' and actor = '44444444-4444-4444-4444-444444444444'));
select t.ok('restrict: historial panel/restricted', exists (select 1 from mdm_device_state_log
    where device_id = 'dddddddd-0000-0000-0000-000000000001' and source = 'panel' and state = 'restricted'
      and details ->> 'change' = 'restrict' and details ->> 'reason' = 'Mora de 15 días'));

-- ---------- 13. Sync v9 ----------
set role anon;
select t.ok('sync: restricted + motivo', (s -> 'restricted') = 'true'::jsonb and s ->> 'restrict_reason' = 'Mora de 15 días'
    and s -> 'payment' = 'null'::jsonb)
  from (select mdm_device_sync(repeat('a',64)) s) x;
select t.ok('sync: no elegible restringido manual', (mdm_device_sync(repeat('a',64)) -> 'attestation_eligible') = 'false'::jsonb);
select t.ok('sync: company trae teléfono/url', s -> 'company' ->> 'payment_phone' = '0800-555-1234'
    and s -> 'company' ->> 'payment_url' = 'https://pagos.isp.com/abonado')
  from (select mdm_device_sync(repeat('a',64)) s) x;
reset role;
select t.as_user('11111111-1111-1111-1111-111111111111');
set role authenticated;
select mdm_set_device_restricted('dddddddd-0000-0000-0000-000000000001', false, 'ignorado');
reset role;
select t.ok('unrestrict: limpia motivo', not restricted and restrict_reason is null)
  from mdm_devices where id = 'dddddddd-0000-0000-0000-000000000001';
select t.ok('unrestrict: auditado + historial active', exists (select 1 from mdm_audit_log where action = 'device.unrestrict')
    and exists (select 1 from mdm_device_state_log where device_id = 'dddddddd-0000-0000-0000-000000000001'
                  and source = 'panel' and state = 'active' and details ->> 'change' = 'unrestrict'));
insert into t.kv select 'log_n', count(*)::text from mdm_device_state_log where source = 'panel';
select t.as_user('11111111-1111-1111-1111-111111111111');
set role authenticated;
select mdm_set_device_restricted('dddddddd-0000-0000-0000-000000000001', false);
reset role;
select t.ok('unrestrict repetido: sin fila nueva', (select count(*) from mdm_device_state_log where source = 'panel')::text
    = (select v from t.kv where k = 'log_n'));
select t.ok('unrestrict repetido: igual se audita', (select count(*) from mdm_audit_log where action = 'device.unrestrict') = 2);

-- Pago: gracia 10, restringe a los 3 días. paid_until = hoy - 5 → restringido por pago, sin bloqueo todavía.
select t.as_user('11111111-1111-1111-1111-111111111111');
set role authenticated;
select mdm_set_paid_until('dddddddd-0000-0000-0000-000000000001', current_date - 5, 'prueba');
reset role;
select t.ok('paid_until panel: historial restricted', exists (select 1 from mdm_device_state_log
    where device_id = 'dddddddd-0000-0000-0000-000000000001' and source = 'panel' and state = 'restricted'
      and details ->> 'change' = 'paid_until' and details ->> 'paid_until' = (current_date - 5)::text));
set role anon;
select t.ok('sync: payment.restrict_at/phone/url', (s -> 'payment' ->> 'restrict_at')::bigint
      = extract(epoch from ((current_date - 5 + 1 + 3)::timestamp at time zone 'America/Argentina/Buenos_Aires'))::bigint
    and (s -> 'payment' ->> 'lock_at')::bigint
      = extract(epoch from ((current_date - 5 + 1 + 10)::timestamp at time zone 'America/Argentina/Buenos_Aires'))::bigint
    and s -> 'payment' ->> 'phone' = '0800-555-1234' and s -> 'payment' ->> 'url' = 'https://pagos.isp.com/abonado'
    and (s -> 'restricted') = 'false'::jsonb)
  from (select mdm_device_sync(repeat('a',64)) s) x;
select t.ok('sync: no elegible restringido por pago', (mdm_device_sync(repeat('a',64)) -> 'attestation_eligible') = 'false'::jsonb);
reset role;
update mdm_devices set paid_until = current_date + 20 where id = 'dddddddd-0000-0000-0000-000000000001';
set role anon;
select t.ok('sync: elegible con restrict_at futuro', (s -> 'attestation_eligible') = 'true'::jsonb
    and (s -> 'payment' ->> 'restrict_at')::bigint > extract(epoch from now()))
  from (select mdm_device_sync(repeat('a',64)) s) x;
reset role;
update mdm_companies set payment_restrict_days = 10 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set role anon;
select t.ok('sync: restrict_days >= gracia → restrict_at null', s -> 'payment' ? 'restrict_at'
    and s -> 'payment' -> 'restrict_at' = 'null'::jsonb)
  from (select mdm_device_sync(repeat('a',64)) s) x;
reset role;
update mdm_companies set payment_restrict_days = null where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set role anon;
select t.ok('sync: sin etapa → restrict_at null', mdm_device_sync(repeat('a',64)) -> 'payment' -> 'restrict_at' = 'null'::jsonb);
reset role;
update mdm_companies set payment_restrict_days = 3 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ---------- 14. Historial: lo que informa el equipo ----------
delete from mdm_device_state_log where source = 'device';
set role anon;
select mdm_device_sync(repeat('a',64), null, '{"mode":"restricted","restrict_kind":"payment"}') is not null;
select mdm_device_sync(repeat('a',64), null, '{"mode":"restricted","restrict_kind":"payment"}') is not null;
reset role;
select t.ok('device: modo restricted aceptado', reported_mode = 'restricted') from mdm_devices where id = 'dddddddd-0000-0000-0000-000000000001';
select t.ok('device: una fila por cambio', (select count(*) from mdm_device_state_log where source = 'device'
    and device_id = 'dddddddd-0000-0000-0000-000000000001' and state = 'restricted'
    and details ->> 'restrict_kind' = 'payment') = 1);
set role anon;
select mdm_device_sync(repeat('a',64), null, '{"mode":"active","service_warning":true}') is not null;
select mdm_device_sync(repeat('a',64), null, '{"mode":"starting"}') is not null;
select mdm_device_sync(repeat('a',64), null, '{"mode":"bogus"}') is not null;
reset role;
select t.ok('device: modo inválido no pisa reported_mode', reported_mode = 'starting') from mdm_devices where id = 'dddddddd-0000-0000-0000-000000000001';
set role anon;
select mdm_device_sync(repeat('a',64), null, '{"mode":"locked","lock_kind":"payment"}') is not null;
reset role;
select t.ok('device: aviso, starting ignorado, locked', array(select state from mdm_device_state_log
    where source = 'device' and device_id = 'dddddddd-0000-0000-0000-000000000001' order by id) = array['restricted','warning','locked']);

-- ---------- 15. API del ISP ----------
insert into t.kv select 'log_api_from', coalesce(max(id), 0)::text from mdm_device_state_log;
set role service_role;
select t.ok('isp: campos v9', mdm_isp_get_device((select v from t.kv where k='h1'), 'ref:CLI-001') ?& array['restricted','restrict_reason','service_state']);
select t.ok('isp: paid_until futuro → active', mdm_isp_set_paid_until((select v from t.kv where k='h1'), 'ref:CLI-001', current_date + 30) ->> 'service_state' = 'active');
select t.ok('isp: restrict', s -> 'restricted' = 'true'::jsonb and s ->> 'restrict_reason' = 'Mora' and s ->> 'service_state' = 'restricted')
  from (select mdm_isp_set_restricted((select v from t.kv where k='h1'), 'ref:CLI-001', true, 'Mora') s) x;
select t.ok('isp: unrestrict', s -> 'restricted' = 'false'::jsonb and s -> 'restrict_reason' = 'null'::jsonb and s ->> 'service_state' = 'active')
  from (select mdm_isp_set_restricted((select v from t.kv where k='h1'), 'ref:CLI-001', false, 'x') s) x;
select t.ok('isp: vence en 2 días → warning', mdm_isp_set_paid_until((select v from t.kv where k='h1'), 'ref:CLI-001', current_date + 2) ->> 'service_state' = 'warning');
select t.ok('isp: vencido hace 5 → restricted (pago)', mdm_isp_set_paid_until((select v from t.kv where k='h1'), 'ref:CLI-001', current_date - 5) ->> 'service_state' = 'restricted');
select t.ok('isp: vencido hace 20 → locked (pago)', mdm_isp_set_paid_until((select v from t.kv where k='h1'), 'ref:CLI-001', current_date - 20) ->> 'service_state' = 'locked');
select t.ok('isp: lock manual → locked', mdm_isp_set_lock((select v from t.kv where k='h1'), 'ref:CLI-001', true, 'Baja') ->> 'service_state' = 'locked');
select mdm_isp_set_lock((select v from t.kv where k='h1'), 'ref:CLI-001', true, 'Baja') is not null;
select mdm_isp_set_lock((select v from t.kv where k='h1'), 'ref:CLI-001', false) is not null;
select mdm_isp_set_paid_until((select v from t.kv where k='h1'), 'ref:CLI-001', current_date + 30) is not null;
select t.err('isp: restrict equipo de otra empresa', format('select mdm_isp_set_restricted(%L, %L, true)', (select v from t.kv where k='h1'), 'dddddddd-0000-0000-0000-000000000003'), 'P0002');
select t.err('isp: restrict clave revocada', format('select mdm_isp_set_restricted(%L, %L, true)', (select v from t.kv where k='h2'), 'ref:CLI-001'), '28000');
select t.err('isp: restrict sin restricted', format('select mdm_isp_set_restricted(%L, %L, null)', (select v from t.kv where k='h1'), 'ref:CLI-001'), '22023');
select t.ok('isp: list trae service_state', (mdm_isp_list_devices((select v from t.kv where k='h1')) -> 'devices' -> 0) ? 'service_state');
reset role;
select t.ok('isp: historial api (restrict, unrestrict, 4 pagos, lock, unlock, pago)',
  array(select details ->> 'change' || ':' || state from mdm_device_state_log
         where source = 'api' and device_id = 'dddddddd-0000-0000-0000-000000000002'
           and id > (select v from t.kv where k = 'log_api_from')::bigint order by id)
  = array['paid_until:active','restrict:restricted','unrestrict:active','paid_until:warning','paid_until:restricted',
          'paid_until:locked','lock:locked','unlock:locked','paid_until:active']);
select t.ok('isp: historial con actor api:Cobranza', not exists (select 1 from mdm_device_state_log
    where source = 'api' and details ->> 'actor' is distinct from 'api:Cobranza'));
select t.ok('isp: auditoría restrict/unrestrict', (select count(*) from mdm_audit_log where actor_label = 'api:Cobranza'
    and action in ('device.restrict', 'device.unrestrict')) = 2);
set role authenticated;
select t.err('authenticated no ejecuta mdm_isp_set_restricted', format('select mdm_isp_set_restricted(%L, %L, true)', (select v from t.kv where k='h1'), 'ref:CLI-001'), '42501');
reset role;
set role anon;
select t.err('anon no ejecuta mdm_isp_set_restricted', format('select mdm_isp_set_restricted(%L, %L, true)', (select v from t.kv where k='h1'), 'ref:CLI-001'), '42501');
reset role;

-- Panel: bloqueo y desbloqueo también quedan en el historial.
select t.as_user('11111111-1111-1111-1111-111111111111');
set role authenticated;
select mdm_set_device_lock('dddddddd-0000-0000-0000-000000000001', true, 'Prueba');
select mdm_set_device_lock('dddddddd-0000-0000-0000-000000000001', false);
reset role;
select t.ok('panel: lock/unlock en historial', array(select details ->> 'change' || ':' || state from mdm_device_state_log
    where source = 'panel' and device_id = 'dddddddd-0000-0000-0000-000000000001' and details ->> 'change' in ('lock', 'unlock') order by id)
  = array['lock:locked', 'unlock:active']);

-- ---------- 16. Historial: permisos ----------
select t.as_user('11111111-1111-1111-1111-111111111111');
set role authenticated;
select t.ok('log: owner A lee su historial', (select count(*) from mdm_device_state_log) > 0
    and not exists (select 1 from mdm_device_state_log where company_id <> 'aaaaaaaa-0000-0000-0000-000000000001'));
select t.err('log: authenticated no inserta', $q$insert into mdm_device_state_log (device_id, company_id, state, source) values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'active', 'panel')$q$, '42501');
select t.err('log: authenticated no borra', $q$delete from mdm_device_state_log$q$, '42501');
reset role;
select t.as_user('22222222-2222-2222-2222-222222222222');
set role authenticated;
select t.ok('log: B no ve historial de A', (select count(*) from mdm_device_state_log) = 0);
reset role;
select t.as_user('11111111-1111-1111-1111-111111111111', 'aal1');
set role authenticated;
select t.ok('log: aal1 no ve nada', (select count(*) from mdm_device_state_log) = 0);
reset role;
set role anon;
select t.err('log: anon no lee', $q$select count(*) from mdm_device_state_log$q$, '42501');
reset role;
select t.ok('helpers v9 no ejecutables por anon/authenticated',
  not exists (select 1 from pg_proc p where p.pronamespace='public'::regnamespace
     and p.proname in ('_mdm_payment_times','_mdm_service_state','_mdm_log_state','_mdm_apply_restricted','_mdm_isp_device_json')
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))));
select t.ok('mdm_update_company: una sola firma', (select count(*) from pg_proc where proname = 'mdm_update_company'
    and pronamespace = 'public'::regnamespace) = 1);
select t.ok('mdm_purge_old_events solo service_role', has_function_privilege('service_role', 'mdm_purge_old_events()', 'execute')
    and not has_function_privilege('authenticated', 'mdm_purge_old_events()', 'execute'));
set role service_role;
select mdm_purge_old_events();
reset role;
delete from mdm_devices where id = 'dddddddd-0000-0000-0000-000000000001';
select t.ok('historial en cascada', not exists (select 1 from mdm_device_state_log where device_id = 'dddddddd-0000-0000-0000-000000000001'));
