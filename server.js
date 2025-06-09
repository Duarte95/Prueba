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
        
        CREATE TABLE IF NOT EXISTS movimientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'salida', 'eliminacion', 'edicion')),
            producto_id INTEGER,
            producto_data TEXT NOT NULL, -- Ahora siempre contiene snapshot estático
            cantidad INTEGER,
            usuario_id INTEGER NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            observaciones TEXT,
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
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

// Login (sin cambios)
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

// Logout (sin cambios)
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

app.get('/api/usuarios/:id', requireLogin, (req, res) => {
    if (req.session.user.rol !== 'admin') return res.status(403).json({ error: 'Acceso no autorizado' });
    
    db.get('SELECT id, nombre, usuario, rol FROM usuarios WHERE id = ?', 
        [req.params.id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
            res.json(row);
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
    const min_quantity = parseInt(req.query.min_quantity) || 0;

    let query = `
        SELECT p.id, cp.codigo AS catalogo_codigo, cp.nombre AS producto_nombre, 
               cm.nombre AS marca_nombre, p.color, p.cantidad
        FROM productos p
        JOIN catalogo_prendas cp ON p.catalogo_codigo = cp.codigo
        JOIN catalogo_marcas cm ON p.catalogo_marca = cm.id
        WHERE p.cantidad >= ? 
    `;

    const params = [min_quantity];

    if (search) {
        query += ' AND (cp.nombre LIKE ? OR cp.codigo LIKE ? OR cm.nombre LIKE ? OR p.color LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY p.id DESC';

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

// Función para crear snapshot de producto
const createProductSnapshot = (product) => {
    return JSON.stringify({
        id: product.id,
        catalogo_codigo: product.catalogo_codigo,
        producto_nombre: product.producto_nombre,
        color: product.color,
        marca_id: product.catalogo_marca,
        marca_nombre: product.marca_nombre,
        cantidad: product.cantidad
    });
};

app.post('/api/productos', requireLogin, (req, res) => {
    const { catalogo_codigo, color, catalogo_marca, cantidad } = req.body;

    // Validaciones
    if (!catalogo_codigo || !color || !catalogo_marca || cantidad === undefined) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const cantidadInt = parseInt(cantidad);
    if (isNaN(cantidadInt) || cantidadInt <= 0) {
        return res.status(400).json({ error: 'Cantidad inválida' });
    }

    // Verificar si el código de prenda existe
    db.get('SELECT * FROM catalogo_prendas WHERE codigo = ?', [catalogo_codigo], (err, prenda) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!prenda) return res.status(400).json({ error: 'Código de prenda no válido' });

        // Verificar si la marca existe
        db.get('SELECT * FROM catalogo_marcas WHERE id = ?', [catalogo_marca], (err, marca) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!marca) return res.status(400).json({ error: 'Marca no válida' });

            // Verificar si el producto ya existe
            db.get(`
                SELECT p.id, p.cantidad, cp.nombre AS producto_nombre, cm.nombre AS marca_nombre
                FROM productos p
                JOIN catalogo_prendas cp ON p.catalogo_codigo = cp.codigo
                JOIN catalogo_marcas cm ON p.catalogo_marca = cm.id
                WHERE p.catalogo_codigo = ? AND p.color = ? AND p.catalogo_marca = ?`,
                [catalogo_codigo, color, catalogo_marca], (err, existingProduct) => {
                    if (err) return res.status(500).json({ error: err.message });

                    if (existingProduct) {
                        // Actualizar cantidad si el producto ya existe
                        const newQuantity = existingProduct.cantidad + cantidadInt;
                        
                        // Eliminar si la nueva cantidad es 0
                        if (newQuantity <= 0) {
                            db.run('DELETE FROM productos WHERE id = ?', [existingProduct.id], (delErr) => {
                                if (delErr) return res.status(400).json({ error: delErr.message });
                                
                                // Crear snapshot estático para el histórico
                                const productSnapshot = createProductSnapshot({
                                    ...existingProduct,
                                    cantidad: existingProduct.cantidad // Cantidad antes de eliminación
                                });
                                
                                // Registrar movimiento de eliminación con snapshot
                                db.run(`INSERT INTO movimientos (tipo, producto_id, producto_data, cantidad, usuario_id, observaciones)
                                        VALUES ('eliminacion', ?, ?, ?, ?, 'Cantidad llegó a 0')`,
                                    [
                                        existingProduct.id,
                                        productSnapshot,
                                        existingProduct.cantidad,
                                        req.session.user.id
                                    ]
                                );
                                
                                res.json({ deleted: true });
                            });
                        } else {
                            db.run('UPDATE productos SET cantidad = ? WHERE id = ?',
                                [newQuantity, existingProduct.id], (updateErr) => {
                                    if (updateErr) return res.status(400).json({ error: updateErr.message });
                                    
                                    // Crear snapshot estático para el histórico
                                    const productSnapshot = createProductSnapshot(existingProduct);
                                    
                                    // Registrar movimiento de entrada con snapshot
                                    db.run(`INSERT INTO movimientos (tipo, producto_id, producto_data, cantidad, usuario_id, observaciones)
                                            VALUES ('entrada', ?, ?, ?, ?, 'Actualización de stock')`,
                                        [
                                            existingProduct.id,
                                            productSnapshot,
                                            cantidadInt,
                                            req.session.user.id
                                        ]
                                    );
                                    
                                    res.json({ id: existingProduct.id, action: "updated", newQuantity });
                                }
                            );
                        }
                    } else {
                        // Crear nuevo producto
                        db.run(
                            'INSERT INTO productos (catalogo_codigo, color, catalogo_marca, cantidad) VALUES (?, ?, ?, ?)',
                            [catalogo_codigo, color, catalogo_marca, cantidadInt],
                            function (err) {
                                if (err) return res.status(400).json({ error: err.message });
                                
                                const productId = this.lastID;
                                
                                // Obtener datos completos del nuevo producto
                                db.get(`
                                    SELECT p.*, cp.nombre AS producto_nombre, cm.nombre AS marca_nombre
                                    FROM productos p
                                    JOIN catalogo_prendas cp ON p.catalogo_codigo = cp.codigo
                                    JOIN catalogo_marcas cm ON p.catalogo_marca = cm.id
                                    WHERE p.id = ?`, [productId], (err, newProduct) => {
                                    if (err) return res.status(500).json({ error: err.message });
                                    
                                    // Crear snapshot estático para el histórico
                                    const productSnapshot = createProductSnapshot(newProduct);
                                    
                                    // Registrar movimiento de entrada con snapshot
                                    db.run(`INSERT INTO movimientos (tipo, producto_id, producto_data, cantidad, usuario_id, observaciones)
                                            VALUES ('entrada', ?, ?, ?, ?, 'Nuevo producto')`,
                                        [productId, productSnapshot, cantidadInt, req.session.user.id]
                                    );
                                    
                                    res.json({ id: productId, action: "created" });
                                });
                            }
                        );
                    }
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

    const cantidadInt = parseInt(cantidad);
    if (isNaN(cantidadInt) || cantidadInt < 0) {
        return res.status(400).json({ error: 'Cantidad inválida' });
    }

    // Obtener producto actual ANTES de la actualización
    db.get(`
        SELECT p.*, cp.nombre AS producto_nombre, cm.nombre AS marca_nombre
        FROM productos p
        JOIN catalogo_prendas cp ON p.catalogo_codigo = cp.codigo
        JOIN catalogo_marcas cm ON p.catalogo_marca = cm.id
        WHERE p.id = ?`, [req.params.id], (err, oldProduct) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!oldProduct) return res.status(404).json({ error: 'Producto no encontrado' });

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
                    [catalogo_codigo, color, catalogo_marca, cantidadInt, req.params.id],
                    function (updateErr) {
                        if (updateErr) return res.status(400).json({ error: updateErr.message });
                        
                        // Obtener producto actualizado
                        db.get(`
                            SELECT p.*, cp.nombre AS producto_nombre, cm.nombre AS marca_nombre
                            FROM productos p
                            JOIN catalogo_prendas cp ON p.catalogo_codigo = cp.codigo
                            JOIN catalogo_marcas cm ON p.catalogo_marca = cm.id
                            WHERE p.id = ?`, [req.params.id], (err, updatedProduct) => {
                            if (err) return res.status(500).json({ error: err.message });
                            
                            // Crear snapshot estático del estado anterior
                            const oldSnapshot = createProductSnapshot(oldProduct);
                            
                            // Registrar movimiento de edición con ambos estados
                            db.run(`INSERT INTO movimientos (
                                tipo, 
                                producto_id, 
                                producto_data, 
                                cantidad,
                                usuario_id, 
                                observaciones
                            ) VALUES ('edicion', ?, ?, ?, ?, ?)`,
                                [
                                    req.params.id,
                                    JSON.stringify({
                                        old: JSON.parse(oldSnapshot),
                                        new: createProductSnapshot(updatedProduct)
                                    }),
                                    cantidadInt - oldProduct.cantidad, // Cambio en cantidad
                                    req.session.user.id,
                                    'Actualización de producto'
                                ],
                                (movErr) => {
                                    if (movErr) console.error("Error registrando movimiento:", movErr.message);
                                }
                            );
                            
                            // Eliminar si la cantidad es 0
                            if (cantidadInt <= 0) {
                                db.run('DELETE FROM productos WHERE id = ?', [req.params.id], (delErr) => {
                                    if (delErr) console.error("Error eliminando producto:", delErr.message);
                                });
                            }
                            
                            res.json({ changes: this.changes });
                        });
                    }
                );
            });
        });
    });
});

