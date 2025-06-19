function loadUserSession() {
    const loggedInUser = localStorage.getItem('loggedInUser');
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('role');
    if (loggedInUser && userId && !isNaN(userId) && role) {
        updateUserInterface(loggedInUser);
    } else {
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('userId');
        localStorage.removeItem('role');
        updateUserInterface(null);
        // Only call checkUserRole if userId exists and is valid
        if (userId && !isNaN(userId)) {
            checkUserRole(userId);
        }
    }
}

// Helper to check if user is admin (for UI purposes only)
function isAdmin() {
    const role = localStorage.getItem('role');
    return role === 'admin';
}

async function checkUserRole(userId) {
    if (!userId) return;
    try {
        const response = await fetch(`/api/user-role?userId=${userId}`);
        const data = await response.json();
        if (response.ok && data.role) {
            localStorage.setItem('role', data.role);
        } else {
            localStorage.removeItem('role');
        }
    } catch (error) {
        console.error('Error checking user role:', error);
    }
}

// ... (rest of the auth.js code remains unchanged, including openForm, closeForm, handleLogin, etc.)
function openForm() {
    const popup = document.getElementById("loginPopup");
    if (popup) {
        popup.style.display = "flex";
        popup.innerHTML = `
            <div class="popup-content">
                <span class="close-btn" onclick="closeForm()">×</span>
                <h2>Sign In</h2>
                <form id="login-form">
                    <input type="text" id="username" placeholder="Username or Email" required>
                    <input type="password" id="password" placeholder="Password" required>
                    <button type="submit">Log In</button>
                    <button type="button" class="register-toggle" id="register-toggle">Register</button>
                    <p><a href="#" id="forgot-password-link" class="forgot-password-link-btn">Forgot Password?</a></p>
                </form>
                <div id="login-error" class="error-message"></div>
            </div>
        `;
        document.getElementById('login-form').addEventListener('submit', handleLogin);
        document.getElementById('register-toggle').addEventListener('click', showRegisterForm);
        document.getElementById('forgot-password-link').addEventListener('click', showForgotPasswordForm);
    }
}

function closeForm() {
    const popup = document.getElementById("loginPopup");
    if (popup) {
        popup.style.display = "none";
        popup.innerHTML = "";
    }
}

