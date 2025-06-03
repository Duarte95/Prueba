// Verificar sesión
function checkSession() {
    if (!sessionStorage.getItem('loggedin')) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// Verificar rol de admin
function checkAdminRole() {
    if (sessionStorage.getItem('userRol') !== 'admin') {
        window.location.href = 'home.html';
        return false;
    }
    return true;
}

// Mostrar notificación
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}