(function () {
    document.addEventListener('DOMContentLoaded', async () => {
        await prefillLatestCoupon();

        sessionStorage.removeItem('orderData');
        console.log('Cleared sessionStorage.orderData on load');
        initializeFormListeners();
        initializeProceedButton();
        updateOrderData();
    });

    function initializeFormListeners() {
        const selectors = [
            'select[name="current-rank"]',
            'select[name="current-division"]',
            'select[name="desired-rank"]',
            'select[name="desired-division"]',
            'select[name="current-lp"]',
            'input[name="current-master-lp"]',
            'input[name="desired-master-lp"]',
            '#coupon-input'
        ];

        selectors.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) {
                el.addEventListener('change', updateOrderData);
            }
        });

        document.querySelectorAll('.option-toggle').forEach(cb => {
            cb.addEventListener('change', updateOrderData);
        });
    }

    async function updateOrderData() {
        const game = 'valorant';

        const couponInput = document.querySelector('#coupon-input');
        const couponCode = couponInput?.value.trim().toUpperCase();
        let discount = 0;
        let couponApplied = false;

        if (couponCode) {
            try {
                const res = await fetch(`/api/validate-coupon?code=${encodeURIComponent(couponCode)}&game=valorant`);
                const result = await res.json();
                if (res.ok && result.valid) {
                    discount = result.discount;
                    couponApplied = true;
                    console.log('Coupon applied:', discount);
                } else {
                    console.warn('Invalid coupon:', result.message);
                }
            } catch (err) {
                console.error('Error validating coupon:', err.message);
            }
        }

        const priceElement = document.getElementById('total-price');
        const basePrice = parseFloat(priceElement?.getAttribute('data-original-price')) || 0;
        const finalPrice = basePrice * (1 - discount / 100);

        if (priceElement) {
            priceElement.textContent = `$${finalPrice.toFixed(2)}`;
        }

        const orderData = {
            currentRank: document.querySelector('select[name="current-rank"]')?.value || '',
            currentDivision: document.querySelector('select[name="current-division"]')?.value || '',
            desiredRank: document.querySelector('select[name="desired-rank"]')?.value || '',
            desiredDivision: document.querySelector('select[name="desired-division"]')?.value || '',
            currentLP: document.querySelector('select[name="current-lp"]')?.value || '',
            currentMasterLP: parseInt(document.querySelector('input[name="current-master-lp"]')?.value || 0),
            desiredMasterLP: parseInt(document.querySelector('input[name="desired-master-lp"]')?.value || 0),
            extras: [],
            couponApplied,
            discount,
            basePrice: basePrice.toFixed(2),
            totalPrice: basePrice.toFixed(2),
            finalPrice: finalPrice.toFixed(2),
            cashback: (finalPrice * 0.03).toFixed(2),
            game,
            desiredLP: 0,
            currentRR: 0,
            desiredRR: 0
        };

        sessionStorage.setItem('orderData', JSON.stringify(orderData));
        console.log('orderData saved:', orderData);
    }

    async function prefillLatestCoupon() {
        try {
            const res = await fetch('/api/coupons/latest?game=valorant');
            const data = await res.json();
            if (data.success && data.code) {
                const couponInput = document.getElementById('coupon-input');
                if (couponInput) {
                    couponInput.value = data.code;
                }
            }
        } catch (err) {
            console.warn('Failed to prefill coupon:', err.message);
        }
    }

function initializeProceedButton() {
        const button = document.querySelector('.proceed-payment');
        if (!button || button.dataset.initialized) return;

        button.dataset.initialized = 'true';
        button.disabled = false;
        button.style.pointerEvents = 'auto';
        button.style.cursor = 'pointer';
        button.style.opacity = '1';

        button.addEventListener('click', () => {
            const orderData = JSON.parse(sessionStorage.getItem('orderData') || '{}');
            if (!orderData.currentRank || !orderData.desiredRank || !orderData.finalPrice) {
                alert('Please complete the order form.');
                return;
            }
            const userId = localStorage.getItem('userId');
            if (!userId) {
                alert('Please log in.');
                return;
            }
            window.location.href = '/checkout.html';
        });
    }
})();