window.onclick = function(event) {
    const popup = document.getElementById("loginPopup");
    if (popup && event.target === popup) {
        closeForm();
    }
};

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginError = document.getElementById('login-error');
    if (username && password) {
        let attempts = 3;
        while (attempts > 0) {
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (response.ok) {
                    alert('Login successful! Welcome, ' + username);
                    localStorage.setItem('loggedInUser', username);
                    localStorage.setItem('userId', data.userId);
                    localStorage.setItem('role', data.role);
                    closeForm();
                    updateUserInterface(username);
                    window.location.href = '/dashboard.html';
                    return;
                } else {
                    loginError.textContent = data.message || 'Invalid username or password.';
                    return;
                }
            } catch (error) {
                console.error('Login error:', error);
                attempts--;
                if (attempts === 0) {
                    loginError.textContent = 'Error connecting to server after retries. Please try again later.';
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } else {
        loginError.textContent = 'Please fill in all fields.';
    }
}

function showRegisterForm() {
    const popup = document.getElementById("loginPopup");
    if (popup) {
        popup.innerHTML = `
            <div class="popup-content">
                <span class="close-btn" onclick="closeForm()">×</span>
                <h2>Register</h2>
                <form id="register-form">
                    <input type="text" id="reg-username" placeholder="Username" required>
                    <input type="email" id="reg-email" placeholder="Email" required>
                    <input type="password" id="reg-password" placeholder="Password" required>
                    <button type="submit" class="register-btn">Register</button>
                    <p>Already have an account? <a href="#" id="show-login">Sign In</a></p>
                </form>
                <div id="register-error" class="error-message"></div>
            </div>
        `;
        document.querySelector('.close-btn').addEventListener('click', closeForm);
        document.getElementById('register-form').addEventListener('submit', handleRegister);
        document.getElementById('show-login').addEventListener('click', openForm);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const registerError = document.getElementById('register-error');
    if (username && email && password) {
        let attempts = 3;
        while (attempts > 0) {
            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
                const data = await response.json();
                if (response.ok) {
                    alert('Registration successful! Welcome, ' + username);
                    localStorage.setItem('loggedInUser', username);
                    localStorage.setItem('userId', data.userId);
                    localStorage.setItem('role', data.role);
                    closeForm();
                    updateUserInterface(username);
                    window.location.href = '/dashboard.html';
                    return;
                } else {
                    registerError.textContent = data.message || 'Username or email already exists.';
                    return;
                }
            } catch (error) {
                console.error('Registration error:', error);
                attempts--;
                if (attempts === 0) {
                    registerError.textContent = 'Error connecting to server after retries. Please try again later.';
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } else {
        registerError.textContent = 'Please fill in all fields.';
    }
}

function showForgotPasswordForm(e) {
    e.preventDefault();
    const popup = document.getElementById("loginPopup");
    if (popup) {
        popup.innerHTML = `
            <div class="popup-content">
                <span class="close-btn" onclick="closeForm()">×</span>
                <h2>Forgot Password</h2>
                <form id="forgot-password-form">
                    <input type="email" id="forgot-email" placeholder="Enter your email" required>
                    <button type="submit" class="forgot-password-btn">Send Reset Link</button>
                    <p>Back to <a href="#" id="show-login">Sign In</a></p>
                </form>
                <div id="forgot-password-message" class="error-message"></div>
            </div>
        `;
        document.querySelector('.close-btn').addEventListener('click', closeForm);
        document.getElementById('forgot-password-form').addEventListener('submit', handleForgotPassword);
        document.getElementById('show-login').addEventListener('click', openForm);
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const forgotPasswordMessage = document.getElementById('forgot-password-message');
    if (email) {
        try {
            const response = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            if (response.ok) {
                forgotPasswordMessage.style.color = 'green';
                forgotPasswordMessage.textContent = 'Password reset link sent to your email!';
                setTimeout(closeForm, 3000);
            } else {
                forgotPasswordMessage.textContent = data.message || 'Failed to send reset link.';
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            forgotPasswordMessage.textContent = 'Server error. Please try again later.';
        }
    } else {
        forgotPasswordMessage.textContent = 'Please enter your email.';
    }
}

function showResetPasswordForm() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    const token = urlParams.get('token');
    if (userId && token) {
        const popup = document.getElementById("loginPopup");
        if (popup) {
            popup.style.display = "flex";
            popup.innerHTML = `
                <div class="popup-content">
                    <span class="close-btn" onclick="closeForm()">×</span>
                    <h2>Reset Password</h2>
                    <form id="reset-password-form">
                        <input type="password" id="new-password" placeholder="New Password" required>
                        <button type="submit" class="reset-btn">Reset Password</button>
                    </form>
                    <div id="reset-password-message" class="error-message"></div>
                </div>
            `;
            document.querySelector('.close-btn').addEventListener('click', closeForm);
            document.getElementById('reset-password-form').addEventListener('submit', (e) => handleResetPassword(e, userId, token));
        }
    }
}

async function handleResetPassword(e, userId, token) {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const resetPasswordMessage = document.getElementById('reset-password-message');
    if (newPassword) {
        try {
            const response = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, token, newPassword })
            });
            const data = await response.json();
            if (response.ok) {
                resetPasswordMessage.style.color = 'green';
                resetPasswordMessage.textContent = 'Password reset successfully! Redirecting to login...';
                setTimeout(() => {
                    closeForm();
                    openForm();
                    window.history.replaceState({}, document.title, '/league-services.html');
                }, 3000);
            } else {
                resetPasswordMessage.textContent = data.message || 'Failed to reset password.';
            }
        } catch (error) {
            console.error('Reset password error:', error);
            resetPasswordMessage.textContent = 'Server error. Please try again later.';
        }
    } else {
        resetPasswordMessage.textContent = 'Please enter a new password.';
    }
}

function updateUserInterface(username) {
    const signInButtons = document.querySelectorAll('.sign-in-btn');
    signInButtons.forEach(button => {
        const existingDropdown = button.parentNode.querySelector('.profile-dropdown');
        if (existingDropdown) {
            existingDropdown.remove();
        }

        if (username) {
            button.style.display = 'none';
            const profileDropdown = document.createElement('div');
            profileDropdown.className = 'profile-dropdown';
            profileDropdown.innerHTML = `
                <button class="profile-btn">${username}</button>
                <div class="dropdown-content">
                    <a href="/dashboard.html" class="dashboard-link">Dashboard</a>
                    <a href="#" class="logout-link">Logout</a>
                </div>
            `;
            button.parentNode.appendChild(profileDropdown);

            const profileBtn = profileDropdown.querySelector('.profile-btn');
            const dropdownContent = profileDropdown.querySelector('.dropdown-content');
            profileBtn.addEventListener('click', function(e) {
                e.preventDefault();
                dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
            });

            profileDropdown.querySelector('.logout-link').addEventListener('click', function(e) {
                e.preventDefault();
                logout();
            });

            document.addEventListener('click', function(e) {
                if (!profileDropdown.contains(e.target)) {
                    dropdownContent.style.display = 'none';
                }
            });
        } else {
            button.style.display = 'inline-block';
            button.textContent = 'Sign In';
            button.href = '#';
            button.addEventListener('click', openForm);
        }
    });
}

function logout() {
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    window.location.href = '/league-services.html';
}

document.addEventListener("DOMContentLoaded", () => {
    loadUserSession();
    const signInButtons = document.querySelectorAll('.sign-in-btn');
    signInButtons.forEach(button => {
        button.addEventListener('click', openForm);
    });
    showResetPasswordForm();
});