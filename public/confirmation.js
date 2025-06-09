(async function () {
  if (window.confirmationScriptRan) {
    console.log('Confirmation script already ran, skipping.');
    return;
  }
  window.confirmationScriptRan = true;

  console.log('Loading confirmation page at:', new Date().toISOString());

  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id') || localStorage.getItem('lastSessionId');
  console.log('Session ID:', sessionId);

  if (!sessionId) {
    console.error('No session_id found in URL or localStorage');
    return;
  }
  localStorage.setItem('lastSessionId', sessionId);

  try {
    const sessionResponse = await fetch(`/api/get-session?session_id=${sessionId}`);
    if (!sessionResponse.ok) {
      throw new Error(`HTTP error! Status: ${sessionResponse.status}`);
    }
    const { session } = await sessionResponse.json();
    console.log('Session data:', session);

    const orderId = session.metadata?.orderId;
    if (!orderId) {
      throw new Error('No orderId found in session metadata');
    }

    console.log('Order ID verified:', orderId);
    console.log('Confirmation page loaded successfully at:', new Date().toISOString());
  } catch (error) {
    console.error('Error verifying session:', error, error.stack);
  }
})();