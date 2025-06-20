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

        // Define rank lists
        const valorantRanks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
        const leagueRanks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'];
        const normalizedCurrentRank = orderData.currentRank ? orderData.currentRank.split(' ')[0] : '';
        const normalizedDesiredRank = orderData.desiredRank ? orderData.desiredRank.split(' ')[0] : '';

        // Respect game type from orderData if valid, otherwise infer
        if (orderData.game && ['League of Legends', 'Valorant'].includes(orderData.game)) {
            console.log(`Game type set to ${orderData.game} based on orderData.game`);
        } else {
            if (valorantRanks.includes(normalizedCurrentRank) && valorantRanks.includes(normalizedDesiredRank)) {
                orderData.game = 'Valorant';
                console.log(`Inferred game type as Valorant based on ranks: ${normalizedCurrentRank}, ${normalizedDesiredRank}`);
            } else if (leagueRanks.includes(normalizedCurrentRank) && leagueRanks.includes(normalizedDesiredRank)) {
                orderData.game = 'League of Legends';
                console.log(`Inferred game type as League of Legends based on ranks: ${normalizedCurrentRank}, ${normalizedDesiredRank}`);
            } else {
                orderData.game = 'League of Legends'; // Default to League
                console.warn(`Could not infer game type from ranks (${normalizedCurrentRank}, ${normalizedDesiredRank}). Defaulting to League of Legends.`);
            }
        }

        const updateSummary = () => {
            try {
                // Helper function to avoid duplicating division and handle Master/Immortal ranks
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
                if (currentLPElement) {
                    currentLPElement.textContent = `Current ${orderData.game === 'Valorant' ? 'RR' : 'LP'}: ${orderData.currentLP || 'N/A'}`;
                }

                // Conditionally display Master LP/RR and hide for Master-to-Master or Immortal-to-Immortal
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
                    const discount = parseFloat(orderData.discount) || (orderData.couponApplied ? 0.15 : 0);
                    const totalPrice = parseFloat(orderData.totalPrice) || (discount > 0 ? finalPrice / (1 - discount) : finalPrice);
                    const basePrice = parseFloat(orderData.basePrice) || totalPrice - (orderData.extras?.reduce((acc, e) => acc + parseFloat(e.cost || e.price || 0), 0) || 0);
                    const discountAmount = totalPrice * discount;

                    subtotalElement.textContent = `$${totalPrice.toFixed(2)}`;
                    discountElement.textContent = `$${discountAmount.toFixed(2)}`;
                    totalElement.textContent = `$${finalPrice.toFixed(2)}`;
                    console.log('Order summary updated:', { basePrice, totalPrice, discount, discountAmount, finalPrice });
                }
            } catch (error) {
                console.error('Error updating order summary:', error);
                const subtotalElement = document.getElementById('subtotal');
                const discountElement = document.getElementById('discount');
                const totalElement = document.getElementById('total');
                const masterLpElement = document.getElementById('MasterLP');
                const lpDetailsElement = document.getElementById('lp-details');

                if (subtotalElement) subtotalElement.textContent = '$0.00';
                if (discountElement) discountElement.textContent = '$0.00';
                if (totalElement) totalElement.textContent = '$0.00';
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
                // Handle LP/RR for Master/Immortal ranks
                const isMasterOrImmortal = (rank) => ['Master', 'Immortal'].includes((rank || '').split(' ')[0]);
                const currentLP = isMasterOrImmortal(orderData.currentRank) 
                    ? (parseInt(orderData.currentMasterLP) || parseInt(orderData.currentRR) || 0)
                    : (orderData.currentLP || '0-20');
                const desiredLP = isMasterOrImmortal(orderData.desiredRank) 
                    ? (parseInt(orderData.desiredMasterLP) || parseInt(orderData.desiredRR) || 0)
                    : (parseInt(orderData.desiredLP) || 0);

                const clientReference = {
                    currentRank: orderData.currentRank || 'Iron',
                    desiredRank: orderData.desiredRank || 'Iron',
                    finalPrice: parseFloat(orderData.finalPrice) || 0,
                    basePrice: parseFloat(orderData.basePrice || orderData.totalPrice || orderData.finalPrice) || 0,
                    discount: parseFloat(orderData.discount) || (orderData.couponApplied ? 0.15 : 0),
                    couponApplied: orderData.couponApplied || false,
                    currentDivision: orderData.currentDivision || '',
                    desiredDivision: orderData.desiredDivision || '',
                    currentLP: currentLP,
                    desiredLP: desiredLP,
                    currentMasterLP: parseInt(orderData.currentMasterLP) || 0,
                    desiredMasterLP: parseInt(orderData.desiredMasterLP) || 0,
                    currentRR: parseInt(orderData.currentRR) || 0,
                    desiredRR: parseInt(orderData.desiredRR) || 0,
                    extras: orderData.extras || [],
                    game: orderData.game
                };
                const clientReferenceString = JSON.stringify(clientReference);
                console.log('client_reference_id:', { length: clientReferenceString.length, value: clientReferenceString });

                // Update orderData for server request
                const updatedOrderData = {
                    ...orderData,
                    currentLP: currentLP,
                    desiredLP: desiredLP,
                    currentMasterLP: parseInt(orderData.currentMasterLP) || 0,
                    desiredMasterLP: parseInt(orderData.desiredMasterLP) || 0,
                    currentRR: parseInt(orderData.currentRR) || 0,
                    desiredRR: parseInt(orderData.desiredRR) || 0,
                    game: orderData.game
                };

                console.log('Requesting Stripe Checkout Session with:', { orderData: updatedOrderData, userId });
                const response = await fetch('/api/create-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderData: updatedOrderData, userId })
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