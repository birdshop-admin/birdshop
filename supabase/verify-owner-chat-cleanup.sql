select 'permanent removal marker' as check_name,
 case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='service_conversations' and column_name='purged_at') then 'PASS' else 'FAIL' end as result
union all
select 'chat cannot reopen after purge',case when exists(select 1 from pg_trigger where tgrelid='public.service_conversations'::regclass and tgname='birdshop_keep_purged_chat_closed') then 'PASS' else 'FAIL' end
union all
select 'late messages suppressed',case when exists(select 1 from pg_trigger where tgrelid='public.service_messages'::regclass and tgname='birdshop_skip_purged_chat_message') then 'PASS' else 'FAIL' end
union all
select 'owner inventory RPC installed',case when to_regprocedure('public.birdshop_owner_remove_inventory_code(uuid)') is not null then 'PASS' else 'FAIL' end
union all
select 'anonymous cleanup blocked',case when not has_function_privilege('anon','public.birdshop_admin_permanently_delete_service_conversation(uuid)','execute') and not has_function_privilege('anon','public.birdshop_owner_remove_inventory_code(uuid)','execute') then 'PASS' else 'FAIL' end
union all
select 'owner guard in permanent deletion',case when position('if not public.is_birdshop_owner()' in lower(pg_get_functiondef('public.birdshop_admin_permanently_delete_service_conversation(uuid)'::regprocedure)))>0 then 'PASS' else 'FAIL' end;
