document.addEventListener('DOMContentLoaded', () => {
    const couponInput = document.querySelector('#coupon-input');
    let fallbackCode = 'BOOST15';
    let fallbackDiscount = 15;
    let latestCode = fallbackCode;
    let latestDiscount = fallbackDiscount;

    fetch('/api/coupons/latest?game=league')
        .then(res => res.json())
        .then(data => {
            if (data.code) {
                latestCode = data.code;
                latestDiscount = parseFloat(data.discount);
                console.log('League coupon loaded from server:', latestCode, latestDiscount);
            } else {
                console.warn('No league coupon found in DB, using fallback');
            }
        })
        .catch(() => console.warn('Error loading league coupon. Using fallback.'))
        .finally(() => {
            if (couponInput) couponInput.value = latestCode;

            window.getLeagueDiscount = (inputCode) => {
                return inputCode?.toUpperCase() === latestCode.toUpperCase()
                    ? latestDiscount / 100
                    : 0;
            };

            if (typeof updatePrice === 'function') {
                updatePrice(); // Only call after coupon is loaded
            }
        });
});

document.addEventListener('DOMContentLoaded', async () => {
    const couponInput = document.querySelector('#coupon-input');
    let fallbackCode = 'BOOST15';
    let fallbackDiscount = 15;
    let defaultCouponCode = fallbackCode;
    let defaultDiscount = fallbackDiscount;

    try {
        const res = await fetch('/api/coupons/latest?game=league');
        if (res.ok) {
            const data = await res.json();
            defaultCouponCode = data.code;
            defaultDiscount = parseFloat(data.discount);
            console.log('League coupon loaded:', defaultCouponCode, defaultDiscount);
        }
    } catch (err) {
        console.warn('Using fallback League coupon');
    }

    if (couponInput) couponInput.value = defaultCouponCode;

    // Hook into price calculation logic
    window.getLeagueDiscount = (inputCode) => {
        return inputCode?.toUpperCase() === defaultCouponCode.toUpperCase()
            ? defaultDiscount / 100
            : 0;
    };
});

const priceData = {
    "Iron IV": { "Iron III": 3.50 },
    "Iron III": { "Iron II": 3.50 },
    "Iron II": { "Iron I": 3.50 },
    "Iron I": { "Bronze IV": 4.00 },
    "Bronze IV": { "Bronze III": 4.25 },
    "Bronze III": { "Bronze II": 4.25 },
    "Bronze II": { "Bronze I": 4.25 },
    "Bronze I": { "Silver IV": 4.75 },
    "Silver IV": { "Silver III": 5.25 },
    "Silver III": { "Silver II": 5.50 },
    "Silver II": { "Silver I": 6.25 },
    "Silver I": { "Gold IV": 8.20 },
    "Gold IV": { "Gold III": 9.00 },
    "Gold III": { "Gold II": 9.50 },
    "Gold II": { "Gold I": 10.50 },
    "Gold I": { "Platinum IV": 13.25 },
    "Platinum IV": { "Platinum III": 14.50 },
    "Platinum III": { "Platinum II": 15.50 },
    "Platinum II": { "Platinum I": 16.50 },
    "Platinum I": { "Emerald IV": 22.00 },
    "Emerald IV": { "Emerald III": 23.50 },
    "Emerald III": { "Emerald II": 25.50 },
    "Emerald II": { "Emerald I": 28.00 },
    "Emerald I": { "Diamond IV": 31.50 },
    "Diamond IV": { "Diamond III": 42.50 },
    "Diamond III": { "Diamond II": 59.50 },
    "Diamond II": { "Diamond I": 79.00 },
    "Diamond I": { "Master": 105.50 },
};

const rankOrder = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master'];
const divisionOrder = ['IV', 'III', 'II', 'I'];

// Initialize state
window.currentRank = 'Silver';
window.currentDivision = 'I';
window.desiredRank = 'Gold';
window.desiredDivision = 'IV';
window.currentLP = '0-20';

function getLPDiscount(lpRange) {
    const discounts = {
        '0-20': 0,
        '21-40': 20,
        '41-60': 25,
        '61-80': 34,
        '81-100': 50
    };
    return discounts[lpRange] || 0;
}

