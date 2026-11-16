import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasSupabasePublicEnv } from '@/lib/supabase/env';
import { getCurrentPlatformAccess, requiresMfaForRoles } from '@/lib/role-access';
import type { RFQStatus } from '@/types';
import AccountClient from './AccountClient';

type AccountPageSize = 5 | 10 | 15 | 'all';

function parsePageSize(value: string | undefined): AccountPageSize {
  if (value === 'all') return 'all';
  if (value === '15') return 15;
  if (value === '10') return 10;
  return 5;
}

function parsePage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function clampPage(page: number, total: number, pageSize: AccountPageSize) {
  if (pageSize === 'all') return 1;
  return Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
}

function safeMfaContinuePath(value: string | undefined, fallback: string) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return /^\/(admin|super-admin)(?:\/|$)/.test(value) ? value : fallback;
}

export default async function AccountPage({
  searchParams,
}: {
    searchParams: Promise<{
      next?: string;
      tab?: string;
      ordersPage?: string;
      ordersPageSize?: string;
      rfqPage?: string;
      rfqPageSize?: string;
      notifikasiPage?: string;
      notifikasiPageSize?: string;
    }>;
}) {
  if (!hasSupabasePublicEnv()) redirect('/login?setup=supabase');

  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const access = await getCurrentPlatformAccess();
  const workspaceLinks = [
    ...(access.roles.includes('super_admin') ? [{ href: '/super-admin', label: 'Portal Super Admin' }] : []),
    ...(access.roles.includes('admin') ? [{ href: '/admin', label: 'Portal Admin' }] : []),
  ];
  const mfaRequired = requiresMfaForRoles(access.roles);
  const mfaContinueTo = safeMfaContinuePath(params.next, access.defaultPortal);

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name,phone,created_at')
    .eq('id', user.id)
    .maybeSingle();

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organizations(name)')
    .eq('user_id', user.id)
    .limit(1);

  const rfqPageSize = parsePageSize(params.rfqPageSize);
  const rfqCountResult = await supabase
    .from('rfqs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  const rfqTotal = rfqCountResult.count ?? 0;
  const rfqPage = clampPage(parsePage(params.rfqPage), rfqTotal, rfqPageSize);
  const rfqBatchSize = rfqPageSize === 'all' ? 500 : rfqPageSize;
  const rfqStart = rfqPageSize === 'all' ? 0 : (rfqPage - 1) * rfqPageSize;
  const rfqEnd = rfqPageSize === 'all' ? Math.min(rfqTotal - 1, rfqBatchSize - 1) : rfqStart + rfqPageSize - 1;
  const fetchRfqRange = (start: number, end: number) => supabase
    .from('rfqs')
    .select('id,status,created_at,deadline,specifications,rfq_items(requested_quantity,products(name))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, end);
  const rfqFirstBatch = await fetchRfqRange(rfqStart, Math.max(rfqStart, rfqEnd));
  const rfqRows = [...(rfqFirstBatch.data ?? [])];
  if (rfqPageSize === 'all') {
    for (let offset = rfqBatchSize; offset < rfqTotal; offset += rfqBatchSize) {
      const batch = await fetchRfqRange(offset, Math.min(offset + rfqBatchSize - 1, rfqTotal - 1));
      rfqRows.push(...(batch.data ?? []));
    }
  }

  const rfqIds = (rfqRows ?? []).map((rfq) => rfq.id);
  const quotationRows = rfqIds.length
    ? (await supabase
      .from('quotations')
      .select('id,rfq_id,revision,status,payment_terms,valid_until,quotation_items(description,quantity,unit_price,line_total)')
      .in('rfq_id', rfqIds)
      .order('revision', { ascending: false })).data ?? []
    : [];
  const quotationsByRfq = new Map<string, Array<(typeof quotationRows)[number]>>();
  for (const quotation of quotationRows) {
    const current = quotationsByRfq.get(quotation.rfq_id) ?? [];
    current.push(quotation);
    quotationsByRfq.set(quotation.rfq_id, current);
  }

  const ordersPageSize = parsePageSize(params.ordersPageSize);
  const ordersCountResult = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  const ordersTotal = ordersCountResult.count ?? 0;
  const ordersPage = clampPage(parsePage(params.ordersPage), ordersTotal, ordersPageSize);
  const ordersBatchSize = ordersPageSize === 'all' ? 500 : ordersPageSize;
  const ordersStart = ordersPageSize === 'all' ? 0 : (ordersPage - 1) * ordersPageSize;
  const ordersEnd = ordersPageSize === 'all' ? Math.min(ordersTotal - 1, ordersBatchSize - 1) : ordersStart + ordersPageSize - 1;
  const fetchOrdersRange = (start: number, end: number) => supabase
    .from('orders')
    .select('id,order_number,status,grand_total,created_at,payments(status)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, end);
  const orderFirstBatch = await fetchOrdersRange(ordersStart, Math.max(ordersStart, ordersEnd));
  const orderRows = [...(orderFirstBatch.data ?? [])];
  if (ordersPageSize === 'all') {
    for (let offset = ordersBatchSize; offset < ordersTotal; offset += ordersBatchSize) {
      const batch = await fetchOrdersRange(offset, Math.min(offset + ordersBatchSize - 1, ordersTotal - 1));
      orderRows.push(...(batch.data ?? []));
    }
  }

  const { data: recentOrderRows } = await supabase
    .from('orders')
    .select('id,order_number,status,grand_total,created_at,payments(status)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(2);

  const notificationsPageSize = parsePageSize(params.notifikasiPageSize);
  const notificationsCountResult = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true });
  const notificationsTotal = notificationsCountResult.count ?? 0;
  const notificationsPage = clampPage(parsePage(params.notifikasiPage), notificationsTotal, notificationsPageSize);
  const notificationsBatchSize = notificationsPageSize === 'all' ? 500 : notificationsPageSize;
  const notificationsStart = notificationsPageSize === 'all' ? 0 : (notificationsPage - 1) * notificationsPageSize;
  const notificationsEnd = notificationsPageSize === 'all'
    ? Math.min(notificationsTotal - 1, notificationsBatchSize - 1)
    : notificationsStart + notificationsPageSize - 1;
  const fetchNotificationsRange = (start: number, end: number) => supabase
    .from('notifications')
    .select('id,title,body,link_path,read_at,created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, end);
  const notificationFirstBatch = await fetchNotificationsRange(notificationsStart, Math.max(notificationsStart, notificationsEnd));
  const notificationRows = [...(notificationFirstBatch.data ?? [])];
  if (notificationsPageSize === 'all') {
    for (let offset = notificationsBatchSize; offset < notificationsTotal; offset += notificationsBatchSize) {
      const batch = await fetchNotificationsRange(offset, Math.min(offset + notificationsBatchSize - 1, notificationsTotal - 1));
      notificationRows.push(...(batch.data ?? []));
    }
  }

  const organizationRelation = memberships?.[0]?.organizations;
  const organization = Array.isArray(organizationRelation)
    ? organizationRelation[0]
    : organizationRelation;

  return (
    <AccountClient
      user={{
        name: profile?.full_name ?? String(user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Pelanggan'),
        email: user.email ?? '',
        phone: profile?.phone ?? String(user.user_metadata?.phone ?? '-'),
        company: organization?.name ?? '-',
        memberSince: profile?.created_at ?? user.created_at,
      }}
      rfqs={(rfqRows ?? []).map((rfq) => {
        const item = Array.isArray(rfq.rfq_items) ? rfq.rfq_items[0] : rfq.rfq_items;
        const productRelation = item?.products;
        const product = Array.isArray(productRelation) ? productRelation[0] : productRelation;
        return {
          id: rfq.id,
          status: rfq.status.toUpperCase() as RFQStatus,
          createdAt: rfq.created_at,
          deadline: rfq.deadline,
          qtyRequested: Number(item?.requested_quantity ?? 0),
          productName: product?.name ?? 'Permintaan kain custom',
          specifications: (rfq.specifications ?? {}) as Record<string, unknown>,
          quotations: (quotationsByRfq.get(rfq.id) ?? []).map((quotation) => ({
            id: quotation.id,
            revision: quotation.revision,
            status: quotation.status,
            paymentTerms: quotation.payment_terms,
            validUntil: quotation.valid_until,
            items: (quotation.quotation_items ?? []).map((line) => ({
              description: line.description,
              quantity: Number(line.quantity),
              unitPrice: Number(line.unit_price),
              lineTotal: Number(line.line_total),
            })),
          })),
        };
      })}
      orders={orderRows.map((order) => {
        const payment = Array.isArray(order.payments) ? order.payments[0] : order.payments;
        return {
          id: order.id,
          orderNumber: order.order_number,
          orderStatus: order.status,
          paymentStatus: payment?.status ?? 'pending',
          totalAmount: Number(order.grand_total),
          createdAt: order.created_at,
        };
      })}
      recentOrders={(recentOrderRows ?? []).map((order) => {
        const payment = Array.isArray(order.payments) ? order.payments[0] : order.payments;
        return {
          id: order.id,
          orderNumber: order.order_number,
          orderStatus: order.status,
          paymentStatus: payment?.status ?? 'pending',
          totalAmount: Number(order.grand_total),
          createdAt: order.created_at,
        };
      })}
      ordersPagination={{ page: ordersPage, pageSize: ordersPageSize, total: ordersTotal }}
      rfqsPagination={{ page: rfqPage, pageSize: rfqPageSize, total: rfqTotal }}
      notificationsPagination={{ page: notificationsPage, pageSize: notificationsPageSize, total: notificationsTotal }}
      notifications={notificationRows.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        linkPath: notification.link_path,
        readAt: notification.read_at,
        createdAt: notification.created_at,
      }))}
      workspaceLinks={workspaceLinks}
      mfaRequired={mfaRequired}
      mfaContinueTo={mfaContinueTo}
      mfaRequirement={access.roles.includes('super_admin') ? 'Super Admin' : 'Admin'}
      initialTab={params.tab === 'orders' || params.tab === 'profil' || params.tab === 'rfq' || params.tab === 'notifikasi' ? params.tab : 'overview'}
    />
  );
}
