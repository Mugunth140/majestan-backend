const { DataSource } = require('typeorm');
async function run() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: '127.0.0.1',
    port: 3307,
    username: 'root',
    password: '8220',
    database: 'majestan',
  });
  await dataSource.initialize();
  const res = await dataSource.query(`INSERT INTO locations (city_name, state_name, country_name, country_code, is_active) VALUES ('TestTypeORM', 'State', 'India', 'IN', 1)`);
  console.log(res);
  process.exit(0);
}
run();
