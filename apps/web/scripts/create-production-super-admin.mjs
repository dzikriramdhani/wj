import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD;
const fullName = process.env.SUPER_ADMIN_NAME?.trim() || 'Super Admin';

if (!url || !serviceKey || !email || !password) {
  throw new Error('SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPER_ADMIN_EMAIL, dan SUPER_ADMIN_PASSWORD wajib diisi.');
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;

let user = listed.users.find((item) => item.email?.toLowerCase() === email);
let created = false;
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error('Akun Auth tidak dapat dibuat.');
  user = data.user;
  created = true;
}

const { data: superAdminRole, error: roleError } = await supabase
  .from('roles')
  .select('id')
  .eq('name', 'super_admin')
  .single();
if (roleError || !superAdminRole) throw roleError ?? new Error('Role super_admin tidak ditemukan.');

const { error: assignmentError } = await supabase
  .from('user_roles')
  .upsert(
    { user_id: user.id, role_id: superAdminRole.id, assigned_by: user.id },
    { onConflict: 'user_id,role_id', ignoreDuplicates: true },
  );
if (assignmentError) throw assignmentError;

const { error: auditError } = await supabase.from('audit_logs').insert({
  actor_user_id: user.id,
  action: 'security.role_granted',
  entity_type: 'user_role',
  entity_id: user.id,
  metadata: { role: 'super_admin', bootstrap: true },
});
if (auditError) throw auditError;

console.log(JSON.stringify({ email, created, role: 'super_admin', mfaEnrollmentRequired: true }));
