document.addEventListener('DOMContentLoaded', () => {
    if (!checkSession()) return;

    const logoutBtn = document.getElementById('logout');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const inventoryContainer = document.getElementById('inventoryContainer');

    logoutBtn.addEventListener('click', logout);
    searchBtn.addEventListener('click', loadProducts);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') loadProducts();
    });

    // Ocultar menú "Usuarios" si no es admin
    const userRol = sessionStorage.getItem('userRol');
    if (userRol !== 'admin') {
        document.querySelectorAll('a[href="usuarios.html"]').forEach(el => {
            el.style.display = 'none';
        });
    }

    loadProducts();

    async function loadProducts() {
        inventoryContainer.innerHTML = '<div class="spinner"></div>';

        try {
            const searchTerm = searchInput.value.trim();
            const response = await fetch('/api/productos?search=' + encodeURIComponent(searchTerm));
            const productos = await response.json();
            renderProducts(productos);
        } catch (error) {
            showNotification('Error al cargar productos', 'error');
            inventoryContainer.innerHTML = '<p class="empty">Error al cargar productos</p>';
        }
    }

    function renderProducts(products) {
        inventoryContainer.innerHTML = '';

        if (products.length === 0) {
            inventoryContainer.innerHTML = '<p class="empty">No se encontraron productos</p>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'inventory-grid';

        products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
          <h3>${product.nombre}</h3>
          <p><strong>Código:</strong> ${product.codigo}</p>
          <p><strong>Marca:</strong> ${product.marca}</p>
          <p><strong>Color:</strong> ${product.color}</p>
          <p><strong>Cantidad:</strong> ${product.cantidad}</p>
        `;
            grid.appendChild(productCard);
        });

        inventoryContainer.appendChild(grid);
    }
});