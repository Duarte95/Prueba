document.addEventListener('DOMContentLoaded', () => {
    if (!checkSession()) return;

    const logoutBtn = document.getElementById('logout');
    const typeFilter = document.getElementById('typeFilter');
    const filterBtn = document.getElementById('filterBtn');
    const historyContainer = document.getElementById('historyContainer');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('pageInfo');

    let currentPage = 1;
    let totalPages = 1;
    let currentType = '';

    logoutBtn.addEventListener('click', logout);
    filterBtn.addEventListener('click', loadHistory);
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadHistory();
        }
    });
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadHistory();
        }
    });

    loadHistory();

    async function loadHistory() {
        currentType = typeFilter.value;
        historyContainer.innerHTML = '<div class="spinner"></div>';
        
        try {
            const response = await fetch(`/api/movimientos?page=${currentPage}&type=${currentType}`);
            if (!response.ok) throw new Error('Error al cargar histórico');
            
            const data = await response.json();
            renderHistory(data);
        } catch (error) {
            showNotification(`Error: ${error.message}`, 'error');
            historyContainer.innerHTML = '<p class="empty">Error al cargar histórico</p>';
        }
    }

    function renderHistory(data) {
        historyContainer.innerHTML = '';
        totalPages = data.totalPages;
        
        if (data.movimientos.length === 0) {
            historyContainer.innerHTML = '<p class="empty">No se encontraron movimientos</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'history-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Producto</th>
                    <th>Detalles</th>
                    <th>Usuario</th>
                </tr>
            </thead>
            <tbody>
                ${data.movimientos.map(mov => {
                    const producto = mov.producto_data;
                    
                    // Manejar diferentes tipos de movimientos
                    let productInfo = '';
                    let details = '';
                    
                    if (producto.tipo === 'edicion') {
                        // Movimiento de edición: mostrar cambios
                        productInfo = `${producto.old.producto_nombre} (${producto.old.catalogo_codigo}, ${producto.old.color}, ${producto.old.marca_nombre})`;
                        
                        const changes = [];
                        if (producto.old.cantidad !== producto.new.cantidad) {
                            changes.push(`Cantidad: ${producto.old.cantidad} → ${producto.new.cantidad}`);
                        }
                        if (producto.old.color !== producto.new.color) {
                            changes.push(`Color: ${producto.old.color} → ${producto.new.color}`);
                        }
                        if (producto.old.catalogo_codigo !== producto.new.catalogo_codigo) {
                            changes.push(`Código: ${producto.old.catalogo_codigo} → ${producto.new.catalogo_codigo}`);
                        }
                        
                        details = changes.join('<br>') || 'Sin cambios visibles';
                    } else {
                        // Otros movimientos
                        productInfo = `${producto.producto_nombre} (${producto.catalogo_codigo}, ${producto.color}, ${producto.marca_nombre})`;
                        details = `Cantidad: ${mov.cantidad}<br>Total: ${producto.cantidad}`;
                    }
                    
                    return `
                        <tr>
                            <td>${new Date(mov.fecha).toLocaleString()}</td>
                            <td><span class="${mov.tipo === 'entrada' ? 'success' : 'danger'}">${mov.tipo}</span></td>
                            <td>${productInfo}</td>
                            <td>${details}</td>
                            <td>${mov.usuario}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        `;
        
        historyContainer.appendChild(table);
        pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
        
        // Actualizar estado de botones
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
    }
});