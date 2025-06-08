document.addEventListener('DOMContentLoaded', () => {
  if (!checkSession()) return;

  // Variables globales para almacenar catálogos
  let prendas = [];
  let marcas = [];
  
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
  const productIdInput = document.getElementById('productId'); // Campo oculto

  // Event listeners
  logoutBtn.addEventListener('click', logout);
  addProductBtn.addEventListener('click', showProductForm);
  cancelProductBtn.addEventListener('click', hideProductForm);
  productForm.addEventListener('submit', saveProduct);

      // Ocultar menú "Usuarios" si no es admin
    const userRol = sessionStorage.getItem('userRol');
    if (userRol !== 'admin') {
        document.querySelectorAll('a[href="usuarios.html"], a[href="ajustes.html"]').forEach(el => {
            el.style.display = 'none';
        });
    }

  // Cargar catálogos y productos
  loadCatalogos();
  loadProducts();

  function showProductForm() {
    productForm.reset();
    productIdInput.value = '';
    productFormContainer.classList.remove('hidden');
  }

  function hideProductForm() {
    productFormContainer.classList.add('hidden');
  }

  // Cargar catálogos desde el backend
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
        showNotification('Producto guardado correctamente', 'success');
        hideProductForm();
        loadProducts();
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
          <th>Acciones</th>
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
            <td>
              <button class="btn-edit" data-id="${product.id}">Editar</button>
              ${isAdmin ? `<button class="btn-delete" data-id="${product.id}">Eliminar</button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    
    productListContainer.appendChild(table);
    
    // Agregar event listeners
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
});