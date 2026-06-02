# APEX — Foundational Fitness Protocol

Tracker de entrenamiento basado en el protocolo de Huberman Lab.

---

## Setup

### 1. Clonar e instalar

```bash
git clone https://github.com/diegobravo011-svg/apex_app.git
cd apex_app
npm install
```

### 2. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**
2. En el SQL Editor pega y ejecuta el siguiente schema:

```sql
-- Profiles (vinculados a auth.users)
create table profiles (
  id         uuid references auth.users primary key,
  name       text not null,
  created_at timestamptz default now()
);

-- Weeks
create table weeks (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references profiles(id) on delete cascade,
  week_number int  not null,
  schedule    text not null default 'A',
  date        text,
  created_at  timestamptz default now(),
  unique(profile_id, week_number)
);

-- Days
create table days (
  id               uuid primary key default gen_random_uuid(),
  week_id          uuid references weeks(id) on delete cascade,
  day_key          text not null,
  completed_warmup boolean default false,
  unique(week_id, day_key)
);

-- Exercises
create table exercises (
  id       uuid primary key default gen_random_uuid(),
  day_id   uuid references days(id) on delete cascade,
  name     text,
  muscle   text,
  weight   text,
  reps     text,
  activity text,
  done     boolean default false,
  position int default 0
);

-- Row Level Security
alter table profiles  enable row level security;
alter table weeks     enable row level security;
alter table days      enable row level security;
alter table exercises enable row level security;

create policy "Users own their profile"
  on profiles for all using (auth.uid() = id);

create policy "Users own their weeks"
  on weeks for all using (auth.uid() = profile_id);

create policy "Users own their days"
  on days for all using (
    auth.uid() = (select profile_id from weeks where id = week_id)
  );

create policy "Users own their exercises"
  on exercises for all using (
    auth.uid() = (
      select w.profile_id from days d
      join weeks w on w.id = d.week_id
      where d.id = day_id
    )
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

3. Ve a **Authentication → Users → Add user** y crea tu usuario con email + contraseña.

### 3. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con los datos de tu proyecto Supabase  
(**Settings → API** en el dashboard de Supabase):

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 4. Correr localmente

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173)

---

## Deploy en Vercel

1. Push a GitHub (ya tienes el repo)
2. Ve a [vercel.com](https://vercel.com) → **New Project** → importa `apex_app`
3. En **Environment Variables** agrega las mismas dos variables del `.env`
4. Deploy → listo ✓

---

## Stack

- React + Vite
- Supabase (auth + postgres)
- CSS inline (sin dependencias de UI)
- Fuentes: DM Sans + DM Mono (Google Fonts)
