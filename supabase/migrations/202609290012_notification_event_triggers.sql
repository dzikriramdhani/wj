-- Emit user notifications and asynchronous RFQ confirmation mail.

create or replace function private.notify_rfq_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_email text;
begin
  insert into public.notifications (user_id, type, title, body, link_path)
  values (new.user_id, 'rfq.submitted', 'RFQ diterima', 'Tim Wina Jaya akan meninjau permintaan Anda.', '/account');

  select u.email into recipient_email from auth.users u where u.id = new.user_id;
  if recipient_email is not null then
    insert into public.email_outbox (dedupe_key, recipient_email, template_key, payload)
    values (
      'rfq-submitted:' || new.id::text,
      recipient_email,
      'rfq.submitted',
      jsonb_build_object('rfq_id', new.id)
    ) on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

create or replace function private.notify_rfq_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.notifications (user_id, type, title, body, link_path)
    values (
      new.user_id,
      'rfq.status_changed',
      'Status RFQ diperbarui',
      'RFQ Anda sekarang berstatus ' || upper(new.status::text) || '.',
      '/account'
    );
  end if;
  return new;
end;
$$;

create or replace function private.notify_order_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and old.status is distinct from new.status then
    insert into public.notifications (user_id, type, title, body, link_path)
    values (
      new.user_id,
      'order.status_changed',
      'Status pesanan diperbarui',
      'Pesanan ' || new.order_number || ' sekarang berstatus ' || replace(lower(new.status), '_', ' ') || '.',
      '/orders/' || new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists rfqs_notify_created on public.rfqs;
create trigger rfqs_notify_created after insert on public.rfqs
  for each row execute function private.notify_rfq_created();
drop trigger if exists rfqs_notify_status_changed on public.rfqs;
create trigger rfqs_notify_status_changed after update of status on public.rfqs
  for each row execute function private.notify_rfq_status_changed();
drop trigger if exists orders_notify_status_changed on public.orders;
create trigger orders_notify_status_changed after update of status on public.orders
  for each row execute function private.notify_order_status_changed();
