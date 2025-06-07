document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error en la autenticación');
        }

        const data = await response.json();

        if (data.success) {
            sessionStorage.setItem('loggedin', 'true');
            sessionStorage.setItem('userRol', data.rol);

            // Ocultar menú "Usuarios" si no es admin
            if (data.rol !== 'admin') {
                document.querySelectorAll('a[href="usuarios.html"]').forEach(el => {
                    el.style.display = 'none';
                });
            }

            window.location.href = data.rol === 'admin' ? 'usuarios.html' : 'home.html';
        } else {
            showNotification('Credenciales inválidas', 'error');
        }
    } catch (error) {
        showNotification(error.message || 'Error de conexión', 'error');
        console.error('Error en login:', error);
    }
});

// CORRECCIÓN: Confirmación para cerrar sesión
function logout() {
    // Confirmar antes de cerrar sesión
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
        try {
            fetch('/api/logout')
                .then(response => {
                    if (!response.ok) throw new Error('Error en el servidor');
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        sessionStorage.removeItem('loggedin');
                        sessionStorage.removeItem('userRol');
                        window.location.href = 'index.html';
                    } else {
                        throw new Error('Error al cerrar sesión');
                    }
                })
                .catch(error => {
                    console.error('Error en logout:', error);
                    showNotification('Error al cerrar sesión', 'error');
                });
        } catch (error) {
            console.error('Error inesperado en logout:', error);
            showNotification('Error inesperado al cerrar sesión', 'error');
        }
    }
}

// Asignar evento de logout
if (document.getElementById('logout')) {
    document.getElementById('logout').addEventListener('click', logout);
}

// Ocultar menú "Usuarios" al cargar páginas si no es admin
document.addEventListener('DOMContentLoaded', () => {
    const userRol = sessionStorage.getItem('userRol');
    if (userRol && userRol !== 'admin') {
        document.querySelectorAll('a[href="usuarios.html"]').forEach(el => {
            el.style.display = 'none';
        });
    }
});