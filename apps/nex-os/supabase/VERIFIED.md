# Verified users (NEX Music)

## Setup (una sola vez)

En Supabase → SQL Editor, corré **en orden**:

1. `supabase/schema-profiles-v4.sql`
2. `supabase/schema-staff-verify-v5.sql`

Luego cambiá la clave default en el panel Staff (o por SQL):

```sql
update nex_staff_config set staff_key = 'tu-clave-secreta-larga' where id = 1;
```

Default inicial: `nex-staff-cambia-esto`

## Uso diario (sin SQL)

1. NEX Music → **Listas Globales** → botón **Staff**
2. Entrá con la clave staff
3. Aprobá solicitudes pendientes, o escribí un nickname y **Dar ✓**

La clave queda en `sessionStorage` hasta que cierres la pestaña / “Cerrar sesión staff”.

## Usuarios

- Abren la app con nickname → se crea el perfil
- Tocan **Solicitar verificación ✓**
- Vos aprobás desde el panel Staff