// Ruta para productos agrupados por código
app.get('/api/productos-agrupados', (req, res) => {
    const search = req.query.search || '';
    
    let query = `
        SELECT 
            cp.codigo,
            cp.nombre AS producto_nombre,
            json_group_array(json_object(
                'id', p.id,
                'color', p.color,
                'marca_id', p.catalogo_marca,
                'marca_nombre', cm.nombre,
                'cantidad', p.cantidad
            )) AS variantes
        FROM productos p
        JOIN catalogo_prendas cp ON p.catalogo_codigo = cp.codigo
        JOIN catalogo_marcas cm ON p.catalogo_marca = cm.id
        WHERE p.cantidad > 0 
    `;

    const params = [];

    if (search) {
        query += ` 
            AND (cp.nombre LIKE ? 
            OR cp.codigo LIKE ? 
            OR cm.nombre LIKE ? 
            OR p.color LIKE ?)
        `;
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ` GROUP BY cp.codigo ORDER BY cp.codigo`;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const parsedRows = rows.map(row => ({
            ...row,
            variantes: JSON.parse(row.variantes)
        }));
        
        res.json(parsedRows);
    });
});

app.delete('/api/productos/:id', requireLogin, (req, res) => {
    if (req.session.user.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    // Obtener datos completos del producto antes de eliminarlo
    db.get(`
        SELECT p.*, cp.nombre AS producto_nombre, cm.nombre AS marca_nombre
        FROM productos p
        JOIN catalogo_prendas cp ON p.catalogo_codigo = cp.codigo
        JOIN catalogo_marcas cm ON p.catalogo_marca = cm.id
        WHERE p.id = ?`, [req.params.id], (err, producto) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
        
        // Crear snapshot estático
        const productSnapshot = createProductSnapshot(producto);
        
        db.run('DELETE FROM productos WHERE id = ?', [req.params.id], function (delErr) {
            if (delErr) return res.status(400).json({ error: delErr.message });
            
            // Registrar movimiento de eliminación con snapshot estático
            db.run(`INSERT INTO movimientos (
                tipo, 
                producto_id, 
                producto_data, 
                cantidad, 
                usuario_id, 
                observaciones
            ) VALUES ('eliminacion', ?, ?, ?, ?, ?)`,
                [
                    req.params.id,
                    productSnapshot,
                    producto.cantidad,
                    req.session.user.id,
                    'Producto eliminado manualmente'
                ]
            );
            
            res.json({ deleted: this.changes });
        });
    });
});

