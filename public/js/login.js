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

// This page shows English • Khmer together; server messages it can get, in the same form
const LOGIN_ERR = {
  'Invalid request': 'Invalid request • សំណើមិនត្រឹមត្រូវ',
  'Please enter ID and password': 'Please enter ID and password • សូមបញ្ចូលអាយឌី និងពាក្យសម្ងាត់',
  'Cannot connect to the database': 'Cannot connect to the database • មិនអាចភ្ជាប់ទៅមូលដ្ឋានទិន្នន័យបានទេ'
};

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
  btnText.textContent = 'Signing in…  •  កំពុងចូល…';
  document.body.style.cursor = 'wait';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return location.replace('/menu.html');
    showError(res.status === 401 ? 'Incorrect ID or password • អាយឌី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ' : (LOGIN_ERR[data.error] || data.error || 'Login failed • ចូលប្រើមិនបាន'));
    if (res.status === 401) document.getElementById('pw').select();
  } catch {
    showError('Cannot reach the server • មិនអាចភ្ជាប់ទៅម៉ាស៊ីនមេបានទេ');
  }
  document.body.style.cursor = '';
  btn.disabled = false;
  btnText.innerHTML = 'Login &nbsp;•&nbsp; ចូលប្រើ';
});
