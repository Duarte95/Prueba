document.addEventListener('DOMContentLoaded', () => {
    if (!checkSession() || !checkAdminRole()) return;

    const logoutBtn = document.getElementById('logout');
    const addUserBtn = document.getElementById('addUserBtn');
    const cancelUserBtn = document.getElementById('cancelUserBtn');
    const userForm = document.getElementById('userForm');
    const userFormContainer = document.getElementById('userFormContainer');
    const userListContainer = document.getElementById('userListContainer');

    logoutBtn.addEventListener('click', logout);
    addUserBtn.addEventListener('click', showUserForm);
    cancelUserBtn.addEventListener('click', hideUserForm);
    userForm.addEventListener('submit', saveUser);

    // Ocultar menú "Usuarios" si no es admin (aunque solo admin debería ver esto)
    const userRol = sessionStorage.getItem('userRol');
    if (userRol !== 'admin') {
        document.querySelectorAll('a[href="usuarios.html"]').forEach(el => {
            el.style.display = 'none';
        });
    }

    loadUsers();

    function showUserForm() {
        userForm.reset();
        userFormContainer.classList.remove('hidden');
    }

    function hideUserForm() {
        userFormContainer.classList.add('hidden');
    }

    function validateUser() {
        const nombre = document.getElementById('userName').value.trim();
        const usuario = document.getElementById('userUsername').value.trim();
        const clave = document.getElementById('userPassword').value;

        if (!nombre) {
            showNotification('El nombre es obligatorio', 'error');
            return false;
        }

        if (!usuario) {
            showNotification('El usuario es obligatorio', 'error');
            return false;
        }

        if (!clave) {
            showNotification('La contraseña es obligatoria', 'error');
            return false;
        }

        return true;
    }

    async function saveUser(e) {
        e.preventDefault();
        if (!validateUser()) return;

        const user = {
            nombre: document.getElementById('userName').value,
            usuario: document.getElementById('userUsername').value,
            clave: document.getElementById('userPassword').value,
            rol: document.getElementById('userRole').value
        };

        try {
            const response = await fetch('/api/usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });

            if (response.ok) {
                showNotification('Usuario creado correctamente', 'success');
                hideUserForm();
                loadUsers();
            } else {
                const error = await response.json();
                showNotification(`Error: ${error.error}`, 'error');
            }
        } catch (error) {
            showNotification('Error de conexión', 'error');
        }
    }

    async function loadUsers() {
        try {
            const response = await fetch('/api/usuarios');
            const users = await response.json();
            renderUsers(users);
        } catch (error) {
            showNotification('Error al cargar usuarios', 'error');
            userListContainer.innerHTML = '<p class="empty">Error al cargar usuarios</p>';
        }
    }

    function renderUsers(users) {
        userListContainer.innerHTML = '';

        if (users.length === 0) {
            userListContainer.innerHTML = '<p class="empty">No hay usuarios registrados</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'user-table';
        table.innerHTML = `
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td>${user.nombre}</td>
              <td>${user.usuario}</td>
              <td>${user.rol === 'admin' ? 'Administrador' : 'Usuario Ordinario'}</td>
              <td>
                <button class="btn-delete" data-id="${user.id}">Eliminar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      `;

        userListContainer.appendChild(table);

        table.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteUser(btn.dataset.id));
        });
    }

    async function deleteUser(id) {
        if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

        try {
            const response = await fetch(`/api/usuarios/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showNotification('Usuario eliminado', 'success');
                loadUsers();
            } else {
                const error = await response.json();
                showNotification(`Error: ${error.error}`, 'error');
            }
        } catch (error) {
            showNotification('Error de conexión', 'error');
        }
    }
});