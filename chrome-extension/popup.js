// popup.js — Brillitos Store Extension

const SUPABASE_URL = 'https://ojspicczjikqptnhzbgr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qc3BpY2N6amlrcXB0bmh6YmdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTE3MDQsImV4cCI6MjA4NzE4NzcwNH0.IOVz3K8Z_SuYb70yhjasgUTS5MmvpBcNbIhAPKYWzMI';

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function sbFetch(path, opts = {}) {
  const session = await getSession();
  const headers = {
    'apikey': SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
    ...opts.headers,
  };
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error_description || `HTTP ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Login fallido');
  return data;
}

async function saveSession(data) {
  await chrome.storage.local.set({
    sb_access_token: data.access_token,
    sb_refresh_token: data.refresh_token,
    sb_user_email: data.user.email,
    sb_user_id: data.user.id,
    sb_expires_at: Date.now() + data.expires_in * 1000,
  });
}

async function getSession() {
  const s = await chrome.storage.local.get(['sb_access_token', 'sb_refresh_token', 'sb_expires_at', 'sb_user_id', 'sb_user_email']);
  if (!s.sb_access_token) return null;
  // Refresh if expired
  if (Date.now() > s.sb_expires_at - 60000) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.sb_refresh_token }),
      });
      const data = await res.json();
      if (res.ok) { await saveSession(data); return data; }
    } catch {}
    return null;
  }
  return { access_token: s.sb_access_token, user_id: s.sb_user_id, email: s.sb_user_email };
}

async function signOut() {
  await chrome.storage.local.remove(['sb_access_token','sb_refresh_token','sb_user_email','sb_user_id','sb_expires_at']);
}

// ── State ─────────────────────────────────────────────────────────────────────

let state = {
  session: null,
  product: null,       // scraped from page
  mode: 'client',      // 'client' | 'personal' | 'merchandise'
  clients: [],
  selectedClient: null,
  saving: false,
  saved: false,
  error: null,
};

// ── DOM helpers ───────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const body = () => $('mainBody');

function render(html) { body().innerHTML = html; }

function showLoading(msg = 'Cargando...') {
  render(`<div class="loading"><div class="spinner"></div>${msg}</div>`);
}

// ── Product scraping ──────────────────────────────────────────────────────────

async function scrapeProduct() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (!tab || !tab.id) return resolve(null);
      const supportedHosts = ['shein.com','sheincorp.com','temu.com','amazon.com','amazon.es','amazon.co.uk'];
      const isSupported = supportedHosts.some(h => tab.url?.includes(h));
      if (!isSupported) return resolve(null);

      chrome.tabs.sendMessage(tab.id, { action: 'getProductData' }, resp => {
        if (chrome.runtime.lastError) {
          // Try injecting content script manually
          chrome.scripting.executeScript(
            { target: { tabId: tab.id }, files: ['content.js'] },
            () => {
              chrome.tabs.sendMessage(tab.id, { action: 'getProductData' }, r => {
                resolve(chrome.runtime.lastError ? null : r);
              });
            }
          );
          return;
        }
        resolve(resp);
      });
    });
  });
}

// ── Clients fetch ─────────────────────────────────────────────────────────────

async function fetchClients() {
  try {
    const data = await sbFetch('/rest/v1/clients?select=id,name,phone&order=name');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

// ── Save to Supabase ──────────────────────────────────────────────────────────

async function saveOrder(formData) {
  const session = await getSession();
  if (!session) throw new Error('Sesión expirada');

  const userId = session.user_id;
  const now = new Date().toISOString();

  if (state.mode === 'client') {
    // 1. Create or find client_order
    let clientOrderId = formData.existingClientOrderId || null;

    if (!clientOrderId && formData.clientId) {
      const coRes = await sbFetch('/rest/v1/client_orders', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: userId,
          client_id: formData.clientId,
          status: 'Pendiente',
          payment_method: '',
          payment_reference: '',
          shipping_cost: 0,
          amount_charged: 0,
          notes: '',
          product_payment_status: 'Pendiente',
          shipping_payment_status: 'Pendiente',
          brother_involved: true,
        }),
      });
      clientOrderId = Array.isArray(coRes) ? coRes[0]?.id : coRes?.id;
    }

    if (!clientOrderId) throw new Error('No se pudo crear el pedido');

    // 2. Insert product linked to client_order
    await sbFetch('/rest/v1/orders', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        category: 'client',
        product_name: formData.name,
        product_photo: formData.image || '',
        product_link: formData.url || null,
        store: formData.store,
        price_paid: parseFloat(formData.price) || 0,
        order_number: formData.orderNumber || '',
        size_color: formData.sizeColor || null,
        status: 'Pendiente',
        notes: formData.notes || '',
        client_order_id: clientOrderId,
        created_at: now,
        updated_at: now,
      }),
    });
    return { type: 'client', clientOrderId };

  } else if (state.mode === 'personal') {
    await sbFetch('/rest/v1/orders', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        category: 'personal',
        product_name: formData.name,
        product_photo: formData.image || '',
        product_link: formData.url || null,
        store: formData.store,
        price_paid: parseFloat(formData.price) || 0,
        order_number: formData.orderNumber || '',
        size_color: formData.sizeColor || null,
        status: 'Pendiente',
        notes: formData.notes || '',
        created_at: now,
        updated_at: now,
      }),
    });
    return { type: 'personal' };

  } else {
    // merchandise
    const qty = parseInt(formData.units) || 1;
    const costUnit = parseFloat(formData.price) || 0;
    await sbFetch('/rest/v1/orders', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        category: 'merchandise',
        product_name: formData.name,
        product_photo: formData.image || '',
        product_link: formData.url || null,
        store: formData.store,
        price_paid: costUnit * qty,
        price_per_unit: costUnit,
        units_ordered: qty,
        units_received: 0,
        suggested_price: parseFloat(formData.salePrice) || null,
        order_number: formData.orderNumber || '',
        size_color: formData.sizeColor || null,
        status: 'Pendiente',
        notes: formData.notes || '',
        created_at: now,
        updated_at: now,
      }),
    });
    return { type: 'merchandise' };
  }
}

// ── Render functions ──────────────────────────────────────────────────────────

function renderLogin() {
  render(`
    <div class="login-section">
      <p>Inicia sesión para capturar productos</p>
      <label>Email</label>
      <input type="email" id="loginEmail" placeholder="ana@brillitos.com" />
      <label>Contraseña</label>
      <input type="password" id="loginPass" placeholder="••••••••" />
      <button class="btn btn-primary" id="loginBtn">✨ Entrar</button>
      <div id="loginError" style="display:none" class="error-banner"></div>
    </div>
  `);

  $('loginBtn').onclick = async () => {
    const email = $('loginEmail').value.trim();
    const pass = $('loginPass').value;
    if (!email || !pass) return;
    $('loginBtn').disabled = true;
    $('loginBtn').textContent = 'Entrando...';
    try {
      const data = await signIn(email, pass);
      await saveSession(data);
      state.session = await getSession();
      await initApp();
    } catch (e) {
      $('loginError').style.display = 'block';
      $('loginError').textContent = e.message;
      $('loginBtn').disabled = false;
      $('loginBtn').textContent = '✨ Entrar';
    }
  };
}

function renderNoProduct() {
  render(`
    <div class="no-product">
      <div class="big">🛍️</div>
      <p>Abre un producto en<br/><strong>Shein, Temu o Amazon</strong><br/>para capturarlo</p>
    </div>
  `);
}

function renderForm() {
  const p = state.product || {};
  const imgHtml = p.image
    ? `<img class="product-img" src="${p.image}" alt="" />`
    : `<div class="product-img-placeholder">🛍️</div>`;

  const clientsHtml = state.mode === 'client' ? `
    <label>Cliente</label>
    <div class="client-search">
      <input type="text" id="clientSearch" placeholder="Buscar cliente..." autocomplete="off" />
      <div class="client-list" id="clientList" style="display:none"></div>
    </div>
    <input type="hidden" id="clientId" />
    <div id="selectedClientBadge" style="display:none; margin-top:6px; font-size:11px; color:#f43f7a; font-weight:600;"></div>
  ` : '';

  const mercFieldsHtml = state.mode === 'merchandise' ? `
    <div class="grid-2">
      <div>
        <label>Unidades</label>
        <input type="number" id="fUnits" value="1" min="1" />
      </div>
      <div>
        <label>Precio venta $</label>
        <input type="number" id="fSalePrice" placeholder="0.00" step="0.01" />
      </div>
    </div>
  ` : '';

  const modeLabels = {
    client: 'Pedido de cliente',
    personal: 'Mi compra personal',
    merchandise: 'Mercancía para vender',
  };

  render(`
    <!-- Mode tabs -->
    <div class="mode-tabs">
      <div class="mode-tab ${state.mode==='client'?'active':''}" data-mode="client">
        <span class="tab-emoji">👥</span>Cliente
      </div>
      <div class="mode-tab ${state.mode==='personal'?'active':''}" data-mode="personal">
        <span class="tab-emoji">🛍️</span>Personal
      </div>
      <div class="mode-tab ${state.mode==='merchandise'?'active':''}" data-mode="merchandise">
        <span class="tab-emoji">📦</span>Mercancía
      </div>
    </div>

    <!-- Product preview -->
    <div class="product-card">
      ${imgHtml}
      <div class="product-info">
        <div class="product-name">${p.name || 'Producto sin nombre'}</div>
        <div class="product-store">${p.store || 'Tienda'}</div>
        <div class="product-price">$${parseFloat(p.price||0).toFixed(2)}</div>
      </div>
    </div>

    <!-- Editable fields -->
    <label>Nombre del producto</label>
    <input type="text" id="fName" value="${escHtml(p.name||'')}" />

    <div class="grid-2">
      <div>
        <label>Precio $</label>
        <input type="number" id="fPrice" value="${p.price||''}" step="0.01" />
      </div>
      <div>
        <label>Talla / Color</label>
        <input type="text" id="fSizeColor" placeholder="M, Rojo..." />
      </div>
    </div>

    ${clientsHtml}
    ${mercFieldsHtml}

    <label>Notas (opcional)</label>
    <input type="text" id="fNotes" placeholder="Para regalo, urgente..." />

    <div id="saveError" style="display:none" class="error-banner"></div>
    <button class="btn btn-primary" id="saveBtn">
      ✨ Agregar como ${modeLabels[state.mode]}
    </button>
  `);

  // Mode tab switching
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.onclick = () => {
      state.mode = tab.dataset.mode;
      renderForm();
      setupClientSearch();
    };
  });

  // Client search
  setupClientSearch();

  // Save
  $('saveBtn').onclick = handleSave;
}

function setupClientSearch() {
  if (state.mode !== 'client') return;
  const search = $('clientSearch');
  const listEl = $('clientList');
  if (!search) return;

  if (state.selectedClient) {
    search.value = state.selectedClient.name;
    $('clientId').value = state.selectedClient.id;
    $('selectedClientBadge').style.display = 'block';
    $('selectedClientBadge').textContent = `✅ ${state.selectedClient.name}`;
  }

  function showList(q) {
    const filtered = state.clients.filter(c =>
      c.name.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 8);

    if (filtered.length === 0) { listEl.style.display = 'none'; return; }

    listEl.innerHTML = filtered.map(c => `
      <div class="client-item" data-id="${c.id}" data-name="${escHtml(c.name)}">
        <div class="client-name">${escHtml(c.name)}</div>
        ${c.phone ? `<div class="client-phone">${c.phone}</div>` : ''}
      </div>
    `).join('');
    listEl.style.display = 'block';

    listEl.querySelectorAll('.client-item').forEach(item => {
      item.onclick = () => {
        state.selectedClient = { id: item.dataset.id, name: item.dataset.name };
        search.value = item.dataset.name;
        $('clientId').value = item.dataset.id;
        $('selectedClientBadge').style.display = 'block';
        $('selectedClientBadge').textContent = `✅ ${item.dataset.name}`;
        listEl.style.display = 'none';
      };
    });
  }

  search.oninput = () => showList(search.value);
  search.onfocus = () => showList(search.value);
  document.addEventListener('click', e => {
    if (!e.target.closest('.client-search')) listEl.style.display = 'none';
  }, { once: true });
}

async function handleSave() {
  const nameVal = $('fName')?.value?.trim();
  if (!nameVal) { showError('Falta el nombre del producto'); return; }
  if (state.mode === 'client' && !$('clientId')?.value) {
    showError('Selecciona un cliente'); return;
  }

  $('saveBtn').disabled = true;
  $('saveBtn').textContent = 'Guardando...';
  $('saveError').style.display = 'none';

  try {
    const formData = {
      name: nameVal,
      price: $('fPrice')?.value || state.product?.price || '0',
      sizeColor: $('fSizeColor')?.value?.trim() || '',
      notes: $('fNotes')?.value?.trim() || '',
      store: state.product?.store || 'Otra',
      image: state.product?.image || '',
      url: state.product?.url || '',
      clientId: $('clientId')?.value || null,
      units: $('fUnits')?.value || '1',
      salePrice: $('fSalePrice')?.value || '0',
    };

    const result = await saveOrder(formData);
    renderSuccess(result);
  } catch (e) {
    $('saveBtn').disabled = false;
    $('saveBtn').textContent = '✨ Guardar';
    showError(e.message);
  }
}

function showError(msg) {
  const el = $('saveError');
  if (el) { el.style.display = 'block'; el.textContent = msg; }
}

function renderSuccess(result) {
  const messages = {
    client: { emoji: '👥', title: '¡Producto agregado al pedido!', sub: 'Ya está en Brillitos' },
    personal: { emoji: '🛍️', title: '¡Compra registrada!', sub: 'Aparece en tus compras personales' },
    merchandise: { emoji: '📦', title: '¡Mercancía agregada!', sub: 'Ya está en tu inventario' },
  };
  const m = messages[state.mode] || messages.client;

  render(`
    <div class="success-banner">
      <div class="icon">${m.emoji}</div>
      <p>${m.title}</p>
      <small>${m.sub}</small>
    </div>
    <button class="btn btn-secondary" id="addAnotherBtn" style="margin-top:12px">
      + Agregar otro producto
    </button>
  `);

  $('addAnotherBtn').onclick = () => {
    state.saved = false;
    renderForm();
    setupClientSearch();
  };
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function initApp() {
  // Show user bar
  const session = state.session;
  if (session?.email) {
    $('userBar').style.display = 'flex';
    $('userEmail').textContent = session.email;
  }

  $('logoutBtn').onclick = async () => {
    await signOut();
    state.session = null;
    $('userBar').style.display = 'none';
    renderLogin();
  };

  showLoading('Leyendo página...');

  // Scrape product and fetch clients in parallel
  const [product, clients] = await Promise.all([
    scrapeProduct(),
    fetchClients(),
  ]);

  state.product = product;
  state.clients = clients;

  if (!product || !product.name) {
    renderNoProduct();
    return;
  }

  renderForm();
  setupClientSearch();
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  state.session = await getSession();

  if (!state.session) {
    renderLogin();
    return;
  }

  await initApp();
});