import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PrivacyClient from './PrivacyClient';
export const dynamic = 'force-dynamic';
export default async function PrivacyPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login');
  const { data } = await supabase.from('data_subject_requests').select('id,request_type,status,note,resolution_note,created_at,updated_at').order('created_at', { ascending: false }).limit(20);
  return <PrivacyClient requests={data ?? []} />;
}
