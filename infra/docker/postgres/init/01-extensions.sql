-- ============================================================================
-- Extensiones requeridas por NODUS.
-- Se ejecuta una sola vez, al inicializar el volumen de datos de PostgreSQL.
-- ============================================================================

-- pg_trgm: similitud por trigramas. La usa CompanyMatchingService para detectar
-- empresas duplicadas por nombre ("Aceros del Norte SAS" ≈ "ACEROS DEL NORTE").
-- Sin ella, el matching por nombre degrada a comparación exacta normalizada.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent: normaliza tildes para el mismo matching y para búsquedas de texto.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- citext: correos case-insensitive sin depender de LOWER() en cada consulta.
CREATE EXTENSION IF NOT EXISTS citext;
