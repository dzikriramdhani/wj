'use client';

import { useMemo, useState } from 'react';
import styles from './page.module.css';
import AdminPagination, { useAdminPagination } from '../_components/AdminPagination';

type Customer = { id: string; name: string; phone: string; role: string; organization: string; createdAt: string };

export default function CustomersClient({ customers, loadError }: { customers: Customer[]; loadError?: string }) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => customers.filter((customer) => [customer.name, customer.phone, customer.role, customer.organization]
    .some((value) => value.toLowerCase().includes(query.toLowerCase()))), [customers, query]);
  const pagination = useAdminPagination(rows);
  return <section className={styles.page}>
    <header className={styles.header}><div><h1>Customer</h1></div><input value={query} onChange={(event) => { setQuery(event.target.value); pagination.resetPage(); }} placeholder="Cari nama, telepon, perusahaan…" aria-label="Cari customer" /></header>
    <div className={styles.tableWrap}><table><thead><tr><th>Customer</th><th>Telepon</th><th>Role</th><th>Perusahaan</th><th>Bergabung</th></tr></thead><tbody>
      {pagination.items.map((customer) => <tr key={customer.id}><td>{customer.name}</td><td>{customer.phone}</td><td><span>{customer.role}</span></td><td>{customer.organization}</td><td>{new Date(customer.createdAt).toLocaleDateString('id-ID')}</td></tr>)}
      {!rows.length && <tr><td colSpan={5}>{loadError ?? 'Tidak ada customer yang cocok.'}</td></tr>}
    </tbody></table><AdminPagination page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize} total={pagination.total} start={pagination.start} end={pagination.end} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} label="customer" /></div>
  </section>;
}
