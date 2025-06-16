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
    if (!window.ranks || !window.divisions) {
        console.log('window.ranks or window.divisions not defined, using default values');
        const couponInput = document.querySelector('#coupon-input');
        const couponApplied = couponInput && couponInput.value.trim().toUpperCase() === 'SAVE15';
        return { basePrice: '0.00', totalPrice: '0.00', cashback: '0.00', activeExtras: [], couponApplied };
    }

    if (!window.currentRank || !window.desiredRank) {
        console.log('Missing ranks for price calculation');
        return { basePrice: '0.00', totalPrice: '0.00', cashback: '0.00', activeExtras: [], couponApplied: false };
    }

    const isHighRank = rank => rank === 'Immortal';

    const currentRankIndex = window.ranks.indexOf(window.currentRank);
    const desiredRankIndex = window.ranks.indexOf(window.desiredRank);
    const currentDivisionIndex = isHighRank(window.currentRank) ? 0 :
        (window.divisions.indexOf(window.currentDivision) >= 0 ? window.divisions.indexOf(window.currentDivision) : -1);
    const desiredDivisionIndex = isHighRank(window.desiredRank) ? 0 :
        (window.divisions.indexOf(window.desiredDivision) >= 0 ? window.divisions.indexOf(window.desiredDivision) : -1);

    if (currentRankIndex === -1 || desiredRankIndex === -1 || currentDivisionIndex === -1 || desiredDivisionIndex === -1) {
        console.log('Invalid rank or division:', {
            currentRank: window.currentRank,
            desiredRank: window.desiredRank,
            currentDivision: window.currentDivision,
            desiredDivision: window.desiredDivision
        });
        return { basePrice: '0.00', totalPrice: '0.00', cashback: '0.00', activeExtras: [], couponApplied: false };
    }

    if (desiredRankIndex < currentRankIndex || (desiredRankIndex === currentRankIndex && desiredDivisionIndex <= currentDivisionIndex && window.currentRank !== 'Immortal')) {
        console.log('Desired rank is not higher than current rank');
        return { basePrice: '0.00', totalPrice: '0.00', cashback: '0.00', activeExtras: [], couponApplied: false };
    }

    if (window.currentRank === 'Immortal' && window.desiredRank === 'Immortal') {
        const currentRR = parseInt(window.currentRR) || 0;
        const desiredRR = parseInt(window.desiredRR) || 0;
        if (desiredRR <= currentRR || (desiredRR - currentRR) < 40) {
            console.log('Invalid RR: Desired RR must be at least 40 higher than current RR');
            return { basePrice: '0.00', totalPrice: '0.00', cashback: '0.00', activeExtras: [], couponApplied: false };
        }
    }

    let divisionCount = 0;
    let currentRank = currentRankIndex;
    let currentDiv = currentDivisionIndex;

    while (currentRank < desiredRankIndex || (currentRank === desiredRankIndex && currentDiv < desiredDivisionIndex)) {
        divisionCount++;
        currentDiv++;
        if (currentDiv >= window.divisions.length || currentRank === window.ranks.length - 1) {
            currentDiv = 0;
            currentRank++;
        }
    }

    const avgRankIndex = Math.min(currentRankIndex + Math.floor((desiredRankIndex - currentRankIndex) / 2), window.ranks.length - 1);
    const rankMultiplier = pricingConfig.rankMultipliers[window.ranks[avgRankIndex]] || 1.0;
    let basePrice = divisionCount * pricingConfig.basePricePerDivision * rankMultiplier;

    if (window.currentRank === 'Immortal' && window.desiredRank === 'Immortal') {
        const rrDifference = (parseInt(window.desiredRR) || 0) - (parseInt(window.currentRR) || 0);
        basePrice = (rrDifference / 40) * pricingConfig.basePricePerDivision * pricingConfig.rankMultipliers.Immortal;
    } else {
        const rrDiscount = pricingConfig.rrDiscounts[window.currentLP] || 0;
        basePrice *= (1 - rrDiscount);
    }

    const activeExtras = [];
    document.querySelectorAll('.extra-option input[data-price]:checked').forEach(checkbox => {
        const pricePercent = parseFloat(checkbox.dataset.price) / 100;
        if (pricePercent > 0) {
            const label = checkbox.closest('.extra-option').querySelector('div:not(.option-label)')?.textContent.trim();
            activeExtras.push({ name: label || 'Unknown', cost: pricePercent });
        }
    });

    let extraCost = 0;
    activeExtras.forEach(extra => {
        extraCost += basePrice * extra.cost;
    });

    let totalPrice = basePrice + extraCost;

    const couponInput = document.querySelector('#coupon-input');
    const couponApplied = couponInput && couponInput.value.trim().toUpperCase() === 'SAVE15';
    if (couponApplied) {
        totalPrice *= (1 - pricingConfig.couponDiscount);
    }

    totalPrice = Math.max(totalPrice, 0);
    const cashback = totalPrice * 0.025;

    console.log('Price calculation:', {
        divisionCount,
        rankMultiplier,
        basePrice,
        rrDiscount: window.currentRank === 'Immortal' ? 0 : pricingConfig.rrDiscounts[window.currentLP],
        activeExtras,
        extraCost,
        couponApplied,
        totalPrice,
        cashback
    });

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

    sessionStorage.setItem('orderData', JSON.stringify({
        currentRank: window.currentRank,
        currentDivision: window.currentDivision,
        desiredRank: window.desiredRank,
        desiredDivision: window.desiredDivision,
        currentLP: window.currentLP,
        currentRR: window.currentRR,
        desiredRR: window.desiredRR,
        basePrice: priceData.basePrice,
        totalPrice: priceData.totalPrice,
        finalPrice: priceData.finalPrice,
        cashback: priceData.cashback,
        extras: priceData.activeExtras,
        couponApplied: priceData.couponApplied,
        discount: priceData.discount
    }));
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Valorant services initialized');

    const couponInput = document.querySelector('#coupon-input');
    if (couponInput) {
        couponInput.value = 'SAVE15';
        console.log('Coupon auto-filled: SAVE15');
    }

    window.updateTotalPrice = updatePriceDisplay;

    document.querySelectorAll('.extra-option input[data-price]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const label = checkbox.closest('.extra-option').querySelector('div:not(.option-label)')?.textContent.trim();
            console.log('Extra option changed:', label || 'Unknown', checkbox.checked);
            updatePriceDisplay();
        });
    });

    if (couponInput) {
        couponInput.addEventListener('input', () => {
            console.log('Coupon input changed:', couponInput.value);
            updatePriceDisplay();
        });
    }

    const couponButton = document.querySelector('.coupon-apply');
    if (couponButton) {
        couponButton.addEventListener('click', () => {
            console.log('Coupon button clicked:', couponInput.value);
            updatePriceDisplay();
        });
    }

    const deferPriceUpdate = () => {
        if (window.ranks && window.divisions) {
            console.log('window.ranks and window.divisions loaded, updating price');
            updatePriceDisplay();
        } else {
            console.log('Deferring price update, waiting for window.ranks and window.divisions');
            setTimeout(deferPriceUpdate, 50);
        }
    };

    deferPriceUpdate();
});