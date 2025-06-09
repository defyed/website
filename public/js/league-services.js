(function () {
    document.addEventListener('DOMContentLoaded', () => {
        initializeFormListeners();
        initializeProceedButton();
    });

    function initializeFormListeners() {
        const selects = [
            'select[name="current-rank"]',
            'select[name="current-division"]',
            'select[name="desired-rank"]',
            'select[name="desired-division"]',
            'select[name="current-lp"]',
            'select[name="queue-type"]',
            'select[name="server-type"]',
            'input[name="current-master-lp"]',
            'input[name="desired-master-lp"]'
        ];
        selects.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) {
                el.addEventListener('change', updateOrderData);
            }
        });

        document.querySelectorAll('.option-toggle').forEach(checkbox => {
            checkbox.addEventListener('change', updateOrderData);
        });

        const couponInput = document.querySelector('#coupon-input');
        if (couponInput) {
            couponInput.addEventListener('input', updateOrderData);
        }

        document.querySelectorAll('.rank-btn, .division-btn, #current-lp-select').forEach(el => {
            el.addEventListener('click', () => setTimeout(updateOrderData, 100));
        });

        updateOrderData();
    }

    function updateOrderData() {
        const currentRank = window.currentRank || document.querySelector('select[name="current-rank"]')?.value || 'Silver';
        const currentDivision = window.currentDivision || document.querySelector('select[name="current-division"]')?.value || (currentRank === 'Master' ? '' : 'I');
        const desiredRank = window.desiredRank || document.querySelector('select[name="desired-rank"]')?.value || 'Gold';
        const desiredDivision = window.desiredDivision || document.querySelector('select[name="desired-division"]')?.value || (desiredRank === 'Master' ? '' : 'IV');
        const currentLP = window.currentLP || document.querySelector('select[name="current-lp"]')?.value || '0-20';
        const currentMasterLP = parseInt(document.querySelector('input[name="current-master-lp"]')?.value) || 0;
        const desiredMasterLP = parseInt(document.querySelector('input[name="desired-master-lp"]')?.value) || 0;

        const extras = [];
        document.querySelectorAll('.option-toggle:checked').forEach(checkbox => {
            const label = checkbox.closest('.option-row')?.querySelector('span')?.textContent.trim() || checkbox.value;
            const price = parseFloat(checkbox.dataset.price) || 0;
            extras.push({ label, price });
        });

        const couponInput = document.querySelector('#coupon-input');
        const validCouponCode = 'BOOST15';
        const couponApplied = couponInput?.value.trim().toUpperCase() === validCouponCode;
        const discount = couponApplied ? 0.15 : 0;

        let basePrice = calculateBasePrice();
        if (!basePrice || isNaN(basePrice)) {
            console.warn('Invalid basePrice, defaulting to 0:', basePrice);
            basePrice = 0;
        }

        let totalPrice = basePrice;
        extras.forEach(extra => {
            if (extra.price > 0) {
                totalPrice *= (1 + extra.price / 100);
            }
        });

        let timeTaxPercentage = 0;
        const rankDistance = calculateRankDistance(currentRank, desiredRank);
        if (totalPrice > 0 && (rankDistance === 3 || (desiredRank === 'Master' && ['Silver', 'Gold', 'Platinum'].includes(currentRank)))) {
            timeTaxPercentage = 10;
            totalPrice *= 1.10;
        }

        let masterFee = 0;
        if (totalPrice > 0 && desiredRank === 'Master') {
            const startRankIndex = rankOrder.indexOf(currentRank);
            if (startRankIndex >= 0 && startRankIndex <= 5) {
                const multiplier = ['Iron', 'Bronze', 'Silver', 'Gold'].includes(currentRank) ? 25 :
                                  currentRank === 'Platinum' ? 40 : currentRank === 'Emerald' ? 50 : 0;
                masterFee = rankDistance * multiplier;
                totalPrice += masterFee;
            }
        }

        const finalPrice = totalPrice * (1 - discount);
        const cashback = finalPrice * 0.03;

        const orderData = {
            currentRank: currentRank + (currentDivision && currentRank !== 'Master' ? ' ' + currentDivision : ''),
            desiredRank: desiredRank + (desiredDivision && desiredRank !== 'Master' ? ' ' + desiredDivision : ''),
            currentDivision: currentDivision || '',
            desiredDivision: desiredDivision || '',
            currentLP,
            currentMasterLP,
            desiredMasterLP,
            extras,
            couponApplied,
            discount,
            basePrice: basePrice.toFixed(2),
            totalPrice: totalPrice.toFixed(2),
            finalPrice: finalPrice.toFixed(2),
            cashback: cashback.toFixed(2)
        };

        const originalPriceEl = document.querySelector('.original-price');
        const discountedPriceEl = document.querySelector('.discounted-price');
        const discountRateEl = document.querySelector('.discount-rate');
        const cashbackOffer = document.querySelector('.cashback-offer p');
        if (originalPriceEl && discountedPriceEl && discountRateEl && cashbackOffer) {
            if (couponApplied) {
                originalPriceEl.textContent = `$${totalPrice.toFixed(2)}`;
                originalPriceEl.classList.add('strikethrough');
                discountedPriceEl.textContent = `$${finalPrice.toFixed(2)}`;
                discountedPriceEl.style.display = 'block';
                discountRateEl.textContent = `Discount active -${discount * 100}%`;
                discountRateEl.className = 'discount-rate coupon-active';
            } else {
                originalPriceEl.textContent = `$${finalPrice.toFixed(2)}`;
                originalPriceEl.classList.remove('strikethrough');
                discountedPriceEl.style.display = 'none';
                discountRateEl.textContent = 'Enter a valid coupon code';
                discountRateEl.className = 'discount-rate';
            }
            cashbackOffer.textContent = `Get $${cashback.toFixed(2)} cashback on your purchase`;
        }

        sessionStorage.setItem('orderData', JSON.stringify(orderData));
        console.log('orderData saved:', JSON.stringify(orderData, null, 2));
    }

    function initializeProceedButton() {
        const proceedButton = document.querySelector('.proceed-payment');
        if (!proceedButton || proceedButton.dataset.initialized) {
            console.log('Proceed to Payment button already initialized or not found');
            return;
        }

        proceedButton.dataset.initialized = 'true';
        console.log('Initializing Proceed to Payment button at:', new Date().toISOString());

        proceedButton.disabled = false;
        proceedButton.style.pointerEvents = 'auto';
        proceedButton.style.cursor = 'pointer';
        proceedButton.style.opacity = '1';

        proceedButton.addEventListener('click', () => {
            console.log('Proceed to Payment button clicked at:', new Date().toISOString());
            const orderData = JSON.parse(sessionStorage.getItem('orderData')) || {};
            if (!orderData.currentRank || !orderData.desiredRank || !orderData.finalPrice) {
                showErrorPopup('Please select ranks and options before proceeding.');
                console.log('Incomplete orderData:', orderData);
                return;
            }

            const currentMasterLP = parseInt(orderData.currentMasterLP) || 0;
            const desiredMasterLP = parseInt(orderData.desiredMasterLP) || 0;
            if (orderData.currentRank.startsWith('Master') && orderData.desiredRank.startsWith('Master')) {
                if (desiredMasterLP <= currentMasterLP || (desiredMasterLP - currentMasterLP) < 40) {
                    showErrorPopup('Target Master LP must be at least 40 LP higher than Current Master LP.');
                    return;
                }
            }

            // Check if user is logged in
            const userId = localStorage.getItem('userId');
            if (!userId) {
                // Trigger login popup
                const loginPopup = document.getElementById('loginPopup');
                if (loginPopup) {
                    loginPopup.style.display = 'flex';
                    console.log('Login popup displayed due to missing userId');
                } else {
                    showErrorPopup('Please sign in to proceed with your order.');
                }
                return;
            }

            sessionStorage.setItem('orderData', JSON.stringify(orderData));
            window.location.href = '/checkout.html';
        });

        // Check URL for reset password params
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('userId') && urlParams.has('token')) {
            const resetPasswordPopup = document.getElementById('reset-password-popup');
            if (resetPasswordPopup) {
                resetPasswordPopup.style.display = 'flex';
                console.log('Reset password popup displayed due to URL params');
            }
        }
    }

    // Helper to show error popup (reusing your existing error-popup)
    function showErrorPopup(message) {
        const errorPopup = document.createElement('div');
        errorPopup.className = 'error-popup active';
        errorPopup.innerHTML = `
            <div class="error-content">
                <span class="warning-icon"></span>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(errorPopup);
        setTimeout(() => {
            errorPopup.style.opacity = '0';
            setTimeout(() => errorPopup.remove(), 300);
        }, 3000);
    }

    const script = document.createElement('script');
    script.text = `
        ${calculateBasePrice.toString()}
        ${calculateRankDistance.toString()}
        ${calculateMasterLPCost.toString()}
        ${getLPDiscount.toString()}
        ${getRankUpLPDiscount.toString()}
        window.rankOrder = ${JSON.stringify(rankOrder)};
        window.divisionOrder = ${JSON.stringify(divisionOrder)};
        window.priceData = ${JSON.stringify(priceData)};
    `;
    document.head.appendChild(script);
})();