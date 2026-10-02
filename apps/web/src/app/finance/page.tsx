import { redirect } from 'next/navigation';

export default function LegacyFinancePage() {
  redirect('/admin/orders');
}
