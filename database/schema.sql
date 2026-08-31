-- ============================================================
-- H-FIRE ADMIN MONITORING - SUPABASE DATABASE SCHEMA
-- Execute this entire script in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Syncs with Supabase Auth auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'hoa', 'guard')),
  push_token TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automatic profile creation on Supabase user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'admin')
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    updated_at = NOW();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. DEVICES TABLE (Maps Hardware MAC Addresses & Coordinates)
CREATE TABLE IF NOT EXISTS public.devices (
  mac TEXT PRIMARY KEY, -- e.g., '24:6F:28:B1:A0:10'
  house_name TEXT NOT NULL,
  label TEXT NOT NULL,
  block_lot TEXT,
  latitude DOUBLE PRECISION NOT NULL DEFAULT 14.6000,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 120.9845,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. GAS LOGS TABLE (Telemetry History)
CREATE TABLE IF NOT EXISTS public.gas_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_mac TEXT REFERENCES public.devices(mac) ON DELETE CASCADE,
  ppm_level INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Normal', 'Warning', 'Danger')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INCIDENTS TABLE (Active Emergency Triggers & Dispatch Logs)
CREATE TABLE IF NOT EXISTS public.incidents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_mac TEXT NOT NULL REFERENCES public.devices(mac) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Resolved')),
  ppm_at_trigger INTEGER,
  alert_type TEXT, -- 'FIRE', 'GAS / SMOKE LEAK'
  notes TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ
);

-- 5. APP SETTINGS (Bridge Heartbeat & Configuration)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value) VALUES
  ('bridge_heartbeat', NOW()::text)
ON CONFLICT (key) DO NOTHING;

-- 6. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gas_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow users to update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Allow authenticated read on devices" ON public.devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert/update on devices" ON public.devices FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated access to gas_logs" ON public.gas_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access to incidents" ON public.incidents FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access to app_settings" ON public.app_settings FOR ALL TO authenticated USING (true);

-- 8. ENABLE REALTIME PUBLICATION
ALTER PUBLICATION supabase_realtime ADD TABLE public.gas_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
