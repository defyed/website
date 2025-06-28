document.addEventListener('DOMContentLoaded', () => {
    // Removed baseUrl for relative paths
    console.log('login.js loaded at:', new Date().toISOString());

    // Create popup containers dynamically
    const createPopup = (id) => {
        let popup = document.getElementById(id);
        if (!popup) {
            console.log(`Creating popup: ${id}`);
            popup = document.createElement('div');
            popup.id = id;
            popup.className = 'popup';
            popup.style.display = 'none';
            document.body.appendChild(popup);
        }
        return popup;
    };

    const loginPopup = createPopup('loginPopup');
    const registerPopup = createPopup('registerPopup');
    const forgotPasswordPopup = createPopup('forgotPasswordPopup');
    const resetPasswordPopup = createPopup('resetPasswordPopup');

    // Helper to hide all popups
    const hideAllPopups = () => {
        console.log('Hiding all popups');
        loginPopup.style.display = 'none';
        registerPopup.style.display = 'none';
        forgotPasswordPopup.style.display = 'none';
        resetPasswordPopup.style.display = 'none';
        const errorMessages = document.querySelectorAll('.error-message');
        errorMessages.forEach(el => el.textContent = '');
    };

    // Render popup content
    const renderLoginPopup = () => {
        console.log('Rendering login popup');
        loginPopup.innerHTML = `
            <div class="popup-content">
                <span class="close-btn">×</span>
                <h2>Sign In</h2>
                <form id="login-form">
                    <input type="text" id="username" placeholder="Username or Email" required>
                    <input type="password" id="password" placeholder="Password" required>
                    <button type="submit" class="sign-in-btn">Login</button>
                    <button type="button" id="forgot-password-btn" class="forgot-password-btn">Forgot Password?</button>
                    <p>Don't have an account? <a href="#" id="show-register">Register</a></p>
                </form>
                <div id="login-error" class="error-message"></div>
            </div>
        `;
        bindPopupEvents();
    };

    const renderRegisterPopup = () => {
        console.log('Rendering register popup');
        registerPopup.innerHTML = `
            <div class="popup-content">
                <span class="close-btn">×</span>
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
        bindPopupEvents();
    };

    const renderForgotPasswordPopup = () => {
        console.log('Rendering forgot password popup');
        forgotPasswordPopup.innerHTML = `
            <div class="popup-content">
                <span class="close-btn">×</span>
                <h2>Forgot Password</h2>
                <form id="forgot-password-form">
                    <input type="email" id="forgot-email" placeholder="Enter your email" required>
                    <button type="submit" class="forgot-password-btn">Send Reset Link</button>
                </form>
                <div id="forgot-password-message" class="error-message"></div>
            </div>
        `;
        bindPopupEvents();
    };

    const renderResetPasswordPopup = () => {
        console.log('Rendering reset password popup');
        resetPasswordPopup.innerHTML = `
            <div class="popup-content">
                <span class="close-btn">×</span>
                <h2>Reset Password</h2>
                <form id="reset-password-form">
                    <input type="password" id="new-password" placeholder="New Password" required>
                    <button type="submit" class="reset-btn">Reset Password</button>
                </form>
                <div id="reset-password-message" class="error-message"></div>
            </div>
        `;
        bindPopupEvents();
    };

    // Bind events to popup elements
    const bindPopupEvents = () => {
        console.log('Binding popup events');

        // Close buttons
        const closeBtns = document.querySelectorAll('.close-btn');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                console.log('Close button clicked');
                hideAllPopups();
            });
        });

        // Show register link
        const showRegister = document.getElementById('show-register');
        if (showRegister) {
            showRegister.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Show register link clicked');
                hideAllPopups();
                renderRegisterPopup();
                registerPopup.style.display = 'flex';
            });
        } else {
            console.warn('Show register link not found');
        }

        // Show login link
        const showLogin = document.getElementById('show-login');
        if (showLogin) {
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Show login link clicked');
                hideAllPopups();
                renderLoginPopup();
                loginPopup.style.display = 'flex';
            });
        } else {
            console.warn('Show login link not found');
        }

        // Forgot password button
        const forgotPasswordBtn = document.getElementById('forgot-password-btn');
        if (forgotPasswordBtn) {
            forgotPasswordBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Forgot password button clicked');
                hideAllPopups();
                renderForgotPasswordPopup();
                forgotPasswordPopup.style.display = 'flex';
            });
        } else {
            console.error('Forgot password button not found in login popup');
        }

        // Login form submission
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Login form submitted');
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                const loginError = document.getElementById('login-error');

                try {
                    const response = await fetch(`/api/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();

                    if (response.ok) {
                        console.log('Login successful:', data);
                        localStorage.setItem('userId', data.userId);
                        localStorage.setItem('username', data.username);
                        localStorage.setItem('role', data.role);
                        hideAllPopups();
                        updateUserInterface(data.username);
                        window.location.href = '/dashboard';
                    } else {
                        loginError.textContent = data.message || 'Login failed';
                        console.log('Login failed:', data.message);
                    }
                } catch (error) {
                    loginError.textContent = 'Server error. Please try again later.';
                    console.error('Login error:', error);
                }
            });
        } else {
            console.error('Login form not found');
        }

        // Register form submission
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Register form submitted');
                const username = document.getElementById('reg-username').value;
                const email = document.getElementById('reg-email').value;
                const password = document.getElementById('reg-password').value;
                const registerError = document.getElementById('register-error');

                try {
                    const response = await fetch(`/api/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, email, password })
                    });
                    const data = await response.json();

                    if (response.ok) {
                        console.log('Registration successful:', data);
                        localStorage.setItem('userId', data.userId);
                        localStorage.setItem('username', data.username);
                        localStorage.setItem('role', data.role);
                        hideAllPopups();
                        updateUserInterface(data.username);
                        window.location.href = '/dashboard.html';
                    } else {
                        registerError.textContent = data.message || 'Registration failed';
                        console.log('Registration failed:', data.message);
                    }
                } catch (error) {
                    registerError.textContent = 'Server error. Please try again later.';
                    console.error('Register error:', error);
                }
            });
        } else {
            console.warn('Register form not found');
        }

        // Forgot password form submission
        const forgotPasswordForm = document.getElementById('forgot-password-form');
        if (forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Forgot password form submitted');
                const email = document.getElementById('forgot-email').value;
                const forgotPasswordMessage = document.getElementById('forgot-password-message');

                try {
                    const response = await fetch(`/api/forgot-password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    const data = await response.json();

                    if (response.ok) {
                        forgotPasswordMessage.style.color = 'green';
                        forgotPasswordMessage.textContent = 'Password reset link sent to your email!';
                        console.log('Forgot password email sent');
                        setTimeout(hideAllPopups, 3000);
                    } else {
                        forgotPasswordMessage.textContent = data.message || 'Failed to send reset link';
                        console.log('Forgot password failed:', data.message);
                    }
                } catch (error) {
                    forgotPasswordMessage.textContent = 'Server error. Please try again later.';
                    console.error('Forgot password error:', error);
                }
            });
        } else {
            console.warn('Forgot password form not found');
        }

        // Reset password form submission
        const resetPasswordForm = document.getElementById('reset-password-form');
        if (resetPasswordForm) {
            resetPasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Reset password form submitted');
                const newPassword = document.getElementById('new-password').value;
                const urlParams = new URLSearchParams(window.location.search);
                const userId = urlParams.get('userId');
                const token = urlParams.get('token');
                const resetPasswordMessage = document.getElementById('reset-password-message');

                if (!userId || !token) {
                    resetPasswordMessage.textContent = 'Invalid reset link';
                    console.log('Invalid reset link: missing userId or token');
                    return;
                }

                try {
                    const response = await fetch(`/api/reset-password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, token, newPassword })
                    });
                    const data = await response.json();

                    if (response.ok) {
                        resetPasswordMessage.style.color = 'green';
                        resetPasswordMessage.textContent = 'Password reset successfully! Redirecting to login...';
                        console.log('Password reset successful');
                        setTimeout(() => {
                            hideAllPopups();
                            renderLoginPopup();
                            loginPopup.style.display = 'flex';
                            window.history.replaceState({}, document.title, '/league-services.html');
                        }, 3000);
                    } else {
                        resetPasswordMessage.textContent = data.message || 'Failed to reset password';
                        console.log('Reset password failed:', data.message);
                    }
                } catch (error) {
                    resetPasswordMessage.textContent = 'Server error. Please try again later.';
                    console.error('Reset password error:', error);
                }
            });
        } else {
            console.warn('Reset password form not found');
        }
    };

    // Update UI based on login status
    const updateUserInterface = (username) => {
        console.log('Updating UI for user:', username);
        const signInButtons = document.querySelectorAll('.sign-in-btn');
        signInButtons.forEach(button => {
            const existingDropdown = button.parentNode.querySelector('.profile-dropdown');
            if (existingDropdown) {
                existingDropdown.remove();
                console.log('Removed existing profile dropdown');
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
                console.log('Added profile dropdown for:', username);

                const profileBtn = profileDropdown.querySelector('.profile-btn');
                const dropdownContent = profileDropdown.querySelector('.dropdown-content');
                profileBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('Profile button clicked');
                    dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
                });

                profileDropdown.querySelector('.logout-link').addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('Logout link clicked');
                    logout(); // From utils.js
                });

                document.addEventListener('click', (e) => {
                    if (!profileDropdown.contains(e.target)) {
                        dropdownContent.style.display = 'none';
                    }
                });
            } else {
                button.style.display = 'inline-block';
                button.textContent = 'Sign In';
                button.addEventListener('click', () => {
                    console.log('Sign In button clicked');
                    hideAllPopups();
                    renderLoginPopup();
                    loginPopup.style.display = 'flex';
                });
            }
        });
    };

    // Initialize sign-in buttons
    const signInButtons = document.querySelectorAll('.sign-in-btn');
    if (signInButtons.length === 0) {
        console.warn('No .sign-in-btn elements found in DOM');
    } else {
        console.log(`Found ${signInButtons.length} .sign-in-btn elements`);
    }
    signInButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('Sign In button clicked');
            hideAllPopups();
            renderLoginPopup();
            loginPopup.style.display = 'flex';
        });
    });

    // Check login status
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    if (userId && username) {
        console.log('User logged in:', username);
        updateUserInterface(username);
    } else {
        console.log('No user logged in');
        updateUserInterface(null);
    }

    // Check URL for reset password params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('userId') && urlParams.has('token')) {
        console.log('Reset password params detected:', urlParams.toString());
        hideAllPopups();
        renderResetPasswordPopup();
        resetPasswordPopup.style.display = 'flex';
    }
});