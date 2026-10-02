import { redirect } from 'next/navigation';

export default function LegacyWarehousePage() {
  redirect('/admin/orders');
}
