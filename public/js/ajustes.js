document.addEventListener('DOMContentLoaded', () => {
  if (!checkSession() || !checkAdminRole()) return;

  // Elementos del DOM
  const logoutBtn = document.getElementById('logout');
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

  logoutBtn.addEventListener('click', logout);

  // Cambiar pestañas
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));

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
  async function loadPrendas() {
    try {
      const response = await fetch('/api/catalogo/prendas');
      if (!response.ok) throw new Error('Error al cargar prendas');

      const prendas = await response.json();
      renderPrendas(prendas);
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error');
    }
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

  async function savePrenda(e) {
    e.preventDefault();

    const prenda = {
      codigo: document.getElementById('prendaCodigo').value,
      nombre: document.getElementById('prendaNombre').value
    };

    if (!prenda.codigo || !prenda.nombre) {
      showNotification('Todos los campos son obligatorios', 'error');
      return;
    }

    try {
      const response = await fetch('/api/catalogo/prendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prenda)
      });

      if (response.ok) {
        showNotification('Prenda guardada correctamente', 'success');
        prendaFormContainer.classList.add('hidden');
        loadPrendas();
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error');
    }
  }

  async function deletePrenda(id) {
    if (!confirm('¿Estás seguro de eliminar esta prenda?')) return;

    try {
      const response = await fetch(`/api/catalogo/prendas/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showNotification('Prenda eliminada', 'success');
        loadPrendas();
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error');
    }
  }

  // Funciones para Marcas
  async function loadMarcas() {
    try {
      const response = await fetch('/api/catalogo/marcas');
      if (!response.ok) throw new Error('Error al cargar marcas');

      const marcas = await response.json();
      renderMarcas(marcas);
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error');
    }
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

  async function saveMarca(e) {
    e.preventDefault();

    const marca = {
      nombre: document.getElementById('marcaNombre').value
    };

    if (!marca.nombre) {
      showNotification('El nombre es obligatorio', 'error');
      return;
    }

    try {
      const response = await fetch('/api/catalogo/marcas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marca)
      });

      if (response.ok) {
        showNotification('Marca guardada correctamente', 'success');
        marcaFormContainer.classList.add('hidden');
        loadMarcas();
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error');
    }
  }

  async function deleteMarca(id) {
    if (!confirm('¿Estás seguro de eliminar esta marca?')) return;

    try {
      const response = await fetch(`/api/catalogo/marcas/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showNotification('Marca eliminada', 'success');
        loadMarcas();
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error) {
      showNotification(`Error: ${error.message}`, 'error');
    }
  }
});