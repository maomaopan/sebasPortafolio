const form = document.getElementById('contact-form');
const statusEl = document.getElementById('form-status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const button = form.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(form));

  button.disabled = true;
  statusEl.textContent = 'Sending...';

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();

    if (res.ok && json.ok) {
      statusEl.textContent = 'Message sent! Thank you (˶ᵔ ᵕ ᵔ˶)';
      form.reset();
    } else {
      statusEl.textContent = json.error || 'Something went wrong, please try again.';
    }
  } catch {
    statusEl.textContent = 'Network error, please try again.';
  } finally {
    button.disabled = false;
  }
});