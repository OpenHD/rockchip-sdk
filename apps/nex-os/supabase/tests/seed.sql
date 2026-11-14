-- Datos de prueba: se cargan después de v7 y antes de v8 (para probar los backfills de v8).
insert into auth.users(id,email) values ('11111111-1111-1111-1111-111111111111','owner@a.com'),('22222222-2222-2222-2222-222222222222','admin@b.com'),('33333333-3333-3333-3333-333333333333','super@nex.com');
insert into mdm_super_admins values ('33333333-3333-3333-3333-333333333333');
insert into mdm_companies(id,name) values ('aaaaaaaa-0000-0000-0000-000000000001','Empresa A'),('bbbbbbbb-0000-0000-0000-000000000002','Empresa B');
insert into mdm_members values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','owner'),('bbbbbbbb-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','owner');
insert into mdm_devices(id, company_id, name, token_hash, paired_at) values
 ('dddddddd-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','TV A1', encode(extensions.digest(repeat('a',64),'sha256'),'hex'), now()),
 ('dddddddd-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','TV A2', encode(extensions.digest(repeat('b',64),'sha256'),'hex'), now()),
 ('dddddddd-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000002','TV B1', encode(extensions.digest(repeat('c',64),'sha256'),'hex'), now());
insert into mdm_company_apps values ('aaaaaaaa-0000-0000-0000-000000000001','netflix',true,now());
