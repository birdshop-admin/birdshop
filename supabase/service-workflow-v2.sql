-- =========================================================
-- BIRDSHOP SERVICE WORKFLOW V2
--
-- Keeps payment status separate from service status.
-- Adds the workflow needed for:
-- - BirdShop chat
-- - custom quotes
-- - payment requests
-- - customer replies
-- - final delivery
-- - completed service sales
-- =========================================================


-- =========================================================
-- SERVICE STATUS OPTIONS
-- =========================================================

alter table public.orders
drop constraint if exists orders_service_status_check;

alter table public.orders
add constraint orders_service_status_check
check (
  service_status is null
  or service_status in (
    'new',
    'discussing',
    'quote_sent',
    'awaiting_payment',
    'assigned',
    'in_progress',
    'waiting_customer',
    'customer_replied',
    'ready_for_delivery',
    'completed',
    'cancelled'
  )
);


-- =========================================================
-- REPAIR OLD IMPOSSIBLE STATES
--
-- Example:
--
-- SERVICE STATUS = COMPLETED
-- PAYMENT = PENDING
--
-- That should never count as a completed sale.
-- =========================================================

update public.orders
set
  service_status = 'awaiting_payment',
  order_status = 'pending',
  fulfillment_status = 'unfulfilled',
  fulfilled_at = null
where order_type = 'service'
  and service_status = 'completed'
  and payment_status <> 'paid';


-- =========================================================
-- SERVICE WORKFLOW RPC
-- =========================================================

create or replace function
public.birdshop_set_service_order_status(
  p_order_id uuid,
  p_status text,
  p_assigned_to text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_assigned text;
begin

  -- =======================================================
  -- ADMIN CHECK
  -- =======================================================

  if
    coalesce(
      auth.role(),
      ''
    ) <> 'service_role'

    and not public.is_birdshop_admin()
  then
    raise exception
      'Not authorized.';
  end if;


  -- =======================================================
  -- STATUS CHECK
  -- =======================================================

  if p_status not in (
    'new',
    'discussing',
    'quote_sent',
    'awaiting_payment',
    'assigned',
    'in_progress',
    'waiting_customer',
    'customer_replied',
    'ready_for_delivery',
    'completed',
    'cancelled'
  ) then
    raise exception
      'Invalid service status.';
  end if;


  -- =======================================================
  -- LOCK ORDER
  -- =======================================================

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;


  if not found then
    raise exception
      'Order not found.';
  end if;


  if v_order.order_type <> 'service' then
    raise exception
      'This is not a service order.';
  end if;


  v_assigned :=
    nullif(
      trim(
        coalesce(
          p_assigned_to,
          ''
        )
      ),
      ''
    );


  -- =======================================================
  -- ASSIGNMENT CHECK
  -- =======================================================

  if
    p_status = 'assigned'

    and coalesce(
      v_assigned,
      v_order.assigned_to
    ) is null
  then
    raise exception
      'Assign an admin before using Assigned status.';
  end if;


  -- =======================================================
  -- PAYMENT SAFETY
  --
  -- BirdShop must NEVER call something delivered/completed
  -- unless payment has actually been recorded.
  --
  -- Later Stripe's webhook will be what changes:
  --
  -- payment_status -> paid
  -- =======================================================

  if
    p_status in (
      'ready_for_delivery',
      'completed'
    )

    and v_order.payment_status <> 'paid'
  then
    raise exception
      'Payment must be recorded before final delivery or completion.';
  end if;


  -- =======================================================
  -- UPDATE
  -- =======================================================

  update public.orders
  set
    service_status =
      p_status,

    assigned_to =
      case
        when v_assigned is null
          then assigned_to

        else v_assigned
      end,

    order_status =
      case
        when p_status = 'completed'
          then 'completed'

        when p_status = 'cancelled'
          then 'cancelled'

        when payment_status = 'paid'
          then 'active'

        else 'pending'
      end,

    fulfillment_status =
      case
        when p_status = 'completed'
          then 'fulfilled'

        when p_status = 'cancelled'
          then 'cancelled'

        else 'unfulfilled'
      end,

    fulfilled_at =
      case
        when p_status = 'completed'
          then coalesce(
            fulfilled_at,
            now()
          )

        else null
      end,

    cancelled_at =
      case
        when p_status = 'cancelled'
          then coalesce(
            cancelled_at,
            now()
          )

        else null
      end

  where id = p_order_id;

end;
$$;


-- =========================================================
-- PERMISSIONS
-- =========================================================

revoke all
on function public.birdshop_set_service_order_status(
  uuid,
  text,
  text
)
from public;


grant execute
on function public.birdshop_set_service_order_status(
  uuid,
  text,
  text
)
to authenticated,
service_role;


-- =========================================================
-- REFRESH SUPABASE API SCHEMA
-- =========================================================

notify pgrst, 'reload schema';