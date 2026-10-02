'use client';

import { useMemo, useState } from 'react';
import styles from './page.module.css';

type ManagedRole = 'admin' | 'super_admin';
type User = { id: string; name: string; email: string; createdAt: string; roles: string[] };

const roleLabel: Record<ManagedRole, string> = {
  admin: 'Admin',
  super_admin: 'Super Admin',
};

export default function SuperAdminUsersClient({
  users: initialUsers,
  currentUserId,
  roles,
}: {
  users: User[];
  currentUserId: string;
  roles: ManagedRole[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => `${user.name} ${user.email} ${user.roles.join(' ')}`.toLowerCase().includes(needle));
  }, [query, users]);

  const updateRole = async (user: User, role: ManagedRole, enabled: boolean) => {
    const key = `${user.id}:${role}`;
    setBusyKey(key);
    setMessage('');
    try {
      const response = await fetch(`/api/super-admin/users/${encodeURIComponent(user.id)}/roles`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, enabled }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Role belum dapat diperbarui.');
      setUsers((current) => current.map((item) => item.id === user.id ? {
        ...item,
        roles: enabled
          ? [...new Set([...item.roles, role])]
          : item.roles.filter((itemRole) => itemRole !== role),
      } : item));
      setMessage(`${roleLabel[role]} ${enabled ? 'ditambahkan ke' : 'dihapus dari'} ${user.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Role belum dapat diperbarui.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>SECURITY WORKSPACE</p>
          <h1>Pengguna &amp; role</h1>
          <p>Kelola tiga role platform: User bawaan, Admin, dan Super Admin. Role organisasi B2B dikelola di Portal Perusahaan.</p>
        </div>
        <span>MFA aktif</span>
      </header>
      {message && <p className={styles.message} role="status">{message}</p>}
      <input className={styles.search} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, email, atau role…" />
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Pengguna</th>
              <th>User</th>
              {roles.map((role) => <th key={role}>{roleLabel[role]}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => <tr key={user.id}>
              <td>
                <strong>{user.name}</strong>
                <small>{user.email || `ID: ${user.id.slice(0, 8)}…`}</small>
              </td>
              <td><span className={styles.fixedRole}>Ya</span></td>
              {roles.map((role) => {
                const assigned = user.roles.includes(role);
                const disabled = busyKey !== null || (role === 'super_admin' && user.id === currentUserId);
                return <td key={role}>
                  <label className={styles.toggle} title={role === 'super_admin' && user.id === currentUserId ? 'Gunakan Super Admin lain untuk mengubah role Anda.' : roleLabel[role]}>
                    <input
                      type="checkbox"
                      checked={assigned}
                      disabled={disabled}
                      onChange={(event) => void updateRole(user, role, event.target.checked)}
                      aria-label={`${roleLabel[role]} untuk ${user.name}`}
                    />
                    <span>{assigned ? 'Aktif' : '—'}</span>
                  </label>
                </td>;
              })}
            </tr>)}
            {!filtered.length && <tr><td colSpan={roles.length + 2} className={styles.empty}>Tidak ada pengguna yang sesuai.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
