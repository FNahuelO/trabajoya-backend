-- Verificar si el enum PaymentMethod existe
SELECT EXISTS (
  SELECT 1 
  FROM pg_type 
  WHERE typname = 'PaymentMethod'
) AS enum_exists;

-- Verificar el tipo actual de la columna paymentMethod
SELECT 
  column_name, 
  data_type, 
  udt_name
FROM information_schema.columns 
WHERE table_name = 'PaymentTransaction' 
  AND column_name = 'paymentMethod';

-- Ver valores actuales en paymentMethod
SELECT DISTINCT "paymentMethod" 
FROM "PaymentTransaction";

