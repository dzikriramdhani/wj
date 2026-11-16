import { redirect } from 'next/navigation';
import RFQForm from './RFQForm';

export default async function RFQPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const organizationId = typeof query.organizationId === 'string' ? query.organizationId : undefined;
  const productId = typeof query.productId === 'string' ? query.productId : undefined;

  if (!organizationId) {
    const destination = productId
      ? `/business?productId=${encodeURIComponent(productId)}`
      : '/business';
    redirect(destination);
  }

  return <RFQForm organizationId={organizationId} productId={productId} />;
}