// Salidas
app.post('/api/salidas', requireLogin, (req, res) => {
    const { producto_id, cantidad, observaciones } = req.body;
    const usuario_id = req.session.user.id;

    if (!producto_id || !cantidad) {
        return res.status(400).json({ error: 'Producto y cantidad son obligatorios' });
    }

    const cantidadInt = parseInt(cantidad);
    if (isNaN(cantidadInt) || cantidadInt <= 0) {
        return res.status(400).json({ error: 'Cantidad inválida' });
    }

    // Obtener producto con datos completos
    db.get(`
        SELECT p.*, cp.nombre AS producto_nombre, cm.nombre AS marca_nombre
        FROM productos p
        JOIN catalogo_prendas cp ON p.catalogo_codigo = cp.codigo
        JOIN catalogo_marcas cm ON p.catalogo_marca = cm.id
        WHERE p.id = ?`, [producto_id], (err, producto) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
        
        // Verificar stock suficiente
        if (producto.cantidad < cantidadInt) {
            return res.status(400).json({ error: 'Stock insuficiente' });
        }
        
        // Crear snapshot estático ANTES de la operación
        const productSnapshot = createProductSnapshot(producto);
        
        const nuevaCantidad = producto.cantidad - cantidadInt;
        
        // Actualizar inventario
        db.run('UPDATE productos SET cantidad = ? WHERE id = ?', 
            [nuevaCantidad, producto_id], 
            (updateErr) => {
                if (updateErr) return res.status(500).json({ error: updateErr.message });
                
                // Registrar movimiento de salida con snapshot estático
                db.run(`INSERT INTO movimientos (
                    tipo, 
                    producto_id, 
                    producto_data, 
                    cantidad, 
                    usuario_id, 
                    observaciones
                ) VALUES ('salida', ?, ?, ?, ?, ?)`,
                    [
                        producto_id, 
                        productSnapshot, 
                        cantidadInt, 
                        usuario_id, 
                        observaciones || ''
                    ],
                    (movErr) => {
                        if (movErr) return res.status(500).json({ error: movErr.message });
                        res.json({ success: true, nuevaCantidad });
                    }
                );
            }
        );
    });
});

