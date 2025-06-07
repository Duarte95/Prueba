document.addEventListener('DOMContentLoaded', () => {
    if (!checkSession()) return;

    const logoutBtn = document.getElementById('logout');
    const addProductBtn = document.getElementById('addProductBtn');
    const cancelProductBtn = document.getElementById('cancelProductBtn');
    const productForm = document.getElementById('productForm');
    const productFormContainer = document.getElementById('productFormContainer');
    const productListContainer = document.getElementById('productListContainer');

    logoutBtn.addEventListener('click', logout);
    addProductBtn.addEventListener('click', showProductForm);
    cancelProductBtn.addEventListener('click', hideProductForm);
    productForm.addEventListener('submit', saveProduct);

    // Ocultar menú "Usuarios" si no es admin (aunque solo admin debería ver esto)
    const userRol = sessionStorage.getItem('userRol');
    if (userRol !== 'admin') {
        document.querySelectorAll('a[href="usuarios.html"]').forEach(el => {
            el.style.display = 'none';
        });
    }

    loadProducts();

    function showProductForm() {
        productForm.reset();
        document.getElementById('productId').value = '';
        productFormContainer.classList.remove('hidden');
    }

    function hideProductForm() {
        productFormContainer.classList.add('hidden');
    }

    function validateProduct() {
        const codigo = document.getElementById('productCode').value.trim();
        const nombre = document.getElementById('productName').value.trim();
        const cantidad = document.getElementById('productQuantity').value;

        if (!codigo) {
            showNotification('El código es obligatorio', 'error');
            return false;
        }

        if (!nombre) {
            showNotification('El nombre es obligatorio', 'error');
            return false;
        }

        if (cantidad === '' || isNaN(cantidad) || cantidad < 0) {
            showNotification('Cantidad inválida', 'error');
            return false;
        }

        return true;
    }

    async function saveProduct(e) {
        e.preventDefault();
        if (!validateProduct()) return;

        const product = {
            id: document.getElementById('productId').value,
            codigo: document.getElementById('productCode').value,
            nombre: document.getElementById('productName').value,
            color: document.getElementById('productColor').value,
            marca: document.getElementById('productBrand').value,
            cantidad: document.getElementById('productQuantity').value
        };

        const method = product.id ? 'PUT' : 'POST';
        const url = product.id ? `/api/productos/${product.id}` : '/api/productos';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });

            if (response.ok) {
                showNotification('Producto guardado correctamente', 'success');
                hideProductForm();
                loadProducts();
            } else {
                const error = await response.json();
                showNotification(`Error: ${error.error}`, 'error');
            }
        } catch (error) {
            showNotification('Error de conexión', 'error');
        }
    }

    async function loadProducts() {
        try {
            const response = await fetch('/api/productos');
            const products = await response.json();
            renderProducts(products);
        } catch (error) {
            showNotification('Error al cargar productos', 'error');
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
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(product => `
            <tr>
              <td>${product.codigo}</td>
              <td>${product.nombre}</td>
              <td>${product.marca}</td>
              <td>${product.color}</td>
              <td>${product.cantidad}</td>
              <td>
                <button class="btn-edit" data-id="${product.id}">Editar</button>
                ${isAdmin ? `<button class="btn-delete" data-id="${product.id}">Eliminar</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      `;

        productListContainer.appendChild(table);

        table.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => editProduct(btn.dataset.id));
        });

        if (isAdmin) {
            table.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', () => deleteProduct(btn.dataset.id));
            });
        }
    }

    async function editProduct(id) {
        try {
            const response = await fetch(`/api/productos/${id}`);
            const product = await response.json();

            document.getElementById('productId').value = product.id;
            document.getElementById('productCode').value = product.codigo;
            document.getElementById('productName').value = product.nombre;
            document.getElementById('productColor').value = product.color;
            document.getElementById('productBrand').value = product.marca;
            document.getElementById('productQuantity').value = product.cantidad;

            showProductForm();
        } catch (error) {
            showNotification('Error al cargar el producto', 'error');
        }
    }

    async function deleteProduct(id) {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return;

        try {
            const response = await fetch(`/api/productos/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showNotification('Producto eliminado', 'success');
                loadProducts();
            } else {
                const error = await response.json();
                showNotification(`Error: ${error.error}`, 'error');
            }
        } catch (error) {
            showNotification('Error de conexión', 'error');
        }
    }
});