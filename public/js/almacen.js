document.addEventListener('DOMContentLoaded', () => {
    if (!checkSession()) return;

    // Variables globales para almacenar catálogos
    let prendas = [];
    let marcas = [];
    let productosEnStock = []; // Almacena productos disponibles
    
    // Elementos DOM
    const logoutBtn = document.getElementById('logout');
    const addProductBtn = document.getElementById('addProductBtn');
    const cancelProductBtn = document.getElementById('cancelProductBtn');
    const productForm = document.getElementById('productForm');
    const productFormContainer = document.getElementById('productFormContainer');
    const productListContainer = document.getElementById('productListContainer');
    const productCodeSelect = document.getElementById('productCode');
    const productNameInput = document.getElementById('productName');
    const productBrandSelect = document.getElementById('productBrand');
    const productColorInput = document.getElementById('productColor');
    const productQuantityInput = document.getElementById('productQuantity');
    const productIdInput = document.getElementById('productId');
    
    // Nuevos elementos para salidas
    const tabBtns = document.querySelectorAll('.tab-btn');
    const saleForm = document.getElementById('saleForm');
    const saleProductSelect = document.getElementById('saleProduct');
    const saleQuantityInput = document.getElementById('saleQuantity');
    const saleNotesInput = document.getElementById('saleNotes');
    const availableQuantitySpan = document.getElementById('availableQuantity');

    // Event listeners
    logoutBtn.addEventListener('click', logout);
    addProductBtn.addEventListener('click', showProductForm);
    cancelProductBtn.addEventListener('click', hideProductForm);
    productForm.addEventListener('submit', saveProduct);
    saleForm.addEventListener('submit', saveSale);

    // Ocultar menú "Usuarios" si no es admin
    const userRol = sessionStorage.getItem('userRol');
    if (userRol !== 'admin') {
        document.querySelectorAll('a[href="usuarios.html"], a[href="ajustes.html"]').forEach(el => {
            el.style.display = 'none';
        });
    }

    // Cambiar pestañas
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
            
            // Actualizar productos si cambiamos a salidas
            if (btn.dataset.tab === 'salidas') {
                loadProductsForSale();
            }
        });
    });

    // Cargar catálogos y productos
    loadCatalogos();
    loadProducts();
    loadProductsForSale();

    function showProductForm() {
        productForm.reset();
        productIdInput.value = '';
        productFormContainer.classList.remove('hidden');
    }

    function hideProductForm() {
        productFormContainer.classList.add('hidden');
    }

    async function loadCatalogos() {
        try {
            // Cargar prendas
            const prendasResponse = await fetch('/api/catalogo/prendas');
            if (!prendasResponse.ok) throw new Error('Error al cargar prendas');
            prendas = await prendasResponse.json();
            
            // Cargar marcas
            const marcasResponse = await fetch('/api/catalogo/marcas');
            if (!marcasResponse.ok) throw new Error('Error al cargar marcas');
            marcas = await marcasResponse.json();
            
            // Llenar select de códigos
            productCodeSelect.innerHTML = '<option value="">Seleccione un código</option>';
            prendas.forEach(prenda => {
                const option = document.createElement('option');
                option.value = prenda.codigo;
                option.textContent = `${prenda.codigo} - ${prenda.nombre}`;
                option.dataset.nombre = prenda.nombre;
                productCodeSelect.appendChild(option);
            });
            
            // Llenar select de marcas
            productBrandSelect.innerHTML = '<option value="">Seleccione una marca</option>';
            marcas.forEach(marca => {
                const option = document.createElement('option');
                option.value = marca.id;
                option.textContent = marca.nombre;
                productBrandSelect.appendChild(option);
            });
            
            // Evento para autocompletar nombre al seleccionar código
            productCodeSelect.addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                productNameInput.value = selectedOption.dataset.nombre || '';
            });
            
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
        }
    }

    function validateProduct() {
        const codigo = productCodeSelect.value;
        const nombre = productNameInput.value;
        const marca = productBrandSelect.value;
        const cantidad = productQuantityInput.value;
        
        if (!codigo) {
            showNotification('Debe seleccionar un código', 'error');
            return false;
        }
        
        if (!nombre) {
            showNotification('El nombre no puede estar vacío', 'error');
            return false;
        }
        
        if (!marca) {
            showNotification('Debe seleccionar una marca', 'error');
            return false;
        }
        
        if (cantidad === '' || isNaN(cantidad) || cantidad < 0) {
            showNotification('Cantidad inválida', 'error');
            return false;
        }
        
        // Validar que la cantidad sea número entero
        if (!Number.isInteger(parseFloat(cantidad))) {
            showNotification('La cantidad debe ser un número entero', 'error');
            return false;
        }
        
        return true;
    }

    async function saveProduct(e) {
        e.preventDefault();
        if (!validateProduct()) return;
        
        const product = {
            id: productIdInput.value,
            catalogo_codigo: productCodeSelect.value,
            color: productColorInput.value,
            catalogo_marca: productBrandSelect.value,
            cantidad: productQuantityInput.value
        };

        const method = product.id ? 'PUT' : 'POST';
        const url = product.id ? `/api/productos/${product.id}` : '/api/productos';
        
        try {
            const submitButton = productForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.innerHTML = '<i class="spinner mini"></i> Guardando...';
            submitButton.disabled = true;
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });
            
            submitButton.textContent = originalText;
            submitButton.disabled = false;
            
            if (response.ok) {
                const data = await response.json();
                
                let message = 'Producto guardado correctamente';
                if (data.action === "updated") {
                    message = `Cantidad actualizada (Nuevo total: ${data.newQuantity})`;
                } else if (data.deleted) {
                    message = 'Producto eliminado por cantidad 0';
                }
                
                showNotification(message, 'success');
                hideProductForm();
                
                // Actualizar solo si no fue eliminado
                if (!data.deleted) {
                    loadProducts();
                    loadProductsForSale(); // Actualizar lista de productos en ventas
                } else {
                    // Si se eliminó, quitarlo de la lista visualmente
                    const productRow = document.querySelector(`.btn-edit[data-id="${product.id}"]`)?.closest('tr');
                    if (productRow) productRow.remove();
                    
                    // Actualizar lista de ventas
                    const saleOption = saleProductSelect.querySelector(`option[value="${product.id}"]`);
                    if (saleOption) saleOption.remove();
                }
            } else {
                const error = await response.json();
                showNotification(`Error: ${error.error}`, 'error');
            }
        } catch (error) {
            showNotification('Error de conexión', 'error');
            
            const submitButton = productForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.textContent = 'Guardar';
                submitButton.disabled = false;
            }
        }
    }

    async function loadProducts() {
        try {
            productListContainer.innerHTML = '<div class="spinner"></div>';
            
            const response = await fetch('/api/productos');
            if (!response.ok) throw new Error('Error al cargar productos');
            
            const products = await response.json();
            renderProducts(products);
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
            productListContainer.innerHTML = '<p class="empty">Error al cargar productos</p>';
        }
    }

    function renderProducts(products) {
        productListContainer.innerHTML = '';
        
        if (products.length === 0) {
            productListContainer.innerHTML = '<p class="empty">No hay productos registrados</p>';
            return;
        }

        const userRol = sessionStorage.getItem('userRol');
        const isAdmin = userRol === 'admin';
        
        const table = document.createElement('table');
        table.className = 'product-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Marca</th>
                    <th>Color</th>
                    <th>Cantidad</th>
                    ${isAdmin ? '<th>Acciones</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${products.map(product => `
                    <tr>
                        <td>${product.catalogo_codigo}</td>
                        <td>${product.producto_nombre}</td>
                        <td>${product.marca_nombre}</td>
                        <td>${product.color}</td>
                        <td>${product.cantidad}</td>
                        ${isAdmin ? `
                            <td>
                                <button class="btn-edit" data-id="${product.id}">Editar</button>
                                <button class="btn-delete" data-id="${product.id}">Eliminar</button>
                            </td>
                        ` : ''}
                    </tr>
                `).join('')}
            </tbody>
        `;
        
        productListContainer.appendChild(table);
        
        // Agregar event listeners
        if (isAdmin) {
            table.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', () => editProduct(btn.dataset.id));
            });
            
            table.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', () => deleteProduct(btn.dataset.id));
            });
        }
    }

    async function editProduct(id) {
        try {
            // Mostrar spinner en el botón de editar
            const editButton = document.querySelector(`.btn-edit[data-id="${id}"]`);
            const originalText = editButton.textContent;
            editButton.innerHTML = '<i class="spinner mini"></i> Cargando...';
            
            // Obtener datos del producto
            const response = await fetch(`/api/productos/${id}`);
            if (!response.ok) throw new Error('Error al cargar producto');
            
            const product = await response.json();
            
            // Restaurar el botón
            editButton.textContent = originalText;
            
            // Mostrar el formulario
            showProductForm();
            
            // Establecer ID
            productIdInput.value = product.id;
            
            // Seleccionar código
            productCodeSelect.value = product.catalogo_codigo;
            
            // Buscar el nombre de la prenda en los catálogos
            const prenda = prendas.find(p => p.codigo === product.catalogo_codigo);
            if (prenda) {
                productNameInput.value = prenda.nombre;
            } else {
                productNameInput.value = 'Nombre no encontrado';
            }
            
            // Establecer color y cantidad
            productColorInput.value = product.color;
            productQuantityInput.value = product.cantidad;
            
            // Seleccionar marca
            productBrandSelect.value = product.catalogo_marca;
            
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
            
            // Restaurar el botón en caso de error
            const editButton = document.querySelector(`.btn-edit[data-id="${id}"]`);
            if (editButton) {
                editButton.textContent = 'Editar';
            }
        }
    }

    async function deleteProduct(id) {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return;
        
        try {
            // Mostrar spinner en el botón de eliminar
            const deleteButton = document.querySelector(`.btn-delete[data-id="${id}"]`);
            const originalText = deleteButton.textContent;
            deleteButton.innerHTML = '<i class="spinner mini"></i> Eliminando...';
            
            const response = await fetch(`/api/productos/${id}`, {
                method: 'DELETE'
            });
            
            // Restaurar botón
            deleteButton.textContent = originalText;
            
            if (response.ok) {
                showNotification('Producto eliminado', 'success');
                loadProducts();
                loadProductsForSale(); // Actualizar lista de productos en ventas
            } else {
                const error = await response.json();
                showNotification(`Error: ${error.error}`, 'error');
            }
        } catch (error) {
            showNotification('Error de conexión', 'error');
            
            // Restaurar botón en caso de error
            const deleteButton = document.querySelector(`.btn-delete[data-id="${id}"]`);
            if (deleteButton) {
                deleteButton.textContent = 'Eliminar';
            }
        }
    }

    // Nueva función para cargar productos en el select de ventas
    async function loadProductsForSale() {
        try {
            // Filtrar por cantidad mínima 1 (solo productos con stock)
            const response = await fetch('/api/productos?min_quantity=1');
            if (!response.ok) throw new Error('Error al cargar productos');
            
            const productos = await response.json();
            
            saleProductSelect.innerHTML = '<option value="">Seleccione un producto</option>';
            productos.forEach(p => {
                const option = document.createElement('option');
                option.value = p.id;
                option.textContent = `${p.catalogo_codigo} - ${p.producto_nombre} (${p.color}, ${p.marca_nombre})`;
                option.dataset.cantidad = p.cantidad;
                saleProductSelect.appendChild(option);
            });
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
        }
    }

    // Evento para mostrar cantidad disponible
    saleProductSelect.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        availableQuantitySpan.textContent = selectedOption.dataset.cantidad || '0';
    });

    // Nueva función para registrar una salida/venta
    async function saveSale(e) {
        e.preventDefault();
        
        const producto_id = saleProductSelect.value;
        const cantidad = saleQuantityInput.value;
        const observaciones = saleNotesInput.value;
        
        if (!producto_id || !cantidad) {
            showNotification('Producto y cantidad son obligatorios', 'error');
            return;
        }
        
        try {
            const submitButton = saleForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.innerHTML = '<i class="spinner mini"></i> Registrando...';
            submitButton.disabled = true;
            
            const response = await fetch('/api/salidas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ producto_id, cantidad, observaciones })
            });
            
            submitButton.textContent = originalText;
            submitButton.disabled = false;
            
            if (response.ok) {
                const data = await response.json();
                showNotification(`Salida registrada! Nuevo stock: ${data.nuevaCantidad}`, 'success');
                saleForm.reset();
                
                // Actualizar stock local sin recargar toda la página
                // Buscar el producto en la lista de productos
                const producto = productosEnStock.find(p => p.id == producto_id);
                if (producto) {
                    // Actualizar la cantidad
                    producto.cantidad = data.nuevaCantidad;
                    
                    // Actualizar la cantidad disponible en el select
                    const option = saleProductSelect.querySelector(`option[value="${producto_id}"]`);
                    if (option) {
                        option.dataset.cantidad = data.nuevaCantidad;
                    }
                    
                    // Actualizar la cantidad en la tabla de productos (si está visible)
                    if (document.getElementById('entradas-tab').classList.contains('active')) {
                        const cantidadCell = document.querySelector(`.btn-edit[data-id="${producto_id}"]`)?.closest('tr').querySelector('td:nth-child(5)');
                        if (cantidadCell) {
                            cantidadCell.textContent = data.nuevaCantidad;
                        }
                    }
                    
                    // Si la nueva cantidad es 0, quitar el producto del select de ventas
                    if (data.nuevaCantidad <= 0) {
                        if (option) option.remove();
                        availableQuantitySpan.textContent = '0';
                    } else {
                        // Actualizar el span de cantidad disponible
                        if (saleProductSelect.value === producto_id) {
                            availableQuantitySpan.textContent = data.nuevaCantidad;
                        }
                    }
                }
            } else {
                const error = await response.json();
                throw new Error(error.error);
            }
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
        }
    }
});