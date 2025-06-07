document.addEventListener('DOMContentLoaded', () => {
    if (!checkSession() || !checkAdminRole()) return;

    // Elementos del DOM
    const prendasTab = document.getElementById('prendas-tab');
    const marcasTab = document.getElementById('marcas-tab');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const addPrendaBtn = document.getElementById('addPrendaBtn');
    const cancelPrendaBtn = document.getElementById('cancelPrendaBtn');
    const prendaFormContainer = document.getElementById('prendaFormContainer');
    const prendaForm = document.getElementById('prendaForm');
    const prendasListContainer = document.getElementById('prendasListContainer');
    const addMarcaBtn = document.getElementById('addMarcaBtn');
    const cancelMarcaBtn = document.getElementById('cancelMarcaBtn');
    const marcaFormContainer = document.getElementById('marcaFormContainer');
    const marcaForm = document.getElementById('marcaForm');
    const marcasListContainer = document.getElementById('marcasListContainer');

    // Cambiar pestañas
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Desactivar todas las pestañas
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));

            // Activar pestaña seleccionada
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        });
    });

    // Prendas
    addPrendaBtn.addEventListener('click', () => {
        prendaForm.reset();
        prendaFormContainer.classList.remove('hidden');
    });

    cancelPrendaBtn.addEventListener('click', () => {
        prendaFormContainer.classList.add('hidden');
    });

    prendaForm.addEventListener('submit', savePrenda);

    // Marcas
    addMarcaBtn.addEventListener('click', () => {
        marcaForm.reset();
        marcaFormContainer.classList.remove('hidden');
    });

    cancelMarcaBtn.addEventListener('click', () => {
        marcaFormContainer.classList.add('hidden');
    });

    marcaForm.addEventListener('submit', saveMarca);

    // Cargar datos iniciales
    loadPrendas();
    loadMarcas();

    // Funciones para Prendas
    function loadPrendas() {
        // Temporal: cargar desde localStorage hasta que el backend esté listo
        const prendas = JSON.parse(localStorage.getItem('catalogo_prendas') || '[]');
        renderPrendas(prendas);
    }

    function renderPrendas(prendas) {
        prendasListContainer.innerHTML = '';

        if (prendas.length === 0) {
            prendasListContainer.innerHTML = '<p class="empty">No hay prendas registradas</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'catalogo-table';
        table.innerHTML = `
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${prendas.map(prenda => `
            <tr>
              <td>${prenda.codigo}</td>
              <td>${prenda.nombre}</td>
              <td>
                <button class="btn-delete" data-id="${prenda.id}">Eliminar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      `;

        prendasListContainer.appendChild(table);

        table.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deletePrenda(btn.dataset.id));
        });
    }

    function savePrenda(e) {
        e.preventDefault();

        const prenda = {
            id: Date.now(), // ID temporal
            codigo: document.getElementById('prendaCodigo').value,
            nombre: document.getElementById('prendaNombre').value
        };

        // Validación
        if (!prenda.codigo || !prenda.nombre) {
            showNotification('Todos los campos son obligatorios', 'error');
            return;
        }

        // Temporal: guardar en localStorage hasta que el backend esté listo
        const prendas = JSON.parse(localStorage.getItem('catalogo_prendas') || '[]');
        prendas.push(prenda);
        localStorage.setItem('catalogo_prendas', JSON.stringify(prendas));

        showNotification('Prenda guardada correctamente', 'success');
        prendaFormContainer.classList.add('hidden');
        loadPrendas();
    }

    function deletePrenda(id) {
        if (!confirm('¿Estás seguro de eliminar esta prenda?')) return;

        // Temporal: eliminar de localStorage
        let prendas = JSON.parse(localStorage.getItem('catalogo_prendas') || '[]');
        prendas = prendas.filter(p => p.id != id);
        localStorage.setItem('catalogo_prendas', JSON.stringify(prendas));

        showNotification('Prenda eliminada', 'success');
        loadPrendas();
    }

    // Funciones para Marcas (similares a Prendas)
    function loadMarcas() {
        const marcas = JSON.parse(localStorage.getItem('catalogo_marcas') || '[]');
        renderMarcas(marcas);
    }

    function renderMarcas(marcas) {
        marcasListContainer.innerHTML = '';

        if (marcas.length === 0) {
            marcasListContainer.innerHTML = '<p class="empty">No hay marcas registradas</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'catalogo-table';
        table.innerHTML = `
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${marcas.map(marca => `
            <tr>
              <td>${marca.nombre}</td>
              <td>
                <button class="btn-delete" data-id="${marca.id}">Eliminar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      `;

        marcasListContainer.appendChild(table);

        table.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteMarca(btn.dataset.id));
        });
    }

    function saveMarca(e) {
        e.preventDefault();

        const marca = {
            id: Date.now(),
            nombre: document.getElementById('marcaNombre').value
        };

        if (!marca.nombre) {
            showNotification('El nombre es obligatorio', 'error');
            return;
        }

        let marcas = JSON.parse(localStorage.getItem('catalogo_marcas') || '[]');
        marcas.push(marca);
        localStorage.setItem('catalogo_marcas', JSON.stringify(marcas));

        showNotification('Marca guardada correctamente', 'success');
        marcaFormContainer.classList.add('hidden');
        loadMarcas();
    }

    function deleteMarca(id) {
        if (!confirm('¿Estás seguro de eliminar esta marca?')) return;

        let marcas = JSON.parse(localStorage.getItem('catalogo_marcas') || '[]');
        marcas = marcas.filter(m => m.id != id);
        localStorage.setItem('catalogo_marcas', JSON.stringify(marcas));

        showNotification('Marca eliminada', 'success');
        loadMarcas();
    }
});