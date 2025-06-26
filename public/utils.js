// utils.js
function checkLoginAndNavigate(page) {
    console.log(`Checking login for navigation to: ${page}`);
    const userId = localStorage.getItem('userId');
    if (!userId) {
        console.log('User not logged in, showing message popup');
        showMessagePopup('Please sign in / register to see this page');
        return false;
    }
    console.log('User logged in, navigating to:', page);
    window.location.href = `/${page}`;
}

function showMessagePopup(message) {
    console.log('Showing message popup with:', message);
    // Remove existing message popup if any
    const existingPopup = document.getElementById('messagePopup');
    if (existingPopup) {
        existingPopup.remove();
    }

    // Create popup
    const popup = document.createElement('div');
    popup.id = 'messagePopup';
    popup.className = 'message-popup';
    popup.innerHTML = `
        <div class="message-popup-content">
            <span class="message-close-btn">×</span>
            <p>${message}</p>
            <button class="sign-in-redirect-btn">Sign In</button>
            <button class="register-redirect-btn">Register</button>
        </div>
    `;
    document.body.appendChild(popup);

    // Show popup
    popup.style.display = 'flex';

    // Bind close button
    const closeBtn = popup.querySelector('.message-close-btn');
    closeBtn.addEventListener('click', () => {
        console.log('Message popup closed');
        popup.remove();
    });

    // Bind Sign In button
    const signInBtn = popup.querySelector('.sign-in-redirect-btn');
    signInBtn.addEventListener('click', () => {
        console.log('Sign In button clicked in message popup');
        popup.remove();
        // Trigger auth.js's login popup
        openForm();
    });

    // Bind Register button
    const registerBtn = popup.querySelector('.register-redirect-btn');
    registerBtn.addEventListener('click', () => {
        console.log('Register button clicked in message popup');
        popup.remove();
        // Trigger auth.js's register popup
        showRegisterForm();
    });

    // Close on click outside
    window.addEventListener('click', (event) => {
        if (event.target === popup) {
            console.log('Message popup closed via click outside');
            popup.remove();
        }
    }, { once: true });
}

function logout() {
    console.log('Logging out user at:', new Date().toISOString());
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('token');
    sessionStorage.removeItem('orderData');
    console.log('localStorage and sessionStorage cleared');
    window.location.href = '/';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { checkLoginAndNavigate, logout };
} else {
    window.checkLoginAndNavigate = checkLoginAndNavigate;
    window.logout = logout;
}
window.logout = logout;
