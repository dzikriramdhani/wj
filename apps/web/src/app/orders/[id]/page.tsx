import { redirect } from 'next/navigation';

export default async function LegacyOrderDetailsPage() {
  redirect('/account?tab=orders');
}
