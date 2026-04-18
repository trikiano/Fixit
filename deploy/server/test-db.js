import mysql from 'mysql2/promise';

const c = await mysql.createConnection({ host: 'localhost', user: 'root', password: '' });

await c.query("CREATE DATABASE IF NOT EXISTS fixit_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
console.log('✅ Base fixit_db créée');

await c.query("CREATE USER IF NOT EXISTS 'fixit_user'@'localhost' IDENTIFIED BY 'fixit_password'");
await c.query("GRANT ALL PRIVILEGES ON fixit_db.* TO 'fixit_user'@'localhost'");
await c.query("FLUSH PRIVILEGES");
console.log("✅ Utilisateur fixit_user créé avec tous les droits sur fixit_db");

await c.end();
console.log("✅ Terminé !");
