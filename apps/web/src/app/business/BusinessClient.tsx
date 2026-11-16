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
  quotation_approvals: { decision: string; note: string | null; created_at: string } | Array<{ decision: string; note: string | null; created_at: string }> | null;
  bulk_orders: { id: string; bulk_order_number: string; status: string; payment_status: string; total_amount: number | string } | Array<{ id: string; bulk_order_number: string; status: string; payment_status: string; total_amount: number | string }> | null;
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
const organizationStatusLabel: Record<string, string> = {
  pending: 'Menunggu verifikasi',
  verified: 'Terverifikasi',
  rejected: 'Perlu ditinjau',
  suspended: 'Ditangguhkan',
};

async function responseError(response: Response, fallback: string) {
  const result = await response.json().catch(() => ({})) as { error?: string };
  return result.error ?? fallback;
}

export default function BusinessClient({
  organizations,
  quotations,
  currentUserId,
  productId,
}: {
  organizations: Org[];
  quotations: Quote[];
  currentUserId: string;
  productId?: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [managingOrganizationId, setManagingOrganizationId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', legalName: '', taxId: '', industry: '', website: '' });
  const [invite, setInvite] = useState<Record<string, { email: string; role: Exclude<OrganizationMemberRole, 'owner'> }>>({});
  const [revisionNote, setRevisionNote] = useState<Record<string, string>>({});
  const rfqHref = (organizationId: string) => {
    const query = new URLSearchParams({ organizationId });
    if (productId) query.set('productId', productId);
    return `/rfq/new?${query.toString()}`;
  };

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

  const quoteAction = async (id: string, payload: Record<string, string>, successMessage: string) => {
    setBusy(true);
    setMessage('');
    const response = await fetch(`/api/quotations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response.ok) return setMessage(await responseError(response, 'Aksi belum dapat diproses.'));
    setMessage(successMessage);
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
        <header className={styles.hero}>
          <h1>Perusahaan &amp; penawaran</h1>
          <p>Kelola status perusahaan, anggota B2B, persetujuan quotation, dan bulk order.</p>
        </header>

        <nav className={styles.sectionIndex} aria-label="Bagian portal bisnis">
          <a href="#organizations" className={styles.indexLink}>
            <span>Perusahaan</span>
            <span className={styles.indexCount}>{String(organizations.length).padStart(2, '0')}</span>
          </a>
          <a href="#quotations" className={styles.indexLink}>
            <span>Quotation</span>
            <span className={styles.indexCount}>{String(quotations.length).padStart(2, '0')}</span>
          </a>
        </nav>

        {message && <p className={styles.message} role="status">{message}</p>}

        <section className={styles.section} id="organizations" aria-labelledby="organizations-title">
          <div className={styles.sectionHead}>
            <div>
              <h2 id="organizations-title">Perusahaan</h2>
              <p className={styles.roleNote}>Pemilik dan Admin perusahaan mengatur anggota serta quotation. Pembeli membuat RFQ. Pembaca hanya melihat informasi perusahaan.</p>
            </div>
            <button
              className={styles.addOrganizationButton}
              type="button"
              aria-expanded={creating}
              onClick={() => setCreating(!creating)}
            >
              <span>{creating ? 'Tutup form' : 'Tambah perusahaan'}</span>
              <svg className={styles.addIcon} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                {creating
                  ? <path d="m3 3 10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.3" />
                  : <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.3" />}
              </svg>
            </button>
          </div>
          {creating && (
            <form className={styles.form} id="company-create-form" onSubmit={create}>
              {Object.entries(form).map(([key, value]) => (
                <label key={key}>
                  {key === 'name' ? 'Nama perusahaan' : key === 'legalName' ? 'Nama legal' : key === 'taxId' ? 'NPWP' : key === 'industry' ? 'Industri' : 'Website'}
                  <input
                    required={key === 'name'}
                    value={value}
                    onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                    autoComplete={key === 'name' ? 'organization' : key === 'website' ? 'url' : 'off'}
                  />
                </label>
              ))}
              <button className={styles.formSubmit} disabled={busy}>
                <span>{busy ? 'Menyimpan...' : 'Simpan perusahaan'}</span>
                <svg className={styles.actionArrow} viewBox="0 0 22 16" fill="none" aria-hidden="true">
                  <path d="M1 8h19m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="1.25" />
                </svg>
              </button>
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
                  <span className={styles.status} data-status={org.status}>
                    {organizationStatusLabel[org.status] ?? org.status}
                  </span>
                </div>
                <div className={styles.cardActions}>
                  {org.status === 'verified' && org.role !== 'viewer' && (
                    <Link href={rfqHref(org.id)} className={styles.newRfq}>
                      <span>RFQ B2B</span>
                      <svg className={styles.actionArrow} viewBox="0 0 22 16" fill="none" aria-hidden="true">
                        <path d="M1 8h19m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="1.25" />
                      </svg>
                    </Link>
                  )}
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

        <section className={styles.section} id="quotations" aria-labelledby="quotations-title">
          <h2 id="quotations-title">Quotation</h2>
          {quotations.length ? quotations.map((quote) => {
            const total = quote.quotation_items.reduce((sum, item) => sum + Number(item.line_total), 0);
            const approval = Array.isArray(quote.quotation_approvals) ? quote.quotation_approvals[0] : quote.quotation_approvals;
            const bulkOrder = Array.isArray(quote.bulk_orders) ? quote.bulk_orders[0] : quote.bulk_orders;
            return (
              <article className={styles.quote} key={quote.id}>
                <div>
                  <strong>Quotation rev. {quote.revision}</strong>
                  <small>{quote.status} · berlaku hingga {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('id-ID') : '-'}</small>
                  {quote.quotation_items.map((item) => <p key={item.description}>{item.description} · {Number(item.quantity).toLocaleString('id-ID')} m</p>)}
                  {approval?.note && <p className={styles.revisionNoteHistory}>Catatan revisi Anda: {approval.note}</p>}
                </div>
                <div>
                  <strong>{money(total)}</strong>
                  {quote.status === 'accepted' && bulkOrder && (
                    <>
                      <small>{bulkOrder.bulk_order_number} · {bulkOrder.payment_status === 'paid' ? 'Pembayaran berhasil' : 'Pembayaran ' + bulkOrder.payment_status}</small>
                      {bulkOrder.payment_status !== 'paid' && (
                        <Link className={styles.quotePaymentLink} href={`/business/orders/${encodeURIComponent(bulkOrder.id)}/payment`}>
                          <span>Lanjut ke pembayaran</span>
                          <svg className={styles.actionArrow} viewBox="0 0 22 16" fill="none" aria-hidden="true">
                            <path d="M1 8h19m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="1.25" />
                          </svg>
                        </Link>
                      )}
                    </>
                  )}
                  {quote.status === 'sent' && (
                    <div className={styles.quoteResponse}>
                      <label className={styles.revisionNote}>
                        <span>Catatan untuk tim Wina Jaya</span>
                        <textarea rows={3} maxLength={2000} value={revisionNote[quote.id] ?? ''} onChange={(event) => setRevisionNote((current) => ({ ...current, [quote.id]: event.target.value }))} placeholder="Jelaskan bagian harga, jumlah, atau syarat yang perlu ditinjau." />
                      </label>
                      <span className={styles.actions}>
                        <button type="button" disabled={busy} onClick={() => quoteAction(quote.id, { action: 'respond', decision: 'accepted' }, 'Penawaran disetujui.')}>Setujui</button>
                        <button type="button" disabled={busy || !(revisionNote[quote.id] ?? '').trim()} onClick={() => quoteAction(quote.id, { action: 'respond', decision: 'rejected', note: revisionNote[quote.id].trim() }, 'Catatan dan permintaan revisi berhasil dikirim ke tim Wina Jaya.')}>Minta revisi</button>
                      </span>
                    </div>
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
