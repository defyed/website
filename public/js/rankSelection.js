const ranks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master'];
const divisions = ['IV', 'III', 'II', 'I'];
window.currentRank = 'Silver';
window.currentDivision = 'I';
window.desiredRank = 'Gold';
window.desiredDivision = 'IV';
window.currentLP = '0-20';

const rankImages = {
    Iron: 'Images/iron.png',
    Bronze: 'Images/bronze.png',
    Silver: 'Images/silver.png',
    Gold: 'Images/gold.png',
    Platinum: 'Images/platinum.png',
    Emerald: 'Images/emerald.png',
    Diamond: 'Images/diamond.png',
    Master: 'Images/master.png',
    default: 'Images/silver.png/150?text=Select+Ranks'
};

const currentRankButtons = document.querySelectorAll('.ls-current-rank .rank-btn');
const desiredRankButtons = document.querySelectorAll('.ls-desired-rank .rank-btn');
const currentDivisionButtons = document.querySelectorAll('.ls-current-rank .division-btn');
const desiredDivisionButtons = document.querySelectorAll('.ls-desired-rank .division-btn');
const currentRankText = document.querySelector('.ls-new-section .rank-text');
const currentRankImage = document.getElementById('current-rank-image');
const targetRankText = document.querySelector('.ls-target-rank .rank-text');
const targetRankImage = document.getElementById('target-rank-image');
const currentDivisionLpContainer = document.querySelector('.current-division-lp');
const currentMasterLpContainer = document.querySelector('.current-master-lp');
const desiredDivisionLpContainer = document.querySelector('.desired-division-lp');
const desiredMasterLpContainer = document.querySelector('.desired-master-lp');
const lpSelect = document.getElementById('current-lp-select');

function toggleMasterUI(isCurrent, rank) {
    if (isCurrent) {
        if (rank === 'Master') {
            currentDivisionLpContainer.style.display = 'none';
            currentMasterLpContainer.style.display = 'block';
            window.currentDivision = null;
        } else {
            currentDivisionLpContainer.style.display = 'block';
            currentMasterLpContainer.style.display = 'none';
            window.currentDivision = window.currentDivision || 'I'; // Default to 'I' instead of 'IV'
        }
    } else {
        if (rank === 'Master') {
            desiredDivisionLpContainer.style.display = 'none';
            desiredMasterLpContainer.style.display = 'block';
            window.desiredDivision = null;
        } else {
            desiredDivisionLpContainer.style.display = 'block';
            desiredMasterLpContainer.style.display = 'none';
            window.desiredDivision = window.desiredDivision || 'I';
        }
    }
}

