-- app_secrets is unreadable/unwritable for anon and signed-in users.
insert into public.app_secrets (key, value_encrypted) values ('smtp_pass', 'v1.x.y.z');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false); -- even an admin
do $$ begin
  begin
    perform 1 from public.app_secrets;
    raise exception 'authenticated must not read app_secrets';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin
    insert into public.app_secrets (key, value_encrypted) values ('x', 'y');
    raise exception 'anon must not write app_secrets';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin raise notice 'secrets tests passed'; end $$;
