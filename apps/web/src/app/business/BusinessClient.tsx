'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

type OrganizationMemberRole = 'owner' | 'admin' | 'buyer' | 'viewer';
type Member = { userId: string; name: string; role: OrganizationMemberRole };
type Org = {
  id: string;
  name: string;
  legalName: string;
  status: string;
  role: OrganizationMemberRole;
  industry: string;
  website: string;
  documents: Array<{ name: string; path: string }>;
  verification?: { decision: string | null; review_notes: string | null; submitted_at: string } | null;
  members: Member[];
};
type Quote = {
  id: string;
  revision: number;
  status: string;
  payment_terms: string;
  valid_until: string | null;
  created_at: string;
  quotation_items: Array<{ description: string; quantity: number | string; unit_price: number | string; line_total: number | string }>;
  bulk_orders: { bulk_order_number: string; status: string; total_amount: number | string } | Array<{ bulk_order_number: string; status: string; total_amount: number | string }> | null;
};

const money = (value: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(value);

const membershipRoleLabel: Record<OrganizationMemberRole, string> = {
  owner: 'Pemilik perusahaan',
  admin: 'Admin perusahaan',
  buyer: 'Pembeli perusahaan',
  viewer: 'Pembaca perusahaan',
};

const inviteRoles: Array<Exclude<OrganizationMemberRole, 'owner'>> = ['admin', 'buyer', 'viewer'];

async function responseError(response: Response, fallback: string) {
  const result = await response.json().catch(() => ({})) as { error?: string };
  return result.error ?? fallback;
}

export default function BusinessClient({
  organizations,
  quotations,
  currentUserId,
}: {
  organizations: Org[];
  quotations: Quote[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [managingOrganizationId, setManagingOrganizationId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', legalName: '', taxId: '', industry: '', website: '' });
  const [invite, setInvite] = useState<Record<string, { email: string; role: Exclude<OrganizationMemberRole, 'owner'> }>>({});

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const response = await fetch('/api/business/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!response.ok) return setMessage(await responseError(response, 'Perusahaan belum dapat dibuat.'));
    router.refresh();
    setCreating(false);
    setMessage('Perusahaan dibuat. Tambahkan anggota atau unggah dokumen verifikasi saat siap.');
  };

  const submitVerification = async (organizationId: string, files: FileList | null) => {
    if (!files?.length) return setMessage('Pilih dokumen verifikasi terlebih dahulu.');
    setBusy(true);
    setMessage('');
    const data = new FormData();
    data.set('organizationId', organizationId);
    [...files].forEach((file) => data.append('files', file));
    const uploaded = await fetch('/api/business/verification/documents', { method: 'POST', body: data });
    const result = await uploaded.json().catch(() => ({})) as { documents?: unknown; error?: string };
    if (!uploaded.ok) {
      setBusy(false);
      return setMessage(result.error ?? 'Dokumen belum dapat diunggah.');
    }
    const response = await fetch('/api/business/verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, documents: result.documents }),
    });
    setBusy(false);
    if (!response.ok) return setMessage(await responseError(response, 'Verifikasi belum dapat dikirim.'));
    setMessage('Dokumen verifikasi berhasil dikirim untuk ditinjau Sales.');
    router.refresh();
  };

  const quoteAction = async (id: string, payload: Record<string, string>) => {
    setBusy(true);
    setMessage('');
    const response = await fetch(`/api/quotations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response.ok) return setMessage(await responseError(response, 'Aksi belum dapat diproses.'));
    router.refresh();
  };

  const inviteMember = async (event: React.FormEvent, organizationId: string) => {
    event.preventDefault();
    const draft = invite[organizationId] ?? { email: '', role: 'buyer' as const };
    setBusy(true);
    setMessage('');
    const response = await fetch(`/api/business/organizations/${encodeURIComponent(organizationId)}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    setBusy(false);
    if (!response.ok) return setMessage(await responseError(response, 'Anggota belum dapat ditambahkan.'));
    setInvite((current) => ({ ...current, [organizationId]: { email: '', role: 'buyer' } }));
    setMessage('Anggota perusahaan berhasil ditambahkan.');
    router.refresh();
  };

  const updateMember = async (organizationId: string, userId: string, role: OrganizationMemberRole) => {
    setBusy(true);
    setMessage('');
    const response = await fetch(`/api/business/organizations/${encodeURIComponent(organizationId)}/members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    setBusy(false);
    if (!response.ok) return setMessage(await responseError(response, 'Role anggota belum dapat diperbarui.'));
    setMessage('Role anggota perusahaan diperbarui.');
    router.refresh();
  };

  const removeMember = async (organizationId: string, userId: string) => {
    setBusy(true);
    setMessage('');
    const response = await fetch(`/api/business/organizations/${encodeURIComponent(organizationId)}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setBusy(false);
    if (!response.ok) return setMessage(await responseError(response, 'Anggota belum dapat dihapus.'));
    setMessage('Anggota perusahaan dihapus.');
    router.refresh();
  };

  return (
    <main className={styles.main}>
      <div className={styles.wrap}>
        <Link href="/account" className={styles.back}>← Akun Saya</Link>
        <header>
          <p className={styles.eyebrow}>B2B PORTAL</p>
          <h1>Perusahaan &amp; penawaran</h1>
          <p>Kelola status perusahaan, anggota B2B, persetujuan quotation, dan bulk order.</p>
        </header>
        {message && <p className={styles.message} role="status">{message}</p>}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2>Perusahaan</h2>
              <p className={styles.roleNote}>Pemilik dan Admin perusahaan mengatur anggota serta quotation. Pembeli membuat RFQ. Pembaca hanya melihat informasi perusahaan.</p>
            </div>
            <button onClick={() => setCreating(!creating)}>+ Tambah perusahaan</button>
          </div>
          {creating && (
            <form className={styles.form} onSubmit={create}>
              {Object.entries(form).map(([key, value]) => (
                <label key={key}>
                  {key === 'name' ? 'Nama perusahaan' : key === 'legalName' ? 'Nama legal' : key === 'taxId' ? 'NPWP' : key === 'industry' ? 'Industri' : 'Website'}
                  <input required={key === 'name'} value={value} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
                </label>
              ))}
              <button disabled={busy}>Simpan perusahaan</button>
            </form>
          )}
          {organizations.length ? organizations.map((org) => {
            const isManager = org.role === 'owner' || org.role === 'admin';
            const isOwner = org.role === 'owner';
            const isManaging = managingOrganizationId === org.id;
            const draft = invite[org.id] ?? { email: '', role: 'buyer' as const };
            return (
              <article className={styles.card} key={org.id}>
                <div className={styles.cardHeader}>
                  <div>
                    <strong>{org.name}</strong>
                    <small>{org.legalName || 'Nama legal belum diisi'} · {membershipRoleLabel[org.role]}</small>
                  </div>
                  <span className={styles.status}>{org.status}</span>
                </div>
                <div className={styles.cardActions}>
                  {org.status === 'verified' && <Link href={`/rfq/new?organizationId=${org.id}`} className={styles.newRfq}>RFQ B2B</Link>}
                  {isManager && (
                    <button className={styles.memberToggle} onClick={() => setManagingOrganizationId(isManaging ? null : org.id)}>
                      {isManaging ? 'Tutup anggota' : `Kelola anggota (${org.members.length})`}
                    </button>
                  )}
                  {isManager && (
                    <label className={styles.upload}>
                      Dokumen verifikasi (PDF/JPG/PNG)
                      <input type="file" multiple accept="application/pdf,image/jpeg,image/png" onChange={(event) => submitVerification(org.id, event.target.files)} disabled={busy} />
                    </label>
                  )}
                </div>
                {org.verification?.review_notes && <p className={styles.reviewNote}>{org.verification.review_notes}</p>}
                {isManaging && (
                  <div className={styles.memberPanel}>
                    <div className={styles.memberPanelHeading}>
                      <div>
                        <h3>Anggota perusahaan</h3>
                        <p>Pengguna harus sudah memiliki akun Wina Jaya sebelum ditambahkan.</p>
                      </div>
                    </div>
                    <form className={styles.inviteForm} onSubmit={(event) => inviteMember(event, org.id)}>
                      <input
                        type="email"
                        required
                        placeholder="email@perusahaan.com"
                        value={draft.email}
                        onChange={(event) => setInvite((current) => ({ ...current, [org.id]: { ...draft, email: event.target.value } }))}
                      />
                      <select
                        value={draft.role}
                        onChange={(event) => setInvite((current) => ({ ...current, [org.id]: { ...draft, role: event.target.value as Exclude<OrganizationMemberRole, 'owner'> } }))}
                      >
                        {inviteRoles.map((role) => <option value={role} key={role}>{membershipRoleLabel[role]}</option>)}
                      </select>
                      <button disabled={busy}>Tambah anggota</button>
                    </form>
                    <div className={styles.memberList}>
                      {org.members.map((member) => {
                        const ownerLocked = !isOwner && member.role === 'owner';
                        const canRemove = member.userId !== currentUserId && !ownerLocked;
                        return (
                          <div className={styles.memberRow} key={member.userId}>
                            <div className={styles.memberInfo}>
                              <strong>{member.name}</strong>
                              <small>{membershipRoleLabel[member.role]}</small>
                            </div>
                            <div className={styles.memberControls}>
                              <select
                                value={member.role}
                                disabled={busy || ownerLocked}
                                onChange={(event) => updateMember(org.id, member.userId, event.target.value as OrganizationMemberRole)}
                                aria-label={`Role ${member.name}`}
                              >
                                {(isOwner || member.role === 'owner') && <option value="owner">{membershipRoleLabel.owner}</option>}
                                <option value="admin">{membershipRoleLabel.admin}</option>
                                <option value="buyer">{membershipRoleLabel.buyer}</option>
                                <option value="viewer">{membershipRoleLabel.viewer}</option>
                              </select>
                              {canRemove && <button className={styles.dangerButton} disabled={busy} onClick={() => removeMember(org.id, member.userId)}>Hapus</button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          }) : <p className={styles.empty}>Belum ada perusahaan. Buat perusahaan untuk mengajukan RFQ B2B dan menerima harga khusus.</p>}
        </section>

        <section className={styles.section}>
          <h2>Quotation</h2>
          {quotations.length ? quotations.map((quote) => {
            const total = quote.quotation_items.reduce((sum, item) => sum + Number(item.line_total), 0);
            return (
              <article className={styles.quote} key={quote.id}>
                <div>
                  <strong>Quotation rev. {quote.revision}</strong>
                  <small>{quote.status} · berlaku hingga {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('id-ID') : '-'}</small>
                  {quote.quotation_items.map((item) => <p key={item.description}>{item.description} · {Number(item.quantity).toLocaleString('id-ID')} m</p>)}
                </div>
                <div>
                  <strong>{money(total)}</strong>
                  {quote.status === 'sent' && (
                    <span className={styles.actions}>
                      <button disabled={busy} onClick={() => quoteAction(quote.id, { action: 'respond', decision: 'accepted' })}>Setujui</button>
                      <button disabled={busy} onClick={() => quoteAction(quote.id, { action: 'respond', decision: 'rejected' })}>Minta revisi</button>
                    </span>
                  )}
                </div>
              </article>
            );
          }) : <p className={styles.empty}>Quotation yang dikirim Sales akan muncul di sini.</p>}
        </section>
      </div>
    </main>
  );
}