function updateButtonStates() {
    console.log('Updating button states:', window.currentRank, window.currentDivision, window.desiredRank, window.desiredDivision, 'LP:', window.currentLP);

    if (window.currentRank === 'Master' && window.desiredRank !== 'Master') {
        window.desiredRank = 'Master';
        desiredRankButtons.forEach(btn => {
            if (btn.dataset.rank === 'Master') {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    if (window.currentRank === 'Diamond' && window.currentDivision === 'I' && window.desiredRank !== 'Master') {
        window.desiredRank = 'Master';
        desiredRankButtons.forEach(btn => {
            if (btn.dataset.rank === 'Master') {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    toggleMasterUI(true, window.currentRank);
    toggleMasterUI(false, window.desiredRank);

    if (window.currentRank) {
        const displayDivision = window.currentRank === 'Master' ? '' : ` ${window.currentDivision || 'I'}`;
        currentRankText.textContent = `${window.currentRank}${displayDivision}`;
        currentRankImage.src = rankImages[window.currentRank] || rankImages.default;
        currentRankImage.alt = `Current: ${window.currentRank}`;
    } else {
        currentRankText.textContent = 'Select Rank';
        currentRankImage.src = rankImages.default;
        currentRankImage.alt = 'Select a Rank';
    }

    if (window.currentRank && !window.desiredRank) {
        window.desiredRank = window.currentRank;
        desiredRankButtons.forEach(btn => {
            if (btn.dataset.rank === window.currentRank) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    if (window.currentRank) {
        const currentRankIndex = ranks.indexOf(window.currentRank);
        desiredRankButtons.forEach((btn, index) => {
            if (index < currentRankIndex) {
                btn.disabled = true;
                btn.classList.add('disabled');
            } else if (index === currentRankIndex && window.currentDivision === 'I' && window.currentRank !== 'Master') {
                btn.disabled = true;
                btn.classList.add('disabled');
            } else {
                btn.disabled = false;
                btn.classList.remove('disabled');
            }
        });
        if (window.desiredRank) {
            const desiredRankIndex = ranks.indexOf(window.desiredRank);
            const shouldBeDisabled = (desiredRankIndex < currentRankIndex) || (desiredRankIndex === currentRankIndex && window.currentDivision === 'I' && window.currentRank !== 'Master');
            if (shouldBeDisabled) {
                window.desiredRank = null;
                window.desiredDivision = null;
                desiredRankButtons.forEach(btn => btn.classList.remove('selected'));
                desiredDivisionButtons.forEach(btn => btn.classList.remove('selected'));
                const nextRankIndex = (window.currentDivision === 'I' || window.currentRank === 'Master') ? currentRankIndex + 1 : currentRankIndex;
                if (nextRankIndex < ranks.length) {
                    window.desiredRank = ranks[nextRankIndex];
                    window.desiredDivision = ranks[nextRankIndex] === 'Master' ? '' : 'I';
                    desiredRankButtons[nextRankIndex].classList.add('selected');
                    if (window.desiredDivision) {
                        desiredDivisionButtons.forEach(btn => {
                            if (btn.dataset.division === 'I') {
                                btn.classList.add('selected');
                            } else {
                                btn.classList.remove('selected');
                            }
                        });
                    }
                }
            }
        }
    } else {
        desiredRankButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('disabled');
        });
    }

    if (window.desiredRank) {
        const displayDivision = window.desiredRank === 'Master' ? '' : ` ${window.desiredDivision || 'I'}`;
        targetRankText.textContent = `${window.desiredRank}${displayDivision}`;
        targetRankImage.src = rankImages[window.desiredRank] || rankImages.default;
        targetRankImage.alt = `Target: ${window.desiredRank}`;
    } else {
        targetRankText.textContent = 'Select Rank';
        targetRankImage.src = rankImages.default;
        targetRankImage.alt = 'Select a Rank';
    }

    if (window.currentRank && window.currentDivision && window.desiredRank === window.currentRank && window.currentRank !== 'Master') {
        const currentDivisionIndex = divisions.indexOf(window.currentDivision);
        desiredDivisionButtons.forEach((btn, index) => {
            btn.disabled = index <= currentDivisionIndex;
            btn.classList.toggle('disabled', index <= currentDivisionIndex);
        });
        if (window.desiredDivision) {
            const desiredDivisionIndex = divisions.indexOf(window.desiredDivision);
            if (desiredDivisionIndex <= currentDivisionIndex) {
                window.desiredDivision = null;
                desiredDivisionButtons.forEach(btn => btn.classList.remove('selected'));
                const nextDivisionIndex = currentDivisionIndex + 1;
                if (nextDivisionIndex < divisions.length) {
                    window.desiredDivision = divisions[nextDivisionIndex];
                    desiredDivisionButtons[nextDivisionIndex].classList.add('selected');
                }
            }
        }
    } else {
        desiredDivisionButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('disabled');
        });
    }

    if (typeof window.updateTotalPrice === 'function') {
        window.updateTotalPrice();
    } else {
        console.error('updateTotalPrice not found');
    }
}

document.addEventListener("DOMContentLoaded", () => {
    console.log('DOM loaded, initializing rank selection');
    currentRankButtons.forEach(btn => {
        if (btn.dataset.rank === 'Silver') {
            btn.classList.add('selected');
            window.currentRank = 'Silver';
        }
    });
    currentDivisionButtons.forEach(btn => {
        if (btn.dataset.division === 'I') {
            btn.classList.add('selected');
            window.currentDivision = 'I';
        }
    });
    desiredRankButtons.forEach(btn => {
        if (btn.dataset.rank === 'Gold') {
            btn.classList.add('selected');
            window.desiredRank = 'Gold';
        }
    });
    desiredDivisionButtons.forEach(btn => {
        if (btn.dataset.division === 'IV') {
            btn.classList.add('selected');
            window.desiredDivision = 'IV';
        }
    });
    if (lpSelect) {
        lpSelect.value = '0-20';
        window.currentLP = '0-20';
    }
    updateButtonStates();
});

currentRankButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        window.currentRank = btn.dataset.rank;
        currentRankButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if (window.currentRank !== 'Master' && !window.currentDivision) {
            window.currentDivision = 'I';
            currentDivisionButtons.forEach(b => {
                b.classList.toggle('selected', b.dataset.division === 'I');
            });
        }
        updateButtonStates();
    });
});

desiredRankButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        window.desiredRank = btn.dataset.rank;
        desiredRankButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        window.desiredDivision = window.desiredRank === 'Master' ? '' : 'I';
        desiredDivisionButtons.forEach(b => {
            b.classList.toggle('selected', b.dataset.division === window.desiredDivision);
        });
        updateButtonStates();
    });
});

currentDivisionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        window.currentDivision = btn.dataset.division;
        currentDivisionButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateButtonStates();
    });
});

desiredDivisionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        window.desiredDivision = btn.dataset.division;
        desiredDivisionButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateButtonStates();
    });
});

if (lpSelect) {
    lpSelect.addEventListener('change', () => {
        window.currentLP = lpSelect.value;
        console.log('Selected LP range:', window.currentLP);
        updateButtonStates();
    });
}

const currentMasterLPInput = document.querySelector('.current-master-lp .master-lp-input');
const desiredMasterLPInput = document.querySelector('.desired-master-lp .master-lp-input');

if (currentMasterLPInput) {
    currentMasterLPInput.addEventListener('input', () => {
        console.log('Current Master LP changed:', currentMasterLPInput.value);
        if (typeof window.updateTotalPrice === 'function') {
            window.updateTotalPrice();
        }
    });
}

if (desiredMasterLPInput) {
    desiredMasterLPInput.addEventListener('input', () => {
        console.log('Desired Master LP changed:', desiredMasterLPInput.value);
        if (typeof window.updateTotalPrice === 'function') {
            window.updateTotalPrice();
        }
    });
}