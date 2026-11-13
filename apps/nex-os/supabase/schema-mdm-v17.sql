-- NEX MDM v17: sync liviano.
--
-- Cada equipo sincroniza cada 60 s y hasta v16 recibía la configuración completa (apps, comunicados, dominios
-- bloqueados, pago, OTA...) aunque no hubiera cambiado nada: es casi todo el tráfico de salida de Supabase.
-- Desde v17 la respuesta completa trae 'config_hash' (md5 de la configuración, sin la hora del servidor). Si el
-- equipo manda ese hash en p_status.config_hash y la configuración sigue igual, recibe solo
--   {status: 'paired', unchanged: true, config_hash, server_time, server_epoch}
-- y usa la que tiene guardada. El latido, los eventos y la salud se procesan igual que antes.
--
-- Cómo: el cuerpo de v15 pasa a llamarse _mdm_device_sync_full (sin permisos para anon) y mdm_device_sync es un
-- envoltorio con la misma firma. Los equipos viejos y los agentes Linux no mandan hash: reciben todo, más el campo
-- config_hash que ignoran. **Los cambios futuros del sync van en _mdm_device_sync_full.**
-- Idempotente.

do $$
begin
  if to_regprocedure('public._mdm_device_sync_full(text, text, jsonb, jsonb, text)') is null then
    alter function public.mdm_device_sync(text, text, jsonb, jsonb, text) rename to _mdm_device_sync_full;
  end if;
end;
$$;

revoke all on function public._mdm_device_sync_full(text, text, jsonb, jsonb, text) from public, anon, authenticated;

create or replace function public.mdm_device_sync(p_token text, p_firmware text default null,
                                                  p_status jsonb default null, p_events jsonb default null,
                                                  p_hardware_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_known text := case when jsonb_typeof(p_status) = 'object' and (p_status ->> 'config_hash') ~ '^[0-9a-f]{32}$'
                       then p_status ->> 'config_hash' end;
  v_resp jsonb;
  v_hash text;
begin
  -- El hash no es parte de la salud del equipo: no se guarda en mdm_devices.health.
  v_resp := public._mdm_device_sync_full(
    p_token, p_firmware,
    case when jsonb_typeof(p_status) = 'object' then p_status - 'config_hash' else p_status end,
    p_events, p_hardware_id);
  if v_resp ->> 'status' is distinct from 'paired' then
    return v_resp;
  end if;
  v_hash := md5((v_resp - 'server_time' - 'server_epoch')::text);
  if v_known = v_hash then
    return jsonb_build_object('status', 'paired', 'unchanged', true, 'config_hash', v_hash,
                              'server_time', v_resp -> 'server_time', 'server_epoch', v_resp -> 'server_epoch');
  end if;
  return v_resp || jsonb_build_object('config_hash', v_hash);
end;
$$;

revoke all on function public.mdm_device_sync(text, text, jsonb, jsonb, text) from public;
grant execute on function public.mdm_device_sync(text, text, jsonb, jsonb, text) to anon, authenticated;
