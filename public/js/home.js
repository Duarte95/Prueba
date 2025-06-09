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
        document.querySelectorAll('a[href="usuarios.html"], a[href="ajustes.html"]').forEach(el => {
            el.style.display = 'none';
        });
    }

    loadProducts();

    async function loadProducts() {
        inventoryContainer.innerHTML = '<div class="spinner"></div>';

        try {
            const searchTerm = searchInput.value.trim();
            const response = await fetch(`/api/productos-agrupados?search=${encodeURIComponent(searchTerm)}`);
            
            if (!response.ok) throw new Error('Error al cargar productos');
            
            const productos = await response.json();
            renderProducts(productos);
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
            inventoryContainer.innerHTML = '<p class="empty">Error al cargar productos</p>';
        }
    }

    function renderProducts(productos) {
        inventoryContainer.innerHTML = '';

        if (productos.length === 0) {
            inventoryContainer.innerHTML = '<p class="empty">No se encontraron productos</p>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'inventory-grid';

        productos.forEach(producto => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            
            // Calcular total inicial
            const total = producto.variantes.reduce((sum, variant) => sum + variant.cantidad, 0);
            
            // Generar opciones para los dropdowns
            const colorOptions = generateColorOptions(producto.variantes);
            const marcaOptions = generateMarcaOptions(producto.variantes);
            
            productCard.innerHTML = `
                <div class="product-header">
                    <h3>${producto.producto_nombre}</h3>
                    <span class="total-badge">Total: ${total}</span>
                </div>
                <p><strong>Código:</strong> ${producto.codigo}</p>
                
                <div class="filters-card">
                    <div class="filter-group">
                        <label>Color:</label>
                        <select class="color-filter" data-codigo="${producto.codigo}">
                            <option value="">Todos los colores</option>
                            ${colorOptions}
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label>Marca:</label>
                        <select class="marca-filter" data-codigo="${producto.codigo}">
                            <option value="">Todas las marcas</option>
                            ${marcaOptions}
                        </select>
                    </div>
                </div>
                
                <p class="current-quantity"><strong>Cantidad actual:</strong> <span>${total}</span></p>
                
                <input type="hidden" class="variantes-data" value='${JSON.stringify(producto.variantes)}' />
            `;
            
            grid.appendChild(productCard);
        });

        inventoryContainer.appendChild(grid);
        
        // Agregar event listeners a los filtros
        document.querySelectorAll('.color-filter').forEach(filter => {
            filter.addEventListener('change', updateFilters);
        });
        
        document.querySelectorAll('.marca-filter').forEach(filter => {
            filter.addEventListener('change', updateFilters);
        });
    }

    function generateColorOptions(variantes, selectedMarca = null) {
        // Filtrar colores según la marca seleccionada
        const filteredVariantes = selectedMarca 
            ? variantes.filter(v => v.marca_nombre === selectedMarca)
            : variantes;
        
        // Obtener colores únicos
        const colores = [...new Set(filteredVariantes.map(v => v.color))];
        
        return colores.map(color => 
            `<option value="${color}">${color}</option>`
        ).join('');
    }

    function generateMarcaOptions(variantes, selectedColor = null) {
        // Filtrar marcas según el color seleccionado
        const filteredVariantes = selectedColor 
            ? variantes.filter(v => v.color === selectedColor)
            : variantes;
        
        // Obtener marcas únicas
        const marcas = [...new Set(filteredVariantes.map(v => v.marca_nombre))];
        
        return marcas.map(marca => 
            `<option value="${marca}">${marca}</option>`
        ).join('');
    }

    function updateFilters(e) {
        const productCard = e.target.closest('.product-card');
        const colorFilter = productCard.querySelector('.color-filter');
        const marcaFilter = productCard.querySelector('.marca-filter');
        const quantitySpan = productCard.querySelector('.current-quantity span');
        const variantesData = productCard.querySelector('.variantes-data');
        
        // Obtener datos de las variantes
        const variantes = JSON.parse(variantesData.value);
        
        // Obtener selecciones actuales
        const selectedColor = colorFilter.value;
        const selectedMarca = marcaFilter.value;
        
        // Actualizar opciones de los dropdowns
        if (e.target.classList.contains('color-filter')) {
            // Si cambié el color, actualizar marcas disponibles
            marcaFilter.innerHTML = '<option value="">Todas las marcas</option>' + 
                generateMarcaOptions(variantes, selectedColor);
            
            // Mantener selección si sigue disponible
            if (selectedMarca) {
                const option = [...marcaFilter.options].find(o => o.value === selectedMarca);
                if (option) option.selected = true;
            }
        } else {
            // Si cambié la marca, actualizar colores disponibles
            colorFilter.innerHTML = '<option value="">Todos los colores</option>' + 
                generateColorOptions(variantes, selectedMarca);
            
            // Mantener selección si sigue disponible
            if (selectedColor) {
                const option = [...colorFilter.options].find(o => o.value === selectedColor);
                if (option) option.selected = true;
            }
        }
        
        // Calcular nueva cantidad
        const cantidad = variantes.reduce((sum, variant) => {
            if (selectedColor && variant.color !== selectedColor) return sum;
            if (selectedMarca && variant.marca_nombre !== selectedMarca) return sum;
            return sum + variant.cantidad;
        }, 0);
        
        quantitySpan.textContent = cantidad;
    }
});