function getRankUpLPDiscount(lpRange) {
    const discounts = {
        '0-20': 5,
        '21-40': 10,
        '41-60': 15,
        '61-80': 20,
        '81-100': 35
    };
    return discounts[lpRange] || 0;
}

function calculateMasterLPCost(lpDifference) {
    if (!lpDifference || lpDifference <= 0) return 0;
    return lpDifference * 2.25; // $2.25 per LP
}

function calculateRankDistance(startRank, endRank) {
    if (startRank === 'Master' && endRank === 'Master') {
        console.log('No rank distance for Master-to-Master boost');
        return 0;
    }

    const startRankIndex = rankOrder.indexOf(startRank);
    const endRankIndex = rankOrder.indexOf(endRank);

    if (startRankIndex === -1 || endRankIndex === -1) {
        console.error('Invalid ranks for distance calculation:', startRank, endRank);
        return 0;
    }

    if (startRankIndex > endRankIndex) {
        console.log('Invalid progression (backward), no distance');
        return 0;
    }

    const distance = endRankIndex - startRankIndex + 1;
    console.log(`Rank distance from ${startRank} to ${endRank}: ${distance} ranks`);
    return distance;
}

function calculateBasePrice() {
    const startRank = window.currentRank || 'Silver';
    const startDivision = window.currentDivision || 'I';
    const endRank = window.desiredRank || 'Gold';
    const endDivision = window.desiredDivision || 'I';
    const lpRange = window.currentLP && ['0-20', '21-40', '41-60', '61-80', '81-100'].includes(window.currentLP) ? window.currentLP : '0-20';

    console.log('Calculating price for:', startRank, startDivision, 'to', endRank, endDivision, 'LP:', lpRange);

    const startRankIndex = rankOrder.indexOf(startRank);
    const endRankIndex = rankOrder.indexOf(endRank);
    const startDivIndex = startRank === 'Master' ? 0 : divisionOrder.indexOf(startDivision);
    const endDivIndex = endRank === 'Master' ? 0 : divisionOrder.indexOf(endDivision);

    if (startRankIndex === -1 || endRankIndex === -1 || startDivIndex === -1 || endDivIndex === -1) {
        console.error('Invalid rank or division:', startRank, startDivision, endRank, endDivision);
        return 0;
    }

    console.log('Indices:', startRankIndex, startDivIndex, 'to', endRankIndex, endDivIndex);

    let totalPrice = 0;

    const currentMasterLPInput = document.querySelector('.current-master-lp .master-lp-input');
    const desiredMasterLPInput = document.querySelector('.desired-master-lp .master-lp-input');
    const currentMasterLP = currentMasterLPInput ? parseInt(currentMasterLPInput.value) || 0 : 0;
    const desiredMasterLP = desiredMasterLPInput ? parseInt(desiredMasterLPInput.value) || 0 : 0;

    if (startRank === 'Master' && endRank === 'Master') {
        if (desiredMasterLP <= currentMasterLP) {
            console.log('Master to Master, desired LP <= current LP, price: 0');
            return 0;
        }
        const lpDifference = desiredMasterLP - currentMasterLP;
        totalPrice = calculateMasterLPCost(lpDifference);
        console.log(`Master to Master, LP difference: ${lpDifference}, Price: $${totalPrice.toFixed(2)}`);
    } else if (endRank === 'Master') {
        if (startRank !== 'Master') {
            for (let i = startDivIndex; i < divisionOrder.length - 1; i++) {
                const current = `${startRank} ${divisionOrder[i]}`;
                const next = `${startRank} ${divisionOrder[i + 1]}`;
                const stepPrice = priceData[current]?.[next] || 0;
                console.log(`Step 1: ${current} to ${next} = $${stepPrice}`);
                totalPrice += stepPrice;
            }
            for (let i = startRankIndex; i < rankOrder.indexOf('Diamond'); i++) {
                const current = `${rankOrder[i]} I`;
                const next = `${rankOrder[i + 1]} IV`;
                const stepPrice = priceData[current]?.[next] || 0;
                console.log(`Step 2: ${current} to ${next} = $${stepPrice}`);
                totalPrice += stepPrice;
                if (i < rankOrder.indexOf('Diamond') - 1) {
                    for (let j = 0; j < divisionOrder.length - 1; j++) {
                        const currentDiv = `${rankOrder[i + 1]} ${divisionOrder[j]}`;
                        const nextDiv = `${rankOrder[i + 1]} ${divisionOrder[j + 1]}`;
                        const divStepPrice = priceData[currentDiv]?.[nextDiv] || 0;
                        console.log(`Step 2 (intermediate climb): ${currentDiv} to ${nextDiv} = $${divStepPrice}`);
                        totalPrice += divStepPrice;
                    }
                }
            }
            const diamondIToMasterPrice = priceData["Diamond I"]?.["Master"] || 0;
            console.log(`Diamond I to Master: $${diamondIToMasterPrice}`);
            totalPrice += diamondIToMasterPrice;
        }
        const lpDifference = desiredMasterLP - currentMasterLP;
        const masterLPCost = calculateMasterLPCost(lpDifference);
        console.log(`Master LP difference (${lpDifference}): $${masterLPCost.toFixed(2)}`);
        totalPrice += masterLPCost;
    } else if (startRank === 'Master') {
        console.log('Cannot boost from Master to a lower rank, price: 0');
        return 0;
    } else if (startRankIndex === endRankIndex) {
        if (startRank === 'Master') {
            console.log('Same rank (Master), handled above, price: 0');
            return 0;
        }
        if (startDivIndex >= endDivIndex) {
            console.log('Same rank, start division >= end division, price: 0');
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
        // Step 1: Climb divisions in start rank
        if (startRank !== 'Master' && startDivIndex < divisionOrder.length - 1) {
            for (let i = startDivIndex; i < divisionOrder.length - 1; i++) {
                const current = `${startRank} ${divisionOrder[i]}`;
                const next = `${startRank} ${divisionOrder[i + 1]}`;
                const stepPrice = priceData[current]?.[next] || 0;
                console.log(`Step 1: ${current} to ${next} = $${stepPrice}`);
                totalPrice += stepPrice;
            }
        }

        // Step 2: Climb through ranks and their divisions
        for (let i = startRankIndex; i < endRankIndex; i++) {
            const current = `${rankOrder[i]} I`;
            const nextRank = rankOrder[i + 1];
            const targetDivision = i + 1 === endRankIndex ? endDivision : 'I';
            let next = `${nextRank} ${targetDivision}`;
            let stepPrice = priceData[current]?.[next] || 0;

            // If direct transition is undefined, assume transition to IV then climb
            if (stepPrice === 0 || i + 1 < endRankIndex) {
                next = `${nextRank} IV`;
                stepPrice = priceData[current]?.[next] || 0;
                console.log(`Step 2: ${current} to ${next} = $${stepPrice}`);
                totalPrice += stepPrice;

                // Climb divisions in intermediate ranks to I
                if (i + 1 < endRankIndex) {
                    for (let j = 0; j < divisionOrder.length - 1; j++) {
                        const currentDiv = `${nextRank} ${divisionOrder[j]}`;
                        const nextDiv = `${nextRank} ${divisionOrder[j + 1]}`;
                        const divStepPrice = priceData[currentDiv]?.[nextDiv] || 0;
                        console.log(`Step 2 (intermediate climb): ${currentDiv} to ${nextDiv} = $${divStepPrice}`);
                        totalPrice += divStepPrice;
                    }
                }
                // Climb divisions in final rank to target division
                if (i + 1 === endRankIndex && targetDivision !== 'IV') {
                    const targetDivIndex = divisionOrder.indexOf(targetDivision);
                    for (let j = 0; j < targetDivIndex; j++) {
                        const currentDiv = `${nextRank} ${divisionOrder[j]}`;
                        const nextDiv = `${nextRank} ${divisionOrder[j + 1]}`;
                        const divStepPrice = priceData[currentDiv]?.[nextDiv] || 0;
                        console.log(`Step 2 (final climb): ${currentDiv} to ${nextDiv} = $${divStepPrice}`);
                        totalPrice += divStepPrice;
                    }
                }
            } else {
                console.log(`Step 2: ${current} to ${next} = $${stepPrice}`);
                totalPrice += stepPrice;
            }
        }
    }

    // Apply LP discount based on rank transition
    let lpDiscount = 0;
    if (startRank === 'Master' || endRank === 'Master') {
        console.log('No LP discount for Master rank');
    } else if (startRank === endRank) {
        lpDiscount = getLPDiscount(lpRange);
        console.log('Applying same rank LP discount:', lpDiscount, '%');
    } else if (endRankIndex === startRankIndex + 1 && startDivision === 'I' && endDivision === 'IV') {
        lpDiscount = getRankUpLPDiscount(lpRange);
        console.log('Applying rank up LP discount (I to IV):', lpDiscount, '%');
    } else {
        console.log('No LP discount for different rank transition');
    }

    console.log('Base Price before LP discount:', totalPrice);
    totalPrice *= (1 - lpDiscount / 100);
    console.log(`LP Discount: ${lpDiscount}%, Discounted Price: $${totalPrice.toFixed(2)}`);
    return totalPrice;
}

function validateMasterLP() {
    const currentMasterLPInput = document.querySelector('.current-master-lp .master-lp-input');
    const desiredMasterLPInput = document.querySelector('.desired-master-lp .master-lp-input');
    const currentMasterLP = currentMasterLPInput ? parseInt(currentMasterLPInput.value) || 0 : 0;
    const desiredMasterLP = desiredMasterLPInput ? parseInt(desiredMasterLPInput.value) || 0 : 0;

    // Only enforce 40 LP minimum for Master-to-Master boosts
    if (window.currentRank === 'Master' && window.desiredRank === 'Master') {
        if (desiredMasterLP <= currentMasterLP) {
            return { isValid: false, message: "Target Master LP must be higher than Current Master LP" };
        }
        const lpDifference = desiredMasterLP - currentMasterLP;
        if (lpDifference < 40) {
            return { isValid: false, message: "Minimum 40 LP difference required between Current and Target Master LP" };
        }
    }

    return { isValid: true, message: "" };
}

function showErrorPopup(message) {
    console.log('Showing error popup with message:', message);

    const existingPopups = document.querySelectorAll('.error-popup');
    existingPopups.forEach(popup => {
        popup.classList.remove('active');
        setTimeout(() => {
            if (popup.parentNode) popup.parentNode.removeChild(popup);
        }, 300);
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
        setTimeout(() => {
            if (popup.parentNode) popup.parentNode.removeChild(popup);
        }, 300);
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
    const optionToggles = document.querySelectorAll('.option-toggle');
    let basePrice = calculateBasePrice();
    let totalPrice = basePrice;

    if (isNaN(totalPrice) || totalPrice < 0) {
        console.error('Invalid total price:', totalPrice, 'Base Price:', basePrice);
        totalPrice = 0;
    }

    let toggleMultipliers = [];
    let extras = [];
    optionToggles.forEach(toggle => {
        if (toggle.checked) {
            const percentage = parseFloat(toggle.dataset.price);
            if (percentage > 0) {
                const multiplier = 1 + percentage / 100;
                totalPrice *= multiplier;
                const label = toggle.closest('.option-row')?.querySelector('span')?.textContent.trim() || 'unknown';
                toggleMultipliers.push(`${label}: ${percentage}%`);
                extras.push({ label, percentage });
            }
        }
    });

    let timeTaxPercentage = 0;
    const startRank = window.currentRank || 'Silver';
    const endRank = window.desiredRank || 'Gold';

    if (totalPrice > 0) {
        const rankDistance = calculateRankDistance(startRank, endRank);
        if (rankDistance === 3 || (endRank === 'Master' && ['Silver', 'Gold', 'Platinum'].includes(startRank))) {
            timeTaxPercentage = 10;
            totalPrice *= 1.10;
            console.log(`Applying 10% time tax for ${startRank} to ${endRank} (distance: ${rankDistance}): $${totalPrice.toFixed(2)}`);
        } else {
            console.log(`No time tax for rank distance of ${rankDistance} from ${startRank} to ${endRank}`);
        }
    }

    let masterFee = 0;
    if (totalPrice > 0 && endRank === 'Master') {
        const rankDistance = calculateRankDistance(startRank, endRank);
        const startRankIndex = rankOrder.indexOf(startRank);
        if (startRankIndex >= 0 && startRankIndex <= 5) {
            let multiplier;
            if (['Iron', 'Bronze', 'Silver', 'Gold'].includes(startRank)) {
                multiplier = 25;
            } else if (startRank === 'Platinum') {
                multiplier = 40;
            } else if (startRank === 'Emerald') {
                multiplier = 50;
            }
            masterFee = rankDistance * multiplier;
            totalPrice += masterFee;
            console.log(`Applying Master rank distance fee for ${startRank} to Master: ${rankDistance} ranks x $${multiplier} = $${masterFee.toFixed(2)}`);
        } else {
            console.log(`Skipping Master fee for ${startRank} to Master`);
        }
    } else {
        console.log(`No Master fee (end rank is ${endRank})`);
    }

    let originalPrice = totalPrice;
    let finalPrice = totalPrice;
    let discountRate = 0; // Default to no discount
    let couponMessage = '';
    let isCouponActive = false;

    // Check coupon code
    const couponInput = document.querySelector('#coupon-input');
    const validCouponCode = 'BOOST15';
    if (couponInput && couponInput.value.trim().toUpperCase() === validCouponCode) {
        discountRate = 15; // Apply 15% discount for valid code
        couponMessage = `Discount active -${discountRate}%`;
        isCouponActive = true;
    } else {
        couponMessage = 'Enter a valid coupon code';
        isCouponActive = false;
    }

    finalPrice = totalPrice * (1 - discountRate / 100);

    const cashback = finalPrice * 0.03;

    console.log(`Price Update: Base: $${basePrice.toFixed(2)}, Toggles: [${toggleMultipliers.join(', ')}], Time Tax: ${timeTaxPercentage}%, Master Fee: $${masterFee.toFixed(2)}, Total: $${totalPrice.toFixed(2)}, Discount: ${discountRate}%, Final: $${finalPrice.toFixed(2)}, Cashback: $${cashback.toFixed(2)}, Coupon: ${couponMessage}, Extras:`, extras);

    const originalPriceElement = document.querySelector('.original-price');
    const discountedPriceElement = document.querySelector('.discounted-price');
    const discountRateElement = document.querySelector('.discount-rate');
    const cashbackOffer = document.querySelector('.cashback-offer p');
    if (originalPriceElement && discountedPriceElement && discountRateElement && cashbackOffer) {
        if (isCouponActive) {
            originalPriceElement.textContent = `$${originalPrice.toFixed(2)}`;
            originalPriceElement.classList.add('strikethrough');
            originalPriceElement.classList.remove('no-strikethrough');
            discountedPriceElement.textContent = `$${finalPrice.toFixed(2)}`;
            discountedPriceElement.style.display = 'block';
            discountRateElement.textContent = couponMessage;
            discountRateElement.className = 'discount-rate coupon-active';
        } else {
            originalPriceElement.textContent = `$${finalPrice.toFixed(2)}`;
            originalPriceElement.classList.remove('strikethrough');
            originalPriceElement.classList.add('no-strikethrough');
            discountedPriceElement.style.display = 'none';
            discountRateElement.textContent = couponMessage;
            discountRateElement.className = 'discount-rate';
        }
        cashbackOffer.textContent = `Get $${cashback.toFixed(2)} cashback on your purchase`;
    } else {
        console.warn('Price or cashback elements not found in DOM');
    }

    // Store order data for checkout
    const currentMasterLPInput = document.querySelector('.current-master-lp .master-lp-input');
    const desiredMasterLPInput = document.querySelector('.desired-master-lp .master-lp-input');
    const orderData = {
        currentRank: window.currentRank || 'Silver',
        currentDivision: window.currentDivision || 'I',
        desiredRank: window.desiredRank || 'Gold',
        desiredDivision: window.desiredDivision || 'IV',
        currentLP: window.currentLP || '0-20',
        currentMasterLP: currentMasterLPInput ? parseInt(currentMasterLPInput.value) || 0 : 0,
        desiredMasterLP: desiredMasterLPInput ? parseInt(desiredMasterLPInput.value) || 0 : 0,
        finalPrice: finalPrice.toFixed(2),
        extras: extras,
        couponApplied: isCouponActive
    };
    sessionStorage.setItem('orderData', JSON.stringify(orderData));
    console.log('Order data saved to sessionStorage:', orderData);
}

const debouncedUpdateTotalPrice = debounce(updateTotalPrice, 100);

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, setting up event listeners');

    // Set defaults
    window.currentRank = 'Silver';
    window.currentDivision = 'I';
    window.desiredRank = 'Gold';
    window.desiredDivision = 'IV';
    window.currentLP = '0-20';

    // Auto-fill coupon input
    const couponInput = document.querySelector('#coupon-input');
    if (couponInput) {
        couponInput.value = 'BOOST15'; // Auto-fill with valid coupon code
        console.log('Coupon input auto-filled with BOOST15');
    } else {
        console.warn('Coupon input element not found (#coupon-input)');
    }

    // Option toggles
    document.querySelectorAll('.option-toggle').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            console.log('Option toggle changed:', checkbox.closest('.option-row')?.querySelector('span')?.textContent.trim() || 'unknown', checkbox.checked);
            debouncedUpdateTotalPrice();
        });
    });

    // Coupon input event listener
    if (couponInput) {
        couponInput.addEventListener('input', () => {
            console.log('Coupon input changed:', couponInput.value);
            debouncedUpdateTotalPrice();
        });
    }

    // LP dropdown
    const lpDropdown = document.querySelector('#current-lp-select') || document.querySelector('#lp-range');
    if (lpDropdown) {
        lpDropdown.value = '0-20';
        lpDropdown.addEventListener('change', () => {
            window.currentLP = lpDropdown.value;
            console.log('LP dropdown changed:', window.currentLP);
            debouncedUpdateTotalPrice();
        });
    } else {
        console.warn('LP dropdown element not found (#current-lp-select or #lp-range)');
    }

    // Rank and division buttons
    document.querySelectorAll('.ls-current-rank .rank-btn').forEach(button => {
        button.addEventListener('click', () => {
            const rank = button.dataset.rank;
            if (rank && rank !== window.currentRank) {
                window.currentRank = rank;
                window.currentDivision = rank === 'Master' ? '' : 'I';
                console.log('Current rank changed:', window.currentRank, 'Division:', window.currentDivision);
                debouncedUpdateTotalPrice();
            }
        });
    });

    document.querySelectorAll('.current-division-lp .division-btn').forEach(button => {
        button.addEventListener('click', () => {
            const division = button.dataset.division;
            if (division && division !== window.currentDivision && window.currentRank !== 'Master') {
                window.currentDivision = division;
                console.log('Current division changed:', window.currentDivision);
                debouncedUpdateTotalPrice();
            }
        });
    });

    document.querySelectorAll('.ls-desired-rank .rank-btn').forEach(button => {
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
                window.desiredDivision = rank === 'Master' ? '' : 'I';
                console.log('Desired rank changed:', window.desiredRank, 'Division:', window.desiredDivision);
                debouncedUpdateTotalPrice();
            }
        });
    });

    document.querySelectorAll('.desired-division-lp .division-btn').forEach(button => {
        button.addEventListener('click', () => {
            const division = button.dataset.division;
            if (division && division !== window.desiredDivision && window.desiredRank !== 'Master') {
                window.desiredDivision = division;
                console.log('Desired division changed:', window.desiredDivision);
                debouncedUpdateTotalPrice();
            }
        });
    });

    // Master LP inputs
    document.querySelectorAll('.master-lp-input').forEach(input => {
        input.addEventListener('input', () => {
            console.log('Master LP input changed');
            debouncedUpdateTotalPrice();
        });
    });

    // Proceed to payment
    const proceedPaymentBtn = document.querySelector('.proceed-payment');
    if (proceedPaymentBtn) {
        proceedPaymentBtn.addEventListener('click', () => {
            console.log('Proceed to payment clicked');
            const validation = validateMasterLP();
            if (!validation.isValid) {
                console.log('Validation error:', validation.message);
                showErrorPopup(validation.message);
                return;
            }
            console.log('Proceeding to payment with validated inputs');
            debouncedUpdateTotalPrice();
            window.location.href = '/checkout.html';
        });
    } else {
        console.warn('Proceed payment button not found (.proceed-payment)');
    }

    // Initial price calculation
    setTimeout(() => {
        console.log('Initiating price calculation on page load');
        debouncedUpdateTotalPrice();
    }, 500);
});

window.updateTotalPrice = debouncedUpdateTotalPrice;