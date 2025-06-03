const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = 3000;

// Configuración de middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de sanitización
const sanitizeInput = (req, res, next) => {
    for (const key in req.body) {
        if (typeof req.body[key] === 'string') {
            req.body[key] = req.body[key].replace(/[<>&'"]/g, '');
        }
    }
    next();
};
app.post('*', sanitizeInput);
app.put('*', sanitizeInput);

// Conexión a la base de datos
const db = new sqlite3.Database('./database/database.db', (err) => {
    if (err) return console.error(err.message);
    console.log('Conectado a SQLite');

    // Crear tablas
    db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      usuario TEXT UNIQUE NOT NULL,
      clave TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('admin', 'ordinario'))
    );
    
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      color TEXT NOT NULL,
      marca TEXT NOT NULL,
      cantidad INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_productos_busqueda ON productos(nombre, codigo, marca);
    CREATE INDEX IF NOT EXISTS idx_usuarios_usuario ON usuarios(usuario);
  `);

    // Crear usuario admin inicial
    db.get("SELECT COUNT(*) AS count FROM usuarios", (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
            bcrypt.hash('admin123', 10, (err, hash) => {
                if (err) throw err;
                db.run(
                    "INSERT INTO usuarios (nombre, usuario, clave, rol) VALUES (?, ?, ?, ?)",
                    ["Administrador", "admin", hash, "admin"],
                    (err) => {
                        if (err) console.error("Error creando admin:", err.message);
                        else console.log("Usuario admin creado: admin/admin123");
                    }
                );
            });
        }
    });
});

// Middleware de autenticación
const requireLogin = (req, res, next) => {
    if (!req.session.loggedin) return res.redirect('/index.html');
    next();
};

// ======= RUTAS DE API =======

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM usuarios WHERE usuario = ?', [username], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        bcrypt.compare(password, user.clave, (err, result) => {
            if (result) {
                req.session.loggedin = true;
                req.session.user = {
                    id: user.id,
                    nombre: user.nombre,
                    usuario: user.usuario,
                    rol: user.rol
                };
                res.json({ success: true, rol: user.rol });
            } else {
                res.status(401).json({ error: 'Credenciales inválidas' });
            }
        });
    });
});

// Logout
app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Productos
app.get('/api/productos', (req, res) => {
    const search = req.query.search || '';
    let query = 'SELECT * FROM productos';
    const params = [];

    if (search) {
        query += ' WHERE nombre LIKE ? OR codigo LIKE ? OR marca LIKE ?';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/productos', requireLogin, (req, res) => {
    const { codigo, nombre, color, marca, cantidad } = req.body;
    db.run(
        'INSERT INTO productos (codigo, nombre, color, marca, cantidad) VALUES (?, ?, ?, ?, ?)',
        [codigo, nombre, color, marca, cantidad],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

app.put('/api/productos/:id', requireLogin, (req, res) => {
    const { codigo, nombre, color, marca, cantidad } = req.body;
    db.run(
        `UPDATE productos SET 
      codigo = ?, 
      nombre = ?, 
      color = ?, 
      marca = ?, 
      cantidad = ?
    WHERE id = ?`,
        [codigo, nombre, color, marca, cantidad, req.params.id],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ changes: this.changes });
        }
    );
});

// CORRECCIÓN: Solo admin puede eliminar productos
app.delete('/api/productos/:id', requireLogin, (req, res) => {
    // Verificar si el usuario es admin
    if (req.session.user.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    db.run('DELETE FROM productos WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// Usuarios
app.get('/api/usuarios', requireLogin, (req, res) => {
    if (req.session.user.rol !== 'admin') return res.status(403).json({ error: 'Acceso no autorizado' });
    db.all('SELECT id, nombre, usuario, rol FROM usuarios', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/usuarios', requireLogin, (req, res) => {
    if (req.session.user.rol !== 'admin') return res.status(403).json({ error: 'Acceso no autorizado' });
    const { nombre, usuario, clave, rol } = req.body;

    bcrypt.hash(clave, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: 'Error al procesar contraseña' });
        db.run(
            'INSERT INTO usuarios (nombre, usuario, clave, rol) VALUES (?, ?, ?, ?)',
            [nombre, usuario, hash, rol],
            function (err) {
                if (err) return res.status(400).json({ error: err.message });
                res.json({ id: this.lastID });
            }
        );
    });
});

app.delete('/api/usuarios/:id', requireLogin, (req, res) => {
    if (req.session.user.rol !== 'admin') return res.status(403).json({ error: 'Acceso no autorizado' });
    if (req.session.user.id == req.params.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });

    db.run('DELETE FROM usuarios WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// Middleware de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Error interno del servidor');
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});