// Movimientos
app.get('/api/movimientos', requireLogin, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const tipo = req.query.type || '';

    const query = `
        SELECT 
            m.id, 
            m.tipo, 
            m.cantidad, 
            m.fecha, 
            m.observaciones,
            u.usuario AS usuario,
            m.producto_data
        FROM movimientos m
        JOIN usuarios u ON m.usuario_id = u.id
        ${tipo ? 'WHERE m.tipo = ?' : ''}
        ORDER BY m.fecha DESC
        LIMIT ? OFFSET ?
    `;

    const countQuery = `
        SELECT COUNT(*) AS total 
        FROM movimientos m
        ${tipo ? 'WHERE m.tipo = ?' : ''}
    `;

    const params = [];
    const countParams = [];

    if (tipo) {
        params.push(tipo);
        countParams.push(tipo);
    }

    params.push(limit, offset);

    db.get(countQuery, countParams, (err, countRow) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all(query, params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // Procesar datos estáticos
            const movimientos = rows.map(row => {
                const data = JSON.parse(row.producto_data);
                
                // Manejar diferentes estructuras de datos
                let productoInfo = {};
                if (data.old && data.new) {
                    // Edición: mostrar ambos estados
                    productoInfo = {
                        tipo: 'edicion',
                        old: data.old,
                        new: data.new,
                        producto_nombre: data.old.producto_nombre,
                        catalogo_codigo: data.old.catalogo_codigo,
                        color: data.old.color,
                        marca_nombre: data.old.marca_nombre
                    };
                } else {
                    // Otros movimientos
                    productoInfo = {
                        tipo: 'normal',
                        producto_nombre: data.producto_nombre,
                        catalogo_codigo: data.catalogo_codigo,
                        color: data.color,
                        marca_nombre: data.marca_nombre,
                        cantidad: data.cantidad
                    };
                }
                
                return {
                    ...row,
                    producto_data: productoInfo
                };
            });
            
            res.json({
                movimientos,
                total: countRow.total,
                page,
                totalPages: Math.ceil(countRow.total / limit)
            });
        });
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