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

  // -------- Token helpers --------

  function getTokenFromUrl() {
    try {
      const url = new URL(location.href);
      return (url.searchParams.get('token') || '').trim();
    } catch {
      return '';
    }
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function getToken() {
    return (localStorage.getItem(TOKEN_KEY) || '').trim();
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function setInputValueSafe(el, value) {
    if (!el) return;
    el.value = value;
  }

  // -------- API --------

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
    return `${currency} ${price}`;
  }

  // -------- Render / load --------

  async function loadAll() {
    const store = (await api('/api/store')).store;

    if (storeInfo) {
      storeInfo.innerHTML = `
        <div><b>Name:</b> ${escapeHtml(store.name)}</div>
        <div><b>Currency:</b> ${escapeHtml(store.currency)}</div>
        <div><b>Channel:</b> ${
          store.channel_username
            ? '@' + escapeHtml(store.channel_username)
            : (store.channel_id ? escapeHtml(store.channel_id) : '<span class="muted">Not linked</span>')
        }</div>
        <div><b>Delivery note:</b> ${escapeHtml(store.delivery_note || '')}</div>
      `;
    }

    const products = (await api('/api/products')).products || [];

    // NOTE: Your Worker currently ignores ?status= and returns all orders.
    // We'll still send it, but the UI will work either way.
    const status = statusFilter?.value || '';
    const orders = (await api(`/api/orders?status=${encodeURIComponent(status)}`)).orders || [];

    renderProducts(store, products);
    renderOrders(store, orders);

    const pending = orders.filter((o) => o.status === 'pending').length;
    if (statsEl) {
      statsEl.innerHTML = `
        <div><b>Products:</b> ${products.length}</div>
        <div><b>Orders shown:</b> ${orders.length}</div>
        <div><b>Pending:</b> ${pending}</div>
      `;
    }
  }

  function renderProducts(store, products) {
    if (!productsBody) return;
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

    // Attach actions
    productsBody.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = btn.getAttribute('data-act');
        const id = btn.getAttribute('data-id');
        try {
          if (act === 'toggle') {
            await toggleStock(id);
            await loadAll();
          } else if (act === 'edit') {
            await editProduct(id);
            await loadAll();
          }
        } catch (e) {
          alert(e.message);
        }
      });
    });
  }

  async function toggleStock(id) {
    // Your Worker does NOT provide /toggle-stock.
    // So we fetch the product from the list and flip in_stock using PUT /api/products/:id
    const products = (await api('/api/products')).products || [];
    const product = products.find((p) => p.id === id);
    if (!product) throw new Error('Product not found');
    const newStock = product.in_stock ? 0 : 1;

    await api(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: {
        name: product.name,
        price: product.price,
        description: product.description || '',
        in_stock: newStock,
        photo_file_id: product.photo_file_id || null,
      },
    });
  }

  async function editProduct(id) {
    // Your Worker does NOT provide GET /api/products/:id
    // So we fetch from /api/products list.
    const products = (await api('/api/products')).products || [];
    const product = products.find((p) => p.id === id);
    if (!product) throw new Error('Product not found');

    const name = prompt('Product name', product.name);
    if (name === null) return;

    const priceStr = prompt('Price (number)', String(product.price));
    if (priceStr === null) return;
    const price = Number(priceStr);

    if (!Number.isFinite(price) || price < 0) {
      alert('Invalid price');
      return;
    }

    const description = prompt('Description', product.description || '') ?? '';
    const inStock = confirm('In stock? (OK=yes, Cancel=no)') ? 1 : 0;
    const photo_file_id = prompt('Photo file_id (optional)', product.photo_file_id || '') ?? '';

    await api(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: {
        name: name.trim(),
        price,
        description,
        in_stock: inStock,
        photo_file_id: photo_file_id.trim() || null,
      },
    });
  }

  function renderOrders(store, orders) {
    if (!ordersBody) return;
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

    ordersBody.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = btn.getAttribute('data-act');
        const id = btn.getAttribute('data-id');
        try {
          const status = act === 'done' ? 'done' : 'pending';
          // Your Worker expects PUT here (not POST)
          await api(`/api/orders/${encodeURIComponent(id)}/status`, { method: 'PUT', body: { status } });
          await loadAll();
        } catch (e) {
          alert(e.message);
        }
      });
    });
  }

  // -------- UI toggles --------

  function showApp() {
    if (loginSection) loginSection.hidden = true;
    if (appSection) appSection.hidden = false;
    if (logoutBtn) logoutBtn.hidden = false;
  }

  function showLogin() {
    if (loginSection) loginSection.hidden = false;
    if (appSection) appSection.hidden = true;
    if (logoutBtn) logoutBtn.hidden = true;
  }

  async function doLogin(token) {
    if (!token) throw new Error('Missing token');
    setToken(token);
    showApp();
    await loadAll();
  }

  // -------- Escape helpers --------

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // -------- Event wiring --------
  // IMPORTANT: only attach listeners if elements exist.
  function wireEvents() {
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const token = tokenInput ? tokenInput.value.trim() : '';
        if (!token) return;
        try {
          await doLogin(token);
        } catch (e) {
          clearToken();
          alert('Login failed: ' + e.message);
          showLogin();
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        clearToken();
        location.href = location.pathname;
      });
    }

    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        try {
          const name = newName ? newName.value.trim() : '';
          const price = Number(newPrice ? newPrice.value : NaN);
          const description = newDesc ? newDesc.value.trim() : '';
          const in_stock = newStock ? (newStock.checked ? 1 : 0) : 1;
          const photo_file_id = newPhotoId ? (newPhotoId.value.trim() || null) : null;

          if (!name || !Number.isFinite(price)) {
            alert('Name and numeric price are required');
            return;
          }

          await api('/api/products', { method: 'POST', body: { name, price, description, in_stock, photo_file_id } });

          if (newName) newName.value = '';
          if (newPrice) newPrice.value = '';
          if (newDesc) newDesc.value = '';
          if (newStock) newStock.checked = true;
          if (newPhotoId) newPhotoId.value = '';

          await loadAll();
        } catch (e) {
          alert(e.message);
        }
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => loadAll().catch((e) => alert(e.message)));
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', () => loadAll().catch((e) => alert(e.message)));
    }
  }

  // -------- Boot --------
  async function boot() {
    const urlToken = getTokenFromUrl();
    const existing = getToken();

    // Prefer URL token, then saved token
    const chosen = urlToken || existing;

    // Only set tokenInput if it exists
    setInputValueSafe(tokenInput, chosen);

    if (chosen) {
      try {
        await doLogin(chosen);
        return;
      } catch (e) {
        // If the URL token fails, clear saved token
        clearToken();
      }
    }

    showLogin();
  }

  window.addEventListener('DOMContentLoaded', () => {
    wireEvents();
    boot().catch((e) => {
      clearToken();
      showLogin();
      alert('Login failed: ' + e.message);
    });
  });
})();