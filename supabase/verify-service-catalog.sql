-- Run after 20261005230000_service_catalog.sql. Read-only checks.
select 'catalog installed' check_name,case when to_regclass('public.birdshop_services') is not null then 'PASS' else 'FAIL' end result
union all select 'catalog RLS',case when (select relrowsecurity from pg_class where oid='public.birdshop_services'::regclass) then 'PASS' else 'FAIL' end
union all select 'anonymous catalog blocked',case when not has_table_privilege('anon','public.birdshop_services','SELECT') then 'PASS' else 'FAIL' end
union all select 'browser catalog writes blocked',case when not has_table_privilege('authenticated','public.birdshop_services','UPDATE') then 'PASS' else 'FAIL' end
union all select 'purchase RPC browser access blocked',case when not has_function_privilege('anon','public.birdshop_buy_service_package(uuid,text,text,text,text,bigint)','EXECUTE') and not has_function_privilege('authenticated','public.birdshop_buy_service_package(uuid,text,text,text,text,bigint)','EXECUTE') then 'PASS' else 'FAIL' end
union all select 'purchase mapping private',case when not has_table_privilege('anon','public.birdshop_service_purchases','SELECT') and not has_table_privilege('authenticated','public.birdshop_service_purchases','SELECT') then 'PASS' else 'FAIL' end;
