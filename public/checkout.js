(function () {
    if (typeof Stripe === 'undefined') {
        console.error('Stripe.js failed to load. Ensure <script src="https://js.stripe.com/v3/"></script> is in checkout.html.');
        alert('Payment system is unavailable. Please try again later or contact support.');
        return;
    }

    const stripe = Stripe('pk_test_51RQDfjPPazfqaVG5QhEgsle6jH6ohhSrqObHzyzOUk6sbh3nERA6impvrDL0judz7e7d0ylipgmgv1sTATWT6ylj00kTO65wlC');
    console.log('Stripe initialized at:', new Date().toISOString());

    initializePayNowButton();

    const pollInterval = setInterval(() => {
        if (document.querySelector('.proceed-payment')) {
            initializePayNowButton();
            clearInterval(pollInterval);
            console.log('Polling stopped: Pay Now button found at:', new Date().toISOString());
        }
    }, 50);
    setTimeout(() => {
        clearInterval(pollInterval);
        console.log('Polling stopped: Timeout after 3s');
    }, 3000);

    function initializePayNowButton() {
        const proceedButton = document.querySelector('.proceed-payment');
        if (!proceedButton || proceedButton.dataset.initialized) {
            console.log('Pay Now button already initialized or not found');
            return;
        }

        proceedButton.dataset.initialized = 'true';
        console.log('Initializing Pay Now button at:', new Date().toISOString());

        proceedButton.disabled = false;
        proceedButton.style.pointerEvents = 'auto';
        proceedButton.style.cursor = 'pointer';
        proceedButton.style.opacity = '1';

        const orderData = JSON.parse(sessionStorage.getItem('orderData')) || {};
        console.log('orderData loaded:', JSON.stringify(orderData, null, 2));

        const updateSummary = () => {
            try {
                // Sanitize division to remove duplicates
                const cleanDivision = (div) => {
                    if (!div) return '';
                    const parts = div.trim().split(/\s+/);
                    return parts[0] || '';
                };

                const currentDivision = cleanDivision(orderData.currentDivision);
                const desiredDivision = cleanDivision(orderData.desiredDivision);

                // Format ranks without prepending From/To
                const currentRankText = orderData.currentRank 
                    ? `${orderData.currentRank}${currentDivision ? ' ' + currentDivision : ''}`
                    : 'N/A';
                const desiredRankText = orderData.desiredRank 
                    ? `${orderData.desiredRank}${desiredDivision ? ' ' + desiredDivision : ''}`
                    : 'N/A';

                document.getElementById('current-rank').textContent = currentRankText;
                document.getElementById('desired-rank').textContent = desiredRankText;
                document.getElementById('current-lp').textContent = orderData.currentLP || 'N/A';

                // Master LP logic
                const masterLpElement = document.getElementById('MasterLP');
                const masterLpValue = document.getElementById('master-lp-value');
                const isMasterRank = orderData.desiredRank && orderData.desiredRank.toLowerCase() === 'master';
                if (isMasterRank) {
                    masterLpValue.textContent = orderData.desiredMasterLP || '0';
                    masterLpElement.style.display = 'block';
                } else {
                    masterLpElement.style.display = 'none';
                }

                const optionsDisplay = orderData.extras?.length 
                    ? orderData.extras.map(option => option.label).join(', ')
                    : 'None';
                document.getElementById('options').textContent = optionsDisplay;

                const finalPrice = parseFloat(orderData.finalPrice) || 0;
                const discount = parseFloat(orderData.discount) || (orderData.couponApplied ? 0.15 : 0);
                const totalPrice = parseFloat(orderData.totalPrice) || (discount > 0 ? finalPrice / (1 - discount) : finalPrice);
                const basePrice = parseFloat(orderData.basePrice) || totalPrice - (orderData.extras?.reduce((acc, e) => acc + parseFloat(e.cost || e.price || 0), 0) || 0);
                const discountAmount = totalPrice * discount;

                document.getElementById('subtotal').textContent = `$${totalPrice.toFixed(2)}`;
                document.getElementById('discount').textContent = `$${discountAmount.toFixed(2)}`;
                document.getElementById('total').textContent = `$${finalPrice.toFixed(2)}`;
                console.log('Order summary updated:', { basePrice, totalPrice, discount, discountAmount, finalPrice });
            } catch (error) {
                console.error('Error updating order summary:', error);
                document.getElementById('current-rank').textContent = 'N/A';
                document.getElementById('desired-rank').textContent = 'N/A';
                document.getElementById('current-lp').textContent = 'N/A';
                document.getElementById('MasterLP').style.display = 'none';
                document.getElementById('options').textContent = 'None';
                document.getElementById('subtotal').textContent = '$0.00';
                document.getElementById('discount').textContent = '$0.00';
                document.getElementById('total').textContent = '$0.00';
            }
        };
        updateSummary();

        proceedButton.addEventListener('click', async () => {
            console.log('Pay Now button clicked at:', new Date().toISOString());
            const userId = localStorage.getItem('userId');
            if (!userId || isNaN(userId)) {
                alert('Please log in to proceed with payment.');
                console.log('No valid userId found:', userId);
                window.location.href = '/league-services.html';
                return;
            }
            if (!orderData.currentRank || !orderData.desiredRank || !orderData.finalPrice) {
                alert('Incomplete order data. Please select ranks and options on the previous page.');
                console.log('Incomplete orderData:', orderData);
                window.location.href = '/league-services.html';
                return;
            }

            try {
                const clientReference = {
                    cr: orderData.currentRank,
                    dr: orderData.desiredRank,
                    fp: orderData.finalPrice,
                    bp: orderData.basePrice || orderData.totalPrice || orderData.finalPrice,
                    d: orderData.discount || (orderData.couponApplied ? 0.15 : 0),
                    ca: orderData.couponApplied || false,
                    cd: orderData.currentDivision || '',
                    dd: orderData.desiredDivision || '',
                    lp: orderData.currentLP || '0-20',
                    dlp: orderData.desiredMasterLP || orderData.desiredRR || 0,
                    ex: orderData.extras?.map(e => ({ l: e.label, p: e.percentage })) || []
                };
                const clientReferenceString = JSON.stringify(clientReference);
                console.log('client_reference_id:', { length: clientReferenceString.length, value: clientReferenceString });
                console.log('Requesting Stripe Checkout Session with:', { orderData, userId, clientReferenceString });
                const response = await fetch('/api/create-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderData, userId, clientReferenceString })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Failed to create checkout session:', errorData);
                    alert(`Failed to initiate payment: ${errorData.error || 'Unknown error'}`);
                    window.location.href = '/checkout.html';
                    return;
                }

                const session = await response.json();
                console.log('Checkout Session created:', session);

                const { error } = await stripe.redirectToCheckout({ sessionId: session.id });
                if (error) {
                    console.error('Stripe redirectToCheckout error:', error.message, error);
                    alert(`Payment error: ${error.message}. Please try again or contact support.`);
                    window.location.href = '/checkout.html';
                }
            } catch (error) {
                console.error('Checkout error:', error.message, error.stack);
                alert(`An error occurred while processing your payment: ${error.message}. Please try again or contact support.`);
                window.location.href = '/checkout.html';
            }
        });

        proceedButton.addEventListener('mousedown', () => {
            console.log('Pay Now button mousedown at:', new Date().toISOString());
        });
    }
})();