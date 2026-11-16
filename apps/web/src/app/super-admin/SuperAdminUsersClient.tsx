'use client';

import { useMemo, useState } from 'react';
import styles from './page.module.css';

type ManagedRole = 'user' | 'admin' | 'super_admin';
type User = { id: string; name: string; email: string; createdAt: string; profileExists: boolean; roles: string[] };

const roleLabel: Record<ManagedRole, string> = {
  user: 'User',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

function primaryRole(user: User): ManagedRole {
  if (user.roles.includes('super_admin')) return 'super_admin';
  if (user.roles.includes('admin')) return 'admin';
  return 'user';
}

export default function SuperAdminUsersClient({
  users: initialUsers,
  currentUserId,
  roles,
  loadError = false,
}: {
  users: User[];
  currentUserId: string;
  roles: ManagedRole[];
  loadError?: boolean;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<ManagedRole>('user');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => `${user.name} ${user.email} ${roleLabel[primaryRole(user)]}`.toLowerCase().includes(needle));
  }, [query, users]);

  const updateRole = async (user: User) => {
    const previousRole = primaryRole(user);
    if (selectedRole === previousRole) {
      setEditingUserId(null);
      return;
    }
    if (!window.confirm(`Ubah role ${user.name} dari ${roleLabel[previousRole]} menjadi ${roleLabel[selectedRole]}?`)) return;

    setBusyKey(user.id);
    setMessage('');
    try {
      const response = await fetch(`/api/super-admin/users/${encodeURIComponent(user.id)}/roles`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Role belum dapat diperbarui.');
      setUsers((current) => current.map((item) => item.id === user.id ? {
        ...item,
        roles: [...new Set([...item.roles.filter((itemRole) => !['user', 'admin', 'super_admin'].includes(itemRole)), 'user', ...(selectedRole === 'user' ? [] : [selectedRole])])],
      } : item));
      setMessage(`Role ${user.name} sekarang ${roleLabel[selectedRole]}.`);
      setEditingUserId(null);
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
          <h1>Pengguna &amp; role</h1>
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
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => <tr key={user.id}>
              <td>
                <strong>{user.name}</strong>
                <small>{user.email || `ID: ${user.id.slice(0, 8)}…`}</small>
                {!user.profileExists && <small>Profil pengguna belum tersedia.</small>}
              </td>
              <td>
                {editingUserId === user.id ? (
                  <div className={styles.roleEditor}>
                    <select className={styles.roleSelect} value={selectedRole} disabled={busyKey === user.id} onChange={(event) => setSelectedRole(event.target.value as ManagedRole)} aria-label={`Role untuk ${user.name}`}>
                      {roles.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}
                    </select>
                    <button type="button" className={styles.roleAction} disabled={busyKey === user.id} onClick={() => void updateRole(user)}>{busyKey === user.id ? 'Menyimpan…' : 'Simpan'}</button>
                    <button type="button" className={`${styles.roleAction} ${styles.roleCancel}`} disabled={busyKey === user.id} onClick={() => setEditingUserId(null)}>Batal</button>
                  </div>
                ) : (
                  <div className={styles.roleCell}>
                    <span>{roleLabel[primaryRole(user)]}</span>
                    <button
                      type="button"
                      className={styles.editRoleButton}
                      disabled={busyKey !== null || !user.profileExists || user.id === currentUserId}
                      title={!user.profileExists ? 'Profil pengguna belum tersedia.' : user.id === currentUserId ? 'Gunakan Super Admin lain untuk mengubah role Anda.' : 'Edit role'}
                      onClick={() => { setSelectedRole(primaryRole(user)); setEditingUserId(user.id); }}
                    >Edit</button>
                  </div>
                )}
              </td>
            </tr>)}
            {!filtered.length && <tr><td colSpan={2} className={styles.empty}>{loadError ? 'Data pengguna & role belum dapat dimuat. Muat ulang halaman.' : 'Tidak ada pengguna yang sesuai.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
