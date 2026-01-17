(() => {
  const $ = (id) => document.getElementById(id);

  const loginSection = $('login');
  const appSection = $('app');
  const tokenInput = $('tokenInput');
  const loginBtn = $('loginBtn');
  const logoutBtn = $('logoutBtn');

  const storeInfo = $('storeInfo');
  const statsEl = $('stats');
  const productsBody = $('productsBody');
  const ordersBody = $('ordersBody');

  const newName = $('newName');
  const newPrice = $('newPrice');
  const newDesc = $('newDesc');
  const newStock = $('newStock');
  const newPhotoId = $('newPhotoId');
  const addBtn = $('addBtn');
  const refreshBtn = $('refreshBtn');

  const statusFilter = $('statusFilter');

  const TOKEN_KEY = 'cysb_token';

  function getTokenFromUrl() {
    const url = new URL(location.href);
    return url.searchParams.get('token');
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  async function api(path, { method = 'GET', body } = {}) {
    const token = getToken();
    const headers = { 'content-type': 'application/json' };
    if (token) headers['authorization'] = `Bearer ${token}`;

    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const msg = data.error || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  function formatMoney(currency, price) {
    if (!currency) return String(price);
    // currency is typically "NGN" or "₦"; keep it simple.
    return `${currency} ${price}`;
  }

  async function loadAll() {
    const store = (await api('/api/store')).store;
    storeInfo.innerHTML = `
      <div><b>Name:</b> ${escapeHtml(store.name)}</div>
      <div><b>Currency:</b> ${escapeHtml(store.currency)}</div>
      <div><b>Channel:</b> ${store.channel_username ? '@' + escapeHtml(store.channel_username) : (store.channel_id ? escapeHtml(store.channel_id) : '<span class="muted">Not linked</span>')}</div>
      <div><b>Delivery note:</b> ${escapeHtml(store.delivery_note || '')}</div>
    `;

    const products = (await api('/api/products')).products;
    const status = statusFilter.value;
    const orders = (await api(`/api/orders?status=${encodeURIComponent(status)}`)).orders;

    renderProducts(store, products);
    renderOrders(store, orders);

    const pending = orders.filter(o => o.status === 'pending').length;
    statsEl.innerHTML = `
      <div><b>Products:</b> ${products.length}</div>
      <div><b>Orders shown:</b> ${orders.length}</div>
      <div><b>Pending:</b> ${pending}</div>
    `;
  }

  function renderProducts(store, products) {
    productsBody.innerHTML = '';
    for (const p of products) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(formatMoney(store.currency, p.price))}</td>
        <td>${p.in_stock ? '<span class="pill ok">In stock</span>' : '<span class="pill bad">Out</span>'}</td>
        <td class="muted">${p.photo_file_id ? '<code>' + escapeHtml(p.photo_file_id) + '</code>' : ''}</td>
        <td>
          <button class="btn tiny" data-act="toggle" data-id="${escapeAttr(p.id)}">Toggle stock</button>
          <button class="btn tiny secondary" data-act="edit" data-id="${escapeAttr(p.id)}">Edit</button>
        </td>
      `;
      productsBody.appendChild(tr);
    }

    productsBody.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const act = btn.getAttribute('data-act');
        const id = btn.getAttribute('data-id');
        try {
          if (act === 'toggle') {
            await api(`/api/products/${encodeURIComponent(id)}/toggle-stock`, { method: 'POST' });
            await loadAll();
          } else if (act === 'edit') {
            await editProduct(id);
          }
        } catch (e) {
          alert(e.message);
        }
      });
    });
  }

  async function editProduct(id) {
    const product = (await api(`/api/products/${encodeURIComponent(id)}`)).product;
    const name = prompt('Product name', product.name);
    if (name === null) return;
    const priceStr = prompt('Price (number)', String(product.price));
    if (priceStr === null) return;
    const price = Number(priceStr);
    const description = prompt('Description', product.description || '') ?? '';
    const inStock = confirm('In stock? (OK=yes, Cancel=no)') ? 1 : 0;
    const photo_file_id = prompt('Photo file_id (optional)', product.photo_file_id || '') ?? '';

    await api(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: { name: name.trim(), price, description, in_stock: inStock, photo_file_id: photo_file_id.trim() || null },
    });
    await loadAll();
  }

  function renderOrders(store, orders) {
    ordersBody.innerHTML = '';
    for (const o of orders) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${escapeHtml(o.id)}</code></td>
        <td>${escapeHtml(o.product_name || '')}</td>
        <td>${escapeHtml(String(o.qty))}</td>
        <td>${o.buyer_username ? '@' + escapeHtml(o.buyer_username) : '<span class="muted">(unknown)</span>'}</td>
        <td>${escapeHtml(o.status)}</td>
        <td>
          <button class="btn tiny" data-act="done" data-id="${escapeAttr(o.id)}">Mark done</button>
          <button class="btn tiny secondary" data-act="pending" data-id="${escapeAttr(o.id)}">Mark pending</button>
        </td>
      `;
      ordersBody.appendChild(tr);
    }

    ordersBody.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const act = btn.getAttribute('data-act');
        const id = btn.getAttribute('data-id');
        try {
          const status = act === 'done' ? 'done' : 'pending';
          await api(`/api/orders/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status } });
          await loadAll();
        } catch (e) {
          alert(e.message);
        }
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function showApp() {
    loginSection.hidden = true;
    appSection.hidden = false;
    logoutBtn.hidden = false;
  }

  function showLogin() {
    loginSection.hidden = false;
    appSection.hidden = true;
    logoutBtn.hidden = true;
  }

  async function doLogin(token) {
    setToken(token);
    showApp();
    await loadAll();
  }

  loginBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) return;
    try {
      await doLogin(token);
    } catch (e) {
      clearToken();
      alert('Login failed: ' + e.message);
      showLogin();
    }
  });

  logoutBtn.addEventListener('click', () => {
    clearToken();
    location.href = location.pathname;
  });

  addBtn.addEventListener('click', async () => {
    try {
      const name = newName.value.trim();
      const price = Number(newPrice.value);
      const description = newDesc.value.trim();
      const in_stock = newStock.checked ? 1 : 0;
      const photo_file_id = newPhotoId.value.trim() || null;
      if (!name || !Number.isFinite(price)) {
        alert('Name and numeric price are required');
        return;
      }
      await api('/api/products', { method: 'POST', body: { name, price, description, in_stock, photo_file_id } });
      newName.value = '';
      newPrice.value = '';
      newDesc.value = '';
      newStock.checked = true;
      newPhotoId.value = '';
      await loadAll();
    } catch (e) {
      alert(e.message);
    }
  });

  refreshBtn.addEventListener('click', () => loadAll().catch(e => alert(e.message)));
  statusFilter.addEventListener('change', () => loadAll().catch(e => alert(e.message)));

  (async () => {
    const urlToken = getTokenFromUrl();
    if (urlToken) {
      tokenInput.value = urlToken;
      try { await doLogin(urlToken); return; } catch { /* fall through */ }
    }
    const existing = getToken();
    if (existing) {
      tokenInput.value = existing;
      try { await doLogin(existing); return; } catch { /* fall through */ }
    }
    showLogin();
  })();
})();
