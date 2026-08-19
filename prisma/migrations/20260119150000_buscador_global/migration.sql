-- Buscador global.
--
-- `unaccent` permite que buscar «jose perez» encuentre a «Jose Perez» con
-- tildes, que es como la gente escribe cuando tiene prisa. Los demas
-- buscadores ya ignoran tildes en el navegador; esto lo hace posible tambien
-- cuando la busqueda ocurre en la base de datos.
CREATE EXTENSION IF NOT EXISTS unaccent;
