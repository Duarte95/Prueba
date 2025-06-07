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
        
        CREATE TABLE IF NOT EXISTS catalogo_prendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS catalogo_marcas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            catalogo_codigo TEXT NOT NULL,
            color TEXT NOT NULL,
            catalogo_marca INTEGER NOT NULL,
            cantidad INTEGER NOT NULL,
            FOREIGN KEY(catalogo_codigo) REFERENCES catalogo_prendas(codigo),
            FOREIGN KEY(catalogo_marca) REFERENCES catalogo_marcas(id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_productos_busqueda ON productos(catalogo_codigo, color, catalogo_marca);
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
    if (!nombre || !usuario || !clave || !rol) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

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

// Catálogo de Prendas
app.get('/api/catalogo/prendas', requireLogin, (req, res) => {
    db.all('SELECT * FROM catalogo_prendas', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/catalogo/prendas', requireLogin, (req, res) => {
    const { codigo, nombre } = req.body;
    if (!codigo || !nombre) {
        return res.status(400).json({ error: 'Código y nombre son obligatorios' });
    }

    db.run(
        'INSERT INTO catalogo_prendas (codigo, nombre) VALUES (?, ?)',
        [codigo, nombre],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

app.delete('/api/catalogo/prendas/:id', requireLogin, (req, res) => {
    // Primero verificar si hay productos usando esta prenda
    db.get('SELECT COUNT(*) AS count FROM productos WHERE catalogo_codigo = (SELECT codigo FROM catalogo_prendas WHERE id = ?)',
        [req.params.id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row.count > 0) {
                return res.status(400).json({ error: 'No se puede eliminar, existen productos relacionados' });
            }

            // Si no hay productos relacionados, eliminar
            db.run('DELETE FROM catalogo_prendas WHERE id = ?', [req.params.id], function (err) {
                if (err) return res.status(400).json({ error: err.message });
                res.json({ deleted: this.changes });
            });
        }
    );
});

// Catálogo de Marcas
app.get('/api/catalogo/marcas', requireLogin, (req, res) => {
    db.all('SELECT * FROM catalogo_marcas', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/catalogo/marcas', requireLogin, (req, res) => {
    const { nombre } = req.body;
    if (!nombre) {
        return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    db.run(
        'INSERT INTO catalogo_marcas (nombre) VALUES (?)',
        [nombre],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

app.delete('/api/catalogo/marcas/:id', requireLogin, (req, res) => {
    // Primero verificar si hay productos usando esta marca
    db.get('SELECT COUNT(*) AS count FROM productos WHERE catalogo_marca = ?',
        [req.params.id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row.count > 0) {
                return res.status(400).json({ error: 'No se puede eliminar, existen productos relacionados' });
            }

            // Si no hay productos relacionados, eliminar
            db.run('DELETE FROM catalogo_marcas WHERE id = ?', [req.params.id], function (err) {
                if (err) return res.status(400).json({ error: err.message });
                res.json({ deleted: this.changes });
            });
        }
    );
});

// Productos
app.get('/api/productos', (req, res) => {
    const search = req.query.search || '';

    let query = `
        SELECT p.id, cp.codigo AS catalogo_codigo, cp.nombre AS producto_nombre, 
               cm.nombre AS marca_nombre, p.color, p.cantidad
        FROM productos p
        JOIN catalogo_prendas cp ON p.catalogo_codigo = cp.codigo
        JOIN catalogo_marcas cm ON p.catalogo_marca = cm.id
    `;

    const params = [];

    if (search) {
        query += ' WHERE cp.nombre LIKE ? OR cp.codigo LIKE ? OR cm.nombre LIKE ? OR p.color LIKE ?';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Obtener un solo producto por ID
app.get('/api/productos/:id', (req, res) => {
    db.get(`
        SELECT p.id, p.catalogo_codigo, p.color, p.catalogo_marca, p.cantidad,
               cp.nombre AS producto_nombre, cm.nombre AS marca_nombre
        FROM productos p
        JOIN catalogo_prendas cp ON p.catalogo_codigo = cp.codigo
        JOIN catalogo_marcas cm ON p.catalogo_marca = cm.id
        WHERE p.id = ?
    `, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(row);
    });
});

app.post('/api/productos', requireLogin, (req, res) => {
    const { catalogo_codigo, color, catalogo_marca, cantidad } = req.body;

    // Validaciones
    if (!catalogo_codigo || !color || !catalogo_marca || cantidad === undefined) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Verificar si el código de prenda existe
    db.get('SELECT 1 FROM catalogo_prendas WHERE codigo = ?', [catalogo_codigo], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(400).json({ error: 'Código de prenda no válido' });

        // Verificar si la marca existe
        db.get('SELECT 1 FROM catalogo_marcas WHERE id = ?', [catalogo_marca], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(400).json({ error: 'Marca no válida' });

            // Crear el producto
            db.run(
                'INSERT INTO productos (catalogo_codigo, color, catalogo_marca, cantidad) VALUES (?, ?, ?, ?)',
                [catalogo_codigo, color, catalogo_marca, cantidad],
                function (err) {
                    if (err) return res.status(400).json({ error: err.message });
                    res.json({ id: this.lastID });
                }
            );
        });
    });
});

app.put('/api/productos/:id', requireLogin, (req, res) => {
    const { catalogo_codigo, color, catalogo_marca, cantidad } = req.body;

    // Validaciones
    if (!catalogo_codigo || !color || !catalogo_marca || cantidad === undefined) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Verificar si el producto existe
    db.get('SELECT id FROM productos WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Producto no encontrado' });

        // Verificar si el código de prenda existe
        db.get('SELECT 1 FROM catalogo_prendas WHERE codigo = ?', [catalogo_codigo], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(400).json({ error: 'Código de prenda no válido' });

            // Verificar si la marca existe
            db.get('SELECT 1 FROM catalogo_marcas WHERE id = ?', [catalogo_marca], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!row) return res.status(400).json({ error: 'Marca no válida' });

                // Actualizar el producto
                db.run(
                    `UPDATE productos SET 
                        catalogo_codigo = ?, 
                        color = ?, 
                        catalogo_marca = ?, 
                        cantidad = ?
                    WHERE id = ?`,
                    [catalogo_codigo, color, catalogo_marca, cantidad, req.params.id],
                    function (err) {
                        if (err) return res.status(400).json({ error: err.message });
                        res.json({ changes: this.changes });
                    }
                );
            });
        });
    });
});

// Solo admin puede eliminar productos
app.delete('/api/productos/:id', requireLogin, (req, res) => {
    if (req.session.user.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    db.run('DELETE FROM productos WHERE id = ?', [req.params.id], function (err) {
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