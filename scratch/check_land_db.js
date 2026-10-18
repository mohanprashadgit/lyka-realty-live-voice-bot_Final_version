import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'lyka_crm',
  });

  const [landRows] = await connection.query('SELECT id, title, land_type, status, city, locality, expected_price, total_area, area_unit, road_access, zoning FROM land_listings');
  console.log('LAND LISTINGS COUNT:', landRows.length);
  console.log(JSON.stringify(landRows, null, 2));

  const [propRows] = await connection.query('SELECT id, title, property_type, status, city, locality, price, built_up_area, area_unit FROM properties');
  console.log('PROPERTIES COUNT:', propRows.length);
  console.log(JSON.stringify(propRows, null, 2));

  await connection.end();
}

main().catch(console.error);
