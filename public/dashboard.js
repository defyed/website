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
        }
    }

    async function checkUserRole() {
        try {
            console.log('Checking role for userId:', userId);
            const response = await fetch(`/api/user-role?userId=${userId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const { role } = await response.json();
            console.log('User role:', role);

            // Hide all role-specific buttons by default
            const ordersLink = document.getElementById('orders-link');
            const availableOrdersLink = document.getElementById('available-orders-link');
            const workingOrdersLink = document.getElementById('working-orders-link');
            const completedOrdersLink = document.getElementById('completed-orders-link');
            if (ordersLink) ordersLink.style.display = 'none';
            if (availableOrdersLink) availableOrdersLink.style.display = 'none';
            if (workingOrdersLink) workingOrdersLink.style.display = 'none';
            if (completedOrdersLink) completedOrdersLink.style.display = 'none';

            if (role === 'booster') {
                console.log('Showing booster buttons');
                if (availableOrdersLink) availableOrdersLink.style.display = 'block';
                if (workingOrdersLink) workingOrdersLink.style.display = 'block';
                if (ordersLink) ordersLink.style.display = 'block';
                console.log('Booster buttons set to display: block');
            } else if (role === 'admin') {
                console.log('Showing all buttons for admin');
                if (ordersLink) ordersLink.style.display = 'block';
                if (availableOrdersLink) availableOrdersLink.style.display = 'block';
                if (workingOrdersLink) workingOrdersLink.style.display = 'block';
                if (completedOrdersLink) completedOrdersLink.style.display = 'block';
                console.log('All buttons set to display: block for admin');
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
        try {
            console.log('Fetching orders for userId:', userId);
            const response = await fetch(`/api/user-orders?userId=${userId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
            }
            const orders = await response.json();
            console.log('My Orders received:', orders);
            renderOrders(orders, 'my-orders');
        } catch (error) {
            console.error('Error fetching orders:', error.message);
            document.getElementById('my-orders').innerHTML = '<p>Error loading orders. Please try again later.</p>';
        }
    }

    async function fetchAvailableOrders() {
        try {
            console.log('Fetching available orders for userId:', userId);
            const response = await fetch(`/api/available-orders?userId=${userId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
            }
            const orders = await response.json();
            console.log('Available orders received:', orders);
            renderOrders(orders, 'available-orders', true);
        } catch (error) {
            console.error('Error fetching available orders:', error.message);
            document.getElementById('available-orders').innerHTML = '<p>Error loading available orders. Please try again later.</p>';
        }
    }

    async function fetchWorkingOrders() {
        try {
            console.log('Fetching working orders for userId:', userId);
            const response = await fetch(`/api/working-orders?userId=${userId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
            }
            const orders = await response.json();
            console.log('Working orders received for userId:', userId, 'Orders:', orders);
            renderOrders(orders, 'working-orders', false, true);
        } catch (error) {
            console.error('Error fetching working orders for userId:', userId, 'Error:', error.message);
            document.getElementById('working-orders').innerHTML = '<p>Error loading working orders. Please try again later.</p>';
        }
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

    function parseRank(rankStr) {
        if (!rankStr || typeof rankStr !== 'string') {
            console.warn('Invalid rank string:', rankStr);
            return { rank: 'default', division: '' };
        }
        rankStr = rankStr.trim();
        const validRanks = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger'];
        const match = rankStr.match(/^([\w\s]+?)\s*(I|II|III|IV)?$/i);
        if (!match) {
            console.warn('Rank parse failed for:', rankStr);
            return { rank: 'default', division: '' };
        }
        const rankName = match[1].trim().toLowerCase().replace(/\s+/g, '');
        const division = match[2] || '';
        if (!validRanks.includes(rankName)) {
            console.warn('Invalid rank name:', rankName, 'Original:', rankStr);
            return { rank: 'default', division: '' };
        }
        return { rank: rankName, division };
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
        const extras = parseExtras(order.extras);
        const userRole = await checkUserRole();
        const isCustomer = userRole !== 'booster' && userRole !== 'admin';

        let modalContent = `
            <div class="modal-content">
                <span class="modal-close">×</span>
                <h3>Order Details</h3>
                <p><strong>Order ID:</strong> ${order.order_id}</p>
                <p><strong>Current Rank:</strong> ${order.current_rank}</p>
                <p><strong>Desired Rank:</strong> ${order.desired_rank}</p>
                <p><strong>Current LP:</strong> ${order.current_lp || 0}</p>
                <p><strong>Extra Options:</strong> ${extras}</p>
                <p><strong>Ordered On:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
        `;
        if (isCustomer) {
            modalContent += `
                <p><strong>Price:</strong> $${parseFloat(order.price || 0).toFixed(2)}</p>
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

    function showOrderIdModal(orderId) {
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

    async function showOrderFormModal(order, userRole) {
        const modal = document.createElement('div');
        modal.className = 'modal order-form-modal';
        const isCustomer = userRole !== 'booster' && userRole !== 'admin';
        const extras = parseExtras(order.extras);

        // Fetch credentials
        let credentials = { account_username: '', summoner_name: '', plaintext_password: '' };
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

        // Fetch messages
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
            <p><strong>Current Rank:</strong> ${order.current_rank}</p>
            <p><strong>Desired Rank:</strong> ${order.desired_rank}</p>
            <p><strong>Current LP:</strong> ${order.current_lp || 0}</p>
            <p><strong>Extras:</strong> ${extras}</p>
            <p><strong>Ordered On:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
        `;
        if (isCustomer) {
            orderDetailsHtml += `
                <p><strong>Price:</strong> $${parseFloat(order.price).toFixed(2)}</p>
                <p><strong>Status:</strong> ${order.status}</p>
                <p><strong>Cashback:</strong> $${parseFloat(order.cashback || 0).toFixed(2)}</p>
            `;
        }

        let accountDetailsHtml = `
            <label>Account Username:</label>
            <input type="text" id="account-username" value="${credentials.account_username || ''}" ${isCustomer ? '' : 'disabled'}>
            <label>Summoner Name:</label>
            <input type="text" id="summoner-name" value="${credentials.summoner_name || ''}" ${isCustomer ? '' : 'disabled'}>
        `;
        if (isCustomer) {
            accountDetailsHtml += `
                <label>Account Password: Encrypted and hidden after entry.</label>
                <input type="password" id="account-password" value="">
                <button id="submit-credentials">Submit Credentials</button>
            `;
        } else {
            accountDetailsHtml += `
                <label>Account Password:</label>
                <div class="password-container">
                    <span id="password-field">********</span>
                    <button id="toggle-password">Show Password</button>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="modal-content order-form-content">
                <span class="modal-close">×</span>
                <div class="order-form-container">
                    <div class="order-details-panel">
                        ${orderDetailsHtml}
                        <h4>Account Details</h4>
                        <div class="account-details-form">
                            ${accountDetailsHtml}
                        </div>
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

        // Store password in data attribute
        if (!isCustomer) {
            modal.querySelector('#password-field').dataset.password = credentials.plaintext_password || 'N/A';
        }

        // Render messages
        const chatMessages = modal.querySelector(`#chat-messages-${order.order_id}`);
        messages.forEach(msg => {
            const messageEl = document.createElement('div');
            messageEl.className = `chat-message ${msg.sender_id === parseInt(userId) ? 'sent' : 'received'}`;
            messageEl.innerHTML = `
                <p><strong>${msg.sender_username}</strong> (${new Date(msg.created_at).toLocaleTimeString()}): ${msg.message}</p>`;
            chatMessages.appendChild(messageEl);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;

        if (isCustomer) {
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
        } else {
            modal.querySelector('#toggle-password').addEventListener('click', () => {
                const passwordField = modal.querySelector('#password-field');
                const toggleButton = document.querySelector('#toggle-password');
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
                        chatMessages.appendChild(messageEl);
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
                    <th>Details</th>
                    <th>Current Rank</th>
                    <th>Desired Rank</th>
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
            const current = parseRank(order.current_rank || 'Unknown');
            const desired = parseRank(order.desired_rank || 'Unknown');
            const currentRankImg = `
                <img src="/assets/${current.rank}.png" alt="${current.rank}" class="rank-logo">
                ${current.division}
            `;
            const desiredRankHtml = `
                <img src="/assets/${desired.rank}.png" alt="${desired.rank}" class="rank-logo">
                ${desired.division}
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
                    <td>${detailsHtml}</td>
                    <td>${currentRankImg}</td>
                    <td>${desiredRankHtml}</td>
                    <td>$${parseFloat(order.price || 0).toFixed(2)}</td>
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

        // Attach event listeners for info buttons
        document.querySelectorAll('.info-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const orderId = button.getAttribute('data-order-id');
                console.log('Info button clicked for orderId:', orderId);
                const order = orders.find(o => String(o.order_id) === String(orderId));
                console.log('Found order:', order);
                showOrderDetailsModal(order);
            });
        });

        // Attach event listeners for claim buttons
        if (isAvailable) {
            document.querySelectorAll('.claim-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const orderId = button.getAttribute('data-order-id');
                    try {
                        console.log('Claiming orderId:', orderId, 'with userId:', userId);
                        const response = await fetch('/api/claim-order', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId, orderId })
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to claim order');
                        }
                        alert('Order claimed successfully!');
                        fetchAvailableOrders();
                        fetchWorkingOrders();
                    } catch (error) {
                        console.error('Error claiming order:', error.message);
                        alert('Failed to claim order. Please try again.');
                    }
                });
            });
        }

        // Attach event listeners for cancel buttons
        if (isWorking) {
            document.querySelectorAll('.cancel-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const orderId = button.getAttribute('data-order-id');
                    if (confirm('Are you sure you want to cancel this order?')) {
                        try {
                            console.log('Cancelling orderId:', orderId, 'with userId:', userId);
                            const response = await fetch('/api/unclaim-order', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId, orderId })
                            });
                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Failed to cancel order');
                            }
                            alert('Order cancelled successfully!');
                            fetchAvailableOrders();
                            fetchWorkingOrders();
                        } catch (error) {
                            console.error('Error cancelling order:', error.message);
                            alert('Failed to cancel order. Please try again.');
                        }
                    }
                });
            });

            // Attach event listeners for complete buttons
            document.querySelectorAll('.complete-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const orderId = button.getAttribute('data-order-id');
                    if (confirm('Are you sure you want to mark this order as completed?')) {
                        try {
                            console.log('Completing orderId:', orderId, 'with userId:', userId);
                            const response = await fetch('/api/complete-order', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId, orderId })
                            });
                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Failed to complete order');
                            }
                            alert('Order marked as completed!');
                            fetchWorkingOrders();
                        } catch (error) {
                            console.error('Error completing order:', error.message);
                            alert('Failed to complete order. Please try again.');
                        }
                    }
                });
            });
        }

        // Attach event listeners for approve payout buttons
        if (isCompleted) {
            document.querySelectorAll('.approve-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const orderId = button.getAttribute('data-order-id');
                    if (confirm(`Are you sure you want to approve the payout for order ${orderId}?`)) {
                        try {
                            console.log('Approving payout for orderId:', orderId, 'with userId:', userId);
                            const response = await fetch('/api/approve-payout', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId, orderId })
                            });
                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Failed to approve payout');
                            }
                            alert('Payout approved successfully!');
                            fetchCompletedOrders();
                        } catch (error) {
                            console.error('Error approving payout:', error.message);
                            alert('Failed to approve payout. Please try again.');
                        }
                    }
                });
            });
        }

        // Attach event listeners for order ID buttons
        document.querySelectorAll('.order-id-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const orderId = button.getAttribute('data-order-id');
                showOrderIdModal(orderId);
            });
        });

        // Attach click handlers for order rows
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
                // Only attach click handler for non-completed orders in "My Working Orders" for boosters
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
        const allPanels = ['account-balance-panel', 'orders-panel', 'available-orders-panel', 'working-orders-panel', 'order-boost-panel', 'discord-panel', 'settings-panel', 'completed-orders-panel'];
        allPanels.forEach(id => {
            const panel = document.getElementById(id);
            if (panel) {
                panel.style.display = id === panelId ? 'flex' : 'none';
            }
        });
        document.querySelectorAll('.sidebar li a').forEach(link => {
            link.classList.toggle('active', link.id === panelId.replace('-panel', '-link'));
        });
    }

    function showDefaultPanels() {
        console.log('Showing default panels');
        const orderPanels = ['orders-panel', 'available-orders-panel', 'working-orders-panel', 'completed-orders-panel'];
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
        window.location.href = '/league-services.html';
    }

    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded event fired');
        checkUserRole();
        fetchUserBalance();
        showDefaultPanels();

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

        const orderBoostLink = document.getElementById('order-boost-link');
        if (orderBoostLink) {
            orderBoostLink.addEventListener('click', (e) => {
                e.preventDefault();
                showPanel('order-boost-panel');
            });
        }

        const discordLink = document.getElementById('discord-link');
        if (discordLink) {
            discordLink.addEventListener('click', (e) => {
                e.preventDefault();
                showPanel('discord-panel');
            });
        }

        const logoutLink = document.getElementById('logout-link');
        if (logoutLink) {
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Logout link clicked');
                logout();
            });
        }

        const closeOrdersButton = document.getElementById('close-orders');
        if (closeOrdersButton) {
            closeOrdersButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Close orders button clicked');
                showDefaultPanels();
            });
        }

        const closeAvailableOrdersButton = document.getElementById('close-available-orders');
        if (closeAvailableOrdersButton) {
            closeAvailableOrdersButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Close available orders button clicked');
                showDefaultPanels();
            });
        }

        const closeWorkingOrdersButton = document.getElementById('close-working-orders');
        if (closeWorkingOrdersButton) {
            closeWorkingOrdersButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Close working orders button clicked');
                showDefaultPanels();
            });
        }

        const closeCompletedOrdersButton = document.getElementById('close-completed-orders');
        if (closeCompletedOrdersButton) {
            closeCompletedOrdersButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Close completed orders button clicked');
                showDefaultPanels();
            });
        }
    });
})();