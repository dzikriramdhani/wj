import { redirect } from 'next/navigation';

export default function LegacyContentProductsPage() {
  redirect('/admin/products');
}
