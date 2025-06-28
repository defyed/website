(function () {
    if (typeof Stripe === 'undefined') {
        console.error('Stripe.js failed to load. Ensure <script src="https://js.stripe.com/v3/"></script> is in the /checkout page.');
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

        // Define rank lists
        const valorantRanks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
        const leagueRanks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'];
        const uniqueValorantRanks = ['Ascendant', 'Immortal', 'Radiant'];
        const uniqueLeagueRanks = ['Emerald', 'Master', 'Grandmaster', 'Challenger'];
        const normalizedCurrentRank = orderData.currentRank ? orderData.currentRank.split(' ')[0] : '';
        const normalizedDesiredRank = orderData.desiredRank ? orderData.desiredRank.split(' ')[0] : '';

        // Set game type based on page user came from
        if (document.referrer.includes('/league')) {
            orderData.game = 'League of Legends';
            console.log('Forced game type to League of Legends based on referrer: /league');
        } else if (document.referrer.includes('/valorant')) {
            orderData.game = 'Valorant';
            console.log('Forced game type to Valorant based on referrer: /valorant');
        } else if (orderData.game && ['League of Legends', 'Valorant'].includes(orderData.game)) {
            console.log(`Game type set to ${orderData.game} based on orderData.game`);
        } else {
            orderData.game = 'League of Legends'; // Fallback
            console.log('Defaulted game type to League of Legends');
        }

        // Clear currentLP for Immortal ranks
        if (orderData.currentRank === 'Immortal' && orderData.currentLP) {
            delete orderData.currentLP;
            sessionStorage.setItem('orderData', JSON.stringify(orderData));
            console.log('Cleared currentLP from orderData for Immortal rank on checkout load');
        }

        const updateSummary = () => {
            try {
                const formatRank = (rank, division, masterLP, rr) => {
                    if (!rank || rank === 'N/A') return 'N/A';
                    if (['Master', 'Immortal'].includes(rank.split(' ')[0])) {
                        const points = orderData.game === 'Valorant' ? (rr || 0) : (masterLP || 0);
                        const pointType = orderData.game === 'Valorant' ? 'RR' : 'LP';
                        return `${rank.split(' ')[0]}${points ? ` (${points} ${pointType})` : ''}`;
                    }
                    return `${rank.split(' ')[0]}${division ? ' ' + division : ''}`.trim();
                };

                const currentRankElement = document.getElementById('current-rank');
                const desiredRankElement = document.getElementById('desired-rank');
                const currentLPElement = document.getElementById('current-lp');
                const currentRRElement = document.getElementById('current-rr');
                const masterLpElement = document.getElementById('MasterLP');
                const masterLpSpan = masterLpElement ? masterLpElement.querySelector('span') : null;
                const lpDetailsElement = document.getElementById('lp-details');
                const optionsElement = document.getElementById('options');
                const subtotalElement = document.getElementById('subtotal');
                const discountElement = document.getElementById('discount');
                const totalElement = document.getElementById('total');

                if (currentRankElement) {
                    currentRankElement.textContent = formatRank(
                        orderData.currentRank,
                        orderData.currentDivision,
                        orderData.currentMasterLP,
                        orderData.currentRR
                    );
                }
                if (desiredRankElement) {
                    desiredRankElement.textContent = formatRank(
                        orderData.desiredRank,
                        orderData.desiredDivision,
                        orderData.desiredMasterLP,
                        orderData.desiredRR
                    );
                }
                if (currentLPElement && currentRRElement) {
                    if (orderData.game === 'Valorant') {
                        currentLPElement.classList.add('hidden');
                        currentRRElement.classList.remove('hidden');
                        currentRRElement.textContent = `Current RR: ${orderData.currentRR || 0}`;
                    } else {
                        currentLPElement.classList.remove('hidden');
                        currentRRElement.classList.add('hidden');
                        currentLPElement.textContent = `Current LP: ${orderData.currentLP || 'N/A'}`;
                    }
                }
                if (masterLpElement && masterLpSpan && lpDetailsElement) {
                    const isMasterOrImmortal = (rank) => ['Master', 'Immortal'].includes((rank || '').split(' ')[0]);
                    if (isMasterOrImmortal(orderData.currentRank) && isMasterOrImmortal(orderData.desiredRank)) {
                        lpDetailsElement.classList.add('hidden');
                    } else if (isMasterOrImmortal(orderData.currentRank) || isMasterOrImmortal(orderData.desiredRank)) {
                        masterLpSpan.textContent = orderData.desiredMasterLP || orderData.desiredRR || '0';
                        masterLpElement.style.display = 'block';
                        lpDetailsElement.classList.remove('hidden');
                    } else {
                        masterLpElement.style.display = 'none';
                        lpDetailsElement.classList.remove('hidden');
                    }
                }
                if (optionsElement) {
                    const optionsDisplay = orderData.extras?.length 
                        ? orderData.extras.map(option => option.label).join(', ')
                        : 'None';
                    optionsElement.textContent = `Options: ${optionsDisplay}`;
                }
                if (subtotalElement && discountElement && totalElement) {
                    const finalPrice = parseFloat(orderData.finalPrice) || 0;
                    const discount = parseFloat(orderData.discountRate) || (orderData.couponApplied ? (orderData.game === 'Valorant' ? 44 : 15) : 0);
                    const totalPrice = parseFloat(orderData.totalPrice) || (discount > 0 ? finalPrice / (1 - discount / 100) : finalPrice);
                    const basePrice = parseFloat(orderData.basePrice) || totalPrice - (orderData.extras?.reduce((acc, e) => acc + parseFloat(e.cost || e.price || 0), 0) || 0);
                    const discountAmount = totalPrice * (discount / 100);

                    subtotalElement.textContent = `Subtotal $${totalPrice.toFixed(2)}`;
                    discountElement.textContent = `Discount (${discount}%) $${discountAmount.toFixed(2)}`;
                    totalElement.textContent = `Total $${finalPrice.toFixed(2)}`;
                    console.log('Order summary updated:', { basePrice, totalPrice, discount, discountAmount, finalPrice });
                }
            } catch (error) {
                console.error('Error updating order summary:', error);
                const subtotalElement = document.getElementById('subtotal');
                const discountElement = document.getElementById('discount');
                const totalElement = document.getElementById('total');
                const masterLpElement = document.getElementById('MasterLP');
                const lpDetailsElement = document.getElementById('lp-details');

                if (subtotalElement) subtotalElement.textContent = 'Subtotal $0.00';
                if (discountElement) discountElement.textContent = 'Discount (0%) $0.00';
                if (totalElement) totalElement.textContent = 'Total $0.00';
                if (masterLpElement) masterLpElement.style.display = 'none';
                if (lpDetailsElement) lpDetailsElement.classList.add('hidden');
            }
        };
        updateSummary();

        proceedButton.addEventListener('click', async () => {
            console.log('Pay Now button clicked at:', new Date().toISOString());
            const userId = localStorage.getItem('userId');
            if (!userId || isNaN(userId)) {
                alert('Please log in to proceed with payment.');
                console.log('No valid userId found:', userId);
                window.location.href = '/league';
                return;
            }
            if (!orderData.currentRank || !orderData.desiredRank || !orderData.finalPrice) {
                alert('Incomplete order data. Please select ranks and options on the previous page.');
                console.log('Incomplete orderData:', orderData);
                window.location.href = '/league';
                return;
            }

            try {
                const isMasterOrImmortal = (rank) => ['Master', 'Immortal'].includes((rank || '').split(' ')[0]);
                const currentLP = orderData.game === 'Valorant' ? undefined : (orderData.currentLP || '0-20');
                const desiredLP = orderData.game === 'Valorant' ? undefined : (parseInt(orderData.desiredLP) || 0);

                const abbreviate = (str) => {
                    const map = {
                        'League of Legends': 'LoL',
                        'Valorant': 'Val',
                        'Platinum': 'Plat',
                        'Diamond': 'Dia',
                        'Emerald': 'Em',
                        'Ascendant': 'Asc',
                        'Immortal': 'Imm',
                        'Grandmaster': 'GM',
                        'Challenger': 'Chal'
                    };
                    return map[str] || str.slice(0, 4);
                };

                const clientReference = {
                    cRank: abbreviate(orderData.currentRank || 'Iron'),
                    dRank: abbreviate(orderData.desiredRank || 'Iron'),
                    price: parseFloat(orderData.finalPrice) || 0,
                    cDiv: orderData.currentDivision || '',
                    dDiv: orderData.desiredDivision || '',
                    cLP: orderData.game === 'Valorant' ? (parseInt(orderData.currentRR) || 0) : currentLP,
                    dLP: orderData.game === 'Valorant' ? (parseInt(orderData.desiredRR) || 0) : desiredLP,
                    extras: orderData.extras?.map(e => ({ l: e.label.slice(0, 10), p: e.price })) || [],
                    game: abbreviate(orderData.game || 'League of Legends'),
                    discountRate: parseFloat(orderData.discountRate) || (orderData.couponApplied ? (orderData.game === 'Valorant' ? 44 : 15) : 0)
                };
                const clientReferenceString = JSON.stringify(clientReference);
                console.log('client_reference_id:', { length: clientReferenceString.length, value: clientReferenceString });

                if (clientReferenceString.length > 200) {
                    console.error('client_reference_id too long:', clientReferenceString.length);
                    alert('Order data is too complex. Please simplify your selection (e.g., fewer extras).');
                    return;
                }

                const updatedOrderData = {
                    ...orderData,
                    currentLP: currentLP,
                    desiredLP: desiredLP,
                    currentMasterLP: parseInt(orderData.currentMasterLP) || 0,
                    desiredMasterLP: parseInt(orderData.desiredMasterLP) || 0,
                    currentRR: parseInt(orderData.currentRR) || 0,
                    desiredRR: parseInt(orderData.desiredRR) || 0,
                    game: orderData.game || 'Valorant',
                    discountRate: parseFloat(orderData.discountRate) || (orderData.couponApplied ? (orderData.game === 'Valorant' ? 44 : 15) : 0)
                };

                console.log('Requesting Stripe Checkout Session with:', { orderData: updatedOrderData, userId, type: 'boost' });
                const response = await fetch('/api/create-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderData: updatedOrderData, userId, type: 'boost' })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Failed to create checkout session:', errorData);
                    alert(`Failed to initiate payment: ${errorData.error || 'Unknown error'}`);
                    window.location.href = '/checkout';
                    return;
                }

                const session = await response.json();
                console.log('Checkout Session created:', session);

                const { error } = await stripe.redirectToCheckout({ sessionId: session.id });
                if (error) {
                    console.error('Stripe redirectToCheckout error:', error.message, error);
                    alert(`Payment error: ${error.message}. Please try again or contact support.`);
                    window.location.href = '/checkout';
                }
            } catch (error) {
                console.error('Checkout error:', error.message, error.stack);
                alert(`An error occurred while processing your payment: ${error.message}. Please try again or contact support.`);
                window.location.href = '/checkout';
            }
        });

        proceedButton.addEventListener('mousedown', () => {
            console.log('Pay Now button mousedown at:', new Date().toISOString());
        });
    }
})();