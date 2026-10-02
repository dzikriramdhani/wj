import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const memberRoleSchema = z.enum(['owner', 'admin', 'buyer', 'viewer']);
const inviteSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(['admin', 'buyer', 'viewer']).default('buyer'),
}).strict();
const updateSchema = z.object({ userId: z.uuid(), role: memberRoleSchema }).strict();
const removeSchema = z.object({ userId: z.uuid() }).strict();

async function currentManager(organizationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Silakan masuk terlebih dahulu.' }, { status: 401 }) };

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return { error: NextResponse.json({ error: 'Akses Pemilik atau Admin perusahaan diperlukan.' }, { status: 403 }) };
  }
  return { user };
}

async function saveMember(
  actorUserId: string,
  organizationId: string,
  memberUserId: string,
  role: z.infer<typeof memberRoleSchema>,
  action: 'upsert' | 'remove',
) {
  const service = createServiceClient();
  const { error } = await service.rpc('manage_organization_member', {
    p_actor_user_id: actorUserId,
    p_organization_id: organizationId,
    p_member_user_id: memberUserId,
    p_role: role,
    p_action: action,
  });
  if (!error) return null;
  const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 422;
  return NextResponse.json({ error: error.message }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rate = checkRateLimit(request, 'business-member-create', 30, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak perubahan anggota. Coba lagi beberapa menit lagi.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'ID perusahaan tidak valid.' }, { status: 400 });
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Email atau role anggota tidak valid.' }, { status: 400 });
  const manager = await currentManager(id);
  if ('error' in manager) return manager.error;

  try {
    const service = createServiceClient();
    const { data: users, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    const email = parsed.data.email.toLowerCase();
    const target = users.users.find((item) => item.email?.toLowerCase() === email);
    if (!target) return NextResponse.json({ error: 'Akun dengan email tersebut belum terdaftar di Wina Jaya.' }, { status: 404 });
    const failure = await saveMember(manager.user.id, id, target.id, parsed.data.role, 'upsert');
    return failure ?? NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('business member creation failed', error);
    return NextResponse.json({ error: 'Anggota perusahaan belum dapat ditambahkan.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rate = checkRateLimit(request, 'business-member-update', 30, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak perubahan anggota. Coba lagi beberapa menit lagi.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'ID perusahaan tidak valid.' }, { status: 400 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Perubahan anggota tidak valid.' }, { status: 400 });
  const manager = await currentManager(id);
  if ('error' in manager) return manager.error;

  try {
    const failure = await saveMember(manager.user.id, id, parsed.data.userId, parsed.data.role, 'upsert');
    return failure ?? NextResponse.json({ success: true });
  } catch (error) {
    console.error('business member update failed', error);
    return NextResponse.json({ error: 'Role anggota belum dapat diperbarui.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rate = checkRateLimit(request, 'business-member-delete', 30, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak perubahan anggota. Coba lagi beberapa menit lagi.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'ID perusahaan tidak valid.' }, { status: 400 });
  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Anggota yang akan dihapus tidak valid.' }, { status: 400 });
  const manager = await currentManager(id);
  if ('error' in manager) return manager.error;

  try {
    const failure = await saveMember(manager.user.id, id, parsed.data.userId, 'buyer', 'remove');
    return failure ?? NextResponse.json({ success: true });
  } catch (error) {
    console.error('business member removal failed', error);
    return NextResponse.json({ error: 'Anggota perusahaan belum dapat dihapus.' }, { status: 500 });
  }
}
