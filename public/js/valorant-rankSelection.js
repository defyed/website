const ranks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal'];
const divisions = ['I', 'II', 'III'];
window.ranks = ranks;
window.divisions = divisions;
window.currentRank = 'Iron';
window.currentDivision = 'I';
window.desiredRank = 'Iron';
window.desiredDivision = 'II';
window.currentLP = '0-20';
window.currentRR = 0;
window.desiredRR = 0;

const rankImages = {
    Iron: {
        I: '/images/Iron_1_Rank.png',
        II: '/images/Iron_2_Rank.png',
        III: '/images/Iron_3_Rank.png'
    },
    Bronze: {
        I: '/images/Bronze_1_Rank.png',
        II: '/images/Bronze_2_Rank.png',
        III: '/images/Bronze_3_Rank.png'
    },
    Silver: {
        I: '/images/Silver_1_Rank.png',
        II: '/images/Silver_2_Rank.png',
        III: '/images/Silver_3_Rank.png'
    },
    Gold: {
        I: '/images/Gold_1_Rank.png',
        II: '/images/Gold_2_Rank.png',
        III: '/images/Gold_3_Rank.png'
    },
    Platinum: {
        I: '/images/Platinum_1_Rank.png',
        II: '/images/Platinum_2_Rank.png',
        III: '/images/Platinum_3_Rank.png'
    },
    Diamond: {
        I: '/images/Diamond_1_Rank.png',
        II: '/images/Diamond_2_Rank.png',
        III: '/images/Diamond_3_Rank.png'
    },
    Ascendant: {
        I: '/images/Ascendant_1_Rank.png',
        II: '/images/Ascendant_2_Rank.png',
        III: '/images/Ascendant_3_Rank.png'
    },
    Immortal: '/images/Immortal_3_Rank.png',
    default: '/images/default.png'
};

