import { getSupabase, getSupabaseErrorMessage } from '../lib/supabase';
import type { VerifiedReason } from './userProfiles';

const STAFF_KEY_STORAGE = 'nexMusicStaffKey';

export type PendingVerification = {
  id: string;
  user_id: string;
  nickname: string;
  message: string | null;
  status: string;
  created_at: string;
};

export function loadStaffKey(): string {
  try {
    return sessionStorage.getItem(STAFF_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function saveStaffKey(key: string) {
  try {
    if (key) sessionStorage.setItem(STAFF_KEY_STORAGE, key);
    else sessionStorage.removeItem(STAFF_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

function mapRpcError(err: unknown): Error {
  const msg = getSupabaseErrorMessage(err);
  if (msg.includes('staff_') || msg.includes('nex_staff') || msg.includes('schema')) {
    return new Error(`${msg} — ejecutá supabase/schema-staff-verify-v5.sql una vez`);
  }
  return new Error(msg);
}

export async function staffUnlock(staffKey: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.rpc('staff_unlock', { p_staff_key: staffKey });
  if (error) throw mapRpcError(error);
  return Boolean(data);
}

export async function staffListPending(staffKey: string): Promise<PendingVerification[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.rpc('staff_list_pending', { p_staff_key: staffKey });
  if (error) throw mapRpcError(error);
  return (data ?? []) as PendingVerification[];
}

export async function staffVerifyNickname(
  nickname: string,
  reason: VerifiedReason,
  staffKey: string,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.rpc('staff_verify_nickname', {
    p_nickname: nickname.trim(),
    p_reason: reason,
    p_staff_key: staffKey,
  });
  if (error) throw mapRpcError(error);
}

export async function staffUnverifyNickname(nickname: string, staffKey: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.rpc('staff_unverify_nickname', {
    p_nickname: nickname.trim(),
    p_staff_key: staffKey,
  });
  if (error) throw mapRpcError(error);
}

export async function staffRejectRequest(requestId: string, staffKey: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.rpc('staff_reject_request', {
    p_request_id: requestId,
    p_staff_key: staffKey,
  });
  if (error) throw mapRpcError(error);
}

export async function staffSetKey(oldKey: string, newKey: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.rpc('staff_set_key', {
    p_old_key: oldKey,
    p_new_key: newKey,
  });
  if (error) throw mapRpcError(error);
}
