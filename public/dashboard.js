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
            const payoutHistoryLink = document.getElementById('payout-history-link');
            const payoutManagementLink = document.getElementById('payout-management-link');
            if (ordersLink) ordersLink.style.display = 'none';
            if (availableOrdersLink) availableOrdersLink.style.display = 'none';
            if (workingOrdersLink) workingOrdersLink.style.display = 'none';
            if (completedOrdersLink) completedOrdersLink.style.display = 'none';
            if (payoutHistoryLink) payoutHistoryLink.style.display = 'none';
            if (payoutManagementLink) payoutManagementLink.style.display = 'none';

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
        if (isFetchingAvailableOrders) {
            console.log('fetchAvailableOrders already in progress, skipping');
            return;
        }
        isFetchingAvailableOrders = true;
        try {
            console.log('Fetching available orders for userId:', userId);
            const response = await fetch(`/api/available-orders?userId=${userId}`);
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
            document.getElementById('available-orders').innerHTML = '<p>Error loading available orders. Please try again later.</p>';
        } finally {
            isFetchingAvailableOrders = false;
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

        if (!isCustomer) {
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
            console.log('Processing order:', order.order_id, 'GameType:', order.game_type, 'CurrentRank:', order.current_rank, 'DesiredRank:', order.desired_rank);
            const current = parseRank(order.current_rank || 'Unknown', order.game_type || 'League of Legends');
            const desired = parseRank(order.desired_rank || 'Unknown', order.game_type || 'League of Legends');

            const isValorant = (order.game_type || 'League of Legends') === 'Valorant';
            let currentRankImgSrc, desiredRankImgSrc;
            if (isValorant) {
                const divisionMap = { 'I': '1', 'II': '2', 'III': '3', '': '0' };
                const currentDivision = divisionMap[current.division] || '0';
                const desiredDivision = divisionMap[desired.division] || '0';
                const currentRankCapitalized = current.rank.charAt(0).toUpperCase() + current.rank.slice(1);
                const desiredRankCapitalized = desired.rank.charAt(0).toUpperCase() + desired.rank.slice(1);
                currentRankImgSrc = `/images/${currentRankCapitalized}_${currentDivision}_Rank.png`;
                desiredRankImgSrc = `/images/${desiredRankCapitalized}_${desiredDivision}_Rank.png`;
            } else {
                currentRankImgSrc = `/images/${current.rank}.png`;
                desiredRankImgSrc = `/images/${desired.rank}.png`;
            }

            console.log('Image paths:', { current: currentRankImgSrc, desired: desiredRankImgSrc });

            const currentRankImg = `
                <img src="${currentRankImgSrc}" alt="${current.displayRank} ${current.division}" class="rank-logo" onerror="console.warn('Image failed:', '${currentRankImgSrc}'); this.src='/images/fallback.png'">
                ${current.division ? current.division : ''}
            `;
            const desiredRankHtml = `
                <img src="${desiredRankImgSrc}" alt="${desired.displayRank} ${desired.division}" class="rank-logo" onerror="console.warn('Image failed:', '${desiredRankImgSrc}'); this.src='/images/fallback.png'">
                ${desired.division ? desired.division : ''}
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
                        await fetchAvailableOrders();
                        await fetchWorkingOrders();
                    } catch (error) {
                        console.error('Error claiming order:', error.message);
                        alert('Failed to claim order. Please try again.');
                    }
                });
            });
        }

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
                            await fetchAvailableOrders();
                            await fetchWorkingOrders();
                        } catch (error) {
                            console.error('Error cancelling order:', error.message);
                            alert('Failed to cancel order. Please try again.');
                        }
                    }
                });
            });

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
                            await fetchWorkingOrders();
                        } catch (error) {
                            console.error('Error completing order:', error.message);
                            alert('Failed to complete order. Please try again.');
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
                            await fetchCompletedOrders();
                        } catch (error) {
                            console.error('Error approving payout:', error.message);
                            alert('Failed to approve payout. Please try again.');
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
            'payout-management-panel'
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
    }

    function showDefaultPanels() {
        console.log('Showing default panels');
        const orderPanels = [
            'orders-panel',
            'available-orders-panel',
            'working-orders-panel',
            'completed-orders-panel',
            'payout-history-panel',
            'payout-management-panel'
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
        window.location.href = '/league-services.html';
    }

    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded event fired');
        checkUserRole();
        fetchUserBalance();
        showDefaultPanels();
        setupPayoutRequestForm();

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

        const closePayoutHistoryButton = document.getElementById('close-payout-history');
        if (closePayoutHistoryButton) {
            closePayoutHistoryButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Close payout history button clicked');
                showDefaultPanels();
            });
        }

        const closePayoutManagementButton = document.getElementById('close-payout-management');
        if (closePayoutManagementButton) {
            closePayoutManagementButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Close payout management button clicked');
                showDefaultPanels();
            });
        }

        // Add navigation for panel buttons
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
    });
})();