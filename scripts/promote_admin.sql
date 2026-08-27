-- Назначить администратора существующему кабинету.
-- sqlite3 /opt/data/app.db  (на проде)
-- sqlite3 ml/data/app.db    (локально)

UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
SELECT id, email, role, created_at FROM users;
