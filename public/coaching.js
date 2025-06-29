
document.addEventListener('DOMContentLoaded', async () => {
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');
    const role = localStorage.getItem('role');
    if (!userId || isNaN(userId)) {
        window.location.href = 'login.html';
        return;
    }

    const coachesContainer = document.getElementById('coaches-list');
    const editProfileModal = document.getElementById('edit-coach-modal');
    const editProfileForm = document.getElementById('edit-coach-form');
    const editMyProfileBtn = document.getElementById('edit-my-profile-btn');
    const logoutLink = document.getElementById('logout-link');

    async function fetchCoaches(attempts = 3, delay = 1000) {
        while (attempts > 0) {
            try {
                const response = await fetch('/api/coaches', {
                    credentials: 'include'
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }
                const coaches = await response.json();
                renderCoaches(coaches);
                return;
            } catch (error) {
                console.error('Error fetching coaches:', error.message);
                attempts--;
                if (attempts === 0) {
                    coachesContainer.innerHTML = '<p>Error loading coaches. Please try again later.</p>';
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    function hasMeaningfulProfile(coach) {
        const hasRank = !!coach.lol_highest_rank || !!coach.valorant_highest_rank;
        const hasPreferences = !!coach.lol_preferred_lanes || !!coach.valorant_preferred_roles;
        const hasRate = !!coach.price_per_hour && coach.price_per_hour > 0;
        return hasRank && hasPreferences && hasRate;
    }

    function renderCoaches(coaches) {
        coachesContainer.innerHTML = '';
        coaches.forEach(coach => {
            if (!hasMeaningfulProfile(coach) && coach.id !== parseInt(userId)) {
                return;
            }

            const coachCard = document.createElement('div');
            coachCard.className = 'coach-card';
            const header = document.createElement('div');
            header.className = 'card-header';
            const usernameWrapper = document.createElement('div');
            usernameWrapper.className = 'username-wrapper';
            const username = document.createElement('h3');
            username.textContent = coach.username || 'Unnamed Coach';
            const gameIcon = document.createElement('img');
            gameIcon.src = `/images/${coach.game_type.toLowerCase().replace(/\s+/g, '-')}.png`;
            gameIcon.alt = coach.game_type;
            gameIcon.className = 'game-icon';
            usernameWrapper.appendChild(username);
            usernameWrapper.appendChild(gameIcon);
            const statusDot = document.createElement('span');
            statusDot.className = 'status-dot online';
            statusDot.title = 'Online';
            header.appendChild(usernameWrapper);
            header.appendChild(statusDot);
            coachCard.appendChild(header);

            const content = document.createElement('div');
            content.className = 'card-content';
            if (coach.lol_highest_rank) {
                const lolRankPanel = document.createElement('div');
                lolRankPanel.className = 'rank-panel';
                lolRankPanel.innerHTML = `<span class="rank-label">LoL Rank:</span><span class="rank-value">${coach.lol_highest_rank}</span>`;
                content.appendChild(lolRankPanel);
            }
            if (coach.valorant_highest_rank) {
                const valorantRankPanel = document.createElement('div');
                valorantRankPanel.className = 'rank-panel';
                valorantRankPanel.innerHTML = `<span class="rank-label">Valorant Rank:</span><span class="rank-value">${coach.valorant_highest_rank}</span>`;
                content.appendChild(valorantRankPanel);
            }
            if (coach.bio) {
                const bioDiv = document.createElement('div');
                bioDiv.className = 'bio-section';
                bioDiv.textContent = coach.bio;
                content.appendChild(bioDiv);
            }
            if (coach.price_per_hour) {
                const rateDiv = document.createElement('div');
                rateDiv.className = 'rate-section';
                rateDiv.innerHTML = `<span class="rate-label">Hourly Rate:</span><span class="rate-value">$${parseFloat(coach.price_per_hour).toFixed(2)}/hr</span>`;
                content.appendChild(rateDiv);
            }
            coachCard.appendChild(content);

            const footer = document.createElement('div');
            footer.className = 'card-footer';
            if (coach.game_type === 'League of Legends' && coach.lol_preferred_lanes) {
                const lolSection = document.createElement('div');
                lolSection.className = 'game-section lol-section';
                const lanesDiv = document.createElement('div');
                lanesDiv.className = 'lanes';
                lanesDiv.innerHTML = '<span class="section-title">Lanes</span>';
                const lanesImages = document.createElement('div');
                lanesImages.className = 'images';
                coach.lol_preferred_lanes.split(',').forEach(lane => {
                    const img = document.createElement('img');
                    img.src = `/images/lanes/${lane.toLowerCase().replace(/\s+/g, '-')}.png`;
                    img.alt = lane;
                    img.className = 'profile-image';
                    lanesImages.appendChild(img);
                });
                lanesDiv.appendChild(lanesImages);
                if (coach.lol_preferred_champions) {
                    const champsDiv = document.createElement('div');
                    champsDiv.className = 'champions';
                    champsDiv.innerHTML = '<span class="section-title">Champions</span>';
                    const champsImages = document.createElement('div');
                    champsImages.className = 'images';
                    const championNameToFile = {
                        "Bel'Veth": "bel-veth",
                        "Cho'Gath": "cho-gath",
                        "Kai'Sa": "kai-sa",
                        "Kha'Zix": "kha-zix",
                        "LeBlanc": "leblanc",
                        "Nunu & Willump": "nunu-&-willump",
                        "Renata Glasc": "renata-glasc",
                        "Vel'Koz": "vel-koz",
                        "Wukong": "wukong"
                    };
                    coach.lol_preferred_champions.split(',').forEach(champion => {
                        const img = document.createElement('img');
                        img.src = `/images/champions/${championNameToFile[champion] || champion.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
                        img.alt = champion;
                        img.className = 'profile-image champion-image';
                        champsImages.appendChild(img);
                    });
                    champsDiv.appendChild(champsImages);
                    lolSection.appendChild(champsDiv);
                }
                footer.appendChild(lolSection);
            }
            if (coach.game_type === 'Valorant' && coach.valorant_preferred_roles) {
                const valorantSection = document.createElement('div');
                valorantSection.className = 'game-section valorant-section';
                const rolesDiv = document.createElement('div');
                rolesDiv.className = 'roles';
                rolesDiv.innerHTML = '<span class="section-title">Roles</span>';
                const rolesImages = document.createElement('div');
                rolesImages.className = 'images';
                coach.valorant_preferred_roles.split(',').forEach(role => {
                    const img = document.createElement('img');
                    img.src = `/images/roles/${role.toLowerCase().replace(/\s+/g, '-')}.png`;
                    img.alt = role;
                    img.className = 'profile-image';
                    rolesImages.appendChild(img);
                });
                rolesDiv.appendChild(rolesImages);
                if (coach.valorant_preferred_agents) {
                    const agentsDiv = document.createElement('div');
                    agentsDiv.className = 'agents';
                    agentsDiv.innerHTML = '<span class="section-title">Agents</span>';
                    const agentsImages = document.createElement('div');
                    agentsImages.className = 'images';
                    coach.valorant_preferred_agents.split(',').forEach(agent => {
                        const img = document.createElement('img');
                        img.src = `/images/agents/${agent.toLowerCase().replace(/\s+/g, '-')}.png`;
                        img.alt = agent;
                        img.className = 'profile-image agent-image';
                        agentsImages.appendChild(img);
                    });
                    agentsDiv.appendChild(agentsImages);
                    valorantSection.appendChild(agentsDiv);
                }
                footer.appendChild(valorantSection);
            }
            coachCard.appendChild(footer);

          if (!(['admin', 'coach'].includes(userRole) && coach.id == userId)) {
                const purchaseSection = document.createElement('div');
                purchaseSection.className = 'purchase-section';
                const hoursLabel = document.createElement('label');
                hoursLabel.textContent = 'Select Hours:';
                const hoursSelect = document.createElement('select');
                hoursSelect.className = 'session-hours';
                [1, 2, 3, 4].forEach(hour => {
                    const option = document.createElement('option');
                    option.value = hour;
                    option.textContent = `${hour} Hour${hour > 1 ? 's' : ''}`;
                    hoursSelect.appendChild(option);
                });
                const totalPrice = document.createElement('div');
                totalPrice.className = 'total-price';
                totalPrice.textContent = `Total: $${(coach.price_per_hour * hoursSelect.value).toFixed(2)}`;
                hoursSelect.addEventListener('change', () => {
                    totalPrice.textContent = `Total: $${(coach.price_per_hour * hoursSelect.value).toFixed(2)}`;
                });
                const purchaseBtn = document.createElement('button');
                purchaseBtn.className = 'purchase-coach-btn';
                purchaseBtn.textContent = 'Book Coaching Session';
                purchaseBtn.dataset.id = coach.id;
                purchaseSection.appendChild(hoursLabel);
                purchaseSection.appendChild(hoursSelect);
                purchaseSection.appendChild(totalPrice);
                purchaseSection.appendChild(purchaseBtn);
                coachCard.appendChild(purchaseSection);
            }


                coachesContainer.appendChild(coachCard);

        });
    }

    async function showEditProfileModal(coach) {
    try {
        const userId = parseInt(localStorage.getItem('userId'));
        if (!userId || isNaN(userId)) {
            console.error('No userId found in localStorage');
            alert('You must be logged in to edit your profile.');
            return;
        }

        const response = await fetch(`https://chboosting.com/api/coach-profile?userId=${userId}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        const profile = await response.json();

        // Display username
        const usernameDisplay = document.getElementById('coach-name-display');
        usernameDisplay.textContent = `Username: ${profile.username || 'Unknown'}`;

        // Populate form fields
        document.getElementById('coach-game').value = profile.game_type || 'League of Legends';
        document.getElementById('lol-highest-rank').value = profile.lol_highest_rank || '';
        document.getElementById('valorant-highest-rank').value = profile.valorant_highest_rank || '';
        document.getElementById('coach-rate').value = profile.price_per_hour || '';
        document.getElementById('coach-bio').value = profile.bio || '';
        updateLaneButtons(profile.lol_preferred_lanes);
        updateSearchableDropdown('lol-preferred-champions', profile.lol_preferred_champions, 'champions');
        updateRoleButtons(profile.valorant_preferred_roles);
        updateSearchableDropdown('valorant-preferred-agents', profile.valorant_preferred_agents, 'agents');

        editProfileModal.style.display = 'block';
    } catch (error) {
        console.error('Error loading coach profile:', error);
        alert(`Failed to load profile: ${error.message}`);
    }
}

editProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = parseInt(localStorage.getItem('userId'));
    if (!userId || isNaN(userId)) {
        console.error('No userId found in localStorage');
        alert('You must be logged in to save your profile.');
        return;
    }

    try {
        const profileData = {
            game_type: document.getElementById('coach-game').value,
            lol_highest_rank: document.getElementById('lol-highest-rank').value || null,
            valorant_highest_rank: document.getElementById('valorant-highest-rank').value || null,
            lol_preferred_lanes: getSelectedValues('lol-preferred-lanes') || null,
            lol_preferred_champions: getSelectedValues('lol-preferred-champions') || null,
            valorant_preferred_roles: getSelectedValues('valorant-preferred-roles') || null,
            valorant_preferred_agents: getSelectedValues('valorant-preferred-agents') || null,
            price_per_hour: parseFloat(document.getElementById('coach-rate').value) || null,
            bio: document.getElementById('coach-bio').value.trim() || null
        };

        if (!profileData.game_type || !profileData.price_per_hour || profileData.price_per_hour <= 0) {
            alert('Please fill in all required fields with valid values.');
            return;
        }

        const response = await fetch(`https://chboosting.com/api/coach-profile?userId=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        alert('Profile saved successfully');
        editProfileModal.style.display = 'none';
        fetchCoaches();
    } catch (error) {
        console.error('Error saving profile:', error);
        alert(`Failed to save profile: ${error.message}`);
    }
});

    function updateLaneButtons(selectedLanes) {
        const buttons = document.querySelectorAll('#lol-preferred-lanes-buttons .lane-button');
        const hiddenInput = document.getElementById('lol-preferred-lanes');
        const selected = selectedLanes ? selectedLanes.split(',') : [];
        buttons.forEach(button => {
            const lane = button.getAttribute('data-lane');
            button.classList.toggle('selected', selected.includes(lane));
        });
        hiddenInput.value = selected.join(',');
        updateImageDisplay('lol-preferred-lanes', 'lanes');
    }

    function updateRoleButtons(selectedRoles) {
        const buttons = document.querySelectorAll('#valorant-preferred-roles-buttons .role-button');
        const hiddenInput = document.getElementById('valorant-preferred-roles');
        const selected = selectedRoles ? selectedRoles.split(',') : [];
        buttons.forEach(button => {
            const role = button.getAttribute('data-role');
            button.classList.toggle('selected', selected.includes(role));
        });
        hiddenInput.value = selected.join(',');
        updateImageDisplay('valorant-preferred-roles', 'roles');
    }

    function updateSearchableDropdown(selectId, selectedValues, imageType) {
        const $select = $(`#${selectId}`);
        if (selectedValues) {
            const values = selectedValues.split(',');
            $select.val(values).trigger('change');
        } else {
            $select.val(null).trigger('change');
        }
        updateImageDisplay(selectId, imageType);
    }

    function updateImageDisplay(selectId, imageType) {
        const imageContainerIdMap = {
            'lol-preferred-lanes': 'lol-lanes-images',
            'lol-preferred-champions': 'lol-champions-images',
            'valorant-preferred-roles': 'valorant-roles-images',
            'valorant-preferred-agents': 'valorant-agents-images'
        };
        const imageContainer = document.getElementById(imageContainerIdMap[selectId]);
        if (!imageContainer) {
            console.warn(`Image container ${imageContainerIdMap[selectId]} not found`);
            return;
        }
        let selectedValues = [];
        if (selectId === 'lol-preferred-lanes' || selectId === 'valorant-preferred-roles') {
            const hiddenInput = document.getElementById(selectId);
            selectedValues = hiddenInput.value ? hiddenInput.value.split(',') : [];
        } else {
            const select = document.getElementById(selectId);
            selectedValues = Array.from(select.selectedOptions).map(option => option.value);
        }
        imageContainer.innerHTML = '';
        selectedValues.forEach(value => {
            const img = document.createElement('img');
            img.src = `/images/${imageType}/${value.toLowerCase().replace(/\s+/g, '-')}.png`;
            img.alt = value;
            img.className = 'selected-image';
            imageContainer.appendChild(img);
        });
    }

    function setupLaneButtons() {
        const buttons = document.querySelectorAll('#lol-preferred-lanes-buttons .lane-button');
        const hiddenInput = document.getElementById('lol-preferred-lanes');
        const maxSelections = 3;
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const lane = button.getAttribute('data-lane');
                let selectedLanes = hiddenInput.value ? hiddenInput.value.split(',') : [];
                if (button.classList.contains('selected')) {
                    selectedLanes = selectedLanes.filter(l => l !== lane);
                    button.classList.remove('selected');
                } else {
                    if (selectedLanes.length >= maxSelections) {
                        alert(`You can select up to ${maxSelections} lanes.`);
                        return;
                    }
                    selectedLanes.push(lane);
                    button.classList.add('selected');
                }
                hiddenInput.value = selectedLanes.join(',');
                updateImageDisplay('lol-preferred-lanes', 'lanes');
            });
        });
    }

    function setupRoleButtons() {
        const buttons = document.querySelectorAll('#valorant-preferred-roles-buttons .role-button');
        const hiddenInput = document.getElementById('valorant-preferred-roles');
        const maxSelections = 2;
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const role = button.getAttribute('data-role');
                let selectedRoles = hiddenInput.value ? hiddenInput.value.split(',') : [];
                if (button.classList.contains('selected')) {
                    selectedRoles = selectedRoles.filter(r => r !== role);
                    button.classList.remove('selected');
                } else {
                    if (selectedRoles.length >= maxSelections) {
                        alert(`You can select up to ${maxSelections} roles.`);
                        return;
                    }
                    selectedRoles.push(role);
                    button.classList.add('selected');
                }
                hiddenInput.value = selectedRoles.join(',');
                updateImageDisplay('valorant-preferred-roles', 'roles');
            });
        });
    }

    function setupDropdowns() {
        const searchableConfigs = [
            { id: 'lol-preferred-champions', max: 5, imageType: 'champions' },
            { id: 'valorant-preferred-agents', max: 3, imageType: 'agents' }
        ];
        searchableConfigs.forEach(config => {
            $(`#${config.id}`).select2({
                placeholder: `Select up to ${config.max} options`,
                maximumSelectionLength: config.max,
                width: '100%'
            }).on('change', () => {
                updateImageDisplay(config.id, config.imageType);
            });
        });
    }

    function getSelectedValues(selectId) {
        if (selectId === 'lol-preferred-lanes' || selectId === 'valorant-preferred-roles') {
            const hiddenInput = document.getElementById(selectId);
            return hiddenInput.value;
        }
        const select = document.getElementById(selectId);
        return Array.from(select.selectedOptions).map(option => option.value).join(',');
    }

    if (['admin', 'coach'].includes(userRole)) {
        editMyProfileBtn.style.display = 'block';
        editMyProfileBtn.addEventListener('click', () => showEditProfileModal({ user_id: userId }));
    }

coachesContainer.addEventListener('click', async (e) => {
  if (e.target.classList.contains('purchase-coach-btn')) {
    const coachId = e.target.dataset.id;
    const hoursSelect = e.target.parentElement.querySelector('.session-hours');
    const hours = parseInt(hoursSelect?.value);
    const coachCard = e.target.closest('.coach-card');
    const coachNameElement = coachCard?.querySelector('.username-wrapper h3');
    const coachName = coachNameElement?.textContent?.trim();
    const gameTypeElement = coachCard?.querySelector('.game-icon');
    const gameType = gameTypeElement?.alt?.trim();
    const pricePerHourElement = coachCard?.querySelector('.rate-value');
    const pricePerHourText = pricePerHourElement?.textContent?.replace('$', '').replace('/hr', '').trim();
    const pricePerHour = parseFloat(pricePerHourText);
    const totalPrice = hours * pricePerHour;
    const cashback = totalPrice * 0.03; // Calculate cashback as 3% of totalPrice
    const userId = parseInt(localStorage.getItem('userId'));

    // Log extracted values for debugging
    console.log('Extracted checkout data:', { 
      coachId, 
      hours, 
      coachName, 
      gameType, 
      pricePerHour, 
      totalPrice, 
      cashback, // Include cashback in debug log
      userId,
      coachNameElement: coachNameElement?.outerHTML,
      gameTypeElement: gameTypeElement?.outerHTML,
      pricePerHourElement: pricePerHourElement?.outerHTML
    });

    // Validate inputs
    if (!coachId || isNaN(parseInt(coachId))) {
      console.error('Invalid coachId:', coachId);
      alert('Invalid coach selected.');
      return;
    }
    if (!hoursSelect || isNaN(hours) || hours < 1 || hours > 4) {
      console.error('Invalid hours:', hours, 'Hours select:', hoursSelect?.outerHTML);
      alert('Please select 1–4 hours.');
      return;
    }
    if (!coachName || coachName === '') {
      console.error('Invalid coachName:', coachName, 'Element:', coachNameElement?.outerHTML);
      alert('Coach name not found. Please check the coach profile.');
      return;
    }
    if (!gameType || !['League of Legends', 'Valorant'].includes(gameType)) {
      console.error('Invalid gameType:', gameType, 'Element:', gameTypeElement?.outerHTML);
      alert('Invalid game type. Please check the coach profile.');
      return;
    }
    if (!pricePerHourText || isNaN(pricePerHour) || pricePerHour <= 0) {
      console.error('Invalid pricePerHour:', pricePerHourText, 'Element:', pricePerHourElement?.outerHTML);
      alert('Invalid price. Please check the coach profile.');
      return;
    }
    if (isNaN(totalPrice) || totalPrice <= 0) {
      console.error('Invalid totalPrice:', totalPrice);
      alert('Invalid total price.');
      return;
    }
    if (!userId || isNaN(userId)) {
      console.error('Invalid userId:', userId);
      alert('You must be logged in to book a coaching session.');
      return;
    }

    // Construct request body
    const requestBody = {
      userId,
      type: 'coaching',
      orderData: {
        coachId: parseInt(coachId),
        hours,
        game: gameType,
        totalPrice: totalPrice.toFixed(2), // Format to two decimal places
        cashback: cashback.toFixed(2), // Include cashback, formatted to two decimal places
        coachName
      }
    };
    console.log('Sending coaching checkout request:', requestBody);

    try {
      const response = await fetch('https://chboosting.com/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
      }
      const { id: sessionId } = await response.json();
      const stripe = Stripe('pk_test_51RQDfjPPazfqaVG5QhEgsle6jH6ohhSrqObHzyzOUk6sbh3nERA6impvrDL0judz7e7d0ylipgmgv1sTATWT6ylj00kTO65wlC');
      const { error } = await stripe.redirectToCheckout({ sessionId });
      if (error) {
        console.error('Stripe redirectToCheckout error:', error.message);
        alert(`Payment error: ${error.message}. Please try again or contact support.`);
      }
    } catch (error) {
      console.error('Error initiating coaching checkout:', error.message);
      alert(`Failed to book coaching session: ${error.message}`);
    }
  }
});

    editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const profileData = {
                
                game_type: document.getElementById('coach-game').value,
                lol_highest_rank: document.getElementById('lol-highest-rank').value || null,
                valorant_highest_rank: document.getElementById('valorant-highest-rank').value || null,
                lol_preferred_lanes: getSelectedValues('lol-preferred-lanes') || null,
                lol_preferred_champions: getSelectedValues('lol-preferred-champions') || null,
                valorant_preferred_roles: getSelectedValues('valorant-preferred-roles') || null,
                valorant_preferred_agents: getSelectedValues('valorant-preferred-agents') || null,
                price_per_hour: parseFloat(document.getElementById('coach-rate').value) || null,
                bio: document.getElementById('coach-bio').value.trim() || null
            };
            if (!profileData.name || !profileData.game_type || !profileData.price_per_hour || profileData.price_per_hour <= 0) {
                alert('Please fill in all required fields with valid values.');
                return;
            }
            const response = await fetch(`/api/coach-profile?userId=${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify(profileData)
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            alert('Profile saved successfully');
            editProfileModal.style.display = 'none';
            fetchCoaches();
        } catch (error) {
            console.error('Error saving profile:', error);
            alert(`Failed to save profile: ${error.message}`);
        }
    });

    const closeModal = document.querySelector('#edit-coach-modal .close');
    closeModal.addEventListener('click', () => {
        editProfileModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === editProfileModal) {
            editProfileModal.style.display = 'none';
        }
    });

    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        localStorage.removeItem('token');
        window.location.href = '/';
    });

    setupLaneButtons();
    setupRoleButtons();
    setupDropdowns();
    await fetchCoaches();
});
