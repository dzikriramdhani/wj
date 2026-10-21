import { redirect } from 'next/navigation';

export default function LegacyAdminHomeContentPage() {
  redirect('/super-admin/content/home');
}
