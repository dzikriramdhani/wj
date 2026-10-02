import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdminUser } from '@/lib/super-admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const managedRoleSchema = z.enum(['admin', 'super_admin']);
const roleSchema = z.object({ role: managedRoleSchema, enabled: z.boolean() }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rate = checkRateLimit(request, 'super-admin-role-update', 30, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak perubahan role. Coba lagi beberapa menit lagi.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });

  const actor = await requireSuperAdminUser();
  if (!actor) return NextResponse.json({ error: 'Akses Super Admin dengan MFA diperlukan.' }, { status: 403 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'ID pengguna tidak valid.' }, { status: 400 });
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Perubahan role tidak valid.' }, { status: 400 });

  try {
    const service = createServiceClient();
    const { error } = await service.rpc('set_platform_user_role', {
      p_actor_user_id: actor.id,
      p_target_user_id: id,
      p_role_name: parsed.data.role,
      p_enabled: parsed.data.enabled,
    });
    if (error) {
      const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 422;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('super admin role update failed', error);
    return NextResponse.json({ error: 'Role belum dapat diperbarui.' }, { status: 500 });
  }
}
