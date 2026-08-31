## Table `gas_logs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary |
| `created_at` | `timestamptz` |  Nullable |
| `device_mac` | `text` |  Nullable |
| `ppm_level` | `int4` |  Nullable |
| `status` | `text` |  Nullable |
| `profile_id` | `text` |  Nullable |

## Table `profiles`

H-Fire Profiles

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `block_lot` | `text` |  Nullable |
| `updated_at` | `timestamp` |  Nullable |
| `latitude` | `float8` |  Nullable |
| `longitude` | `float8` |  Nullable |
| `is_admin` | `bool` |  Nullable |
| `push_token` | `text` |  Nullable |
| `emergency_hotline` | `text` |  Nullable |
| `address` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `role` | `text` |  Nullable |
| `location_url` | `text` |  Nullable |

## Table `devices`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `mac` | `text` | Primary |
| `house_name` | `text` |  |
| `label` | `text` |  |
| `profile_id` | `text` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `last_seen` | `timestamptz` |  Nullable |
| `block_lot` | `text` |  Nullable |

## Table `incidents`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `device_mac` | `text` |  |
| `status` | `text` |  |
| `start_time` | `timestamptz` |  Nullable |
| `end_time` | `timestamptz` |  Nullable |
| `resolved_by` | `text` |  Nullable |
| `notes` | `text` |  Nullable |
| `ppm_at_trigger` | `int4` |  Nullable |
| `alert_type` | `text` |  Nullable |
| `profile_id` | `text` |  Nullable |

## Table `app_settings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `key` | `text` | Primary |
| `value` | `text` |  |
| `updated_at` | `timestamptz` |  Nullable |

## Table `family_members`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `profile_id` | `text` |  |
| `full_name` | `text` |  |
| `age` | `int4` |  Nullable |
| `relationship` | `text` |  |
| `email` | `text` |  Nullable |
| `phone` | `text` |  |
| `is_primary` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `emergency_settings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `key` | `text` | Primary |
| `value` | `text` |  |
| `updated_at` | `timestamptz` |  Nullable |

## Table `call_logs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary Identity |
| `incident_id` | `int8` |  |
| `profile_id` | `text` |  Nullable |
| `family_member_id` | `int8` |  Nullable |
| `phone_number` | `text` |  |
| `call_type` | `text` |  |
| `call_sid` | `text` |  Nullable |
| `status` | `text` |  Nullable |
| `duration_sec` | `int4` |  Nullable |
| `attempt` | `int4` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |
| `completed_at` | `timestamptz` |  Nullable |

## Table `user_push_tokens`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `profile_id` | `text` |  Nullable |
| `token` | `text` |  Unique |
| `device_info` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## RLS Policies

### `gas_logs`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Gas Logs: Resident owned or Admin all` | SELECT | public | PERMISSIVE | `(is_admin() OR (profile_id = (auth.uid())::text))` | — |
| `Gas Logs: admins see all, residents see owned` | SELECT | public | PERMISSIVE | `(is_admin() OR (profile_id = (auth.uid())::text))` | — |
| `Gas Logs: insert by authenticated users` | INSERT | public | PERMISSIVE | — | `(auth.role() = 'authenticated'::text)` |
| `System: Allow Bridge Inserts` | INSERT | public | PERMISSIVE | — | `true` |

### `family_members`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Admins view all families` | SELECT | public | PERMISSIVE | `is_admin()` | — |
| `Users manage own family` | ALL | anon, authenticated | PERMISSIVE | `true` | `true` |

### `user_push_tokens`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Users can manage their own tokens` | ALL | public | PERMISSIVE | `(profile_id = (auth.uid())::text)` | `(profile_id = (auth.uid())::text)` |

### `incidents`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Incidents: Resident owned or Admin all` | SELECT | public | PERMISSIVE | `(is_admin() OR (profile_id = (auth.uid())::text))` | — |
| `Incidents: admins see all, residents see owned` | SELECT | public | PERMISSIVE | `(is_admin() OR (profile_id = (auth.uid())::text))` | — |
| `Incidents: update only by admin (resolve alerts)` | UPDATE | public | PERMISSIVE | `is_admin()` | — |
| `System: Allow Bridge Incident Inserts` | INSERT | public | PERMISSIVE | — | `true` |
| `System: Allow Simulation Select` | SELECT | public | PERMISSIVE | `true` | — |

### `devices`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Devices: Claim or Update Owned` | UPDATE | public | PERMISSIVE | `(is_admin() OR (profile_id = (auth.uid())::text) OR (profile_id IS NULL))` | `(is_admin() OR (profile_id = (auth.uid())::text))` |
| `Devices: Resident owned, Admin all, or Unowned` | SELECT | public | PERMISSIVE | `(is_admin() OR (profile_id = (auth.uid())::text) OR (profile_id IS NULL))` | — |
| `System: Allow Bridge Device Management` | ALL | public | PERMISSIVE | `true` | `true` |

### `profiles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Profiles: Allow All for App Users` | ALL | anon, authenticated | PERMISSIVE | `true` | `true` |
| `Profiles: Viewable by owner/admin` | SELECT | public | PERMISSIVE | `((id = (auth.uid())::text) OR is_admin())` | — |
| `Profiles: viewable by owner or admin` | SELECT | public | PERMISSIVE | `(((auth.uid())::text = id) OR is_admin())` | — |
| `profiles` | ALL | public | PERMISSIVE | `true` | `true` |

### `app_settings`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `Allow read app_settings` | SELECT | public | PERMISSIVE | `true` | — |
| `Allow update hoa_pin` | UPDATE | public | PERMISSIVE | `(key = 'hoa_pin'::text)` | — |

