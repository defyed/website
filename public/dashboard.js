(function () {
    console.log('dashboard.js loaded');
    const userId = localStorage.getItem('userId');
    console.log('userId from localStorage:', userId);
    if (!userId || isNaN(userId)) {
        console.error('No valid userId found, redirecting to login');
        alert('Please log in to view your dashboard.');
        window.location.href = '/league-services.html';
        return;
    }

    // Flag to prevent multiple fetch calls
    let isFetchingAvailableOrders = false;
    // Store user balance globally
    let userBalance = 0;

    async function fetchUserBalance() {
        try {
            console.log('Fetching balance for userId:', userId);
            const response = await fetch(`/api/user-balance?userId=${userId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            if (typeof data.balance !== 'number' || isNaN(data.balance)) {
                throw new Error(`Invalid balance format: ${JSON.stringify(data)}`);
            }
            console.log('User balance:', data.balance);
            userBalance = data.balance; // Store balance
            const balanceDisplay = document.getElementById('balance-display');
            if (balanceDisplay) {
                balanceDisplay.textContent = `Balance: $${data.balance.toFixed(2)}`;
            } else {
                console.error('Balance display element not found');
            }
        } catch (error) {
            console.error('Error fetching user balance:', error.message);
            const balanceDisplay = document.getElementById('balance-display');
            if (balanceDisplay) {
                balanceDisplay.textContent = 'Error loading balance.';
            }
            userBalance = 0; // Reset balance on error
        }
    }

    async function checkUserRole() {
        try {
            const response = await fetch(`/api/user-role?userId=${encodeURIComponent(userId)}`);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const { role } = await response.json();
            localStorage.setItem('userRole', role);

            // Hide all role-specific buttons by default
            const ordersLink = document.getElementById('orders-link');
            const availableOrdersLink = document.getElementById('available-orders-link');
            const workingOrdersLink = document.getElementById('working-orders-link');
            const completedOrdersLink = document.getElementById('completed-orders-link');
            const payoutHistoryLink = document.getElementById('payout-history-link');
            const payoutManagementLink = document.getElementById('payout-management-link');
            const adminPanelLink = document.getElementById('admin-panel-link');
            const coachingOrdersLink = document.getElementById('coaching-orders-link');

            // Debug log
            console.log('coachingOrdersLink exists:', !!coachingOrdersLink);

            // Safely hide links
            if (ordersLink) ordersLink.style.display = 'none';
            if (availableOrdersLink) availableOrdersLink.style.display = 'none';
            if (workingOrdersLink) workingOrdersLink.style.display = 'none';
            if (completedOrdersLink) completedOrdersLink.style.display = 'none';
            if (payoutHistoryLink) payoutHistoryLink.style.display = 'none';
            if (payoutManagementLink) payoutManagementLink.style.display = 'none';
            if (adminPanelLink) adminPanelLink.style.display = 'none';
            if (coachingOrdersLink) coachingOrdersLink.style.display = 'none';

            if (role === 'booster') {
                console.log('Showing booster buttons');
                if (availableOrdersLink) availableOrdersLink.style.display = 'block';
                if (workingOrdersLink) workingOrdersLink.style.display = 'block';
                if (ordersLink) ordersLink.style.display = 'block';
                if (payoutHistoryLink) payoutHistoryLink.style.display = 'block';
                console.log('Booster buttons set to display: block');
            } else if (role === 'admin') {
                console.log('Showing all buttons for admin');
                if (ordersLink) ordersLink.style.display = 'block';
                if (availableOrdersLink) availableOrdersLink.style.display = 'block';
                if (workingOrdersLink) workingOrdersLink.style.display = 'block';
                if (completedOrdersLink) completedOrdersLink.style.display = 'block';
                if (payoutHistoryLink) payoutHistoryLink.style.display = 'block';
                if (payoutManagementLink) payoutManagementLink.style.display = 'block';
                if (adminPanelLink) adminPanelLink.style.display = 'block';
                if (coachingOrdersLink) coachingOrdersLink.style.display = 'block';
                console.log('All buttons set to display: block for admin');
            } else if (role === 'coach') {
                console.log('Showing coach buttons');
                if (ordersLink) ordersLink.style.display = 'block';
                if (payoutHistoryLink) payoutHistoryLink.style.display = 'block';
                if (coachingOrdersLink) coachingOrdersLink.style.display = 'block';
                console.log('Coach buttons set to display: block');
            } else {
                // Customer role (default)
                console.log('Showing customer buttons');
                if (ordersLink) ordersLink.style.display = 'block';
                console.log('Customer buttons set to display: block');
            }

            return role;
        } catch (error) {
            console.error('Error fetching user role:', error.message);
            return null;
        }
    }

 async function fetchUserOrders() {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'coach') {
        console.log('Skipping user orders for coach role');
        const container = document.getElementById('my-orders');
        if (container) {
            container.innerHTML = '<p>Orders panel is not available for coaches. See My Coaching Orders.</p>';
        }
        return;
    }
    try {
        console.log('Fetching orders for userId:', userId, 'Role:', userRole);
        const response = await fetch(`/api/user-orders?userId=${encodeURIComponent(userId)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
        }
        const orders = await response.json();
        console.log('My Orders received:', orders);
        if (!Array.isArray(orders)) {
            console.warn('Unexpected response format for user orders:', orders);
            throw new Error('Invalid response format from server');
        }
        renderOrders(orders, 'my-orders');
    } catch (error) {
        console.error('Error fetching orders:', error.message);
        const container = document.getElementById('my-orders');
        if (container) {
            container.innerHTML = `<p style="color: red;">Failed to load orders: ${error.message}. Please try logging in again or contact support.</p>`;
        }
    }
}

async function fetchAvailableCoachingOrders() {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'coach' && userRole !== 'admin') {
        console.log('Skipping available coaching orders for non-coach/admin role:', userRole);
        const container = document.getElementById('coaching-orders');
        if (container) {
            container.innerHTML = '<p>Available coaching orders are only for coaches and admins.</p>';
        }
        return;
    }
    try {
        console.log('Fetching available coaching orders for userId:', userId);
        const response = await fetch(`/api/available-coaching-orders?userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
        }
        const orders = await response.json();
        console.log('Available coaching orders received:', orders);
        renderCoachingOrders(orders, 'coaching-orders', true);
    } catch (error) {
        console.error('Error fetching available coaching orders:', error.message);
        const container = document.getElementById('coaching-orders');
        if (container) {
            container.innerHTML = `<p style="color: red;">Error loading available coaching orders: ${error.message}. Please try again later.</p>`;
        }
    }
}
async function fetchWorkingCoachingOrders() {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'coach' && userRole !== 'admin') {
        console.log('Skipping working coaching orders for non-coach/admin role:', userRole);
        const container = document.getElementById('coaching-orders');
        if (container) {
            container.innerHTML = '<p>Working coaching orders are only for coaches and admins.</p>';
        }
        return;
    }
    try {
        console.log('Fetching working coaching orders for userId:', userId);
        const response = await fetch(`/api/working-coaching-orders?userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
        }
        const orders = await response.json();
        console.log('Working coaching orders received:', orders);
        renderCoachingOrders(orders, 'coaching-orders', false, true);
    } catch (error) {
        console.error('Error fetching working coaching orders:', error.message);
        const container = document.getElementById('coaching-orders');
        if (container) {
            container.innerHTML = `<p style="color: red;">Error loading working coaching orders: ${error.message}. Please try again later.</p>`;
        }
    }
}
async function fetchCompletedCoachingOrders() {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
        console.log('Skipping completed coaching orders for non-admin role:', userRole);
        return;
    }
    try {
        console.log('Fetching completed coaching orders for userId:', userId);
        const response = await fetch(`/api/completed-coaching-orders?userId=${userId}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
        }
        const orders = await response.json();
        console.log('Completed coaching orders received:', orders);
        renderCoachingOrders(orders, 'completed-orders', false, false, true);
    } catch (error) {
        console.error('Error fetching completed coaching orders:', error.message);
        const container = document.getElementById('completed-orders');
        if (container) {
            container.innerHTML = `<p style="color: red;">Error loading completed coaching orders: ${error.message}. Please try again later.</p>`;
        }
    }
}
async function fetchCoachingOrders() {
    const userRole = localStorage.getItem('userRole');
    console.log('Fetching coaching orders for userId:', userId, 'role:', userRole);
    if (userRole === 'admin') {
        await Promise.all([
            fetchAvailableCoachingOrders(),
            fetchWorkingCoachingOrders(),
            fetchCompletedCoachingOrders()
        ]);
    } else if (userRole === 'coach') {
        await Promise.all([
            fetchAvailableCoachingOrders(),
            fetchWorkingCoachingOrders()
        ]);
    } else {
        console.log('Skipping coaching orders for role:', userRole);
        const container = document.getElementById('coaching-orders');
        if (container) {
            container.innerHTML = '<p>Coaching orders are only for coaches and admins.</p>';
        }
    }
}
function renderCoachingOrders(orders, containerId, isAvailable = false, isWorking = false, isCompleted = false) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Error: ${containerId} container not found`);
        return;
    }
    const userRole = localStorage.getItem('userRole');
    const currentUserId = parseInt(userId);
    if (!Array.isArray(orders) || orders.length === 0) {
        container.innerHTML = '<p>No coaching orders found. Please check if orders exist or contact support.</p>';
        return;
    }
    const table = document.createElement('table');
    table.className = 'orders-table';
    let headers = '';
    if (isAvailable) {
        headers = `
            <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Game</th>
                <th>Hours</th>
                <th>Payout</th>
                <th>Created</th>
                <th>Action</th>
            </tr>
        `;
    } else if (isWorking) {
        headers = `
            <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Game</th>
                <th>Hours</th>
                <th>Payout</th>
                <th>Created</th>
                <th>Action</th>
            </tr>
        `;
    } else if (isCompleted) {
        headers = `
            <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Coach</th>
                <th>Game</th>
                <th>Hours</th>
                <th>Price</th>
                <th>Created</th>
                <th>Payout Status</th>
                <th>Action</th>
            </tr>
        `;
    } else {
        headers = `
            <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Coach</th>
                <th>Game</th>
                <th>Hours</th>
                <th>Price</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
            </tr>
        `;
    }
    table.innerHTML = `<thead>${headers}</thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    orders.forEach(order => {
        if (!order || !order.order_id) {
            console.warn('Skipping invalid coaching order:', order);
            return;
        }
        console.log('Rendering coaching order:', order);
        const isOwnOrder = userRole === 'coach' && order.coach_id === currentUserId;
        const row = document.createElement('tr');
        row.dataset.orderId = order.order_id;
        let rowData = '';
        if (isAvailable) {
            rowData = `
                <td><button class="order-id-button" data-order-id="${order.order_id}">?</button></td>
                <td>${order.customer_username || 'Unknown Customer'}</td>
                <td>${order.game_type || 'N/A'}</td>
                <td>${order.booked_hours || 'N/A'}</td>
                <td>$${(parseFloat(order.price || 0) * 0.80).toFixed(2)}</td>
                <td>${order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</td>
                <td><button class="claim-btn" data-order-id="${order.order_id}">Claim</button></td>
            `;
        } else if (isWorking) {
            const isCompleted = order.status === 'completed';
            rowData = `
                <td><button class="order-id-button" data-order-id="${order.order_id}">?</button></td>
                <td>${order.customer_username || 'Unknown Customer'}</td>
                <td>${order.game_type || 'N/A'}</td>
                <td>${order.booked_hours || 'N/A'}</td>
                <td>$${(parseFloat(order.price || 0) * 0.80).toFixed(2)}</td>
                <td>${order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <button class="cancel-btn" data-order-id="${order.order_id}" ${isCompleted ? 'disabled' : ''}>Cancel</button>
                    <br>
                    <button class="complete-btn" data-order-id="${order.order_id}" ${isCompleted ? 'disabled' : ''}>Complete</button>
                </td>
            `;
            if (isCompleted) {
                row.classList.add('completed-order');
            }
        } else if (isCompleted) {
            const payout = (parseFloat(order.price || 0) * 0.80).toFixed(2);
            rowData = `
                <td><button class="order-id-button" data-order-id="${order.order_id}">?</button></td>
                <td>${order.customer_username || 'Unknown Customer'}</td>
                <td>${order.coach_username || order.coach_name || 'Unknown Coach'}</td>
                <td>${order.game_type || 'N/A'}</td>
                <td>${order.booked_hours || 'N/A'}</td>
                <td>$${parseFloat(order.price || 0).toFixed(2)}</td>
                <td>${order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>${order.payout_status || 'Pending'}</td>
                <td>
                    <button class="approve-btn" data-order-id="${order.order_id}" ${order.payout_status === 'Paid' ? 'disabled' : ''}>
                        Approve Payout ($${payout})
                    </button>
                </td>
            `;
        } else {
            rowData = `
                <td><button class="order-id-button" data-order-id="${order.order_id}">?</button></td>
                <td>${order.customer_username || 'Unknown Customer'}</td>
                <td>${order.coach_username || order.coach_name || 'Unknown Coach'}</td>
                <td>${order.game_type || 'N/A'}</td>
                <td>${order.booked_hours || 'N/A'}</td>
                <td>
                    $${userRole === 'coach' ? (parseFloat(order.price || 0) * 0.80).toFixed(2) : parseFloat(order.price || 0).toFixed(2)}
                    ${userRole === 'coach' ? '<span class="payout-label">(Payout)</span>' : ''}
                </td>
                <td>${order.status || 'pending'}</td>
                <td>${order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>
                    ${userRole === 'coach' && order.coach_id === currentUserId && order.status !== 'completed' ? `
                        <button class="complete-btn" data-order-id="${order.order_id}">Mark Complete</button>
                    ` : ''}
                </td>
            `;
        }
        row.innerHTML = rowData;
        tbody.appendChild(row);
    });
    container.innerHTML = '';
    container.appendChild(table);

    document.querySelectorAll('.order-id-button').forEach(button => {
        button.addEventListener('click', function (e) {
            e.stopPropagation();
            const orderId = button.getAttribute('data-order-id');
            showOrderIdModal(orderId);
        });
    });

    if (isAvailable) {
        document.querySelectorAll('.claim-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const orderId = button.getAttribute('data-order-id');
                if (confirm(`Are you sure you want to claim coaching order ${orderId}?`)) {
                    try {
                        console.log('Claiming coaching orderId:', orderId, 'with userId:', userId);
                        const response = await fetch('/api/claim-coaching-order', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ userId, orderId })
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to claim coaching order');
                        }
                        alert('Coaching order claimed successfully!');
                        fetchCoachingOrders();
                    } catch (error) {
                        console.error('Error claiming coaching order:', error.message);
                        alert(`Failed to claim coaching order: ${error.message}`);
                    }
                }
            });
        });
    }

    if (isWorking) {
        document.querySelectorAll('.cancel-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const orderId = button.getAttribute('data-order-id');
                if (confirm(`Are you sure you want to cancel coaching order ${orderId}?`)) {
                    try {
                        console.log('Cancelling coaching orderId:', orderId, 'with userId:', userId);
                        const response = await fetch('/api/unclaim-coaching-order', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ userId, orderId })
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to cancel coaching order');
                        }
                        alert('Coaching order cancelled successfully!');
                        fetchCoachingOrders();
                    } catch (error) {
                        console.error('Error cancelling coaching order:', error.message);
                        alert(`Failed to cancel coaching order: ${error.message}`);
                    }
                }
            });
        });

        document.querySelectorAll('.complete-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const orderId = button.getAttribute('data-order-id');
                if (confirm(`Are you sure you want to mark coaching order ${orderId} as completed?`)) {
                    try {
                        console.log('Completing coaching orderId:', orderId, 'with userId:', userId);
                        const response = await fetch('/api/complete-coaching-order', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ userId, orderId })
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to complete coaching order');
                        }
                        alert('Coaching order marked as completed!');
                        fetchCoachingOrders();
                    } catch (error) {
                        console.error('Error completing coaching order:', error.message);
                        alert(`Failed to complete coaching order: ${error.message}`);
                    }
                }
            });
        });
    }

    if (isCompleted) {
        document.querySelectorAll('.approve-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const orderId = button.getAttribute('data-order-id');
                if (confirm(`Are you sure you want to approve the payout for coaching order ${orderId}?`)) {
                    try {
                        console.log('Approving payout for coaching orderId:', orderId, 'with userId:', userId);
                        const response = await fetch('/api/approve-coaching-payout', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ userId, orderId })
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to approve coaching payout');
                        }
                        alert('Coaching payout approved successfully!');
                        fetchCompletedCoachingOrders();
                    } catch (error) {
                        console.error('Error approving coaching payout:', error.message);
                        alert(`Failed to approve coaching payout: ${error.message}`);
                    }
                }
            });
        });
    }

    table.querySelectorAll('tbody tr').forEach(row => {
        const orderId = row.dataset.orderId;
        if (!orderId) {
            console.warn(`Skipping row with missing or invalid orderId in container: ${containerId}`, row.outerHTML);
            row.style.cursor = 'not-allowed';
            return;
        }
        const order = orders.find(o => String(o.order_id) === String(orderId));
        if (!order) {
            console.warn(`No order found for orderId: ${orderId} in container: ${containerId}`);
            row.style.cursor = 'not-allowed';
            return;
        }
        if (!(isWorking && order.status === 'completed') && !isCompleted) {
            row.addEventListener('click', async () => {
                const userRole = await checkUserRole();
                console.log('Row clicked for orderId:', orderId, 'Role:', userRole, 'Status:', order.status);
                showOrderFormModal(order, userRole);
            });
        } else {
            console.log('Skipping click handler for completed orderId:', orderId);
            row.style.cursor = 'not-allowed';
        }
    });
}
async function checkUserRole() {
    try {
        const response = await fetch(`/api/user-role?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const { role } = await response.json();
        localStorage.setItem('userRole', role);

        const ordersLink = document.getElementById('orders-link');
        const availableOrdersLink = document.getElementById('available-orders-link');
        const workingOrdersLink = document.getElementById('working-orders-link');
        const completedOrdersLink = document.getElementById('completed-orders-link');
        const payoutHistoryLink = document.getElementById('payout-history-link');
        const payoutManagementLink = document.getElementById('payout-management-link');
        const adminPanelLink = document.getElementById('admin-panel-link');
        const coachingOrdersLink = document.getElementById('coaching-orders-link');

        console.log('coachingOrdersLink exists:', !!coachingOrdersLink);

        if (ordersLink) ordersLink.style.display = 'none';
        if (availableOrdersLink) availableOrdersLink.style.display = 'none';
        if (workingOrdersLink) workingOrdersLink.style.display = 'none';
        if (completedOrdersLink) completedOrdersLink.style.display = 'none';
        if (payoutHistoryLink) payoutHistoryLink.style.display = 'none';
        if (payoutManagementLink) payoutManagementLink.style.display = 'none';
        if (adminPanelLink) adminPanelLink.style.display = 'none';
        if (coachingOrdersLink) coachingOrdersLink.style.display = 'none';

        if (role === 'booster') {
            console.log('Showing booster buttons');
            if (availableOrdersLink) availableOrdersLink.style.display = 'block';
            if (workingOrdersLink) workingOrdersLink.style.display = 'block';
            if (ordersLink) ordersLink.style.display = 'block';
            if (payoutHistoryLink) payoutHistoryLink.style.display = 'block';
        } else if (role === 'admin') {
            console.log('Showing all buttons for admin');
            if (ordersLink) ordersLink.style.display = 'block';
            if (availableOrdersLink) availableOrdersLink.style.display = 'block';
            if (workingOrdersLink) workingOrdersLink.style.display = 'block';
            if (completedOrdersLink) completedOrdersLink.style.display = 'block';
            if (payoutHistoryLink) payoutHistoryLink.style.display = 'block';
            if (payoutManagementLink) payoutManagementLink.style.display = 'block';
            if (adminPanelLink) adminPanelLink.style.display = 'block';
            if (coachingOrdersLink) coachingOrdersLink.style.display = 'block';
        } else if (role === 'coach') {
            console.log('Showing coach buttons');
            if (ordersLink) ordersLink.style.display = 'block';
            if (payoutHistoryLink) payoutHistoryLink.style.display = 'block';
            if (coachingOrdersLink) coachingOrdersLink.style.display = 'block';
        } else {
            console.log('Showing customer buttons');
            if (ordersLink) ordersLink.style.display = 'block';
        }

        return role;
    } catch (error) {
        console.error('Error fetching user role:', error.message);
        return null;
    }
}
async function showOrderDetailsModal(order, isAvailable = false) {
    if (!order) {
        console.error('No order provided to showOrderDetailsModal');
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close">×</span>
                <h3>Order Details</h3>
                <p><strong>Error:</strong> Unable to load order details.</p>
            </div>
        `;
        document.getElementById('modal-container').appendChild(modal);
        modal.style.display = 'block';

        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });

        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.remove();
            }
        }, { once: true });
        return;
    }

    console.log('Displaying details for order:', order);
    const userRole = await checkUserRole();
    const isCustomer = userRole !== 'booster' && userRole !== 'admin' && userRole !== 'coach';
    const isCoachingOrder = order.order_type === 'coaching';

    let modalContent = `
        <div class="modal-content">
            <span class="modal-close">×</span>
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> ${order.order_id}</p>
            <p><strong>Game Type:</strong> ${order.game_type || 'N/A'}</p>
    `;

    if (isCoachingOrder) {
        modalContent += `
            <p><strong>Booked Hours:</strong> ${order.booked_hours || 'N/A'}</p>
            <p><strong>Coach Name:</strong> ${order.coach_name || order.coach_username || 'N/A'}</p>
        `;
    } else {
        modalContent += `
            <p><strong>Current Rank:</strong> ${order.current_rank || 'N/A'}</p>
            <p><strong>Desired Rank:</strong> ${order.desired_rank || 'N/A'}</p>
            <p><strong>Current LP:</strong> ${order.current_lp || 0}</p>
            <p><strong>Extra Options:</strong> ${parseExtras(order.extras)}</p>
        `;
    }

    modalContent += `
        <p><strong>Ordered On:</strong> ${order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</p>
    `;

    if (isCustomer) {
        modalContent += `
            <p><strong>Price:</strong> $${parseFloat(order.price || order.total_price || 0).toFixed(2)}</p>
            <p><strong>Status:</strong> ${order.status || 'Pending'}</p>
            <p><strong>Cashback:</strong> $${parseFloat(order.cashback || 0).toFixed(2)}</p>
        `;
    } else if (isAvailable && (userRole === 'booster' || userRole === 'coach')) {
        modalContent += `
            <p><strong>Payout:</strong> $${(parseFloat(order.price || 0) * (isCoachingOrder ? 0.80 : 0.85)).toFixed(2)}</p>
        `;
    }

    modalContent += `</div>`;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = modalContent;
    document.getElementById('modal-container').appendChild(modal);
    modal.style.display = 'block';

    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });

    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.remove();
        }
    }, { once: true });
}

  async function fetchAvailableOrders() {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'booster' && userRole !== 'admin') {
        console.log('Skipping available orders for non-booster/admin role:', userRole);
        const container = document.getElementById('available-orders');
        if (container) {
            container.innerHTML = '<p>Available orders are only for boosters and admins.</p>';
        }
        return;
    }
    if (isFetchingAvailableOrders) {
        console.log('fetchAvailableOrders already in progress, skipping');
        return;
    }
    isFetchingAvailableOrders = true;
    try {
        console.log('Fetching available orders for userId:', userId);
        const response = await fetch(`/api/available-orders?userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
        }
        const orders = await response.json();
        console.log('Available orders received:', orders);
        orders.forEach(order => {
            console.log(`Order ${order.order_id}: current_rank=${order.current_rank}, desired_rank=${order.desired_rank}, game_type=${order.game_type}`);
        });
        renderOrders(orders, 'available-orders', true);
    } catch (error) {
        console.error('Error fetching available orders:', error.message);
        const container = document.getElementById('available-orders');
        if (container) {
            container.innerHTML = `<p style="color: red;">Error loading available orders: ${error.message}. Please try again later.</p>`;
        }
    } finally {
        isFetchingAvailableOrders = false;
    }
}

  async function fetchWorkingOrders() {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'booster' && userRole !== 'admin') {
        console.log('Skipping working orders for non-booster/admin role:', userRole);
        const container = document.getElementById('working-orders');
        if (container) {
            container.innerHTML = '<p>Working orders are only for boosters and admins.</p>';
        }
        return;
    }
    try {
        console.log('Fetching working orders for userId:', userId);
        const response = await fetch(`/api/working-orders?userId=${userId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
        }
        const orders = await response.json();
        console.log('Working orders received for userId:', userId, 'Orders:', orders);
        renderOrders(orders, 'working-orders', false, true);
    } catch (error) {
        console.error('Error fetching working orders for userId:', userId, 'Error:', error.message);
        const container = document.getElementById('working-orders');
        if (container) {
            container.innerHTML = `<p style="color: red;">Error loading working orders: ${error.message}. Please try again later.</p>`;
        }
    }
}


async function fetchCoachingOrders() {
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('role');
    if (!userId || !role) {
        console.error('No userId or role found in localStorage');
        alert('Please log in to view coaching orders.');
        window.location.href = '/league-services.html';
        return;
    }
    try {
        console.log('Fetching coaching orders for userId:', userId, 'role:', role);
        const response = await fetch(`/api/user-orders?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&type=coaching&status=claimed`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
        }
        const orders = await response.json();
        console.log('Coaching orders raw response:', orders);
        if (!Array.isArray(orders)) {
            console.warn('Unexpected response format for coaching orders:', orders);
            throw new Error('Invalid response format from server');
        }
        renderCoachingOrders(orders, 'coaching-orders');
    } catch (error) {
        console.error('Error fetching coaching orders:', error.message);
        const container = document.getElementById('coaching-orders');
        if (container) {
            container.innerHTML = `<p style="color: red;">Failed to load coaching orders: ${error.message}. Please contact support.</p>`;
        }
    }
}


async function showOrderIdModal(orderId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content order-id-modal">
            <span class="modal-close">×</span>
            <h3>Order ID</h3>
            <p><strong>${orderId}</strong></p>
        </div>
    `;
    document.getElementById('modal-container').appendChild(modal);
    modal.style.display = 'block';

    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });

    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.remove();
        }
    }, { once: true });
}

