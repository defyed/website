const priceData = {
    "Iron I": { "Iron II": 3.18 },
    "Iron II": { "Iron III": 3.18 },
    "Iron III": { "Bronze I": 3.18 },
    "Bronze I": { "Bronze II": 3.18 },
    "Bronze II": { "Bronze III": 3.18 },
    "Bronze III": { "Silver I": 3.18 },
    "Silver I": { "Silver II": 4.78 },
    "Silver II": { "Silver III": 5.18 },
    "Silver III": { "Gold I": 5.57 },
    "Gold I": { "Gold II": 5.97 },
    "Gold II": { "Gold III": 6.37 },
    "Gold III": { "Platinum I": 7.17 },
    "Platinum I": { "Platinum II": 7.96 },
    "Platinum II": { "Platinum III": 9.96 },
    "Platinum III": { "Diamond I": 11.95 },
    "Diamond I": { "Diamond II": 16.82 },
    "Diamond II": { "Diamond III": 18.93},
    "Diamond III": { "Ascendant I": 29.44 },
    "Ascendant I": { "Ascendant II": 40.65 },
    "Ascendant II": { "Ascendant III": 45.43 },
    "Ascendant III": { "Immortal": 52.60 },
    "Immortal": { "Immortal": 25.35 }
};

const rankOrder = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal'];
const divisionOrder = ['I', 'II', 'III'];

function getRRDiscount(rrRange) {
    const discounts = {
        '0-20': 0,
        '21-40': 20,
        '41-60': 25,
        '61-80': 34,
        '81-100': 50
    };
    return discounts[rrRange] || 0;
}

function getRankUpRRDiscount(rrRange) {
    const discounts = {
        '0-20': 5,
        '21-40': 10,
        '41-60': 15,
        '61-80': 20,
        '81-100': 35
    };
    return discounts[rrRange] || 0;
}

function calculateImmortalRRCost(rrDifference) {
    if (!rrDifference || rrDifference < 40) return 0;
    const basePrice = 25.35; // Base price for 40 RR
    const additionalRR = rrDifference - 40; // RR points beyond 40
    const additionalCost = additionalRR * 0.65; // $0.65 per additional RR
    return basePrice + additionalCost;
}

function calculateRankDistance(startRank, endRank) {
    if (startRank === 'Immortal' && endRank === 'Immortal') {
        console.log('No rank distance for Immortal-to-Immortal boost');
        return 0;
    }
    const startRankIndex = rankOrder.indexOf(startRank);
    const endRankIndex = rankOrder.indexOf(endRank);
    if (startRankIndex === -1 || endRankIndex === -1) {
        console.error('Invalid ranks:', startRank, endRank);
        return 0;
    }
    if (startRankIndex > endRankIndex) {
        console.log('Invalid progression (backward)');
        return 0;
    }
    const distance = endRankIndex - startRankIndex + 1;
    console.log(`Rank distance from ${startRank} to ${endRank}: ${distance} ranks`);
    return distance;
}