document.addEventListener('DOMContentLoaded', () => {
    const currentRankButtons = document.querySelectorAll('.ls-current-league-group .rank-btn[data-rank]');
    const desiredRankButtons = document.querySelectorAll('.ls-target-league-group .rank-btn[data-rank]');
    const currentDivisionButtons = document.querySelectorAll('.ls-current-league-group .division-btn');
    const desiredDivisionButtons = document.querySelectorAll('.ls-target-league-group .division-btn');
    const currentRankText = document.querySelector('.ls-current-league-group .rank-text');
    const currentRankImage = document.getElementById('current-rank-image');
    const targetRankText = document.querySelector('.ls-target-league-group .rank-text');
    const targetRankImage = document.getElementById('target-rank-image');
    const lpSelect = document.getElementById('current-lp-select');

    let currentRRContainer = document.querySelector('.ls-current-league-group .current-rr-input');
    let desiredRRContainer = document.querySelector('.ls-target-league-group .desired-rr-input');

    function createRRInput(containerClass, inputId, labelText) {
        const container = document.createElement('div');
        container.className = containerClass;
        container.style.display = 'none';
        const label = document.createElement('label');
        label.htmlFor = inputId;
        label.textContent = labelText;
        const input = document.createElement('input');
        input.id = inputId;
        input.type = 'text';
        input.placeholder = 'Enter RR';
        input.classList.add('input-lp');
        input.min = '0';
        container.appendChild(label);
        container.appendChild(input);
        return container;
    }

    if (!currentRRContainer && document.querySelector('.ls-current-league-group .ls-rank-box')) {
        currentRRContainer = createRRInput('current-rr-input', 'current-rr-input', 'Current Immortal RR (Numbers Only): ');
        document.querySelector('.ls-current-league-group .ls-rank-box').appendChild(currentRRContainer);
    }

    if (!desiredRRContainer && document.querySelector('.ls-target-league-group .ls-rank-box')) {
        desiredRRContainer = createRRInput('desired-rr-input', 'desired-rr-input', 'Target Desired Immortal RR (Numbers Only): ');
        document.querySelector('.ls-target-league-group .ls-rank-box').appendChild(desiredRRContainer);
    }

    const currentRRInput = document.getElementById('current-rr-input');
    const desiredRRInput = document.getElementById('desired-rr-input');

    function logDomElements() {
        console.log('DOM Elements:', {
            currentRankButtons: currentRankButtons.length,
            desiredRankButtons: desiredRankButtons.length,
            currentDivisionButtons: currentDivisionButtons.length,
            desiredDivisionButtons: desiredDivisionButtons.length,
            currentRankText: !!currentRankText,
            currentRankImage: !!currentRankImage,
            targetRankText: !!targetRankText,
            targetRankImage: !!targetRankImage,
            lpSelect: !!lpSelect,
            currentRRContainer: !!currentRRContainer,
            desiredRRContainer: !!desiredRRContainer
        });
    }

    function updateButtonStates() {
        console.log('Updating button states:', window.currentRank, window.currentDivision, window.desiredRank, window.desiredDivision, 'RR/LP:', window.currentLP, 'Current RR:', window.currentRR, 'Desired RR:', window.desiredRR);

        const isCurrentImmortal = window.currentRank === 'Immortal';
        const isDesiredImmortal = window.desiredRank === 'Immortal';
        const isAscendantToImmortal = window.currentRank === 'Ascendant' && window.currentDivision === 'III' && window.desiredRank === 'Immortal';

        const currentDivisionSelect = document.querySelector('.ls-current-league-group .division-select');
        const currentLPSelect = document.querySelector('.ls-current-league-group .lp-select');
        const desiredDivisionSelect = document.querySelector('.ls-target-league-group .division-select');

        if (currentDivisionSelect) currentDivisionSelect.style.display = isCurrentImmortal ? 'none' : '';
        if (currentLPSelect) currentLPSelect.style.display = isCurrentImmortal ? 'none' : '';
        if (currentRRContainer) currentRRContainer.style.display = isCurrentImmortal ? '' : 'none';

        if (desiredDivisionSelect) {
            const hideDiv = (isDesiredImmortal || isAscendantToImmortal);
            desiredDivisionSelect.style.display = hideDiv ? 'none' : '';
            desiredDivisionButtons.forEach(btn => {
                btn.style.display = hideDiv ? 'none' : '';
            });
        }

        if (desiredRRContainer) desiredRRContainer.style.display = (isDesiredImmortal || isAscendantToImmortal) ? '' : 'none';
        if (desiredRRInput && (isDesiredImmortal || isAscendantToImmortal)) {
            if (!desiredRRInput.value || isDesiredImmortal) {
                desiredRRInput.value = '';
                window.desiredRR = 0;
            }
        }

        if (window.currentRank) {
            const displayDivision = window.currentRank === 'Immortal' ? '' : ` ${window.currentDivision || 'I'}`;
            if (currentRankText) currentRankText.textContent = `${window.currentRank}${displayDivision}`;
            if (currentRankImage) {
                const imageSrc = window.currentRank === 'Immortal' 
                    ? rankImages[window.currentRank] 
                    : rankImages[window.currentRank]?.[window.currentDivision || 'I'] || rankImages.default;
                currentRankImage.src = imageSrc;
                currentRankImage.alt = `Current: ${window.currentRank}${displayDivision}`;
            }
        } else {
            if (currentRankText) currentRankText.textContent = 'Select Rank';
            if (currentRankImage) {
                currentRankImage.src = rankImages.default;
                currentRankImage.alt = 'Select a Rank';
            }
        }

        if (window.currentRank && !window.desiredRank) {
            window.desiredRank = window.currentRank;
            window.desiredDivision = window.currentRank === 'Immortal' ? '' : 'II';
            desiredRankButtons.forEach(btn => btn.classList.toggle('selected', btn.dataset.rank === window.currentRank));
            desiredDivisionButtons.forEach(btn => btn.classList.toggle('selected', btn.dataset.division === 'II'));
        }

        if (window.currentRank) {
            const currentRankIndex = ranks.indexOf(window.currentRank);
            desiredRankButtons.forEach((btn, index) => {
                const isDisabled = index < currentRankIndex;
                btn.disabled = isDisabled;
                btn.classList.toggle('disabled', isDisabled);
            });

            if (window.desiredRank) {
                const desiredRankIndex = ranks.indexOf(window.desiredRank);
                if (desiredRankIndex < currentRankIndex) {
                    window.desiredRank = ranks[currentRankIndex];
                    window.desiredDivision = window.currentRank === 'Immortal' ? '' : 'I';
                    desiredRankButtons.forEach(btn => btn.classList.toggle('selected', btn.dataset.rank === window.desiredRank));
                    desiredDivisionButtons.forEach(btn => btn.classList.toggle('selected', btn.dataset.division === window.desiredDivision));
                }
            }
        } else {
            desiredRankButtons.forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('disabled');
            });
        }

        if (window.desiredRank !== window.currentRank || window.currentRank === 'Immortal' || !window.currentDivision) {
            desiredDivisionButtons.forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('disabled');
            });
        } else if (window.currentRank && window.currentDivision && window.desiredRank === window.currentRank && window.currentRank !== 'Immortal') {
            const currentDivisionIndex = divisions.indexOf(window.currentDivision);
            desiredDivisionButtons.forEach((btn, index) => {
                const isDisabled = index <= currentDivisionIndex;
                btn.disabled = isDisabled;
                btn.classList.toggle('disabled', isDisabled);
            });

            if (window.desiredDivision) {
                const desiredDivisionIndex = divisions.indexOf(window.desiredDivision);
                if (desiredDivisionIndex <= currentDivisionIndex) {
                    window.desiredDivision = null;
                    desiredDivisionButtons.forEach(btn => btn.classList.remove('selected'));
                    const nextDivisionIndex = currentDivisionIndex + 1;
                    if (nextDivisionIndex < divisions.length) {
                        window.desiredDivision = divisions[nextDivisionIndex];
                        desiredDivisionButtons.forEach(btn => btn.classList.toggle('selected', btn.dataset.division === divisions[nextDivisionIndex]));
                    } else {
                        const currentRankIndex = ranks.indexOf(window.currentRank);
                        if (currentRankIndex + 1 < ranks.length) {
                            window.desiredRank = ranks[currentRankIndex + 1];
                            window.desiredDivision = ranks[currentRankIndex + 1] === 'Immortal' ? '' : 'I';
                            desiredRankButtons.forEach(btn => btn.classList.toggle('selected', btn.dataset.rank === ranks[currentRankIndex + 1]));
                            desiredDivisionButtons.forEach(btn => btn.classList.toggle('selected', btn.dataset.division === 'I'));
                            updateButtonStates();
                        }
                    }
                }
            }
        }

        if (window.desiredRank) {
            const displayDivision = window.desiredRank === 'Immortal' ? '' : ` ${window.desiredDivision || 'I'}`;
            if (targetRankText) targetRankText.textContent = `${window.desiredRank}${displayDivision}`;
            if (targetRankImage) {
                const imageSrc = window.desiredRank === 'Immortal' 
                    ? rankImages[window.desiredRank] 
                    : rankImages[window.desiredRank]?.[window.desiredDivision || 'I'] || rankImages.default;
                targetRankImage.src = imageSrc;
                targetRankImage.alt = `Target: ${window.desiredRank}${displayDivision}`;
            }
        } else {
            if (targetRankText) targetRankText.textContent = 'Select Rank';
            if (targetRankImage) {
                targetRankImage.src = rankImages.default;
                targetRankImage.alt = 'Select a Rank';
            }
        }

        if (typeof window.updateTotalPrice === 'function') {
            window.updateTotalPrice();
        } else {
            console.log('updateTotalPrice not defined, waiting');
        }
    }

    console.log('DOM loaded, initializing rank selection');
    logDomElements();

    if (!currentRankButtons.length || !desiredRankButtons.length || !currentDivisionButtons.length || !desiredDivisionButtons.length) {
        console.error('Required buttons not found');
        return;
    }

    currentRankButtons.forEach(btn => {
        if (btn.dataset.rank === 'Iron') {
            btn.classList.add('selected');
            window.currentRank = 'Iron';
        }
    });
    currentDivisionButtons.forEach(btn => {
        if (btn.dataset.division === 'I') {
            btn.classList.add('selected');
            window.currentDivision = 'I';
        }
    });
    desiredRankButtons.forEach(btn => {
        if (btn.dataset.rank === 'Iron') {
            btn.classList.add('selected');
            window.desiredRank = 'Iron';
        }
    });
    desiredDivisionButtons.forEach(btn => {
        if (btn.dataset.division === 'II') {
            btn.classList.add('selected');
            window.desiredDivision = 'II';
        }
    });

    if (lpSelect) {
        lpSelect.value = '0-20';
        window.currentLP = '0-20';
        window.desiredRR = 0;
    }

    if (currentRRInput) {
        currentRRInput.addEventListener('input', () => {
            let value = parseInt(currentRRInput.value) || 0;
            if (value < 0) value = 0;
            currentRRInput.value = value;
            window.currentRR = value;
            updateButtonStates();
        });
    }

    if (desiredRRInput) {
        desiredRRInput.addEventListener('input', () => {
            let value = parseInt(desiredRRInput.value) || 0;
            if (value < 0) value = 0;
            desiredRRInput.value = value;
            window.desiredRR = value;
            updateButtonStates();
        });
    }

    currentRankButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            window.currentRank = btn.dataset.rank;
            currentRankButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (window.currentRank !== 'Immortal') {
                window.currentDivision = 'I';
                currentDivisionButtons.forEach(b => {
                    b.classList.toggle('selected', b.dataset.division === 'I');
                });
            } else {
                window.currentDivision = '';
                window.desiredRank = 'Immortal';
                window.desiredDivision = '';
                desiredRankButtons.forEach(b => b.classList.toggle('selected', b.dataset.rank === 'Immortal'));
                desiredDivisionButtons.forEach(b => b.classList.remove('selected'));
                if (desiredRRInput) desiredRRInput.value = '';
                window.desiredRR = 0;
            }
            updateButtonStates();
        });
    });

    desiredRankButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            window.desiredRank = btn.dataset.rank;
            desiredRankButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            window.desiredDivision = window.desiredRank === 'Immortal' ? '' : 'I';
            desiredDivisionButtons.forEach(b => {
                b.classList.toggle('selected', b.dataset.division === window.desiredDivision);
            });

            const isAscendantToImmortal = window.currentRank === 'Ascendant' && window.currentDivision === 'III' && window.desiredRank === 'Immortal';
            if ((isAscendantToImmortal || window.desiredRank === 'Immortal') && desiredRRInput) {
                desiredRRInput.value = '';
                window.desiredRR = 0;
            }

            updateButtonStates();
        });
    });

    currentDivisionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            window.currentDivision = btn.dataset.division;
            currentDivisionButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            if (window.currentRank === 'Ascendant' && window.currentDivision === 'III') {
                window.desiredRank = 'Immortal';
                window.desiredDivision = '';
                window.desiredRR = 0;
                if (desiredRRInput) desiredRRInput.value = '';
                desiredRankButtons.forEach(b => b.classList.toggle('selected', b.dataset.rank === 'Immortal'));
                desiredDivisionButtons.forEach(b => b.classList.remove('selected'));
            }

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
            console.log('RR dropdown');
            updateButtonStates();
        });
    }

    updateButtonStates();
});