function renderCoachingOrders(orders, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Error: ${containerId} container not found`);
        return;
    }
    const userRole = localStorage.getItem('userRole');
    const currentUserId = parseInt(userId);
    if (!Array.isArray(orders) || orders.length === 0) {
        container.innerHTML = '<p>No coaching orders found. Please check if orders exist or contact support.</p>';
        return;
    }
    const table = document.createElement('table');
    table.className = 'orders-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Coach</th>
                <th>Game</th>
                <th>Hours</th>
                <th>Price</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    orders.forEach(order => {
        if (!order || !order.order_id) {
            console.warn('Skipping invalid coaching order:', order);
            return;
        }
        console.log('Rendering coaching order:', order);
        const isOwnOrder = userRole === 'coach' && order.coach_id === currentUserId;
        const row = document.createElement('tr');
        row.dataset.orderId = order.order_id;
        row.innerHTML = `
            <td><button class="order-id-button" data-order-id="${order.order_id}">?</button></td>
            <td>${order.customer_username || 'Unknown Customer'}</td>
            <td>${order.coach_username || order.coach_name || 'Unknown Coach'}</td>
            <td>${order.game_type || 'N/A'}</td>
            <td>${order.booked_hours || 'N/A'}</td>
            <td>
  $${userRole === 'coach'
    ? (parseFloat(order.price || 0) * 0.80).toFixed(2)
    : parseFloat(order.price || 0).toFixed(2)}
  ${userRole === 'coach' ? '<span class="payout-label">(Payout)</span>' : ''}
</td>


            <td>${order.status || 'pending'}</td>
            <td>${order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</td>
          <td>
    ${userRole === 'coach' && order.coach_id === currentUserId && order.status !== 'completed' ? `
        <button class="complete-btn" data-order-id="${order.order_id}">Mark Complete</button>
    ` : ''}
</td>

        `;
        tbody.appendChild(row);
    });
    container.innerHTML = '';
    container.appendChild(table);

    // Order ID button event listeners
    document.querySelectorAll('.order-id-button').forEach(button => {
        button.addEventListener('click', function (e) {
            e.stopPropagation();
            const orderId = button.getAttribute('data-order-id');
            showOrderIdModal(orderId);
        });
    });

    // Info button event listeners
    document.querySelectorAll('.info-button').forEach(button => {
        button.addEventListener('click', function (e) {
            e.stopPropagation();
            const orderId = button.getAttribute('data-order-id');
            console.log('Info button clicked for orderId:', orderId);
            const order = orders.find(o => String(o.order_id) === String(orderId));
            console.log('Found order:', order);
            showOrderDetailsModal(order);
        });
    });

    // Complete button event listeners
    document.querySelectorAll('.complete-btn').forEach(button => {
        button.addEventListener('click', async function (e) {
            e.stopPropagation();
            const orderId = button.getAttribute('data-order-id');
            if (confirm(`Mark coaching order ${orderId} as completed?`)) {
                try {
                    
                    const response = await fetch('/api/complete-coaching-order', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            
                        },
                        body: JSON.stringify({ userId, orderId })
                    });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
                    }
                    alert('Coaching order marked as completed!');
                    fetchCoachingOrders();
                } catch (error) {
                    console.error('Error completing coaching order:', error.message);
                    alert(`Failed to complete coaching order: ${error.message}`);
                }
            }
        });
    });

    // Row click event listeners
    table.querySelectorAll('tbody tr').forEach(row => {
        const orderId = row.dataset.orderId;
        if (!orderId) {
            console.warn(`Skipping row with missing or invalid orderId in container: ${containerId}`, row.outerHTML);
            row.style.cursor = 'not-allowed';
            return;
        }
        const order = orders.find(o => String(o.order_id) === String(orderId));
        if (!order) {
            console.warn(`No order found for orderId: ${orderId} in container: ${containerId}`);
            row.style.cursor = 'not-allowed';
            return;
        }
        if (order.status !== 'completed') {
            row.addEventListener('click', async () => {
                const userRole = await checkUserRole();
                console.log('Row clicked for orderId:', orderId, 'Role:', userRole, 'Status:', order.status);
                showOrderFormModal(order, userRole);
            });
        } else {
            console.log('Skipping click handler for completed orderId:', orderId);
            row.style.cursor = 'not-allowed';
        }
    });
}

    async function fetchCompletedOrders() {
        try {
            console.log('Fetching completed orders for userId:', userId);
            const response = await fetch(`/api/completed-orders?userId=${userId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
            }
            const orders = await response.json();
            console.log('Completed orders received:', orders);
            renderOrders(orders, 'completed-orders', false, false, true);
        } catch (error) {
            console.error('Error fetching completed orders:', error.message);
            document.getElementById('completed-orders').innerHTML = '<p>Error loading completed orders. Please try again later.</p>';
        }
    }

    async function fetchPayoutHistory() {
        try {
            console.log('Fetching payout history for userId:', userId);
            const response = await fetch(`/api/payout-history?userId=${userId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
            }
            const requests = await response.json();
            console.log('Payout history received:', requests);
            renderPayoutHistory(requests, 'payout-history');
        } catch (error) {
            console.error('Error fetching payout history:', error.message);
            document.getElementById('payout-history').innerHTML = '<p>Error loading payout history. Please try again later.</p>';
        }
    }

    async function fetchPayoutRequests() {
        try {
            console.log('Fetching payout requests for userId:', userId);
            const response = await fetch(`/api/payout-requests?userId=${userId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
            }
            const requests = await response.json();
            console.log('Payout requests received:', requests);
            renderPayoutRequests(requests, 'payout-requests');
        } catch (error) {
            console.error('Error fetching payout requests:', error.message);
            document.getElementById('payout-requests').innerHTML = '<p>Error loading payout requests. Please try again later.</p>';
        }
    }

    async function loadAdminPanel() {
        const userId = localStorage.getItem('userId');
        const role = localStorage.getItem('role');
        if (role !== 'admin') {
            console.log('User is not admin, skipping admin panel load');
            return;
        }

        try {
            // Fetch users
            console.log('Fetching users for admin panel with userId:', userId);
            const res = await fetch(`/admin/users?userId=${userId}`);
            if (!res.ok) throw new Error('Not authorized or error fetching users');
            const users = await res.json();

            const userTableBody = document.querySelector('#user-table tbody');
            if (!userTableBody) {
                console.error('User table body not found');
                return;
            }

            userTableBody.innerHTML = '';
            users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td>$${parseFloat(user.account_balance || 0).toFixed(2)}</td>
                    <td>${user.role}</td>
                    <td>
                        <select onchange="updateUserRole(${user.id}, this.value)">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="booster" ${user.role === 'booster' ? 'selected' : ''}>Booster</option>
                            <option value="coach" ${user.role === 'coach' ? 'selected' : ''}>Coach</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </td>
                `;
                userTableBody.appendChild(row);
            });

            // Fetch coupons
            console.log('Fetching coupons for admin panel with userId:', userId);
            const couponRes = await fetch(`/api/coupons?userId=${userId}`);
            if (!couponRes.ok) throw new Error('Failed to fetch coupons');
            const coupons = await couponRes.json();
            renderCoupons(coupons);
        } catch (err) {
            console.error('Failed to load admin panel:', err.message);
            const container = document.getElementById('admin-panel');
            if (container) {
                container.innerHTML = '<p>Error loading admin panel. Please try again later.</p>';
            }
        }
    }

    function renderCoupons(coupons) {
        const couponsTableBody = document.querySelector('#coupons-table tbody');
        if (!couponsTableBody) {
            console.error('Coupons table body not found');
            return;
        }

        couponsTableBody.innerHTML = '';
        coupons.forEach(coupon => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${coupon.code}</td>
                <td>${Number(coupon.lol_discount_percentage || 0).toFixed(2)}</td>
                <td>${Number(coupon.valorant_discount_percentage || 0).toFixed(2)}</td>
                <td>${new Date(coupon.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="edit-coupon-btn" data-id="${coupon.id}">Edit</button>
                    <button class="delete-coupon-btn" data-id="${coupon.id}">Delete</button>
                </td>
            `;
            couponsTableBody.appendChild(row);
        });

        // Add event listeners for edit buttons
        document.querySelectorAll('.edit-coupon-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const couponId = btn.dataset.id;
                const coupon = coupons.find(c => String(c.id) === String(couponId));
                if (coupon) {
                    document.getElementById('coupon-id').value = coupon.id;
                    document.getElementById('coupon-code').value = coupon.code;
                    document.getElementById('lol-discount').value = coupon.lol_discount_percentage;
                    document.getElementById('valorant-discount').value = coupon.valorant_discount_percentage;
                    console.log('Editing coupon:', coupon);
                }
            });
        });

        // Add event listeners for delete buttons
        document.querySelectorAll('.delete-coupon-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const couponId = btn.dataset.id;
                if (confirm(`Are you sure you want to delete coupon ${couponId}?`)) {
                    try {
                        console.log('Deleting couponId:', couponId, 'with userId:', userId);
                        const response = await fetch(`/api/coupons/${couponId}?userId=${userId}`, {
                            method: 'DELETE'
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to delete coupon');
                        }
                        alert('Coupon deleted successfully');
                        loadAdminPanel();
                    } catch (error) {
                        console.error('Error deleting coupon:', error.message);
                        alert(`Failed to delete coupon: ${error.message}`);
                    }
                }
            });
        });
    }

    async function setupCouponForm() {
        const couponForm = document.getElementById('coupon-form');
        if (!couponForm) {
            console.warn('Coupon form (#coupon-form) not found');
            return;
        }

        couponForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const leagueCode = document.getElementById('league-code').value.trim().toUpperCase();
            const leagueDiscount = parseFloat(document.getElementById('league-discount').value);
            const valorantCode = document.getElementById('valorant-code').value.trim().toUpperCase();
            const valorantDiscount = parseFloat(document.getElementById('valorant-discount').value);

            if (!leagueCode && !valorantCode) {
                alert('Please enter at least one coupon code.');
                return;
            }
            if ((!isFinite(leagueDiscount) || leagueDiscount <= 0) && leagueCode) {
                alert('Please enter a valid League discount percentage.');
                return;
            }
            if ((!isFinite(valorantDiscount) || valorantDiscount <= 0) && valorantCode) {
                alert('Please enter a valid Valorant discount percentage.');
                return;
            }

            const couponData = {
                id: document.getElementById('coupon-id').value || null,
                code: leagueCode || valorantCode,
                lol_discount_percentage: isFinite(leagueDiscount) ? leagueDiscount : 0,
                valorant_discount_percentage: isFinite(valorantDiscount) ? valorantDiscount : 0
            };

            if (!couponData.code || isNaN(couponData.lol_discount_percentage) || isNaN(couponData.valorant_discount_percentage)) {
                alert('Please fill in all fields with valid values.');
                return;
            }

            try {
                console.log('Saving coupon:', couponData, 'with userId:', userId);
                const response = await fetch(`/api/coupons?userId=${userId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(couponData)
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to save coupon');
                }
                alert('Coupon saved successfully');
                couponForm.reset();
                document.getElementById('coupon-id').value = '';
                loadAdminPanel();
            } catch (error) {
                console.error('Error saving coupon:', error.message);
                alert(`Failed to save coupon: ${error.message}`);
            }
        });
    }

    async function updateUserRole(targetUserId, newRole) {
        try {
            const adminUserId = localStorage.getItem('userId');
            const res = await fetch('/admin/update-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: targetUserId, newRole, adminUserId })
            });
            if (!res.ok) throw new Error('Failed to update role');
            alert('Role updated successfully!');
            loadAdminPanel();
        } catch (err) {
            console.error('Error updating role:', err.message);
            alert('Error updating role: ' + err.message);
        }
    }
    window.updateUserRole = updateUserRole;

    function renderPayoutHistory(requests, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Error: ${containerId} container not found`);
            return;
        }

        if (requests.length === 0) {
            container.innerHTML = '<p>No payout history found.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'payout-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Request ID</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Payment Method</th>
                    <th>Requested On</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        requests.forEach(request => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${request.id}</td>
                <td>$${parseFloat(request.amount || 0).toFixed(2)}</td>
                <td>${request.status || 'Pending'}</td>
                <td>${request.payment_method || 'N/A'} (${request.payment_details || 'N/A'})</td>
                <td>${new Date(request.requested_at).toLocaleDateString()}</td>
                <td>${request.admin_notes || 'None'}</td>
            `;
            tbody.appendChild(row);
        });

        container.innerHTML = '';
        container.appendChild(table);
    }

    function renderPayoutRequests(requests, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Error: ${containerId} container not found`);
            return;
        }

        if (requests.length === 0) {
            container.innerHTML = '<p>No pending payout requests.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'payout-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Request ID</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Payment Method</th>
                    <th>Requested On</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        requests.forEach(request => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${request.id}</td>
                <td>${request.username || 'N/A'} (${request.user_id})</td>
                <td>$${parseFloat(request.amount || 0).toFixed(2)}</td>
                <td>${request.payment_method || 'N/A'} (${request.payment_details || 'N/A'})</td>
                <td>${new Date(request.requested_at).toLocaleDateString()}</td>
                <td>
                    <button class="approve-payout-btn" data-request-id="${request.id}" ${request.status === 'Approved' ? 'disabled' : ''}>Approve</button>
                    <button class="reject-payout-btn" data-request-id="${request.id}" ${request.status === 'Rejected' ? 'disabled' : ''}>Reject</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        container.innerHTML = '';
        container.appendChild(table);

        document.querySelectorAll('.approve-payout-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const requestId = button.getAttribute('data-request-id');
                const adminNotes = prompt('Enter admin notes (optional):') || '';
                if (confirm(`Are you sure you want to approve payout request ${requestId}?`)) {
                    try {
                        console.log('Approving payout requestId:', requestId, 'userId:', userId);
                        const response = await fetch('/api/process-payout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ requestId, action: 'approve', adminNotes, userId })
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to approve payout');
                        }
                        alert('Payout approved successfully!');
                        fetchPayoutRequests();
                    } catch (error) {
                        console.error('Error approving payout:', error.message);
                        alert(`Failed to approve payout: ${error.message}`);
                    }
                }
            });
        });

        document.querySelectorAll('.reject-payout-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const requestId = button.getAttribute('data-request-id');
                const adminNotes = prompt('Enter reason for rejection (optional):') || '';
                if (confirm(`Are you sure you want to reject payout request ${requestId}?`)) {
                    try {
                        console.log('Rejecting payout requestId:', requestId, 'userId:', userId);
                        const response = await fetch('/api/process-payout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ requestId, action: 'reject', adminNotes, userId })
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to reject payout');
                        }
                        alert('Payout rejected successfully!');
                        fetchPayoutRequests();
                    } catch (error) {
                        console.error('Error rejecting payout:', error.message);
                        alert(`Failed to reject payout: ${error.message}`);
                    }
                }
            });
        });
    }

    function setupPayoutRequestForm() {
        const form = document.getElementById('payout-request-form');
        const payoutModal = document.getElementById('payout-request-modal');
        const closeModal = payoutModal ? payoutModal.querySelector('.modal-close') : null;
        const requestPayoutBtn = document.getElementById('request-payout-button');

        if (!form) {
            console.warn('Payout request form (#payout-request-form) not found');
            return;
        }
        if (!requestPayoutBtn) {
            console.warn('Request Payout button (#request-payout-button) not found');
            return;
        }
        if (!payoutModal || !closeModal) {
            console.warn('Payout request modal (#payout-request-modal) or close button (.modal-close) not found');
            return;
        }

        // Hide any unexpected buttons in #account-balance-panel
        const duplicateButtons = document.querySelectorAll('#account-balance-panel button:not(#request-payout-button)');
        duplicateButtons.forEach(btn => {
            console.log('Hiding duplicate button:', btn);
            btn.style.display = 'none';
        });

        // Pre-fill payout amount with user balance
        const payoutAmountInput = form.querySelector('#payout-amount');
        if (payoutAmountInput) {
            payoutAmountInput.value = userBalance.toFixed(2);
            console.log('Pre-filled payout amount:', userBalance.toFixed(2));
        } else {
            console.warn('Payout amount input (#payout-amount) not found');
        }

        // Show modal when Request Payout button is clicked
        requestPayoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Request Payout button clicked:', requestPayoutBtn);
            // Refresh balance before showing modal
            await fetchUserBalance();
            if (payoutAmountInput) {
                payoutAmountInput.value = userBalance.toFixed(2);
            }
            payoutModal.style.display = 'block';
        });

        // Close modal on close button click
        closeModal.addEventListener('click', () => {
            console.log('Payout modal closed via close button');
            payoutModal.style.display = 'none';
            form.reset();
            // Reset payout amount to balance
            if (payoutAmountInput) {
                payoutAmountInput.value = userBalance.toFixed(2);
            }
        });

        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === payoutModal) {
                console.log('Payout modal closed via click outside');
                payoutModal.style.display = 'none';
                form.reset();
                // Reset payout amount to balance
                if (payoutAmountInput) {
                    payoutAmountInput.value = userBalance.toFixed(2);
                }
            }
        });

        // Form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = parseFloat(form.querySelector('#payout-amount').value);
            const paymentMethod = form.querySelector('#payment-method').value;
            const paymentDetails = form.querySelector('#payment-details').value.trim();
            if (!amount || isNaN(amount) || amount <= 0) {
                alert('Please enter a valid payout amount.');
                return;
            }
            if (amount > userBalance) {
                alert(`Requested amount ($${amount.toFixed(2)}) exceeds your balance ($${userBalance.toFixed(2)}).`);
                return;
            }
            if (!paymentMethod || !paymentDetails) {
                alert('Please select a payment method and provide payment details.');
                return;
            }
            try {
                console.log('Submitting payout request for userId:', userId);
                const response = await fetch('/api/request-payout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount, paymentMethod, paymentDetails, userId })
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to submit payout request');
                }
                alert('Payout request submitted successfully!');
                form.reset();
                // Reset payout amount to balance
                if (payoutAmountInput) {
                    payoutAmountInput.value = userBalance.toFixed(2);
                }
                payoutModal.style.display = 'none';
                fetchPayoutHistory();
                fetchUserBalance();
            } catch (error) {
                console.error('Error submitting payout request:', error.message);
                alert(`Failed to submit payout request: ${error.message}`);
            }
        });
    }

    function parseRank(rankStr, gameType = 'League of Legends') {
        if (!rankStr || typeof rankStr !== 'string') {
            console.warn('Invalid rank string:', rankStr, 'GameType:', gameType);
            return { rank: 'default', division: '', displayRank: 'Unknown' };
        }
        rankStr = rankStr.trim();
        const leagueRanks = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger'];
        const valorantRanks = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'ascendant', 'immortal', 'radiant'];
        const leagueDivisions = ['I', 'II', 'III', 'IV'];
        const valorantDivisions = ['I', 'II', 'III'];
        const validGameTypes = ['League of Legends', 'Valorant'];
        const normalizedGameType = validGameTypes.includes(gameType) ? gameType : 'League of Legends';
        const validRanks = normalizedGameType === 'Valorant' ? valorantRanks : leagueRanks;
        const validDivisions = normalizedGameType === 'Valorant' ? valorantDivisions : leagueDivisions;
        const tierlessRanks = normalizedGameType === 'Valorant' ? ['immortal', 'radiant'] : ['master', 'grandmaster', 'challenger'];

        console.log('Parsing rank:', rankStr, 'GameType:', normalizedGameType);

        const rankLower = rankStr.toLowerCase();
        if (tierlessRanks.includes(rankLower)) {
            if (validRanks.includes(rankLower)) {
                const displayRank = rankLower.charAt(0).toUpperCase() + rankLower.slice(1);
                console.log('Parsed tierless rank:', { rank: rankLower, division: '', displayRank });
                return { rank: rankLower, division: '', displayRank };
            }
            console.warn('Invalid tierless rank:', rankLower, 'Original:', rankStr, 'Game:', normalizedGameType);
            return { rank: 'default', division: '', displayRank: 'Unknown' };
        }

        let normalizedRankStr = rankStr;
        if (normalizedGameType === 'Valorant') {
            normalizedRankStr = rankStr.replace(/(\d)$/i, match => {
                const map = { '1': 'I', '2': 'II', '3': 'III' };
                return map[match] || match;
            });
        }

        const match = normalizedRankStr.match(/^([\w\s]+?)\s*(I|II|III|IV)?$/i);
        if (!match) {
            console.warn('Rank parse failed for:', rankStr, 'Normalized:', normalizedRankStr, 'Game:', normalizedGameType);
            return { rank: 'default', division: '', displayRank: 'Unknown' };
        }

        const rankName = match[1].trim().toLowerCase().replace(/\s+/g, '');
        const division = match[2] || '';

        if (!validRanks.includes(rankName)) {
            console.warn('Invalid rank name:', rankName, 'Original:', rankStr, 'Game:', normalizedGameType);
            return { rank: 'default', division: '', displayRank: 'Unknown' };
        }

        if (division && !validDivisions.includes(division)) {
            console.warn('Invalid division:', division, 'Original:', rankStr, 'Game:', normalizedGameType);
            return { rank: 'default', division: '', displayRank: 'Unknown' };
        }

        const displayRank = rankName.charAt(0).toUpperCase() + rankName.slice(1);
        console.log('Parsed rank:', { rank: rankName, division, displayRank });
        return { rank: rankName, division, displayRank };
    }

    function parseExtras(extras) {
        let parsedExtras = [];
        try {
            if (typeof extras === 'object' && extras !== null) {
                parsedExtras = Array.isArray(extras) ? extras : [extras];
            } else if (typeof extras === 'string' && extras.trim()) {
                parsedExtras = JSON.parse(extras);
                parsedExtras = Array.isArray(parsedExtras) ? parsedExtras : [parsedExtras];
            }
            return parsedExtras.length > 0
                ? parsedExtras
                    .map(e => {
                        if (typeof e === 'string') return e;
                        if (typeof e === 'object' && e !== null) {
                            return e.label || e.name || e.value || JSON.stringify(e);
                        }
                        return String(e);
                    })
                    .filter(e => e && e !== '{}')
                    .join(', ') || 'None'
                : 'None';
        } catch (e) {
            console.warn('Failed to parse extras:', e.message, 'Raw extras:', extras);
            return 'None';
        }
    }

   async function showOrderDetailsModal(order) {
    if (!order) {
        console.error('No order provided to showOrderDetailsModal');
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close">×</span>
                <h3>Order Details</h3>
                <p><strong>Error:</strong> Unable to load order details.</p>
            </div>
        `;
        document.getElementById('modal-container').appendChild(modal);
        modal.style.display = 'block';

        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });

        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.remove();
            }
        }, { once: true });
        return;
    }

    console.log('Displaying details for order:', order);
    const userRole = await checkUserRole();
    const isCustomer = userRole !== 'booster' && userRole !== 'admin';
    const isCoachingOrder = order.order_type === 'coaching';

    let modalContent = `
        <div class="modal-content">
            <span class="modal-close">×</span>
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> ${order.order_id}</p>
            <p><strong>Game Type:</strong> ${order.game_type || 'N/A'}</p>
            <p><strong>Current Rank:</strong> ${order.current_rank || 'N/A'}</p>
    `;

    if (isCoachingOrder) {
        // For coaching orders, show relevant fields, excluding Desired Rank, Current LP, Extras, Account Username, Account Password
        modalContent += `
            <p><strong>Booked Hours:</strong> ${order.booked_hours || 'N/A'}</p>
            <p><strong>Coach Name:</strong> ${order.coach_name || order.coach_username || 'N/A'}</p>
        `;
    } else {
        // For boost orders, include all fields
        modalContent += `
            <p><strong>Desired Rank:</strong> ${order.desired_rank || 'N/A'}</p>
            <p><strong>Current LP:</strong> ${order.current_lp || 0}</p>
            <p><strong>Extra Options:</strong> ${parseExtras(order.extras)}</p>
            
        `;
    }

    // Common fields for both order types
    modalContent += `
        <p><strong>Ordered On:</strong> ${order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</p>
    `;

    if (isCustomer) {
        modalContent += `
            <p><strong>Price:</strong> $${parseFloat(order.price || order.total_price || 0).toFixed(2)}</p>
            <p><strong>Status:</strong> ${order.status || 'Pending'}</p>
            <p><strong>Cashback:</strong> $${parseFloat(order.cashback || 0).toFixed(2)}</p>
        `;
    }

    modalContent += `</div>`;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = modalContent;
    document.getElementById('modal-container').appendChild(modal);
    modal.style.display = 'block';

    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });

    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.remove();
        }
    }, { once: true });
}

    async function showOrderFormModal(order, userRole) {
    const modal = document.createElement('div');
    modal.className = 'modal order-form-modal';
    const isCustomer = userRole !== 'booster' && userRole !== 'admin';
    const isCoachingOrder = order.order_type === 'coaching';

    let credentials = { account_username: '', summoner_name: '', plaintext_password: '' };
    if (!isCoachingOrder) {
        try {
            console.log('Fetching credentials for orderId:', order.order_id, 'userId:', userId);
            const response = await fetch(`/api/order-credentials?orderId=${order.order_id}&userId=${userId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.credentials) {
                    credentials = data.credentials;
                    console.log('Credentials received:', {
                        account_username: credentials.account_username,
                        summoner_name: credentials.summoner_name,
                        plaintext_password: credentials.plaintext_password ? '***' : 'N/A'
                    });
                } else {
                    console.log('No credentials found for orderId:', order.order_id);
                }
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch credentials:', errorData);
            }
        } catch (error) {
            console.error('Error fetching credentials:', error.message);
        }
    }

    let messages = [];
    try {
        console.log('Fetching messages for orderId:', order.order_id, 'userId:', userId);
        const response = await fetch(`/api/order-messages?orderId=${order.order_id}&userId=${userId}`);
        if (response.ok) {
            messages = await response.json();
            console.log('Messages received:', messages);
        }
    } catch (error) {
        console.error('Error fetching messages:', error.message);
    }

    let orderDetailsHtml = `
        <h3>Order #${order.order_id}</h3>
        <p><strong>Game Type:</strong> ${order.game_type || 'N/A'}</p>
        <p><strong>Current Rank:</strong> ${order.current_rank || 'N/A'}</p>
    `;

    if (isCoachingOrder) {
        orderDetailsHtml += `
            <p><strong>Booked Hours:</strong> ${order.booked_hours || 'N/A'}</p>
            <p><strong>Coach Name:</strong> ${order.coach_name || order.coach_username || 'N/A'}</p>
        `;
    } else {
        orderDetailsHtml += `
            <p><strong>Desired Rank:</strong> ${order.desired_rank || 'N/A'}</p>
            <p><strong>Current LP:</strong> ${order.current_lp || 0}</p>
            <p><strong>Extras:</strong> ${parseExtras(order.extras)}</p>
        `;
    }

    orderDetailsHtml += `
        <p><strong>Ordered On:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
    `;

    if (isCustomer) {
        orderDetailsHtml += `
            <p><strong>Price:</strong> $${parseFloat(order.price || order.total_price || 0).toFixed(2)}</p>
            <p><strong>Status:</strong> ${order.status || 'Pending'}</p>
            <p><strong>Cashback:</strong> $${parseFloat(order.cashback || 0).toFixed(2)}</p>
        `;
    }

    let accountDetailsHtml = '';
    if (!isCoachingOrder && isCustomer) {
        accountDetailsHtml = `
            <h4>Account Details</h4>
            <div class="account-details-form">
                <label>Account Username:</label>
                <input type="text" id="account-username" value="${credentials.account_username || ''}">
                <label>Summoner Name:</label>
                <input type="text" id="summoner-name" value="${credentials.summoner_name || ''}">
                <label>Account Password: Encrypted and hidden after entry.</label>
                <input type="password" id="account-password" value="">
                <button id="submit-credentials">Submit Credentials</button>
            </div>
        `;
    } else if (!isCoachingOrder) {
        accountDetailsHtml = `
            <h4>Account Details</h4>
            <div class="account-details-form">
                <label>Account Username:</label>
                <input type="text" id="account-username" value="${credentials.account_username || ''}" disabled>
                <label>Summoner Name:</label>
                <input type="text" id="summoner-name" value="${credentials.summoner_name || ''}" disabled>
                <label>Account Password:</label>
                <div class="password-container">
                    <span id="password-field">********</span>
                    <button id="toggle-password">Show Password</button>
                </div>
            </div>
        `;
    }

    modal.innerHTML = `
        <div class="modal-content order-form-content">
            <span class="modal-close">×</span>
            <div class="order-form-container">
                <div class="order-details-panel">
                    ${orderDetailsHtml}
                    ${accountDetailsHtml}
                </div>
                <div class="chat-panel">
                    <h4>Chat</h4>
                    <div class="chat-messages" id="chat-messages-${order.order_id}"></div>
                    <div class="chat-input">
                        <input type="text" id="chat-input-${order.order_id}" placeholder="Type a message...">
                        <button id="send-message-${order.order_id}">Send</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('modal-container').appendChild(modal);
    modal.style.display = 'block';

    if (!isCoachingOrder && !isCustomer) {
        modal.querySelector('#password-field').dataset.password = credentials.plaintext_password || 'N/A';
    }

    const chatMessages = modal.querySelector(`#chat-messages-${order.order_id}`);
    messages.forEach(msg => {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${msg.sender_id === parseInt(userId) ? 'sent' : 'received'}`;
        messageEl.innerHTML = `
            <p><strong>${msg.sender_username}</strong> (${new Date(msg.created_at).toLocaleTimeString()}): ${msg.message}</p>`;
        chatMessages.appendChild(messageEl);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (!isCoachingOrder && isCustomer) {
        modal.querySelector('#submit-credentials').addEventListener('click', async () => {
            const accountUsername = modal.querySelector('#account-username').value.trim();
            const accountPassword = modal.querySelector('#account-password').value.trim();
            const summonerName = modal.querySelector('#summoner-name').value.trim();
            if (!accountUsername || !accountPassword || !summonerName) {
                alert('Please fill in all fields');
                return;
            }
            try {
                console.log('Submitting credentials for orderId:', order.order_id, 'userId:', userId);
                const response = await fetch('/api/submit-credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId: order.order_id,
                        userId: parseInt(userId),
                        accountUsername,
                        password: accountPassword,
                        summonerName
                    })
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to submit credentials');
                }
                alert('Credentials submitted successfully!');
                console.log('Credentials submitted successfully for orderId:', order.order_id);
            } catch (error) {
                console.error('Error submitting credentials:', error.message);
                alert(`Failed to submit credentials: ${error.message}`);
            }
        });
    } else if (!isCoachingOrder) {
        modal.querySelector('#toggle-password').addEventListener('click', () => {
            const passwordField = modal.querySelector('#password-field');
            const toggleButton = modal.querySelector('#toggle-password');
            if (passwordField.textContent === '********') {
                passwordField.textContent = passwordField.dataset.password;
                toggleButton.textContent = 'Hide Password';
                console.log('Password revealed for orderId:', order.order_id);
            } else {
                passwordField.textContent = '********';
                toggleButton.textContent = 'Show Password';
                console.log('Password hidden for orderId:', order.order_id);
            }
        });
    }

    modal.querySelector(`#send-message-${order.order_id}`).addEventListener('click', async () => {
        const input = modal.querySelector(`#chat-input-${order.order_id}`);
        const message = input.value.trim();
        if (!message) return;
        try {
            console.log('Sending message for orderId:', order.order_id, 'userId:', userId, 'Message:', message);
            const response = await fetch('/api/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.order_id, userId, message })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send message');
            }
            input.value = '';
            const msgResponse = await fetch(`/api/order-messages?orderId=${order.order_id}&userId=${userId}`);
            if (msgResponse.ok) {
                const newMessages = await msgResponse.json();
                console.log('New messages fetched:', newMessages);
                chatMessages.innerHTML = '';
                newMessages.forEach(msg => {
                    const messageEl = document.createElement('div');
                    messageEl.className = `chat-message ${msg.sender_id === parseInt(userId) ? 'sent' : 'received'}`;
                    messageEl.innerHTML = `
                        <p><strong>${msg.sender_username}</strong> (${new Date(msg.created_at).toLocaleTimeString()}): ${msg.message}</p>`;
                    chatMessages.appendChild(msgEl);
                });
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        } catch (error) {
            console.error('Error sending message:', error.message);
            alert('Failed to send message. Please try again.');
        }
    });

    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
        console.log('Modal closed for orderId:', order.order_id);
    });

    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.remove();
            console.log('Modal closed via click outside for orderId:', order.order_id);
        }
    }, { once: true });
}

 // ─── UPDATED renderOrders ──────────────────────────────────────────────────────
    function renderOrders(orders, containerId, isAvailable = false, isWorking = false, isCompleted = false) {
        const ordersDiv = document.getElementById(containerId);
        if (!ordersDiv) {
            console.error(`Error: ${containerId} div not found`);
            return;
        }

        if (orders.length === 0) {
            ordersDiv.innerHTML = '<p>No orders found.</p>';
            return;
        }

        if (containerId === 'my-orders') {
            // Split into boost vs coaching
            const boostOrders   = orders.filter(o => o.order_type !== 'coaching');
            const coachingOrders = orders.filter(o => o.order_type === 'coaching');

            ordersDiv.innerHTML = ''; // clear old content

            // BOOST ORDERS TABLE
            if (boostOrders.length) {
                const tbl = document.createElement('table');
                tbl.className = 'orders-table';
                tbl.innerHTML = `
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Type</th>
                        <th>Details</th>
                        <th>Current Rank</th>
                        <th>Desired Rank</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Ordered On</th>
                        <th>Cashback</th>
                      </tr>
                    </thead>
                    <tbody></tbody>`;
                const tb = tbl.querySelector('tbody');

                boostOrders.forEach(order => {
                    const cur = parseRank(order.current_rank || 'Unknown', order.game_type);
                    const des = parseRank(order.desired_rank || 'Unknown', order.game_type);
                    const isVal = order.game_type === 'Valorant';
                    const divMap = { 'I':'1','II':'2','III':'3','IV':'4','':'0' };
                    const curDiv = isVal ? divMap[cur.division] : '';
                    const desDiv = isVal ? divMap[des.division] : '';
                    const curImg = isVal
                        ? `/images/${cur.displayRank}_${curDiv}_Rank.png`
                        : `/images/${cur.rank}.png`;
                    const desImg = isVal
                        ? `/images/${des.displayRank}_${desDiv}_Rank.png`
                        : `/images/${des.rank}.png`;

                    const row = document.createElement('tr');
                    row.dataset.orderId = order.order_id;
                    row.innerHTML = `
                        <td><button class="order-id-button" data-order-id="${order.order_id}">?</button></td>
                        <td>${order.order_type === 'coaching' ? 'Coaching' : (order.game_type || 'Boost')}</td>
                        <td><button class="info-button" data-order-id="${order.order_id}">Info</button></td>
                        <td>
                          <img src="${curImg}" class="rank-logo" onerror="this.src='/images/fallback.png'">
                          ${cur.displayRank}${cur.division ? ' '+cur.division : ''}
                        </td>
                        <td>
                          <img src="${desImg}" class="rank-logo" onerror="this.src='/images/fallback.png'">
                          ${des.displayRank}${des.division ? ' '+des.division : ''}
                        </td>
                        <td>$${parseFloat(order.price||0).toFixed(2)}</td>
                        <td>${order.status||'Pending'}</td>
                        <td>${new Date(order.created_at).toLocaleDateString()}</td>
                        <td>$${parseFloat(order.cashback||0).toFixed(2)}</td>`;
                    if (order.status === 'Completed') row.classList.add('customer-completed-order');
                    tb.appendChild(row);
                });

                ordersDiv.appendChild(Object.assign(document.createElement('h3'), { textContent: 'Boost Orders' }));
                ordersDiv.appendChild(tbl);
            }

            // Divider if both exist
            if (boostOrders.length && coachingOrders.length) {
                const hr = document.createElement('hr');
                hr.className = 'divider';
                hr.style.margin = '20px 0';
                ordersDiv.appendChild(hr);
            }

            // COACHING ORDERS TABLE
            if (coachingOrders.length) {
                const tbl2 = document.createElement('table');
                tbl2.className = 'orders-table';
                tbl2.innerHTML = `
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Details</th>
                        <th>Hours</th>
                        <th>Coach</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Ordered On</th>
                        <th>Cashback</th>
                      </tr>
                    </thead>
                    <tbody></tbody>`;
                const tb2 = tbl2.querySelector('tbody');

                coachingOrders.forEach(order => {
                    const row = document.createElement('tr');
                    row.dataset.orderId = order.order_id;
                    row.innerHTML = `
                        <td><button class="order-id-button" data-order-id="${order.order_id}">?</button></td>
                        <td>${order.booked_hours||'N/A'}</td>
                        <td>${order.coach_username||order.coach_name||'N/A'}</td>
                        <td>$${parseFloat(order.price||0).toFixed(2)}</td>
                        <td>${order.status||'Pending'}</td>
                        <td>${new Date(order.created_at).toLocaleDateString()}</td>
                        <td>$${parseFloat(order.cashback||0).toFixed(2)}</td>`;
                    if ((order.status || '').trim().toLowerCase() === 'completed') {

                        row.classList.add('customer-completed-order');
                    }
tb2.appendChild(row);

                    
                });

                ordersDiv.appendChild(Object.assign(document.createElement('h3'), { textContent: 'Coaching Orders' }));
                ordersDiv.appendChild(tbl2);
            }

            // No orders at all?
            if (!boostOrders.length && !coachingOrders.length) {
                ordersDiv.innerHTML = '<p>No orders found.</p>';
            }

            // Re-bind click handlers
            ordersDiv.querySelectorAll('.orders-table tbody tr').forEach(row => {
                const oid = row.dataset.orderId;
                const ord = orders.find(o => String(o.order_id) === oid);
                if (!ord || ord.status==='Completed') {
                    row.style.cursor = 'not-allowed';
                    return;
                }
                row.addEventListener('click', async () => {
                    const userRole = await checkUserRole();
                    showOrderFormModal(ord, userRole);
                });
            });

            // Info & ID buttons
            ordersDiv.querySelectorAll('.info-button, .order-id-button').forEach(btn => {
                const id = btn.dataset.orderId;
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    const ord = orders.find(o => String(o.order_id) === id);
                    if (btn.classList.contains('info-button')) showOrderDetailsModal(ord);
                    else showOrderIdModal(id);
                });
            });

            return;
        }

    const table = document.createElement('table');
    table.className = 'orders-table';
    let headers = '';
    if (isAvailable) {
        headers = `
            <tr>
                <th>Current Rank</th>
                <th>Desired Rank</th>
                <th>Details</th>
                <th>Ordered On</th>
                <th>Payout</th>
                <th>Action</th>
            </tr>
        `;
    } else if (isWorking) {
        headers = `
            <tr>
                <th>Order ID</th>
                <th>Details</th>
                <th>Current Rank</th>
                <th>Desired Rank</th>
                <th>Ordered On</th>
                <th>Payout</th>
                <th>Action</th>
            </tr>
        `;
    } else if (isCompleted) {
        headers = `
            <tr>
                <th>Customer</th>
                <th>Booster</th>
                <th>Current Rank</th>
                <th>Desired Rank</th>
                <th>Price</th>
                <th>Ordered On</th>
                <th>Extras</th>
                <th>Payout Status</th>
                <th>Action</th>
            </tr>
        `;
    } else {
        headers = `
            <tr>
                <th>Order ID</th>
                <th>Type</th>
                <th>Details</th>
                <th>Current Rank</th>
                <th>Desired Rank</th>
                <th>Hours</th>
                <th>Coach</th>
                <th>Price</th>
                <th>Status</th>
                <th>Ordered On</th>
                <th>Cashback</th>
            </tr>
        `;
    }
    table.innerHTML = `<thead>${headers}</thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');

    orders.forEach(order => {
        if (!order || !order.order_id) {
            console.warn('Skipping invalid order:', order);
            return;
        }
        console.log('Processing order:', order.order_id, 'GameType:', order.game_type, 'OrderType:', order.order_type, 'CurrentRank:', order.currentRank, 'CurrentRankRaw:', order.current_rank, 'DesiredRank:', order.desiredRank, 'DesiredRankRaw:', order.desired_rank);

        // Handle ranks for coaching orders
        const current = order.order_type === 'coaching'
            ? { rank: '', division: '', displayRank: 'N/A' }
            : (order.currentRank && order.currentDivision !== undefined
                ? {
                    rank: order.currentRank.toLowerCase(),
                    division: order.currentDivision || '',
                    displayRank: order.currentRank.charAt(0).toUpperCase() + order.currentRank.slice(1)
                }
                : parseRank(order.current_rank || 'Unknown', order.game_type || 'League of Legends'));
        const desired = order.order_type === 'coaching'
            ? { rank: '', division: '', displayRank: 'N/A' }
            : (order.desiredRank && order.desiredDivision !== undefined
                ? {
                    rank: order.desiredRank.toLowerCase(),
                    division: order.desiredDivision || '',
                    displayRank: order.desiredRank.charAt(0).toUpperCase() + order.desiredRank.slice(1)
                }
                : parseRank(order.desired_rank || 'Unknown', order.game_type || 'League of Legends'));

        const isValorant = (order.game_type || 'League of Legends') === 'Valorant';
        let currentRankImgSrc, desiredRankImgSrc;
        if (isValorant && order.order_type !== 'coaching') {
            const divisionMap = { 'I': '1', 'II': '2', 'III': '3', '': '0' };
            const currentDivision = divisionMap[current.division] || '0';
            const desiredDivision = divisionMap[desired.division] || '0';
            const currentRankCapitalized = current.displayRank;
            const desiredRankCapitalized = desired.displayRank;
            currentRankImgSrc = `/images/${currentRankCapitalized}_${currentDivision}_Rank.png`;
            desiredRankImgSrc = `/images/${desiredRankCapitalized}_${desiredDivision}_Rank.png`;
        } else if (order.order_type !== 'coaching') {
            currentRankImgSrc = `/images/${current.rank}.png`;
            desiredRankImgSrc = `/images/${desired.rank}.png`;
        }

        const currentRankImg = order.order_type === 'coaching'
            ? 'N/A'
            : `
                <img src="${currentRankImgSrc}" alt="${current.displayRank} ${current.division}" class="rank-logo" onerror="console.warn('Image failed:', '${currentRankImgSrc}'); this.src='/images/fallback.png'">
                ${current.displayRank} ${current.division ? current.division : ''}
            `;
        const desiredRankHtml = order.order_type === 'coaching'
            ? 'N/A'
            : `
                <img src="${desiredRankImgSrc}" alt="${desired.displayRank} ${desired.division}" class="rank-logo" onerror="console.warn('Image failed:', '${desiredRankImgSrc}'); this.src='/images/fallback.png'">
                ${desired.displayRank} ${desired.division ? desired.division : ''}
            `;
        const orderIdHtml = `
            <button class="order-id-button" data-order-id="${order.order_id}">?</button>
        `;
        const detailsHtml = `
            <button class="info-button" data-order-id="${order.order_id}">Info</button>
        `;
        const row = document.createElement('tr');
        row.dataset.orderId = order.order_id;
        let rowData = '';
        if (isAvailable) {
            rowData = `
                <td>${currentRankImg}</td>
                <td>${desiredRankHtml}</td>
                <td>${detailsHtml}</td>
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                <td>$${order.booster_payout || (order.price * 0.85).toFixed(2)}</td>
                <td><button class="claim-btn" data-order-id="${order.order_id}">Claim</button></td>
            `;
        } else if (isWorking) {
            const isCompleted = order.status === 'Completed';
            rowData = `
                <td>${orderIdHtml}</td>
                <td>${detailsHtml}</td>
                <td>${currentRankImg}</td>
                <td>${desiredRankHtml}</td>
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                <td>$${order.booster_payout || (order.price * 0.85).toFixed(2)}</td>
                <td>
                    <button class="cancel-btn" data-order-id="${order.order_id}" ${isCompleted ? 'disabled' : ''}>Cancel</button>
                    <br>
                    <button class="complete-btn" data-order-id="${order.order_id}" ${isCompleted ? 'disabled' : ''}>Complete</button>
                </td>
            `;
            if (isCompleted) {
                row.classList.add('completed-order');
            }
        } else if (isCompleted) {
            const extras = parseExtras(order.extras);
            const payout = order.booster_payout || (order.price * 0.85).toFixed(2);
            rowData = `
                <td>${order.customer_username || 'N/A'} (${order.user_id})</td>
                <td>${order.booster_username || 'N/A'} (${order.booster_id || 'N/A'})</td>
                <td>${currentRankImg}</td>
                <td>${desiredRankHtml}</td>
                <td>$${parseFloat(order.price || 0).toFixed(2)} <span class="price-payout">(Payout: $${payout})</span></td>
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                <td>${extras}</td>
                <td>${order.payout_status || 'Pending'}</td>
                <td>
                    <button class="approve-btn" data-order-id="${order.order_id}" ${order.payout_status === 'Paid' ? 'disabled' : ''}>
                        Approve Payout ($${payout})
                    </button>
                </td>
            `;
        } else {
            rowData = `
                <td>${orderIdHtml}</td>
                <td>${order.order_type || 'boost'}</td>
                <td>${detailsHtml}</td>
                <td>${currentRankImg}</td>
                <td>${desiredRankHtml}</td>
                <td>${order.order_type === 'coaching' ? (order.booked_hours || 'N/A') : 'N/A'}</td>
                <td>${order.order_type === 'coaching' ? (order.coach_username || order.coach_name || 'N/A') : 'N/A'}</td>
                <td>$${parseFloat(order.price || order.total_price || 0).toFixed(2)}</td>
                <td>${order.status || 'Pending'}</td>
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                <td>$${parseFloat(order.cashback || 0).toFixed(2)}</td>
            `;
            if (order.status === 'Completed') {
                row.classList.add('customer-completed-order');
            }
        }
        row.innerHTML = rowData;
        tbody.appendChild(row);
    });

    ordersDiv.innerHTML = '';
    ordersDiv.appendChild(table);

 document.querySelectorAll('.info-button').forEach(button => {
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        const orderId = button.getAttribute('data-order-id');
        console.log('Info button clicked for orderId:', orderId);
        const order = orders.find(o => String(o.order_id) === String(orderId));
        console.log('Found order:', order);
        showOrderDetailsModal(order, isAvailable); // Pass isAvailable flag
    });
});

    


if (isAvailable) {
    document.querySelectorAll('.claim-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const orderId = button.getAttribute('data-order-id');
            const userId = localStorage.getItem('userId'); // Get userId from localStorage
            if (!userId) {
                console.error('No userId found in localStorage');
                alert('Please log in to claim orders.');
                window.location.href = '/league-services.html';
                return;
            }
            try {
                console.log('Claiming orderId:', orderId, 'with userId:', userId);
                const response = await fetch('/api/claim-order', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId, orderId })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to claim order');
                }
                console.log('Order claimed successfully:', data);
                alert('Order claimed successfully!');
                await fetchAvailableOrders();
                await fetchWorkingOrders();
            } catch (error) {
                console.error('Error claiming order:', error.message);
                alert('Failed to claim order: ' + error.message);
            }
        });
    });
}

    if (isWorking) {
    document.querySelectorAll('.cancel-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const orderId = button.getAttribute('data-order-id');
            const userId = localStorage.getItem('userId');
            if (!userId) {
                console.error('No userId found in localStorage');
                alert('Please log in to cancel orders.');
                window.location.href = '/league-services.html';
                return;
            }
            if (confirm('Are you sure you want to cancel this order?')) {
                try {
                    console.log('Cancelling orderId:', orderId, 'with userId:', userId);
                    const response = await fetch('/api/unclaim-order', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ userId, orderId })
                    });
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to cancel order');
                    }
                    console.log('Order cancelled successfully:', data);
                    alert('Order cancelled successfully!');
                    await fetchAvailableOrders();
                    await fetchWorkingOrders();
                } catch (error) {
                    console.error('Error cancelling order:', error.message);
                    alert('Failed to cancel order: ' + error.message);
                }
            }
        });
    });

    document.querySelectorAll('.complete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const orderId = button.getAttribute('data-order-id');
            const userId = localStorage.getItem('userId');
            if (!userId) {
                console.error('No userId found in localStorage');
                alert('Please log in to complete orders.');
                window.location.href = '/league-services.html';
                return;
            }
            if (confirm('Are you sure you want to mark this order as completed?')) {
                try {
                    console.log('Completing orderId:', orderId, 'with userId:', userId);
                    const response = await fetch('/api/complete-order', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ userId, orderId })
                    });
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to complete order');
                    }
                    console.log('Order marked as completed:', data);
                    alert('Order marked as completed!');
                    await fetchWorkingOrders();
                } catch (error) {
                    console.error('Error completing order:', error.message);
                    alert('Failed to complete order: ' + error.message);
                }
            }
        });
    });
}

if (isCompleted) {
    document.querySelectorAll('.approve-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const orderId = button.getAttribute('data-order-id');
            const userId = localStorage.getItem('userId');
            if (!userId) {
                console.error('No userId found in localStorage');
                alert('Please log in to approve payouts.');
                window.location.href = '/league-services.html';
                return;
            }
            if (confirm(`Are you sure you want to approve the payout for order ${orderId}?`)) {
                try {
                    console.log('Approving payout for orderId:', orderId, 'with userId:', userId);
                    const response = await fetch('/api/approve-payout', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ userId, orderId })
                    });
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to approve payout');
                    }
                    console.log('Payout approved successfully:', data);
                    alert('Payout approved successfully!');
                    await fetchCompletedOrders();
                } catch (error) {
                    console.error('Error approving payout:', error.message);
                    alert('Failed to approve payout: ' + error.message);
                }
            }
        });
    });
}

    document.querySelectorAll('.order-id-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const orderId = button.getAttribute('data-order-id');
            showOrderIdModal(orderId);
        });
    });

    if (!isAvailable) {
        table.querySelectorAll('tbody tr').forEach(row => {
            const orderId = row.dataset.orderId;
            if (!orderId) {
                console.warn(`Skipping row with missing or invalid orderId in container: ${containerId}`, row.outerHTML);
                row.style.cursor = 'not-allowed';
                return;
            }
            const order = orders.find(o => String(o.order_id) === String(orderId));
            if (!order) {
                console.warn(`No order found for orderId: ${orderId} in container: ${containerId}`);
                row.style.cursor = 'not-allowed';
                return;
            }
            if (!(isWorking && order.status === 'Completed')) {
                row.addEventListener('click', async () => {
                    const userRole = await checkUserRole();
                    console.log('Row clicked for orderId:', orderId, 'Role:', userRole, 'Status:', order.status);
                    showOrderFormModal(order, userRole);
                });
            } else {
                console.log('Skipping click handler for completed orderId:', orderId, 'in working orders');
                row.style.cursor = 'not-allowed';
            }
        });
    }
}

    function showPanel(panelId) {
        console.log(`Showing panel: ${panelId}`);
        const allPanels = [
            'account-balance-panel',
            'orders-panel',
            'available-orders-panel',
            'working-orders-panel',
            'order-boost-panel',
            'discord-panel',
            'settings-panel',
            'completed-orders-panel',
            'payout-history-panel',
            'payout-management-panel',
            'admin-panel',
            'coaching-orders-panel'
        ];
        allPanels.forEach(id => {
            const panel = document.getElementById(id);
            if (panel) {
                panel.style.display = id === panelId ? 'flex' : 'none';
            }
        });
        document.querySelectorAll('.sidebar li a').forEach(link => {
            link.classList.toggle('active', link.id === panelId.replace('-panel', '-link'));
        });

        // Load data for specific panels
        if (panelId === 'admin-panel') {
            loadAdminPanel();
        }
    }

    function showDefaultPanels() {
        console.log('Showing default panels');
        const orderPanels = [
            'orders-panel',
            'available-orders-panel',
            'working-orders-panel',
            'completed-orders-panel',
            'payout-history-panel',
            'payout-management-panel',
            'admin-panel',
            'coaching-orders-panel'
        ];
        const defaultPanels = ['account-balance-panel', 'order-boost-panel', 'discord-panel', 'settings-panel'];
        orderPanels.forEach(id => {
            const panel = document.getElementById(id);
            if (panel) panel.style.display = 'none';
        });
        defaultPanels.forEach(id => {
            const panel = document.getElementById(id);
            if (panel) panel.style.display = 'flex';
        });
        document.querySelectorAll('.sidebar li a').forEach(link => link.classList.remove('active'));
    }

    function logout() {
        localStorage.removeItem('userId');
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('role');
        window.location.href = '/league-services.html';
    }

    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded event fired');
        checkUserRole();
        fetchUserBalance();
        showDefaultPanels();
        setupPayoutRequestForm();
        setupCouponForm(); // Initialize coupon form

        const accountBalanceLink = document.getElementById('account-balance-link');
        if (accountBalanceLink) {
            accountBalanceLink.addEventListener('click', (e) => {
                e.preventDefault();
                showPanel('account-balance-panel');
                fetchUserBalance();
            });
        }

        const ordersLink = document.getElementById('orders-link');
        if (ordersLink) {
            ordersLink.addEventListener('click', (e) => {
                e.preventDefault();
                showPanel('orders-panel');
                fetchUserOrders();
            });
        }

        const availableOrdersLink = document.getElementById('available-orders-link');
        if (availableOrdersLink) {
            availableOrdersLink.addEventListener('click', (e) => {
                e.preventDefault();
                showPanel('available-orders-panel');
                fetchAvailableOrders();
            });
        }

        if (document.getElementById('coaching-orders-link')) {
            document.getElementById('coaching-orders-link').addEventListener('click', function (e) {
                e.preventDefault();
                console.log('Coaching orders link clicked');
                showPanel('coaching-orders-panel');
                fetchCoachingOrders();
            });
        }

        const workingOrdersLink = document.getElementById('working-orders-link');
        if (workingOrdersLink) {
            workingOrdersLink.addEventListener('click', (e) => {
                e.preventDefault();
                showPanel('working-orders-panel');
                fetchWorkingOrders();
            });
        }

        const completedOrdersLink = document.getElementById('completed-orders-link');
        if (completedOrdersLink) {
            completedOrdersLink.addEventListener('click', (e) => {
                e.preventDefault();
                showPanel('completed-orders-panel');
                fetchCompletedOrders();
            });
        }

        const payoutHistoryLink = document.getElementById('payout-history-link');
        if (payoutHistoryLink) {
            payoutHistoryLink.addEventListener('click', (e) => {
                e.preventDefault();
                showPanel('payout-history-panel');
                fetchPayoutHistory();
            });
        }

        const payoutManagementLink = document.getElementById('payout-management-link');
        if (payoutManagementLink) {
            payoutManagementLink.addEventListener('click', (e) => {
                e.preventDefault();
                showPanel('payout-management-panel');
                fetchPayoutRequests();
            });
        }

        const adminPanelLink = document.getElementById('admin-panel-link');
        if (adminPanelLink) {
            adminPanelLink.addEventListener('click', (e) => {
                e.preventDefault();
                showPanel('admin-panel');
                loadAdminPanel();
            });
        }

        const orderBoostLink = document.getElementById('order-boost-link');
        if (orderBoostLink) {
            orderBoostLink.addEventListener('click', (e) => {
                e.preventDefault();
                showPanel('order-boost-panel');
            });
        }

        const joinDiscordButton = document.querySelector('#discord-panel button');
        if (joinDiscordButton) {
            console.log('Join Discord button found:', joinDiscordButton);
            joinDiscordButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Join Discord button clicked');
                window.open('https://discord.gg/XCS94bnaRc', '_blank');
            });
        } else {
            console.error('Join Discord button not found in #discord-panel');
        }

        const settingsButton = document.querySelector('#settings-panel button');
        if (settingsButton) {
            console.log('Settings button found:', settingsButton);
            settingsButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Settings button clicked');
                window.location.href = '/account-settings.html';
            });
        } else {
            console.error('Settings button not found in #settings-panel');
        }

        const orderNowButton = document.querySelector('#order-boost-panel button');
        if (orderNowButton) {
            console.log('Order Now button found:', orderNowButton);
            orderNowButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Order Now button clicked');
                window.location.href = '/league-services.html';
            });
        } else {
            console.error('Order Now button not found in #order-boost-panel');
        }

        const logoutLink = document.getElementById('logout-link');
        if (logoutLink) {
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
        }

        const closeButtons = [
            { id: 'close-orders', panel: 'orders-panel' },
            { id: 'close-available-orders', panel: 'available-orders-panel' },
            { id: 'close-working-orders', panel: 'working-orders-panel' },
            { id: 'close-completed-orders', panel: 'completed-orders-panel' },
            { id: 'close-payout-history', panel: 'payout-history-panel' },
            { id: 'close-payout-management', panel: 'payout-management-panel' },
            { id: 'close-coaching-orders', panel: 'coaching-orders-panel' }
        ];

        closeButtons.forEach(button => {
            const btn = document.getElementById(button.id);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log(`Close button clicked: ${button.id}`);
                    showDefaultPanels();
                });
            } else {
                console.warn(`Close button not found: ${button.id}`);
            }
        });
    });
})();