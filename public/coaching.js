document.addEventListener('DOMContentLoaded', function () {
    const coachesList = document.getElementById('coaches-list');
    const editModal = document.getElementById('edit-coach-modal');
    const closeModal = editModal.querySelector('.modal-close');
    const editForm = document.getElementById('edit-coach-form');
    const logoutLink = document.getElementById('logout-link');
    let currentCoachId = null;

    async function fetchCoaches() {
        try {
            const response = await fetch('/api/coaches', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const coaches = await response.json();
            renderCoaches(coaches);
        } catch (error) {
            console.error('Error fetching coaches:', error.message);
            coachesList.innerHTML = '<p>Error loading coaches.</p>';
        }
    }

    function renderCoaches(coaches) {
        coachesList.innerHTML = '';
        const userRole = localStorage.getItem('userRole');
        const userId = localStorage.getItem('userId');
        coaches.forEach(coach => {
            if (coach.game_type && coach.price_per_hour) {
                const coachDiv = document.createElement('div');
                coachDiv.className = 'panel';
                coachDiv.innerHTML = `
                    <h3>${coach.name || 'Unnamed Coach'}</h3>
                    <p>Game: ${coach.game_type}</p>
                    <p>Bio: ${coach.bio || 'No bio provided'}</p>
                    <p>Rate: $${parseFloat(coach.price_per_hour).toFixed(2)}/hr</p>
                    ${userRole === 'admin' || (userRole === 'coach' && coach.user_id === parseInt(userId)) ? 
                        `<button class="edit-coach-btn" data-id="${coach.user_id}">Edit Profile</button>` : 
                        `<button class="purchase-coach-btn" data-id="${coach.user_id}">Purchase Session</button>`}
                `;
                coachesList.appendChild(coachDiv);
            }
        });
    }

    coachesList.addEventListener('click', async function (e) {
        if (e.target.classList.contains('edit-coach-btn')) {
            currentCoachId = e.target.dataset.id;
            try {
                const response = await fetch(`/api/coaches/${currentCoachId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                const coach = await response.json();
                document.getElementById('coach-name').value = coach.name || '';
                document.getElementById('coach-game').value = coach.game_type;
                document.getElementById('coach-bio').value = coach.bio || '';
                document.getElementById('coach-rate').value = coach.price_per_hour;
                editModal.style.display = 'block';
            } catch (error) {
                console.error('Error fetching coach:', error.message);
                alert('Failed to load coach profile.');
            }
        } else if (e.target.classList.contains('purchase-coach-btn')) {
            const coachId = e.target.dataset.id;
            const hours = prompt('Enter number of hours for the coaching session:');
            if (!hours || isNaN(hours) || hours <= 0) {
                alert('Please enter a valid number of hours.');
                return;
            }
            try {
                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        coach_id: parseInt(coachId),
                        order_type: 'coaching',
                        booked_hours: parseFloat(hours)
                    })
                });
                if (response.ok) {
                    alert('Coaching session purchased successfully!');
                    window.location.href = '/dashboard.html';
                } else {
                    const errorData = await response.json();
                    alert(`Failed to purchase coaching session: ${errorData.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error purchasing coaching session:', error.message);
                alert('Error purchasing coaching session.');
            }
        }
    });

    closeModal.addEventListener('click', function () {
        editModal.style.display = 'none';
    });

    window.addEventListener('click', function (event) {
        if (event.target === editModal) {
            editModal.style.display = 'none';
        }
    });

    editForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const updatedCoach = {
            name: document.getElementById('coach-name').value.trim(),
            game_type: document.getElementById('coach-game').value,
            bio: document.getElementById('coach-bio').value.trim(),
            price_per_hour: parseFloat(document.getElementById('coach-rate').value)
        };
        if (!updatedCoach.game_type || isNaN(updatedCoach.price_per_hour) || updatedCoach.price_per_hour <= 0) {
            alert('Please fill in all required fields with valid values.');
            return;
        }
        try {
            const response = await fetch(`/api/coaches/${currentCoachId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(updatedCoach)
            });
            if (response.ok) {
                editModal.style.display = 'none';
                fetchCoaches();
                alert('Coach profile updated successfully!');
            } else {
                const errorData = await response.json();
                alert(`Failed to update coach profile: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error updating coach:', error.message);
            alert('Error updating coach profile.');
        }
    });

    logoutLink.addEventListener('click', function (e) {
        e.preventDefault();
        localStorage.removeItem('userId');
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('userRole');
        localStorage.removeItem('token');
        window.location.href = '/league-services.html';
    });

    fetchCoaches();
});