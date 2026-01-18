/* app.js (Orderlyy Dashboard) */
(() => {
  const $ = (id) => document.getElementById(id);

  // Sections
  const loginSection = $("login");
  const appSection = $("app");

  // Auth
  const tokenInput = $("tokenInput");
  const loginBtn = $("loginBtn");
  const logoutBtn = $("logoutBtn");

  // Sidebar nav + panels
  const navButtons = Array.from(document.querySelectorAll(".navBtn"));
  const panels = {
    overview: $("panel-overview"),
    products: $("panel-products"),
    orders: $("panel-orders"),
    payments: $("panel-payments"),
    settings: $("panel-settings"),
  };

  // Header store subtitle
  const storeSubtitle = $("storeSubtitle");

  // Overview / Analytics
  const storeInfo = $("storeInfo");
  const periodSelect = $("periodSelect");
  const analyticsMsg = $("analyticsMsg");

  const kpiOrders = $("kpiOrders");
  const kpiOrdersDelta = $("kpiOrdersDelta");
  const kpiRevenue = $("kpiRevenue");
  const kpiRevenueDelta = $("kpiRevenueDelta");
  const kpiPending = $("kpiPending");
  const kpiPendingDelta = $("kpiPendingDelta");
  const kpiProducts = $("kpiProducts");
  const kpiProductsDelta = $("kpiProductsDelta");

  const ordersChartCanvas = $("ordersChart");
  let ordersChart = null;

  // Products
  const refreshProductsBtn = $("refreshProducts");
  const productForm = $("productForm");
  const clearFormBtn = $("clearForm");
  const productFormMsg = $("productFormMsg");
  const productsTable = $("productsTable");
  const productsTbody = productsTable ? productsTable.querySelector("tbody") : null;

  // Orders
  const refreshOrdersBtn = $("refreshOrders");
  const ordersTable = $("ordersTable");
  const ordersTbody = ordersTable ? ordersTable.querySelector("tbody") : null;

  // Payments
  const refreshPaymentsBtn = $("refreshPayments");
  const paymentsStatus = $("paymentsStatus");
  const paymentsMsg = $("paymentsMsg");
  const paymentsTable = $("paymentsTable");
  const paymentsTbody = paymentsTable ? paymentsTable.querySelector("tbody") : null;

  // Payment modal
  const payModal = $("payModal");
  const payModalBackdrop = $("payModalBackdrop");
  const payModalClose = $("payModalClose");
  const payModalTitle = $("payModalTitle");
  const payModalMeta = $("payModalMeta");
  const payModalProof = $("payModalProof");
  const payModalActions = $("payModalActions");

  // Settings (Bank)
  const bankForm = $("bankForm");
  const bankMsg = $("bankMsg");
  const bankName = $("bank_name");
  const accountNumber = $("account_number");
  const accountName = $("account_name");

  // Subscription
  const subBadge = $("subBadge");
  const subText = $("subText");
  const subContact = $("subContact");

  // Token storage
  const TOKEN_KEY = "orderlyy_token";

  // Cache
  let cachedStore = null;
  let cachedProducts = [];
  let cachedOrders = [];
  let cachedPayments = [];

  // ---------- Token helpers ----------
  function getTokenFromUrl() {
    try {
      const url = new URL(location.href);
      return (url.searchParams.get("token") || "").trim();
    } catch {
      return "";
    }
  }
  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
  function getToken() {
    return (localStorage.getItem(TOKEN_KEY) || "").trim();
  }
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }
  function setInputValueSafe(el, value) {
    if (!el) return;
    el.value = value;
  }

  // ---------- API ----------
  async function api(path, { method = "GET", body } = {}) {
    const token = getToken();
    const headers = { "content-type": "application/json" };
    if (token) headers["authorization"] = `Bearer ${token}`;

    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const msg = data.error || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.httpStatus = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  }

  // ---------- Formatting ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function formatMoney(currency, value) {
    if (value === null || value === undefined) return "—";
    const cur = currency || "";
    return `${cur}${value}`;
  }

  function formatDateTime(s) {
    if (!s) return "—";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return escapeHtml(String(s));
    return d.toLocaleString();
  }

  // ---------- Navigation (left sidebar) ----------
  function setActivePanel(name) {
    navButtons.forEach((b) => {
      b.classList.toggle("active", b.dataset.nav === name);
    });
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      el.hidden = key !== name;
    });
    // update URL hash (nice UX)
    try {
      history.replaceState(null, "", `#${name}`);
    } catch {}
  }

  function getInitialPanel() {
    const h = (location.hash || "").replace("#", "").trim();
    if (h && panels[h]) return h;
    return "overview";
  }

  // ---------- UI show/hide ----------
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

  // ---------- Subscription UX ----------
  function renderSubscription(store) {
    if (!store) return;

    const active = !!store.subscription_active;
    const status = String(store.subscription_status || "unknown");
    const exp = store.subscription_expires_at || "";
    const supportUser = store.support_username || "orderlyysupport";
    const supportLink = store.support_link || `https://t.me/${supportUser}`;

    if (subBadge) {
      subBadge.className = active ? "pill ok" : "pill bad";
      subBadge.textContent = active ? "Active" : "Expired";
    }

    if (subText) {
      const expTxt = exp ? formatDateTime(exp) : "—";
      subText.innerHTML = `
        <div><b>Plan:</b> ${escapeHtml(status)}</div>
        <div><b>Expiry:</b> ${escapeHtml(expTxt)}</div>
        <div class="muted small">Activation is handled by support for now.</div>
      `;
    }

    if (subContact) {
      subContact.href = supportLink;
      subContact.textContent = `@${supportUser}`;
    }
  }

  function renderWriteLockMessage(err) {
    // Worker returns 402 for subscription_required (we used that)
    if (!err) return "";
    const is402 = err.httpStatus === 402;
    if (!is402) return "";
    const support = cachedStore?.support_username ? `@${cachedStore.support_username}` : "@orderlyysupport";
    return `🔒 Subscription required. Message ${support} to activate.`;
  }

  // ---------- Store ----------
  async function loadStore() {
    const out = await api("/api/store");
    cachedStore = out.store;

    if (storeSubtitle && cachedStore?.name) {
      storeSubtitle.innerHTML = `Managing <b>${escapeHtml(cachedStore.name)}</b> — keep your token private.`;
    }

    renderSubscription(cachedStore);

    // Fill store info (overview)
    if (storeInfo) {
      const channel = cachedStore.channel_username
        ? "@" + escapeHtml(cachedStore.channel_username)
        : (cachedStore.channel_id ? escapeHtml(cachedStore.channel_id) : '<span class="muted">Not linked</span>');

      storeInfo.innerHTML = `
        <div class="infoGrid">
          <div><div class="muted small">Store name</div><div><b>${escapeHtml(cachedStore.name || "")}</b></div></div>
          <div><div class="muted small">Currency</div><div><b>${escapeHtml(cachedStore.currency || "")}</b></div></div>
          <div><div class="muted small">Channel</div><div>${channel}</div></div>
          <div><div class="muted small">Delivery note</div><div>${escapeHtml(cachedStore.delivery_note || "")}</div></div>
        </div>
      `;
    }

    // Pre-fill settings bank form
    if (bankName) bankName.value = cachedStore.bank_name || "";
    if (accountNumber) accountNumber.value = cachedStore.account_number || "";
    if (accountName) accountName.value = cachedStore.account_name || "";

    return cachedStore;
  }

  // ---------- Products ----------
  async function loadProducts() {
    const out = await api("/api/products");
    cachedProducts = out.products || [];
    renderProducts();
    return cachedProducts;
  }

  function renderProducts() {
    if (!productsTbody || !cachedStore) return;
    productsTbody.innerHTML = "";

    for (const p of cachedProducts) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div class="cellMain">${escapeHtml(p.name)}</div>
          <div class="muted small">${p.description ? escapeHtml(p.description) : ""}</div>
        </td>
        <td><b>${escapeHtml(formatMoney(cachedStore.currency, p.price))}</b></td>
        <td>${p.in_stock ? '<span class="pill ok">In stock</span>' : '<span class="pill bad">Out</span>'}</td>
        <td class="muted">${p.photo_file_id ? `<code>${escapeHtml(p.photo_file_id)}</code>` : ""}</td>
        <td class="rowActions">
          <button class="btn secondary tiny" data-act="toggle" data-id="${escapeHtml(p.id)}">Toggle</button>
          <button class="btn secondary tiny" data-act="edit" data-id="${escapeHtml(p.id)}">Edit</button>
        </td>
      `;
      productsTbody.appendChild(tr);
    }

    productsTbody.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");
        try {
          if (act === "toggle") {
            await toggleStock(id);
            await loadProducts();
            await loadAnalyticsSafe();
          } else if (act === "edit") {
            await editProduct(id);
            await loadProducts();
            await loadAnalyticsSafe();
          }
        } catch (e) {
          alert(e.message || "Failed");
        }
      });
    });
  }

  async function toggleStock(id) {
    const product = cachedProducts.find((p) => p.id === id);
    if (!product) throw new Error("Product not found");

    const newStock = product.in_stock ? 0 : 1;
    await api(`/api/products/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: {
        name: product.name,
        price: product.price,
        description: product.description || "",
        in_stock: newStock,
        photo_file_id: product.photo_file_id || null,
      },
    });
  }

  async function editProduct(id) {
    const product = cachedProducts.find((p) => p.id === id);
    if (!product) throw new Error("Product not found");

    const name = prompt("Product name", product.name);
    if (name === null) return;

    const priceStr = prompt("Price (number)", String(product.price));
    if (priceStr === null) return;
    const price = Number(priceStr);
    if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price");

    const description = prompt("Description", product.description || "") ?? "";
    const inStock = confirm("In stock? (OK=yes, Cancel=no)") ? 1 : 0;
    const photo_file_id = prompt("Photo file_id (optional)", product.photo_file_id || "") ?? "";

    await api(`/api/products/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: {
        name: name.trim(),
        price,
        description,
        in_stock: inStock,
        photo_file_id: photo_file_id.trim() || null,
      },
    });
  }

  async function addProductFromForm() {
    if (!productForm) return;
    if (productFormMsg) productFormMsg.textContent = "";

    const fd = new FormData(productForm);
    const name = String(fd.get("name") || "").trim();
    const price = Number(fd.get("price") || 0);
    const description = String(fd.get("description") || "").trim();
    const in_stock = String(fd.get("in_stock") || "1") === "1" ? 1 : 0;
    const photo_file_id = String(fd.get("photo_file_id") || "").trim() || null;

    if (!name || !Number.isFinite(price)) {
      if (productFormMsg) productFormMsg.textContent = "Name + numeric price are required.";
      return;
    }

    try {
      await api("/api/products", { method: "POST", body: { name, price, description, in_stock, photo_file_id } });
      productForm.reset();
      const stockSel = productForm.querySelector('select[name="in_stock"]');
      if (stockSel) stockSel.value = "1";
      if (productFormMsg) productFormMsg.textContent = "Product added ✅";
      await loadProducts();
      await loadAnalyticsSafe();
    } catch (e) {
      const lock = renderWriteLockMessage(e);
      if (productFormMsg) productFormMsg.textContent = lock || `Error: ${e.message}`;
      throw e;
    }
  }

  // ---------- Orders ----------
  async function loadOrders() {
    const out = await api("/api/orders");
    cachedOrders = out.orders || [];
    renderOrders();
    return cachedOrders;
  }

  function renderOrders() {
    if (!ordersTbody) return;
    ordersTbody.innerHTML = "";

    for (const o of cachedOrders) {
      const buyer = o.buyer_username ? "@" + escapeHtml(o.buyer_username) : '<span class="muted">(unknown)</span>';
      const delivery = o.delivery_text ? escapeHtml(o.delivery_text) : '<span class="muted">—</span>';

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><code>${escapeHtml(o.id)}</code></td>
        <td>${escapeHtml(o.product_name || "")}</td>
        <td>${buyer}</td>
        <td><b>${escapeHtml(String(o.qty))}</b></td>
        <td><span class="pill ${o.status === "pending" ? "warn" : "soft"}">${escapeHtml(o.status || "")}</span></td>
        <td class="muted small">${delivery}</td>
        <td class="rowActions">
          <button class="btn secondary tiny" data-act="done" data-id="${escapeHtml(o.id)}">Done</button>
          <button class="btn secondary tiny" data-act="pending" data-id="${escapeHtml(o.id)}">Pending</button>
        </td>
      `;
      ordersTbody.appendChild(tr);
    }

    ordersTbody.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");
        try {
          const status = act === "done" ? "done" : "pending";
          await api(`/api/orders/${encodeURIComponent(id)}/status`, { method: "PUT", body: { status } });
          await loadOrders();
          await loadAnalyticsSafe();
        } catch (e) {
          alert(renderWriteLockMessage(e) || e.message);
        }
      });
    });
  }

  // ---------- Payments ----------
  async function loadPayments() {
    if (paymentsMsg) paymentsMsg.textContent = "";
    const status = paymentsStatus ? paymentsStatus.value : "";
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const out = await api(`/api/payments${qs}`);
    cachedPayments = out.payments || [];
    renderPayments();
    return cachedPayments;
  }

  function statusPill(status) {
    const s = String(status || "");
    if (s === "awaiting") return '<span class="pill warn">awaiting</span>';
    if (s === "confirmed") return '<span class="pill ok">confirmed</span>';
    if (s === "rejected") return '<span class="pill bad">rejected</span>';
    return `<span class="pill soft">${escapeHtml(s)}</span>`;
  }

  function renderPayments() {
    if (!paymentsTbody || !cachedStore) return;
    paymentsTbody.innerHTML = "";

    if (!cachedPayments.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" class="muted" style="padding:14px;">No payments yet.</td>`;
      paymentsTbody.appendChild(tr);
      return;
    }

    for (const p of cachedPayments) {
      const buyer = p.buyer_username ? "@" + escapeHtml(p.buyer_username) : '<span class="muted">(unknown)</span>';
      const amount = formatMoney(p.currency || cachedStore.currency, p.amount);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><code>${escapeHtml(p.id)}</code></td>
        <td><code>${escapeHtml(p.order_id)}</code></td>
        <td>${escapeHtml(p.product_name || "")}</td>
        <td>${buyer}</td>
        <td><b>${escapeHtml(amount)}</b></td>
        <td>${statusPill(p.status)}</td>
        <td class="rowActions">
          <button class="btn secondary tiny" data-act="view" data-id="${escapeHtml(p.id)}">View</button>
          <button class="btn tiny" data-act="approve" data-id="${escapeHtml(p.id)}" ${p.status !== "awaiting" ? "disabled" : ""}>Approve</button>
          <button class="btn danger tiny" data-act="reject" data-id="${escapeHtml(p.id)}" ${p.status !== "awaiting" ? "disabled" : ""}>Reject</button>
        </td>
      `;
      paymentsTbody.appendChild(tr);
    }

    paymentsTbody.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");
        try {
          if (act === "view") {
            await openPaymentModal(id);
            return;
          }
          if (act === "approve") {
            if (!confirm("Approve this payment?")) return;
            await api(`/api/payments/${encodeURIComponent(id)}/approve`, { method: "PUT" });
            await Promise.all([loadPayments(), loadOrders(), loadAnalyticsSafe()]);
            return;
          }
          if (act === "reject") {
            if (!confirm("Reject this payment?")) return;
            await api(`/api/payments/${encodeURIComponent(id)}/reject`, { method: "PUT" });
            await Promise.all([loadPayments(), loadOrders(), loadAnalyticsSafe()]);
            return;
          }
        } catch (e) {
          const msg = renderWriteLockMessage(e) || e.message;
          if (paymentsMsg) paymentsMsg.textContent = msg;
          alert(msg);
        }
      });
    });
  }

  async function openPaymentModal(paymentId) {
    if (!payModal) return;

    // Reset
    if (payModalTitle) payModalTitle.textContent = "Payment";
    if (payModalMeta) payModalMeta.innerHTML = "";
    if (payModalProof) payModalProof.innerHTML = "";
    if (payModalActions) payModalActions.innerHTML = "";

    // Show now (fast)
    showPayModal(true);

    let details = null;
    try {
      details = await api(`/api/payments/${encodeURIComponent(paymentId)}`);
    } catch (e) {
      if (payModalMeta) payModalMeta.innerHTML = `<div class="muted">Failed to load: ${escapeHtml(e.message)}</div>`;
      return;
    }

    const pay = details.payment || {};
    const order = details.order || {};
    const product = details.product || {};
    const currency = details.store?.currency || cachedStore?.currency || "";

    if (payModalTitle) {
      payModalTitle.textContent = `Payment • ${pay.status || ""}`;
    }

    const buyer = pay.buyer_username ? "@" + escapeHtml(pay.buyer_username) : escapeHtml(String(pay.buyer_id || ""));
    const amount = escapeHtml(formatMoney(currency, pay.amount));
    const when = formatDateTime(pay.created_at);
    const delivery = order.delivery_text ? escapeHtml(order.delivery_text) : '<span class="muted">—</span>';

    if (payModalMeta) {
      payModalMeta.innerHTML = `
        <div class="modalGrid">
          <div><div class="muted small">Payment ID</div><div><code>${escapeHtml(pay.id || "")}</code></div></div>
          <div><div class="muted small">Order ID</div><div><code>${escapeHtml(pay.order_id || "")}</code></div></div>
          <div><div class="muted small">Product</div><div><b>${escapeHtml(product.name || "")}</b></div></div>
          <div><div class="muted small">Buyer</div><div>${buyer}</div></div>
          <div><div class="muted small">Amount</div><div><b>${amount}</b></div></div>
          <div><div class="muted small">Submitted</div><div>${escapeHtml(when)}</div></div>
          <div style="grid-column:1/-1;">
            <div class="muted small">Delivery details</div>
            <div class="monoBox">${delivery}</div>
          </div>
        </div>
      `;
    }

    // Proof preview
    const isPhoto = String(pay.proof_type || "") === "photo";
    if (payModalProof) {
      if (isPhoto) {
        const imgUrl = `/api/payments/${encodeURIComponent(pay.id)}/proof`;
        payModalProof.innerHTML = `
          <div class="proofWrap">
            <img src="${imgUrl}" alt="Proof" />
          </div>
          <div class="muted small">Tip: long-press / open image in new tab if you want to zoom.</div>
        `;
      } else {
        payModalProof.innerHTML = `
          <div class="muted">Proof is a document (Telegram file_id). Open Telegram to view it.</div>
          <div class="monoBox"><code>${escapeHtml(pay.proof_file_id || "")}</code></div>
        `;
      }
    }

    // Actions
    if (payModalActions) {
      if (pay.status === "awaiting") {
        payModalActions.innerHTML = `
          <button class="btn" id="modalApprove">Approve</button>
          <button class="btn danger" id="modalReject">Reject</button>
          <button class="btn secondary" id="modalClose2">Close</button>
          <div class="muted small" style="margin-top:8px;">Approving asks buyer for delivery details automatically.</div>
        `;
        const modalApprove = $("modalApprove");
        const modalReject = $("modalReject");
        const modalClose2 = $("modalClose2");

        if (modalApprove) {
          modalApprove.addEventListener("click", async () => {
            try {
              await api(`/api/payments/${encodeURIComponent(pay.id)}/approve`, { method: "PUT" });
              showPayModal(false);
              await Promise.all([loadPayments(), loadOrders(), loadAnalyticsSafe()]);
            } catch (e) {
              alert(renderWriteLockMessage(e) || e.message);
            }
          });
        }
        if (modalReject) {
          modalReject.addEventListener("click", async () => {
            if (!confirm("Reject this payment?")) return;
            try {
              await api(`/api/payments/${encodeURIComponent(pay.id)}/reject`, { method: "PUT" });
              showPayModal(false);
              await Promise.all([loadPayments(), loadOrders(), loadAnalyticsSafe()]);
            } catch (e) {
              alert(renderWriteLockMessage(e) || e.message);
            }
          });
        }
        if (modalClose2) modalClose2.addEventListener("click", () => showPayModal(false));
      } else {
        payModalActions.innerHTML = `<button class="btn secondary" id="modalClose3">Close</button>`;
        const modalClose3 = $("modalClose3");
        if (modalClose3) modalClose3.addEventListener("click", () => showPayModal(false));
      }
    }
  }

  function showPayModal(show) {
    if (!payModal) return;
    payModal.hidden = !show;
    if (payModalBackdrop) payModalBackdrop.hidden = !show;
    document.body.classList.toggle("modalOpen", !!show);
  }

  // ---------- Settings (Bank) ----------
  async function saveBankDetails() {
    if (!bankForm) return;
    if (bankMsg) bankMsg.textContent = "";

    const fd = new FormData(bankForm);
    const bank_name = String(fd.get("bank_name") || "").trim();
    const account_number = String(fd.get("account_number") || "").trim();
    const account_name = String(fd.get("account_name") || "").trim();

    if (!bank_name || !account_number || !account_name) {
      if (bankMsg) bankMsg.textContent = "All bank fields are required.";
      return;
    }

    try {
      await api("/api/store/bank", {
        method: "PUT",
        body: { bank_name, account_number, account_name },
      });
      if (bankMsg) bankMsg.textContent = "Saved ✅";
      await loadStore(); // refresh store data
    } catch (e) {
      const lock = renderWriteLockMessage(e);
      if (bankMsg) bankMsg.textContent = lock || `Error: ${e.message}`;
      throw e;
    }
  }

  // ---------- Analytics ----------
  function setKpiValue(el, val) {
    if (!el) return;
    el.textContent = String(val ?? "—");
  }

  function setDelta(el, pct) {
    if (!el) return;

    if (pct === null || pct === undefined || !Number.isFinite(Number(pct))) {
      el.className = "kpiDelta muted deltaFlat";
      el.innerHTML = "—";
      return;
    }

    const n = Number(pct);
    const abs = Math.abs(n).toFixed(1);

    if (n > 0) {
      el.className = "kpiDelta deltaUp";
      el.innerHTML = `<span class="tri up"></span><span>+${abs}%</span>`;
    } else if (n < 0) {
      el.className = "kpiDelta deltaDown";
      el.innerHTML = `<span class="tri down"></span><span>-${abs}%</span>`;
    } else {
      el.className = "kpiDelta muted deltaFlat";
      el.innerHTML = `<span>0.0%</span>`;
    }
  }

  function buildChart(labels, values) {
    if (!ordersChartCanvas || typeof Chart === "undefined") return;

    const data = {
      labels,
      datasets: [{
        label: "Orders",
        data: values,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 2,
      }],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#a7b0c0" }, grid: { color: "rgba(31,42,64,0.35)" } },
        y: { ticks: { color: "#a7b0c0", precision: 0 }, grid: { color: "rgba(31,42,64,0.35)" } },
      },
    };

    if (!ordersChart) {
      ordersChart = new Chart(ordersChartCanvas.getContext("2d"), { type: "line", data, options });
    } else {
      ordersChart.data = data;
      ordersChart.update();
    }
  }

  async function loadAnalyticsSafe() {
    if (!cachedStore) return;
    const period = periodSelect ? periodSelect.value : "30d";

    try {
      const out = await api(`/api/analytics?period=${encodeURIComponent(period)}`);
      const a = out.analytics || {};

      setKpiValue(kpiOrders, a.orders_total ?? cachedOrders.length);
      setDelta(kpiOrdersDelta, a.orders_change_pct);

      setKpiValue(kpiRevenue, a.revenue_total ?? 0);
      setDelta(kpiRevenueDelta, a.revenue_change_pct);

      const pendingFallback = cachedOrders.filter((o) => o.status === "pending").length;
      setKpiValue(kpiPending, a.pending_total ?? pendingFallback);
      setDelta(kpiPendingDelta, a.pending_change_pct);

      setKpiValue(kpiProducts, a.products_total ?? cachedProducts.length);
      setDelta(kpiProductsDelta, a.products_change_pct);

      const labels = a.series?.labels || [];
      const values = a.series?.values || [];
      if (labels.length && values.length) buildChart(labels, values);

      if (analyticsMsg) analyticsMsg.textContent = "";
    } catch (e) {
      // basic fallback
      const pending = cachedOrders.filter((o) => o.status === "pending").length;
      setKpiValue(kpiOrders, cachedOrders.length);
      setDelta(kpiOrdersDelta, null);
      setKpiValue(kpiRevenue, 0);
      setDelta(kpiRevenueDelta, null);
      setKpiValue(kpiPending, pending);
      setDelta(kpiPendingDelta, null);
      setKpiValue(kpiProducts, cachedProducts.length);
      setDelta(kpiProductsDelta, null);

      if (analyticsMsg) analyticsMsg.textContent = `Analytics unavailable (${e.message})`;
    }
  }

  // ---------- Load all ----------
  async function loadAll() {
    await loadStore();
    await Promise.all([loadProducts(), loadOrders()]);
    // payments is separate so the dashboard loads fast
    await loadAnalyticsSafe();
  }

  // ---------- Login ----------
  async function doLogin(token) {
    if (!token) throw new Error("Missing token");
    setToken(token);
    showApp();
    setActivePanel(getInitialPanel());
    await loadAll();
  }

  // ---------- Wiring ----------
  function wireEvents() {
    // Sidebar navigation
    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.nav;
        setActivePanel(name);

        // Lazy load
        if (name === "payments") loadPayments().catch((e) => (paymentsMsg ? (paymentsMsg.textContent = e.message) : alert(e.message)));
        if (name === "orders") loadOrders().catch((e) => alert(e.message));
        if (name === "products") loadProducts().catch((e) => alert(e.message));
        if (name === "settings") loadStore().catch((e) => alert(e.message));
      });
    });

    // Login
    if (loginBtn) {
      loginBtn.addEventListener("click", async () => {
        const token = tokenInput ? tokenInput.value.trim() : "";
        if (!token) return;
        try {
          await doLogin(token);
        } catch (e) {
          clearToken();
          alert("Login failed: " + (e.message || e));
          showLogin();
        }
      });
    }

    // Logout
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        clearToken();
        location.href = location.pathname;
      });
    }

    // Products
    if (refreshProductsBtn) refreshProductsBtn.addEventListener("click", () => loadProducts().catch((e) => alert(e.message)));
    if (productForm) {
      productForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        addProductFromForm().catch(() => {});
      });
    }
    if (clearFormBtn && productForm) {
      clearFormBtn.addEventListener("click", () => {
        productForm.reset();
        const stockSel = productForm.querySelector('select[name="in_stock"]');
        if (stockSel) stockSel.value = "1";
        if (productFormMsg) productFormMsg.textContent = "";
      });
    }

    // Orders
    if (refreshOrdersBtn) refreshOrdersBtn.addEventListener("click", () => loadOrders().catch((e) => alert(e.message)));

    // Payments
    if (refreshPaymentsBtn) refreshPaymentsBtn.addEventListener("click", () => loadPayments().catch((e) => alert(e.message)));
    if (paymentsStatus) paymentsStatus.addEventListener("change", () => loadPayments().catch((e) => alert(e.message)));

    // Settings bank form
    if (bankForm) {
      bankForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        saveBankDetails().catch(() => {});
      });
    }

    // Analytics period
    if (periodSelect) {
      periodSelect.addEventListener("change", () => loadAnalyticsSafe().catch(() => {}));
    }

    // Modal close
    if (payModalClose) payModalClose.addEventListener("click", () => showPayModal(false));
    if (payModalBackdrop) payModalBackdrop.addEventListener("click", () => showPayModal(false));
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") showPayModal(false);
    });
  }

  // ---------- Boot ----------
  async function boot() {
    const urlToken = getTokenFromUrl();
    const existing = getToken();
    const chosen = urlToken || existing;

    setInputValueSafe(tokenInput, chosen);

    if (chosen) {
      try {
        await doLogin(chosen);
        return;
      } catch {
        clearToken();
      }
    }

    showLogin();
  }

  // ---------- Minimal UI helpers injected ----------
  function injectUiStyles() {
    const style = document.createElement("style");
    style.textContent = `
      /* left nav polish (works with your CSS, even if you forget to add new styles) */
      .rowActions{display:flex;gap:8px;flex-wrap:wrap}
      .btn.tiny{padding:8px 10px;font-size:12px;border-radius:10px}
      .pill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:999px;padding:4px 10px;font-size:12px}
      .pill.ok{color:var(--good);border-color:rgba(46,229,157,.35);background:rgba(46,229,157,.08)}
      .pill.bad{color:var(--danger);border-color:rgba(255,77,77,.35);background:rgba(255,77,77,.08)}
      .pill.warn{color:var(--warn);border-color:rgba(255,176,32,.35);background:rgba(255,176,32,.08)}
      .pill.soft{color:var(--muted);background:rgba(255,255,255,.03)}
      .infoGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      @media(max-width:900px){.infoGrid{grid-template-columns:1fr}}
      .cellMain{font-weight:800}
      .modalOpen{overflow:hidden}
      /* modal (needs HTML IDs, but safe even if missing) */
      #payModalBackdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);z-index:1000}
      #payModal{position:fixed;inset:auto;left:50%;top:50%;transform:translate(-50%,-50%);width:min(880px,92vw);max-height:86vh;overflow:auto;z-index:1001}
      .modalGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      @media(max-width:900px){.modalGrid{grid-template-columns:1fr}}
      .monoBox{border:1px solid var(--border);border-radius:12px;padding:10px;background:rgba(255,255,255,.03);white-space:pre-wrap}
      .proofWrap{border:1px solid var(--border);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.02)}
      .proofWrap img{display:block;width:100%;height:auto}
    `;
    document.head.appendChild(style);
  }

  window.addEventListener("DOMContentLoaded", () => {
    injectUiStyles();
    wireEvents();
    boot().catch((e) => {
      clearToken();
      showLogin();
      alert("Login failed: " + (e.message || e));
    });
  });
})();