function calculateBasePrice() {
    const startRank = window.currentRank || 'Iron';
    const startDivision = window.currentDivision || 'I';
    const endRank = window.desiredRank || 'Iron';
    const endDivision = window.desiredDivision || 'II';
    const rrRange = window.currentLP && ['0-20', '21-40', '41-60', '61-80', '81-100'].includes(window.currentLP) ? window.currentLP : '0-20';

    console.log('Calculating price for:', startRank, startDivision, 'to', endRank, endDivision, 'RR:', rrRange);

    const startRankIndex = rankOrder.indexOf(startRank);
    const endRankIndex = rankOrder.indexOf(endRank);
    const startDivIndex = startRank === 'Immortal' ? 0 : divisionOrder.indexOf(startDivision);
    const endDivIndex = endRank === 'Immortal' ? 0 : divisionOrder.indexOf(endDivision);

    if (startRankIndex === -1 || endRankIndex === -1 || startDivIndex === -1 || endDivIndex === -1) {
        console.error('Invalid rank or division:', startRank, startDivision, endRank, endDivision);
        return 0;
    }

    let totalPrice = 0;
    const currentRR = window.currentRR || 0;
    const desiredRR = window.desiredRR || 0;

    if (startRank === 'Immortal' && endRank === 'Immortal') {
        if (desiredRR <= currentRR) {
            console.log('Immortal to Immortal, desired RR <= current RR, price: 0');
            return 0;
        }
        const rrDifference = desiredRR - currentRR;
        totalPrice = calculateImmortalRRCost(rrDifference);
        console.log(`Immortal to Immortal, RR difference: ${rrDifference}, Price: $${totalPrice.toFixed(2)}`);
    } else if (endRank === 'Immortal') {
        if (startRank !== 'Immortal') {
            if (startDivIndex < divisionOrder.length - 1) {
                for (let i = startDivIndex; i < divisionOrder.length - 1; i++) {
                    const current = `${startRank} ${divisionOrder[i]}`;
                    const next = `${startRank} ${divisionOrder[i + 1]}`;
                    const stepPrice = priceData[current]?.[next] || 0;
                    console.log(`Step 1: ${current} to ${next} = $${stepPrice}`);
                    totalPrice += stepPrice;
                }
            }
            for (let i = startRankIndex; i < rankOrder.indexOf('Ascendant'); i++) {
                const current = `${rankOrder[i]} ${divisionOrder[divisionOrder.length - 1]}`;
                const next = `${rankOrder[i + 1]} ${divisionOrder[0]}`;
                const stepPrice = priceData[current]?.[next] || 0;
                console.log(`Step 2: ${current} to ${next} = $${stepPrice}`);
                totalPrice += stepPrice;
                if (i < rankOrder.indexOf('Ascendant') - 1) {
                    for (let j = 0; j < divisionOrder.length - 1; j++) {
                        const currentDiv = `${rankOrder[i + 1]} ${divisionOrder[j]}`;
                        const nextDiv = `${rankOrder[i + 1]} ${divisionOrder[j + 1]}`;
                        const divStepPrice = priceData[currentDiv]?.[nextDiv] || 0;
                        console.log(`Step 2 (intermediate): ${currentDiv} to ${nextDiv} = $${divStepPrice}`);
                        totalPrice += divStepPrice;
                    }
                }
            }
            const ascendantToImmortalPrice = priceData[`Ascendant ${divisionOrder[divisionOrder.length - 1]}`]?.["Immortal"] || 0;
            console.log(`Ascendant ${divisionOrder[divisionOrder.length - 1]} to Immortal: $${ascendantToImmortalPrice}`);
            totalPrice += ascendantToImmortalPrice;
        }
        const rrCost = calculateImmortalRRCost(desiredRR);
        console.log(`Immortal RR cost (${desiredRR}): $${rrCost.toFixed(2)}`);
        totalPrice += rrCost;
    } else if (startRank === 'Immortal') {
        console.log('Cannot boost from Immortal to lower rank, price: 0');
        return 0;
    } else if (startRankIndex === endRankIndex) {
        if (startDivIndex >= endDivIndex) {
            console.log('Same rank, start division <= end division, price: 0');
            return 0;
        }
        for (let i = startDivIndex; i < endDivIndex; i++) {
            const current = `${startRank} ${divisionOrder[i]}`;
            const next = `${startRank} ${divisionOrder[i + 1]}`;
            const stepPrice = priceData[current]?.[next] || 0;
            console.log(`Step (same rank): ${current} to ${next} = $${stepPrice}`);
            totalPrice += stepPrice;
        }
    } else {
        if (startDivIndex < divisionOrder.length - 1) {
            for (let i = startDivIndex; i < divisionOrder.length - 1; i++) {
                const current = `${startRank} ${divisionOrder[i]}`;
                const next = `${startRank} ${divisionOrder[i + 1]}`;
                const stepPrice = priceData[current]?.[next] || 0;
                console.log(`Step 1: ${current} to ${next} = $${stepPrice}`);
                totalPrice += stepPrice;
            }
        }
        for (let i = startRankIndex; i < endRankIndex; i++) {
            const current = `${rankOrder[i]} ${divisionOrder[divisionOrder.length - 1]}`;
            const nextRank = rankOrder[i + 1];
            const targetDivision = i + 1 === endRankIndex ? endDivision : divisionOrder[0];
            const next = `${nextRank} ${targetDivision}`;
            let stepPrice = priceData[current]?.[next] || 0;
            if (stepPrice === 0 || i + 1 < endRankIndex) {
                const nextStart = `${nextRank} ${divisionOrder[0]}`;
                stepPrice = priceData[current]?.[nextStart] || 0;
                console.log(`Step 2: ${current} to ${nextStart} = $${stepPrice}`);
                totalPrice += stepPrice;
                if (i + 1 < endRankIndex) {
                    for (let j = 0; j < divisionOrder.length - 1; j++) {
                        const currentDiv = `${nextRank} ${divisionOrder[j]}`;
                        const nextDiv = `${nextRank} ${divisionOrder[j + 1]}`;
                        const divStepPrice = priceData[currentDiv]?.[nextDiv] || 0;
                        console.log(`Step 2 (intermediate): ${currentDiv} to ${nextDiv} = $${divStepPrice}`);
                        totalPrice += divStepPrice;
                    }
                }
                if (i + 1 === endRankIndex && targetDivision !== divisionOrder[0]) {
                    const targetDivIndex = divisionOrder.indexOf(targetDivision);
                    for (let j = 0; j < targetDivIndex; j++) {
                        const currentDiv = `${nextRank} ${divisionOrder[j]}`;
                        const nextDiv = `${nextRank} ${divisionOrder[j + 1]}`;
                        const divStepPrice = priceData[currentDiv]?.[nextDiv] || 0;
                        console.log(`Step 2 (final): ${currentDiv} to ${nextDiv} = $${divStepPrice}`);
                        totalPrice += divStepPrice;
                    }
                }
            } else {
                console.log(`Step 2: ${current} to ${next} = $${stepPrice}`);
                totalPrice += stepPrice;
            }
        }
    }

    let rrDiscount = 0;
    if (startRank !== 'Immortal' && endRank !== 'Immortal') {
        if (startRankIndex === endRankIndex) {
            rrDiscount = getRRDiscount(rrRange);
            console.log('Same-rank RR discount:', rrDiscount, '%');
        } else if (endRankIndex === startRankIndex + 1 && startDivision === divisionOrder[divisionOrder.length - 1] && endDivision === divisionOrder[0]) {
            rrDiscount = getRankUpRRDiscount(rrRange);
            console.log('Rank-up RR discount:', rrDiscount, '%');
        }
    }
    totalPrice *= (1 - rrDiscount / 100);
    console.log(`Base Price: $${totalPrice.toFixed(2)}, RR Discount: ${rrDiscount}%`);
    return totalPrice;
}

