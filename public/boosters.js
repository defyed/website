document.addEventListener('DOMContentLoaded', async () => {
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('role');
    if (!userId || isNaN(userId)) {
        window.location.href = 'login.html';
        return;
    }

    const boostersContainer = document.getElementById('boosters-container');
    const editProfileModal = document.getElementById('edit-profile-modal');
    const editProfileForm = document.getElementById('edit-profile-form');
    const logoutLink = document.getElementById('logout-link');

    async function fetchBoosters(attempts = 3, delay = 1000) {
        while (attempts > 0) {
            try {
                const response = await fetch('/api/boosters');
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
                const boosters = await response.json();
                renderBoosters(boosters);
                return;
            } catch (error) {
                console.error('Error fetching boosters:', error);
                attempts--;
                if (attempts === 0) {
                    boostersContainer.innerHTML = '<p>Error loading boosters. Please try again later.</p>';
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    function renderBoosters(boosters) {
    boostersContainer.innerHTML = '';
    boosters.forEach(booster => {
        const boosterCard = document.createElement('div');
        boosterCard.className = 'booster-card';

        const header = document.createElement('div');
        header.className = 'card-header';
        const languageWrapper = document.createElement('div');
        languageWrapper.className = 'language-wrapper';
        if (booster.language) {
            const languageSpan = document.createElement('span');
            languageSpan.textContent = 'Speaks: ';
            const languageIcon = document.createElement('img');
            languageIcon.src = `/images/languages/${booster.language.toLowerCase()}.png`;
            languageIcon.alt = booster.language;
            languageIcon.className = 'language-icon';
            languageWrapper.appendChild(languageSpan);
            languageWrapper.appendChild(languageIcon);
        }
        const usernameWrapper = document.createElement('div');
        usernameWrapper.className = 'username-wrapper';
        const username = document.createElement('h3');
        username.textContent = booster.username;
        const gameIcon = document.createElement('img');
        gameIcon.src = '/images/league-of-legends.png';
        gameIcon.alt = 'League of Legends';
        gameIcon.className = 'game-icon';
        usernameWrapper.appendChild(username);
        usernameWrapper.appendChild(gameIcon);
        const statusDot = document.createElement('span');
        statusDot.className = 'status-dot online'; // Always green and pulsing
        statusDot.title = 'Online';
        header.appendChild(languageWrapper);
        header.appendChild(usernameWrapper);
        header.appendChild(statusDot);
        boosterCard.appendChild(header);

        const content = document.createElement('div');
        content.className = 'card-content';
        if (booster.lol_highest_rank) {
            const lolRankPanel = document.createElement('div');
            lolRankPanel.className = 'rank-panel';
            const lolRank = document.createElement('div');
            lolRank.className = 'rank-section';
            lolRank.innerHTML = `<span class="rank-label">LoL Rank:</span><span class="rank-value">${booster.lol_highest_rank}</span>`;
            lolRankPanel.appendChild(lolRank);
            content.appendChild(lolRankPanel);
        }
        if (booster.valorant_highest_rank) {
            const valorantRankPanel = document.createElement('div');
            valorantRankPanel.className = 'rank-panel';
            const valorantRank = document.createElement('div');
            valorantRank.className = 'rank-section';
            valorantRank.innerHTML = `<span class="rank-label">Valorant Rank:</span><span class="rank-value">${booster.valorant_highest_rank}</span>`;
            valorantRankPanel.appendChild(valorantRank);
            content.appendChild(valorantRankPanel);
        }
        if (booster.bio) {
            const bioDiv = document.createElement('div');
            bioDiv.className = 'bio-section';
            bioDiv.textContent = booster.bio;
            content.appendChild(bioDiv);
        }
        boosterCard.appendChild(content);

        const footer = document.createElement('div');
        footer.className = 'card-footer';
        const lolSection = document.createElement('div');
        lolSection.className = 'game-section lol-section';
        if (booster.lol_preferred_lanes) {
            const lanesDiv = document.createElement('div');
            lanesDiv.className = 'lanes';
            lanesDiv.innerHTML = '<span class="section-title">Lanes</span>';
            const lanesImages = document.createElement('div');
            lanesImages.className = 'images';
            booster.lol_preferred_lanes.split(',').forEach(lane => {
                const img = document.createElement('img');
                img.src = `/images/lanes/${lane.toLowerCase().replace(/\s+/g, '-')}.png`;
                img.alt = lane;
                img.className = 'profile-image';
                lanesImages.appendChild(img);
            });
            lanesDiv.appendChild(lanesImages);
            lolSection.appendChild(lanesDiv);
        }
        if (booster.lol_preferred_champions) {
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
            booster.lol_preferred_champions.split(',').forEach(champion => {
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

        const valorantSection = document.createElement('div');
        valorantSection.className = 'game-section valorant-section';
        if (booster.valorant_preferred_roles) {
            const rolesDiv = document.createElement('div');
            rolesDiv.className = 'roles';
            rolesDiv.innerHTML = '<span class="section-title">Roles</span>';
            const rolesImages = document.createElement('div');
            rolesImages.className = 'images';
            booster.valorant_preferred_roles.split(',').forEach(role => {
                const img = document.createElement('img');
                img.src = `/images/roles/${role.toLowerCase().replace(/\s+/g, '-')}.png`;
                img.alt = role;
                img.className = 'profile-image';
                rolesImages.appendChild(img);
            });
            rolesDiv.appendChild(rolesImages);
            valorantSection.appendChild(rolesDiv);
        }
        if (booster.valorant_preferred_agents) {
            const agentsDiv = document.createElement('div');
            agentsDiv.className = 'agents';
            agentsDiv.innerHTML = '<span class="section-title">Agents</span>';
            const agentsImages = document.createElement('div');
            agentsImages.className = 'images';
            booster.valorant_preferred_agents.split(',').forEach(agent => {
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
        boosterCard.appendChild(footer);

        if (booster.id == userId && ['booster', 'admin'].includes(role)) {
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-profile-btn';
            editBtn.textContent = 'Edit Profile';
            editBtn.addEventListener('click', () => showEditProfileModal(booster));
            boosterCard.appendChild(editBtn);
        }

        boostersContainer.appendChild(boosterCard);
    });
}

    async function showEditProfileModal(booster) {
        try {
            const response = await fetch(`/api/booster-profile?userId=${userId}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            const profile = await response.json();

            document.getElementById('lol-highest-rank').value = profile.lol_highest_rank || '';
            document.getElementById('valorant-highest-rank').value = profile.valorant_highest_rank || '';
            document.getElementById('language').value = profile.language || '';
            document.getElementById('bio').value = profile.bio || '';

            updateLaneButtons(profile.lol_preferred_lanes);
            updateSearchableDropdown('lol-preferred-champions', profile.lol_preferred_champions, 'champions');
            updateRoleButtons(profile.valorant_preferred_roles);
            updateSearchableDropdown('valorant-preferred-agents', profile.valorant_preferred_agents, 'agents');

            editProfileModal.style.display = 'block';
        } catch (error) {
            console.error('Error loading booster profile:', error);
            alert(`Failed to load profile: ${error.message}`);
        }
    }

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
        const imageContainerId = imageContainerIdMap[selectId];
        const imageContainer = document.getElementById(imageContainerId);
        if (!imageContainer) {
            console.warn(`Image container with ID ${imageContainerId} not found`);
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

    function setupModal() {
        const close = document.querySelector('#edit-profile-modal .close');
        close.addEventListener('click', () => {
            editProfileModal.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target === editProfileModal) {
                editProfileModal.style.display = 'none';
            }
        });

        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const profileData = {
                    lolHighestRank: document.getElementById('lol-highest-rank').value,
                    valorantHighestRank: document.getElementById('valorant-highest-rank').value,
                    lolPreferredLanes: getSelectedValues('lol-preferred-lanes'),
                    lolPreferredChampions: getSelectedValues('lol-preferred-champions'),
                    valorantPreferredRoles: getSelectedValues('valorant-preferred-roles'),
                    valorantPreferredAgents: getSelectedValues('valorant-preferred-agents'),
                    language: document.getElementById('language').value,
                    bio: document.getElementById('bio').value
                };

                const response = await fetch(`/api/booster-profile?userId=${userId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(profileData)
                });

                const responseData = await response.json();
                if (!response.ok) {
                    throw new Error(responseData.error || `HTTP ${response.status}: ${await response.text()}`);
                }

                alert('Profile updated successfully');
                editProfileModal.style.display = 'none';
                fetchBoosters();
            } catch (error) {
                console.error('Error updating profile:', error);
                alert(`Failed to update profile: ${error.message}`);
            }
        });
    }

  logoutLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof logout === 'function') {
        logout(); // Use your shared logout logic
    } else {
        console.error('logout() is not defined. Make sure utils.js or login.js is loaded.');
    }
});


    setupLaneButtons();
    setupRoleButtons();
    setupDropdowns();
    setupModal();
    await fetchBoosters();
});