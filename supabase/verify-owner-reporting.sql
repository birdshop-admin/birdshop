-- Read-only checks. Run AFTER 20261005220000_owner_reporting.sql.
select 'owner report installed' check_name, case when to_regprocedure('public.birdshop_admin_report(integer)') is not null then 'PASS' else 'FAIL' end result
union all select 'overview installed',case when to_regprocedure('public.birdshop_admin_overview()') is not null then 'PASS' else 'FAIL' end
union all select 'anonymous report blocked',case when not has_function_privilege('anon','public.birdshop_admin_report(integer)','EXECUTE') then 'PASS' else 'FAIL' end
union all select 'anonymous overview blocked',case when not has_function_privilege('anon','public.birdshop_admin_overview()','EXECUTE') then 'PASS' else 'FAIL' end
union all select 'browser cannot read reporting view directly',case when not has_table_privilege('authenticated','private.birdshop_reporting_orders','SELECT') then 'PASS' else 'FAIL' end
union all select 'owner check and safe search path',case when (
 select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('birdshop_admin_report','birdshop_admin_overview')
 and p.prosecdef and p.proconfig is not null and position('is_birdshop_owner' in p.prosrc)>0
)=2 then 'PASS' else 'FAIL' end;
