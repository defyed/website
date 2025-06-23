(function () {
    const ranks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal'];
    const divisions = ['I', 'II', 'III'];
    const pricingConfig = {
        basePricePerDivision: 2.00,
        rankMultipliers: {
            Iron: 1.0,
            Bronze: 1.2,
            Silver: 1.4,
            Gold: 1.6,
            Platinum: 1.8,
            Diamond: 2.0,
            Ascendant: 2.2,
            Immortal: 2.5
        },
        rrDiscounts: {
            '0-20': 0.10,
            '21-40': 0.08,
            '41-60': 0.05,
            '61-80': 0.03,
            '81-100': 0.00
        },
        couponDiscount: 0.15
    };

    function calculatePrice() {
        const currentRank = document.querySelector('select[name="current-rank"]')?.value || 'Iron';
        const desiredRank = document.querySelector('select[name="desired-rank"]')?.value || 'Bronze';
        const currentDivision = document.querySelector('select[name="current-division"]')?.value || 'I';
        const desiredDivision = document.querySelector('select[name="desired-division"]')?.value || 'I';
        const currentRR = document.querySelector('select[name="current-rr"]')?.value || '0-20';
        const currentImmortalRR = parseInt(document.querySelector('input[name="current-immortal-rr"]')?.value) || 0;
        const desiredImmortalRR = parseInt(document.querySelector('input[name="desired-immortal-rr"]')?.value) || 0;
        

        const isHighRank = rank => rank === 'Immortal';
        const currentRankIndex = ranks.indexOf(currentRank);
        const desiredRankIndex = ranks.indexOf(desiredRank);
        const currentDivisionIndex = isHighRank(currentRank) ? 0 : divisions.indexOf(currentDivision);
        const desiredDivisionIndex = isHighRank(desiredRank) ? 0 : divisions.indexOf(desiredDivision);

        if (currentRankIndex === -1 || desiredRankIndex === -1 || currentDivisionIndex === -1 || desiredDivisionIndex === -1) {
            console.log('Invalid rank or division:', { currentRank, desiredRank, currentDivision, desiredDivision });
            return { basePrice: '0.00', totalPrice: '0.00', cashback: '0.00', activeExtras: [], couponApplied: false };
        }

        if (desiredRankIndex < currentRankIndex || (desiredRankIndex === currentRankIndex && desiredDivisionIndex <= currentDivisionIndex && !isHighRank(currentRank))) {
            console.log('Desired rank is not higher than current rank');
            return { basePrice: '0.00', totalPrice: '0.00', cashback: '0.00', activeExtras: [], couponApplied: false };
        }

        if (isHighRank(currentRank) && isHighRank(desiredRank)) {
            if (desiredImmortalRR <= currentImmortalRR || (desiredImmortalRR - currentImmortalRR) < 40) {
                console.log('Invalid RR: Desired RR must be at least 40 higher than current RR');
                return { basePrice: '0.00', totalPrice: '0.00', cashback: '0.00', activeExtras: [], couponApplied: false };
            }
        }

        let divisionCount = 0;
        let currentRankIdx = currentRankIndex;
        let currentDivIdx = currentDivisionIndex;

        while (currentRankIdx < desiredRankIndex || (currentRankIdx === desiredRankIndex && currentDivIdx < desiredDivisionIndex)) {
            divisionCount++;
            currentDivIdx++;
            if (currentDivIdx >= divisions.length || currentRankIdx === ranks.length - 1) {
                currentDivIdx = 0;
                currentRankIdx++;
            }
        }

        const avgRankIndex = Math.min(currentRankIndex + Math.floor((desiredRankIndex - currentRankIndex) / 2), ranks.length - 1);
        const rankMultiplier = pricingConfig.rankMultipliers[ranks[avgRankIndex]] || 1.0;
        let basePrice = divisionCount * pricingConfig.basePricePerDivision * rankMultiplier;

        if (isHighRank(currentRank) && isHighRank(desiredRank)) {
            const rrDifference = desiredImmortalRR - currentImmortalRR;
            basePrice = (rrDifference / 40) * pricingConfig.basePricePerDivision * pricingConfig.rankMultipliers.Immortal;
        } else {
            const rrDiscount = pricingConfig.rrDiscounts[currentRR] || 0;
            basePrice *= (1 - rrDiscount);
        }

        const activeExtras = [];
        document.querySelectorAll('.extra-option input[data-price]:checked').forEach(checkbox => {
            const pricePercent = parseFloat(checkbox.dataset.price) / 100;
            if (pricePercent > 0) {
                const label = checkbox.closest('.extra-option')?.querySelector('div:not(.option-label)')?.textContent.trim() || 'Unknown';
                activeExtras.push({ name: label, cost: pricePercent });
            }
        });

        let extraCost = 0;
        activeExtras.forEach(extra => {
            extraCost += basePrice * extra.cost;
        });

        let totalPrice = basePrice + extraCost;

        const couponInput = document.querySelector('#coupon-input');
        const couponApplied = couponInput?.value.trim().toUpperCase() === 'SAVE15';
        if (couponApplied) {
            totalPrice *= (1 - pricingConfig.couponDiscount);
        }

        totalPrice = Math.max(totalPrice, 0);
        const cashback = totalPrice * 0.025;

        return {
            basePrice: basePrice.toFixed(2),
            totalPrice: totalPrice.toFixed(2),
            finalPrice: totalPrice.toFixed(2),
            cashback: cashback.toFixed(2),
            activeExtras,
            couponApplied,
            discount: couponApplied ? pricingConfig.couponDiscount : 0
        };
    }

    function updatePriceDisplay() {
        const priceData = calculatePrice();
        const currentRank = document.querySelector('select[name="current-rank"]')?.value || 'Iron';
        const desiredRank = document.querySelector('select[name="desired-rank"]')?.value || 'Bronze';
        const currentDivision = document.querySelector('select[name="current-division"]')?.value || 'I';
        const desiredDivision = document.querySelector('select[name="desired-division"]')?.value || 'I';
        const currentRR = document.querySelector('select[name="current-rr"]')?.value || '0-20';
        const currentImmortalRR = parseInt(document.querySelector('input[name="current-immortal-rr"]')?.value) || 0;
        const desiredImmortalRR = parseInt(document.querySelector('input[name="desired-immortal-rr"]')?.value) || 0;

        const orderData = {
            currentRank: currentRank + (currentDivision && !isHighRank(currentRank) ? ' ' + currentDivision : ''),
            desiredRank: desiredRank + (desiredDivision && !isHighRank(desiredRank) ? ' ' + desiredDivision : ''),
            currentDivision: currentDivision || '',
            desiredDivision: desiredDivision || '',
            currentLP: currentRR,
            currentRR: currentImmortalRR,
            desiredRR: desiredImmortalRR,
            basePrice: priceData.basePrice,
            totalPrice: priceData.totalPrice,
            finalPrice: priceData.finalPrice,
            cashback: priceData.cashback,
            extras: priceData.activeExtras.map(extra => ({ label: extra.name, price: extra.cost * 100 })),
            couponApplied: priceData.couponApplied,
            discount: priceData.discount,
            game: 'Valorant'
        };

        sessionStorage.setItem('orderData', JSON.stringify(orderData));
        console.log('orderData saved:', JSON.stringify(orderData, null, 2));

        const originalPriceElement = document.querySelector('.original-price');
        const discountedPriceElement = document.querySelector('.discounted-price');
        const cashbackElement = document.querySelector('.cashback-offer p');
        const couponElement = document.querySelector('.discount-rate');

        if (originalPriceElement) {
            originalPriceElement.textContent = `$${priceData.basePrice}`;
            originalPriceElement.classList.toggle('strikethrough', priceData.couponApplied || priceData.totalPrice !== priceData.basePrice);
        }
        if (discountedPriceElement) {
            discountedPriceElement.textContent = `$${priceData.totalPrice}`;
        }
        if (cashbackElement) {
            cashbackElement.textContent = `Get $${priceData.cashback} cashback on your purchase`;
        }
        if (couponElement) {
            couponElement.textContent = priceData.couponApplied ? 'Coupon active -15%' : 'Coupon isn\'t active';
            couponElement.classList.toggle('coupon-active', priceData.couponApplied);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        console.log('Valorant services initialized');
        const couponInput = document.querySelector('#coupon-input');
        if (couponInput) {
            couponInput.value = 'SAVE15';
            console.log('Coupon auto-filled: SAVE15');
        }

        document.querySelectorAll('select[name="current-rank"], select[name="desired-rank"], select[name="current-division"], select[name="desired-division"], select[name="current-rr"], input[name="current-immortal-rr"], input[name="desired-immortal-rr"], .extra-option input[data-price], #coupon-input').forEach(element => {
            element.addEventListener('change', updatePriceDisplay);
        });

        const couponButton = document.querySelector('.coupon-apply');
        if (couponButton) {
            couponButton.addEventListener('click', updatePriceDisplay);
        }

        updatePriceDisplay();
    });
})();


document.addEventListener('DOMContentLoaded', async () => {
    const couponInput = document.getElementById('coupon-code');
    if (!couponInput) return;
    try {
        const response = await fetch('/api/coupons/latest?game=valorant');
        if (!response.ok) throw new Error('No coupon found');
        const coupon = await response.json();
        if (coupon && coupon.code) {
            couponInput.value = coupon.code;
            const event = new Event('input');
            couponInput.dispatchEvent(event);  // Trigger any bound listeners
        }
    } catch (e) {
        console.warn('No active coupon to prefill:', e.message);
    }
});
