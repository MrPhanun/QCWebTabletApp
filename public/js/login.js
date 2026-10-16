// Show the environment badge in non-production environments
if (window.APP_ENV && window.APP_ENV.showEnvBadge) {
  const b = document.getElementById('envBadge');
  b.textContent = window.APP_ENV.name;
  b.style.display = 'block';
}

// Sign in against tbUser via the server
const form = document.getElementById('loginForm');
const errorBox = document.getElementById('error');
const btn = document.getElementById('loginBtn');
const btnText = document.getElementById('loginText');

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove('show');
  void errorBox.offsetWidth; // restart the shake animation
  errorBox.classList.add('show');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('uid').value.trim();
  const password = document.getElementById('pw').value;
  if (!id || !password) return showError('Please enter ID and password • សូមបញ្ចូលអាយឌី និងពាក្យសម្ងាត់');

  btn.disabled = true;
  btnText.textContent = 'Signing in…';
  document.body.style.cursor = 'wait';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return location.replace('/menu.html');
    showError(res.status === 401 ? 'Incorrect ID or password • អាយឌី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ' : (data.error || 'Login failed'));
    if (res.status === 401) document.getElementById('pw').select();
  } catch {
    showError('Cannot reach the server');
  }
  document.body.style.cursor = '';
  btn.disabled = false;
  btnText.innerHTML = 'Login &nbsp;•&nbsp; ចូលប្រើ';
});
