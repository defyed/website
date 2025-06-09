function logout() {
    console.log('Logging out user at:', new Date().toISOString());
    // Clear all user-related localStorage items
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('token'); // If using a token
    // Clear sessionStorage for order data
    sessionStorage.removeItem('orderData');
    console.log('localStorage and sessionStorage cleared');
    // Redirect to league-services.html
    window.location.href = '/league-services.html';
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { logout };
} else {
    window.logout = logout;
}