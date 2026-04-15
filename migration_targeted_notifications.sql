-- 1️⃣ إضافة UUID إلى departments (بدون حذف name)

alter table departments
add column if not exists id uuid default uuid_generate_v4();

update departments
set id = uuid_generate_v4()
where id is null;

alter table departments
alter column id set not null;

-- إذا لم يكن Primary Key
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'departments_pkey'
  ) then
    alter table departments add primary key (id);
  end if;
end $$;

-- --------------------------------------------------

-- 2️⃣ إنشاء users

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  phone text unique not null,
  name text,
  entity_id uuid references departments(id),
  created_at timestamp default now()
);

-- --------------------------------------------------

-- 3️⃣ تعديل push_tokens

alter table push_tokens
add column if not exists user_id uuid references users(id);

-- --------------------------------------------------

-- 4️⃣ Index

create index if not exists idx_users_phone on users(phone);
