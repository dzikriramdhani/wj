export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';

export default function WarehouseLayout() {
  redirect('/admin/orders');
}