function validateImmortalRR() {
    const currentRR = window.currentRR || 0;
    const desiredRR = window.desiredRR || 0;
    if (window.currentRank === 'Immortal' && window.desiredRank === 'Immortal') {
        if (desiredRR <= currentRR) {
            return { isValid: false, message: "Target RR must be higher than Current RR" };
        }
        if (desiredRR - currentRR < 40) {
            return { isValid: false, message: "Minimum 40 RR difference required" };
        }
    }
    return { isValid: true, message: "" };
}

function showErrorPopup(message) {
    console.log('Showing error popup:', message);
    const existingPopups = document.querySelectorAll('.error-popup');
    existingPopups.forEach(popup => {
        popup.classList.remove('active');
        setTimeout(() => popup.parentNode?.removeChild(popup), 300);
    });
    const popup = document.createElement('div');
    popup.className = 'error-popup';
    popup.innerHTML = `
        <div class="error-content">
            <span class="warning-icon"></span>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add('active'), 10);
    setTimeout(() => {
        popup.classList.remove('active');
        setTimeout(() => popup.parentNode?.removeChild(popup), 300);
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function updateTotalPrice() {
    const extraToggles = document.querySelectorAll('.option-toggle');
    let basePrice = calculateBasePrice();
    let totalPrice = basePrice;

    if (isNaN(totalPrice) || totalPrice < 0) {
        console.error('Invalid total price:', totalPrice, 'Base Price:', basePrice);
        totalPrice = 0;
    }

    let toggleMultipliers = [];
    let extras = [];
    extraToggles.forEach(toggle => {
        if (toggle.checked) {
            const percentage = parseFloat(toggle.dataset.price);
            const multiplier = percentage > 0 ? 1 + percentage / 100 : 1;
            totalPrice *= multiplier;
            const label = toggle.closest('.option-row')?.querySelector('span')?.textContent.trim() || 'unknown';
            toggleMultipliers.push(`${label}: ${percentage}%`);
            extras.push({ label, percentage });
        }
    });

    let originalPrice = totalPrice;
    let finalPrice = totalPrice;
    let discountRate = 0;
    let couponMessage = '';
    let isCouponApplied = false;

    const couponInput = document.querySelector('#coupon-input');
    if (couponInput && couponInput.value.trim().toUpperCase() === 'SAVE44') {
        discountRate = 44;
        couponMessage = `Coupon applied -${discountRate}%`;
        isCouponApplied = true;
    } else {
        couponMessage = 'Enter a valid coupon code';
        isCouponApplied = false;
    }

    finalPrice *= (1 - discountRate / 100);
    const cashback = finalPrice * 0.025;

    console.log(`Price Update: Base: $${basePrice.toFixed(2)}, Toggles: [${toggleMultipliers.join(', ')}], Total: $${totalPrice.toFixed(2)}, Discount: ${discountRate}%, Final: $${finalPrice.toFixed(2)}, Cashback: $${cashback.toFixed(2)}, Coupon: ${couponMessage}, Extras:`, extras);

    const originalPriceDisplay = document.querySelector('.original-price');
    const discountedPriceDisplay = document.querySelector('.discounted-price');
    const discountRateDisplay = document.querySelector('.discount-rate');
    const cashbackDisplay = document.querySelector('.cashback-offer p');
    if (originalPriceDisplay && discountedPriceDisplay && discountRateDisplay && cashbackDisplay) {
        if (isCouponApplied) {
            originalPriceDisplay.textContent = `$${originalPrice.toFixed(2)}`;
            originalPriceDisplay.classList.add('strikethrough');
            originalPriceDisplay.classList.remove('no-strikethrough');
            discountedPriceDisplay.textContent = `$${finalPrice.toFixed(2)}`;
            discountedPriceDisplay.style.display = 'block';
            discountRateDisplay.textContent = couponMessage;
            discountRateDisplay.classList.add('coupon-active');
        } else {
            originalPriceDisplay.textContent = `$${finalPrice.toFixed(2)}`;
            originalPriceDisplay.classList.remove('strikethrough');
            originalPriceDisplay.classList.add('no-strikethrough');
            discountedPriceDisplay.style.display = 'none';
            discountRateDisplay.textContent = couponMessage;
            discountRateDisplay.classList.remove('coupon-active');
        }
        cashbackDisplay.textContent = `Get $${cashback.toFixed(2)} cashback on your purchase`;
    } else {
        console.warn('Price or cashback elements not found');
    }

    const orderData = {
        currentRank: window.currentRank || 'Iron',
        currentDivision: window.currentDivision || 'I',
        desiredRank: window.desiredRank || 'Iron',
        desiredDivision: window.desiredDivision || 'II',
        currentLP: window.currentLP || '0-20',
        currentRR: window.currentRR || 0,
        desiredRR: window.desiredRR || 0,
        finalPrice: finalPrice.toFixed(2),
        extras,
        couponApplied: isCouponApplied
    };
    sessionStorage.setItem('orderData', JSON.stringify(orderData));
    console.log('Order data saved:', orderData);
}

const debouncedUpdateTotalPrice = debounce(updateTotalPrice, 100);

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, setting up listeners');

    const couponInput = document.querySelector('#coupon-input');
    if (couponInput) {
        couponInput.value = 'SAVE44';
        console.log('Coupon auto-filled: SAVE44');
    }

    document.querySelectorAll('.option-toggle').forEach(checkbox => {
        console.log('checkbox', checkbox)
        checkbox.addEventListener('change', () => {
            console.log('Extra option changed:', checkbox.closest('.option-row')?.querySelector('span')?.textContent.trim() || 'unknown', checkbox.checked);
            debouncedUpdateTotalPrice();
        });
    });

    if (couponInput) {
        couponInput.addEventListener('input', () => {
            console.log('Coupon changed:', couponInput.value);
            debouncedUpdateTotalPrice();
        });
    }

    const couponApplyBtn = document.querySelector('.coupon-apply');
    if (couponApplyBtn) {
        couponApplyBtn.addEventListener('click', () => {
            console.log('Coupon apply clicked:', couponInput.value);
            debouncedUpdateTotalPrice();
        });
    }

    const rrDropdown = document.querySelector('#current-lp-select');
    if (rrDropdown) {
        rrDropdown.value = '0-20';
        rrDropdown.addEventListener('change', () => {
            window.currentLP = rrDropdown.value;
            console.log('RR dropdown changed:', window.currentLP);
            debouncedUpdateTotalPrice();
        });
    }

    document.querySelectorAll('.ls-current-league-group .rank-btn').forEach(button => {
        button.addEventListener('click', () => {
            const rank = button.dataset.rank;
            if (rank && rank !== window.currentRank) {
                window.currentRank = rank;
                window.currentDivision = rank === 'Immortal' ? '' : 'III';
                window.currentRR = rank === 'Immortal' ? 0 : window.currentRR;
                console.log('Current rank changed:', window.currentRank, 'Division:', window.currentDivision, 'RR:', window.currentRR);
                debouncedUpdateTotalPrice();
            }
        });
    });

    document.querySelectorAll('.ls-current-league-group .division-btn').forEach(button => {
        button.addEventListener('click', () => {
            const division = button.dataset.division;
            if (division && division !== window.currentDivision && window.currentRank !== 'Immortal') {
                window.currentDivision = division;
                console.log('Current division changed:', window.currentDivision);
                debouncedUpdateTotalPrice();
            }
        });
    });

    document.querySelectorAll('.ls-target-league-group .rank-btn').forEach(button => {
        button.addEventListener('click', () => {
            const rank = button.dataset.rank;
            if (rank && rank !== window.desiredRank) {
                const currentRankIndex = rankOrder.indexOf(window.currentRank);
                const desiredRankIndex = rankOrder.indexOf(rank);
                if (desiredRankIndex < currentRankIndex) {
                    showErrorPopup('Target rank must be higher than current rank');
                    return;
                }
                window.desiredRank = rank;
                window.desiredDivision = rank === 'Immortal' ? '' : 'III';
                window.desiredRR = rank === 'Immortal' ? 0 : window.desiredRR;
                console.log('Desired rank changed:', window.desiredRank, 'Division:', window.desiredDivision, 'RR:', window.desiredRR);
                debouncedUpdateTotalPrice();
            }
        });
    });

    document.querySelectorAll('.ls-target-league-group .division-btn').forEach(button => {
        button.addEventListener('click', () => {
            const division = button.dataset.division;
            if (division && division !== window.desiredDivision && window.desiredRank !== 'Immortal') {
                window.desiredDivision = division;
                console.log('Desired division changed:', window.desiredDivision);
                debouncedUpdateTotalPrice();
            }
        });
    });

    document.querySelectorAll('.current-rr-input input, .desired-rr-input input').forEach(input => {
        input.addEventListener('input', () => {
            console.log('RR input changed');
            window.currentRR = parseInt(document.querySelector('.current-rr-input input')?.value) || 0;
            window.desiredRR = parseInt(document.querySelector('.desired-rr-input input')?.value) || 0;
            debouncedUpdateTotalPrice();
        });
    });

    const proceedPaymentBtn = document.querySelector('.proceed-payment');
    if (proceedPaymentBtn) {
        proceedPaymentBtn.addEventListener('click', () => {
            console.log('Proceed to payment clicked');
            const validation = validateImmortalRR();
            if (!validation.isValid) {
                console.log('Validation error:', validation.message);
                showErrorPopup(validation.message);
                return;
            }
            debouncedUpdateTotalPrice();
            window.location.href = '/checkout';
        });
    }

    setTimeout(() => {
        console.log('Initial price calculation');
        debouncedUpdateTotalPrice();
    }, 500);
});

window.updateTotalPrice = debouncedUpdateTotalPrice;