(function () {
    'use strict';

    const API = '/api/v1';
    const AUTH_KEY = 'settleflow_auth';
    const app = document.getElementById('app');
    const icons = {
        logo: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M7 7.5h7.5a4 4 0 1 1 0 8H11"/><path d="m13 12-3 3.5L13 19"/><path d="M17 4.5 19.5 7 17 9.5"/><path d="M19 7h-7.5a4 4 0 0 0 0 8H13"/></svg>',
        mail: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
        lock: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
        user: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
        eye: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
        arrow: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
        back: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>',
        plus: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
        download: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 20h14"/></svg>',
        logout: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4m6-4 4-4-4-4m4 4H9"/></svg>',
        chevron: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>',
        orders: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M6 3h12l2 4v14H4V7l2-4Z"/><path d="M4 8h16M9 12h6"/></svg>',
        wallet: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M4 6a2 2 0 0 1 2-2h12v16H6a2 2 0 0 1-2-2V6Z"/><path d="M4 8h14M14 12h7v5h-7a2.5 2.5 0 0 1 0-5Z"/></svg>',
        clock: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
        check: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
        card: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></svg>',
        close: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
        trash: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m3 0-1 14H7L6 7"/></svg>',
        edit: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m14 7 3 3"/></svg>',
        calendar: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></svg>',
        alert: '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4m0 3h.01"/></svg>'
    };

    const state = { authMode: 'login', orders: [], metadata: null, status: '', page: 1 };

    function brand() {
        return `<a class="brand" href="/"><span class="brand-mark">${icons.logo}</span><span>SettleFlow</span></a>`;
    }

    function getAuth() {
        try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; }
    }

    function saveAuth(data) {
        const auth = { token: data.accessToken, user: { id: data._id, name: data.name, email: data.email } };
        localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
        return auth;
    }

    function clearAuth() { localStorage.removeItem(AUTH_KEY); }

    function navigate(path) {
        history.pushState({}, '', path);
        route();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function api(path, options = {}) {
        const auth = getAuth();
        const headers = { ...options.headers };
        if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
        if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
        const response = await fetch(`${API}${path}`, { ...options, headers });
        const contentType = response.headers.get('content-type') || '';
        const result = contentType.includes('application/json') ? await response.json() : await response.text();
        if (!response.ok) {
            if (response.status === 401 && path !== '/users/login') {
                clearAuth();
                navigate('/');
            }
            throw new Error(result?.message || 'Something went wrong. Please try again.');
        }
        return result;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    }

    function initials(name) {
        return String(name || 'User').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    }

    function money(value) {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format((Number(value) || 0) / 100);
    }

    function date(value, withTime = false) {
        if (!value) return '—';
        return new Intl.DateTimeFormat('en-IN', withTime
            ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
            : { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
    }

    function statusLabel(value) { return String(value || '').replaceAll('_', ' '); }
    function statusPill(value) { return `<span class="status-pill status-${escapeHtml(value)}">${escapeHtml(statusLabel(value))}</span>`; }
    function shortId(value) { return `ORD-${String(value || '').slice(-6).toUpperCase()}`; }

    function auditNote(entry) {
        if (entry.payment && Number.isFinite(Number(entry.payment.amount))) {
            return `Payment of ${money(entry.payment.amount)} added${entry.payment.note ? ` — ${entry.payment.note}` : '.'}`;
        }
        const legacyPayment = String(entry.note || '').match(/^Payment of (\d+(?:\.\d+)?) added\.$/i);
        if (legacyPayment) {
            const loggedAmount = legacyPayment[1].includes('.') ? Number(legacyPayment[1]) * 100 : Number(legacyPayment[1]);
            return `Payment of ${money(loggedAmount)} added.`;
        }
        return entry.note || (entry.status === 'pending' ? 'Order created and awaiting payment.' : 'Order status updated.');
    }

    function toast(message, type = 'success') {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = message;
        document.getElementById('toast-region').appendChild(el);
        window.setTimeout(() => el.remove(), 3500);
    }

    function topbar() {
        const auth = getAuth();
        const user = auth?.user || {};
        return `<header class="topbar">
            ${brand()}
            <div class="topbar-actions">
                <button class="secondary-button" id="export-button" type="button" title="Export orders">${icons.download}<span>Export</span></button>
                <div class="user-menu">
                    <span class="avatar">${escapeHtml(initials(user.name))}</span>
                    <span class="user-copy"><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.email)}</span></span>
                    <button class="ghost-button" id="logout-button" type="button" aria-label="Sign out" title="Sign out">${icons.logout}</button>
                </div>
            </div>
        </header>`;
    }

    function bindShell() {
        document.getElementById('logout-button')?.addEventListener('click', () => {
            clearAuth();
            navigate('/');
        });
        document.getElementById('export-button')?.addEventListener('click', showExportModal);
    }

    function renderAuth() {
        if (getAuth()) return navigate('/dashboard');
        const signup = state.authMode === 'signup';
        document.title = `${signup ? 'Create account' : 'Sign in'} · SettleFlow`;
        app.innerHTML = `<main class="auth-page">
            <section class="auth-story">
                ${brand()}
                <div class="story-copy">
                    <p class="eyebrow">Order settlement, simplified</p>
                    <h1>Know what’s paid. Act on what isn’t.</h1>
                    <p>One clear workspace for every order, due date and payment—built to help your team close the books with confidence.</p>
                </div>
                <div class="proof-row">
                    <div class="proof-item"><strong>One view</strong><span>Orders and settlements</span></div>
                    <div class="proof-item"><strong>Real time</strong><span>Payment visibility</span></div>
                    <div class="proof-item"><strong>Always clear</strong><span>Nothing slips through</span></div>
                </div>
            </section>
            <section class="auth-panel">
                <div class="auth-card">
                    <div class="mobile-brand">${brand()}</div>
                    <h2>${signup ? 'Create your account' : 'Welcome back'}</h2>
                    <p class="auth-subtitle">${signup ? 'Start keeping orders and payments in perfect sync.' : 'Sign in to continue to your settlement workspace.'}</p>
                    <div class="auth-tabs" role="tablist">
                        <button class="auth-tab ${!signup ? 'active' : ''}" data-mode="login" type="button">Sign in</button>
                        <button class="auth-tab ${signup ? 'active' : ''}" data-mode="signup" type="button">Create account</button>
                    </div>
                    <form id="auth-form" class="form-stack">
                        ${signup ? `<div class="form-field"><label for="name">Full name</label><div class="input-wrap">${icons.user}<input id="name" name="name" autocomplete="name" placeholder="Alex Morgan" required></div></div>` : ''}
                        <div class="form-field"><label for="email">Email address</label><div class="input-wrap">${icons.mail}<input id="email" name="email" type="email" autocomplete="email" placeholder="you@company.com" required></div></div>
                        <div class="form-field"><label for="password">Password</label><div class="input-wrap">${icons.lock}<input id="password" name="password" type="password" minlength="6" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="At least 6 characters" required><button class="password-toggle" id="password-toggle" type="button" aria-label="Show password">${icons.eye}</button></div></div>
                        <div class="form-error" id="auth-error" role="alert"></div>
                        <button class="primary-button full-button" id="auth-submit" type="submit">${signup ? 'Create account' : 'Sign in'} ${icons.arrow}</button>
                    </form>
                    <p class="terms">By continuing, you agree to use SettleFlow responsibly and keep your account credentials secure.</p>
                </div>
            </section>
        </main>`;

        document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
            state.authMode = button.dataset.mode;
            renderAuth();
        }));
        document.getElementById('password-toggle').addEventListener('click', () => {
            const input = document.getElementById('password');
            input.type = input.type === 'password' ? 'text' : 'password';
        });
        document.getElementById('auth-form').addEventListener('submit', handleAuth);
    }

    async function handleAuth(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const button = document.getElementById('auth-submit');
        const error = document.getElementById('auth-error');
        const payload = Object.fromEntries(new FormData(form).entries());
        error.classList.remove('show');
        button.disabled = true;
        button.textContent = state.authMode === 'signup' ? 'Creating your account…' : 'Signing you in…';
        try {
            const endpoint = state.authMode === 'signup' ? '/users' : '/users/login';
            const result = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
            saveAuth(result.data);
            navigate('/dashboard');
        } catch (err) {
            error.textContent = err.message;
            error.classList.add('show');
            button.disabled = false;
            button.innerHTML = `${state.authMode === 'signup' ? 'Create account' : 'Sign in'} ${icons.arrow}`;
        }
    }

    function renderDashboard() {
        if (!getAuth()) return navigate('/');
        document.title = 'Orders · SettleFlow';
        app.innerHTML = `<div class="app-shell">
            ${topbar()}
            <main class="page-wrap">
                <div class="page-heading">
                    <div><p class="eyebrow">Settlement overview</p><h1>Your orders</h1><p>Track every invoice, due date and payment from one place.</p></div>
                    <div class="heading-actions"><button class="primary-button" id="new-order-button" type="button">${icons.plus} New order</button></div>
                </div>
                <section class="stats-grid" id="stats-grid" aria-label="Order summary">${statsSkeleton()}</section>
                <section class="table-card">
                    <div class="table-toolbar">
                        <div class="table-title"><h2>All orders</h2><p id="order-count">Loading your orders…</p></div>
                        <div class="filter-group"><label for="status-filter" class="optional">Status</label><span class="select-wrap"><select id="status-filter"><option value="">All statuses</option><option value="pending">Pending</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select>${icons.chevron}</span></div>
                    </div>
                    <div id="orders-content"><div class="loading-state"><div class="state-inner"><div class="spinner"></div><p>Bringing your orders into focus…</p></div></div></div>
                </section>
            </main>
        </div>`;
        bindShell();
        document.getElementById('status-filter').value = state.status;
        document.getElementById('status-filter').addEventListener('change', event => {
            state.status = event.target.value;
            state.page = 1;
            loadOrders();
        });
        document.getElementById('new-order-button').addEventListener('click', showNewOrderModal);
        loadOrders();
    }

    function statsSkeleton() {
        return Array(4).fill('<article class="stat-card"><div class="stat-top"><span>Loading</span><span class="stat-icon"></span></div><strong>—</strong><small>Calculating</small></article>').join('');
    }

    function renderStats(metadata) {
        const summary = metadata?.summary || {};
        document.getElementById('stats-grid').innerHTML = `
            <article class="stat-card"><div class="stat-top"><span>Total orders</span><span class="stat-icon">${icons.orders}</span></div><strong>${summary.totalOrders ?? 0}</strong><small>Across your account</small></article>
            <article class="stat-card"><div class="stat-top"><span>Paid</span><span class="stat-icon">${icons.check}</span></div><strong>${summary.paidOrders ?? 0}</strong><small>Fully settled orders</small></article>
            <article class="stat-card"><div class="stat-top"><span>Open</span><span class="stat-icon">${icons.clock}</span></div><strong>${summary.openOrders ?? 0}</strong><small>Pending or partially paid</small></article>
            <article class="stat-card"><div class="stat-top"><span>Overdue</span><span class="stat-icon">${icons.alert}</span></div><strong>${summary.overdueOrders ?? 0}</strong><small>Need your attention</small></article>`;
    }

    async function loadOrders() {
        const content = document.getElementById('orders-content');
        if (!content) return;
        content.innerHTML = '<div class="loading-state"><div class="state-inner"><div class="spinner"></div><p>Bringing your orders into focus…</p></div></div>';
        const query = new URLSearchParams({ page: String(state.page), limit: '10' });
        if (state.status) query.set('status', state.status);
        try {
            const result = await api(`/orders?${query}`);
            state.orders = result.data || [];
            state.metadata = result.metadata || {};
            renderStats(state.metadata);
            document.getElementById('order-count').textContent = `${state.metadata.totalCount || 0} ${state.metadata.totalCount === 1 ? 'order' : 'orders'} found`;
            renderOrdersTable();
        } catch (err) {
            content.innerHTML = `<div class="error-state"><div class="state-inner"><div class="state-icon">${icons.orders}</div><h3>Couldn’t load orders</h3><p>${escapeHtml(err.message)}</p><button class="secondary-button" id="retry-orders">Try again</button></div></div>`;
            document.getElementById('retry-orders')?.addEventListener('click', loadOrders);
        }
    }

    function renderOrdersTable() {
        const content = document.getElementById('orders-content');
        if (!state.orders.length) {
            content.innerHTML = `<div class="empty-state"><div class="state-inner"><div class="state-icon">${icons.orders}</div><h3>${state.status ? 'No matching orders' : 'Your first order starts here'}</h3><p>${state.status ? 'Try another status to broaden the view.' : 'Create an order to start tracking its value, due date and settlement progress.'}</p>${state.status ? '' : '<button class="primary-button" id="empty-new-order">Create an order</button>'}</div></div>`;
            document.getElementById('empty-new-order')?.addEventListener('click', showNewOrderModal);
            return;
        }
        const rows = state.orders.map(order => {
            const customer = order.user || getAuth()?.user || {};
            const due = Math.max(0, Number(order.orderTotal || 0) - Number(order.paymentsTotal || 0));
            return `<tr data-order-id="${escapeHtml(order._id)}" tabindex="0">
                <td><span class="order-code">${shortId(order._id)}</span></td>
                <td><div class="customer-cell"><span class="avatar">${escapeHtml(initials(customer.name))}</span><span><strong>${escapeHtml(customer.name || 'Customer')}</strong><span>${escapeHtml(customer.email || '')}</span></span></div></td>
                <td>${statusPill(order.status)}</td>
                <td class="money">${money(order.orderTotal)}</td>
                <td class="money">${money(order.paymentsTotal)}</td>
                <td class="money ${due ? 'due' : ''}">${money(due)}</td>
                <td>${date(order.dueDate)}</td>
                <td><span class="view-arrow">${icons.arrow}</span></td>
            </tr>`;
        }).join('');
        const metadata = state.metadata || {};
        content.innerHTML = `<div class="table-scroll"><table>
            <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Order total</th><th>Amount paid</th><th>Amount due</th><th>Due date</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>
        <div class="pagination"><span>Page ${metadata.page || 1} of ${metadata.totalPages || 1}</span><div class="pagination-actions"><button class="page-button" id="prev-page" ${state.page <= 1 ? 'disabled' : ''} aria-label="Previous page">${icons.back}</button><button class="page-button" id="next-page" ${state.page >= (metadata.totalPages || 1) ? 'disabled' : ''} aria-label="Next page">${icons.arrow}</button></div></div>`;
        document.querySelectorAll('[data-order-id]').forEach(row => {
            const open = () => navigate(`/orders/${row.dataset.orderId}`);
            row.addEventListener('click', open);
            row.addEventListener('keydown', event => { if (event.key === 'Enter') open(); });
        });
        document.getElementById('prev-page').addEventListener('click', () => { state.page -= 1; loadOrders(); });
        document.getElementById('next-page').addEventListener('click', () => { state.page += 1; loadOrders(); });
    }

    function showExportModal() {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
        const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
        showModal(`<div class="modal-head"><h2>Export orders</h2><button class="close-button" data-close-modal aria-label="Close">${icons.close}</button></div>
            <form id="export-form">
                <div class="modal-body form-stack">
                    <p class="auth-subtitle modal-intro">Download orders whose due dates fall within your selected range.</p>
                    <div class="form-grid">
                        <div class="form-field"><label for="export-from">From</label><input id="export-from" name="from" type="date" value="${monthStart}" required></div>
                        <div class="form-field"><label for="export-to">To</label><input id="export-to" name="to" type="date" value="${monthEnd}" required></div>
                    </div>
                    <div class="form-field"><label for="export-status">Status <span class="optional">optional</span></label><select id="export-status" name="status"><option value="">All statuses</option><option value="pending">Pending</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></div>
                    <div class="form-error" id="export-error"></div>
                </div>
                <div class="modal-actions"><button class="secondary-button" data-close-modal type="button">Cancel</button><button class="primary-button" id="export-submit" type="submit">${icons.download} Download CSV</button></div>
            </form>`);
        document.getElementById('export-status').value = state.status || '';
        document.getElementById('export-form').addEventListener('submit', event => {
            event.preventDefault();
            const values = Object.fromEntries(new FormData(event.currentTarget).entries());
            const error = document.getElementById('export-error');
            if (values.from > values.to) {
                error.textContent = 'The start date must be on or before the end date.';
                error.classList.add('show');
                return;
            }
            exportOrders(values.from, values.to, values.status);
        });
    }

    async function exportOrders(from, to, status) {
        const auth = getAuth();
        if (!auth) return;
        const query = new URLSearchParams({ dueDateFrom: from, dueDateTo: to });
        if (status) query.set('status', status);
        const button = document.getElementById('export-submit');
        const error = document.getElementById('export-error');
        button.disabled = true;
        button.textContent = 'Preparing export…';
        try {
            const response = await fetch(`${API}/orders/export/csv?${query}`, { headers: { Authorization: `Bearer ${auth.token}` } });
            if (!response.ok) {
                const result = await response.json().catch(() => null);
                throw new Error(result?.message || 'Export could not be created.');
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `orders-${from}-to-${to}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            closeModal();
            toast('Orders exported successfully.');
        } catch (err) {
            error.textContent = err.message;
            error.classList.add('show');
            button.disabled = false;
            button.innerHTML = `${icons.download} Download CSV`;
        }
    }

    async function renderOrderDetail(orderId) {
        if (!getAuth()) return navigate('/');
        document.title = 'Order details · SettleFlow';
        app.innerHTML = `<div class="app-shell">${topbar()}<main class="page-wrap"><a href="/dashboard" class="back-link" data-link>${icons.back} Back to all orders</a><div class="loading-state"><div class="state-inner"><div class="spinner"></div><p>Loading the full order story…</p></div></div></main></div>`;
        bindShell();
        try {
            const [result, auditResult] = await Promise.all([
                api(`/orders/${encodeURIComponent(orderId)}`),
                api(`/orders/${encodeURIComponent(orderId)}/status-log`).catch(() => ({ data: null }))
            ]);
            renderOrderDetailContent(result.data, auditResult.data);
        } catch (err) {
            const main = document.querySelector('.page-wrap');
            main.innerHTML = `<a href="/dashboard" class="back-link" data-link>${icons.back} Back to all orders</a><div class="content-card error-state"><div class="state-inner"><div class="state-icon">${icons.orders}</div><h3>Order unavailable</h3><p>${escapeHtml(err.message)}</p><a class="primary-button" href="/dashboard" data-link>Return to orders</a></div></div>`;
        }
    }

    function renderOrderDetailContent(order, auditLog) {
        document.title = `${shortId(order._id)} · SettleFlow`;
        const customer = order.user || getAuth()?.user || {};
        const paid = Number(order.paymentsTotal || 0);
        const total = Number(order.orderTotal || 0);
        const due = Math.max(0, total - paid);
        const canEdit = !(order.payments || []).length;
        const progress = total ? Math.min(100, Math.round((paid / total) * 100)) : 0;
        const items = (order.lineItems || []).map((item, index) => `<tr><td><div class="item-desc"><strong>${escapeHtml(item.description)}</strong><span>Item ${String(index + 1).padStart(2, '0')}</span></div></td><td>${item.quantity}</td><td class="money">${money(item.unitPrice)}</td><td class="money">${money(item.subtotal)}</td>${canEdit ? `<td><button class="item-action-button edit-line-item" type="button" data-item-id="${escapeHtml(item._id)}" aria-label="Edit ${escapeHtml(item.description)}" title="Edit line item">${icons.edit}</button></td>` : ''}</tr>`).join('');
        const payments = (order.payments || []).slice().reverse().map(payment => `<div class="payment-row"><span class="payment-icon">${icons.check}</span><span class="payment-info"><strong>${escapeHtml(payment.note || 'Payment received')}</strong><span>${date(payment.date || payment.createdAt, true)}</span></span><span class="payment-amount">+ ${money(payment.amount)}</span></div>`).join('');
        const auditEntries = (auditLog?.statusHistory || order.statusHistory || []).slice().reverse().map(entry => `<div class="audit-entry">
            <span class="audit-dot">${icons.clock}</span>
            <div class="audit-copy"><div><strong>Status changed to ${escapeHtml(statusLabel(entry.status))}</strong><p>${escapeHtml(auditNote(entry))}</p></div><time class="audit-time" datetime="${escapeHtml(entry.createdAt)}">${date(entry.createdAt, true)}</time></div>
        </div>`).join('');
        const page = document.querySelector('.page-wrap');
        page.innerHTML = `<a href="/dashboard" class="back-link" data-link>${icons.back} Back to all orders</a>
            <div class="page-heading detail-heading">
                <div><div class="detail-title-row"><h1>${shortId(order._id)}</h1>${statusPill(order.status)}</div><div class="order-meta">Created ${date(order.createdAt)} · Due ${date(order.dueDate)}${canEdit ? '' : ' · Order editing locked after payment'}</div></div>
                <div class="heading-actions">${canEdit ? `<button class="secondary-button" id="edit-due-date-button" type="button">${icons.calendar} Edit due date</button><button class="secondary-button" id="add-line-item-button" type="button">${icons.plus} Add item</button>` : ''}${due > 0 ? `<button class="primary-button" id="record-payment-button" type="button">${icons.card} Record payment</button>` : ''}</div>
            </div>
            <div class="detail-layout">
                <div class="detail-main">
                    <section class="content-card"><div class="card-header"><h2>Line items</h2><span>${(order.lineItems || []).length} ${(order.lineItems || []).length === 1 ? 'item' : 'items'}</span></div><div class="table-scroll"><table class="item-table"><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Subtotal</th>${canEdit ? '<th><span class="visually-hidden">Actions</span></th>' : ''}</tr></thead><tbody>${items}</tbody></table></div></section>
                    <section class="content-card"><div class="card-header"><h2>Payment history</h2><span>${(order.payments || []).length} ${(order.payments || []).length === 1 ? 'payment' : 'payments'}</span></div>${payments ? `<div class="payment-list">${payments}</div>` : '<div class="no-payments">No payments have been recorded for this order yet.</div>'}</section>
                    <section class="content-card"><div class="card-header"><h2>Audit log</h2><span>Status history</span></div>${auditEntries ? `<div class="audit-list">${auditEntries}</div>` : '<div class="no-payments">No status changes have been recorded yet.</div>'}</section>
                </div>
                <aside class="detail-side">
                    <section class="content-card"><div class="card-header"><h2>Settlement</h2><span>${progress}% paid</span></div><div class="summary-list"><div class="summary-row"><span>Order total</span><strong>${money(total)}</strong></div><div class="summary-row"><span>Amount paid</span><strong>${money(paid)}</strong></div><progress class="settlement-track" max="100" value="${progress}" aria-label="${progress}% paid"></progress><div class="summary-row total"><span>Amount due</span><strong>${money(due)}</strong></div></div></section>
                    <section class="content-card"><div class="card-header"><h2>Order details</h2></div><div class="info-list"><div class="info-row"><span>Customer</span><strong>${escapeHtml(customer.name || 'Customer')}</strong></div><div class="info-row"><span>Email</span><strong>${escapeHtml(customer.email || '—')}</strong></div><div class="info-row"><span>Due date</span><strong>${date(order.dueDate)}</strong></div><div class="info-row"><span>Last updated</span><strong>${date(order.updatedAt)}</strong></div></div></section>
                </aside>
            </div>`;
        document.getElementById('record-payment-button')?.addEventListener('click', () => showPaymentModal(order));
        document.getElementById('edit-due-date-button')?.addEventListener('click', () => showUpdateOrderModal(order));
        document.getElementById('add-line-item-button')?.addEventListener('click', () => showAddLineItemModal(order));
        document.querySelectorAll('.edit-line-item').forEach(button => button.addEventListener('click', () => {
            const item = (order.lineItems || []).find(candidate => String(candidate._id) === button.dataset.itemId);
            if (item) showUpdateLineItemModal(order, item);
        }));
    }

    function showUpdateOrderModal(order) {
        const currentDueDate = String(order.dueDate || '').slice(0, 10);
        showModal(`<div class="modal-head"><h2>Update order due date</h2><button class="close-button" data-close-modal aria-label="Close">${icons.close}</button></div>
            <form id="update-order-form"><div class="modal-body form-stack"><p class="auth-subtitle modal-intro">Changing the due date may also update the order’s status.</p><div class="form-field"><label for="updated-due-date">Due date</label><input id="updated-due-date" name="dueDate" type="date" value="${escapeHtml(currentDueDate)}" required></div><div class="form-error" id="update-order-error"></div></div><div class="modal-actions"><button class="secondary-button" data-close-modal type="button">Cancel</button><button class="primary-button" id="update-order-submit" type="submit">Save due date</button></div></form>`);
        document.getElementById('update-order-form').addEventListener('submit', async event => {
            event.preventDefault();
            const dueDate = new FormData(event.currentTarget).get('dueDate');
            await submitOrderChange({
                buttonId: 'update-order-submit',
                errorId: 'update-order-error',
                loadingText: 'Saving…',
                request: () => api(`/orders/${order._id}`, { method: 'PATCH', body: JSON.stringify({ dueDate }) }),
                successMessage: 'Order due date updated.',
                orderId: order._id
            });
        });
    }

    function showAddLineItemModal(order) {
        showModal(`<div class="modal-head"><h2>Add line items</h2><button class="close-button" data-close-modal aria-label="Close">${icons.close}</button></div>
            <form id="add-line-item-form"><div class="modal-body form-stack"><div><label class="section-label">New items</label><div id="line-items"></div><button class="add-item-link" id="add-another-line-item" type="button">+ Add another item</button></div><div class="form-error" id="add-line-item-error"></div></div><div class="modal-actions"><button class="secondary-button" data-close-modal type="button">Cancel</button><button class="primary-button" id="add-line-item-submit" type="submit">Add to order</button></div></form>`);
        addLineItemEditor();
        document.getElementById('add-another-line-item').addEventListener('click', addLineItemEditor);
        document.getElementById('add-line-item-form').addEventListener('submit', async event => {
            event.preventDefault();
            const lineItems = [...document.querySelectorAll('.line-item-editor')].map(row => ({
                description: row.querySelector('[name="description"]').value.trim(),
                quantity: Number(row.querySelector('[name="quantity"]').value),
                unitPrice: Math.round(Number(row.querySelector('[name="unitPrice"]').value) * 100)
            }));
            await submitOrderChange({
                buttonId: 'add-line-item-submit',
                errorId: 'add-line-item-error',
                loadingText: 'Adding…',
                request: () => api(`/orders/${order._id}/items`, { method: 'POST', body: JSON.stringify({ lineItems }) }),
                successMessage: `${lineItems.length === 1 ? 'Line item' : 'Line items'} added successfully.`,
                orderId: order._id
            });
        });
    }

    function showUpdateLineItemModal(order, item) {
        showModal(`<div class="modal-head"><h2>Update line item</h2><button class="close-button" data-close-modal aria-label="Close">${icons.close}</button></div>
            <form id="update-line-item-form"><div class="modal-body form-stack"><div class="form-field"><label for="updated-description">Description</label><input id="updated-description" name="description" value="${escapeHtml(item.description)}" required></div><div class="form-grid"><div class="form-field"><label for="updated-quantity">Quantity</label><input id="updated-quantity" name="quantity" type="number" min="1" step="1" value="${Number(item.quantity)}" required></div><div class="form-field"><label for="updated-unit-price">Unit price (₹)</label><input id="updated-unit-price" name="unitPrice" type="number" min="0.01" step="0.01" value="${(Number(item.unitPrice) / 100).toFixed(2)}" required></div></div><div class="form-error" id="update-line-item-error"></div></div><div class="modal-actions"><button class="secondary-button" data-close-modal type="button">Cancel</button><button class="primary-button" id="update-line-item-submit" type="submit">Save changes</button></div></form>`);
        document.getElementById('update-line-item-form').addEventListener('submit', async event => {
            event.preventDefault();
            const values = Object.fromEntries(new FormData(event.currentTarget).entries());
            const payload = { description: String(values.description).trim(), quantity: Number(values.quantity), unitPrice: Math.round(Number(values.unitPrice) * 100) };
            await submitOrderChange({
                buttonId: 'update-line-item-submit',
                errorId: 'update-line-item-error',
                loadingText: 'Saving…',
                request: () => api(`/orders/${order._id}/items/${item._id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
                successMessage: 'Line item updated successfully.',
                orderId: order._id
            });
        });
    }

    async function submitOrderChange({ buttonId, errorId, loadingText, request, successMessage, orderId }) {
        const button = document.getElementById(buttonId);
        const error = document.getElementById(errorId);
        button.disabled = true;
        button.textContent = loadingText;
        try {
            await request();
            closeModal();
            toast(successMessage);
            renderOrderDetail(orderId);
        } catch (err) {
            error.textContent = err.message;
            error.classList.add('show');
            button.disabled = false;
            button.textContent = buttonId === 'add-line-item-submit' ? 'Add to order' : buttonId === 'update-order-submit' ? 'Save due date' : 'Save changes';
        }
    }

    function showPaymentModal(order) {
        const due = Math.max(0, Number(order.orderTotal || 0) - Number(order.paymentsTotal || 0));
        showModal(`<div class="modal-head"><h2>Record a payment</h2><button class="close-button" data-close-modal aria-label="Close">${icons.close}</button></div>
            <form id="payment-form"><div class="modal-body form-stack"><p class="auth-subtitle modal-intro">The remaining balance is <strong>${money(due)}</strong>.</p><div class="form-field"><label for="payment-amount">Amount (₹)</label><input id="payment-amount" name="amount" type="number" min="0.01" max="${(due / 100).toFixed(2)}" step="0.01" value="${(due / 100).toFixed(2)}" required></div><div class="form-field"><label for="payment-note">Note <span class="optional">optional</span></label><input id="payment-note" name="note" placeholder="e.g. Bank transfer"></div><div class="form-error" id="payment-error"></div></div><div class="modal-actions"><button class="secondary-button" data-close-modal type="button">Cancel</button><button class="primary-button" id="payment-submit" type="submit">Record payment</button></div></form>`);
        document.getElementById('payment-form').addEventListener('submit', async event => {
            event.preventDefault();
            const values = Object.fromEntries(new FormData(event.currentTarget).entries());
            const button = document.getElementById('payment-submit');
            const error = document.getElementById('payment-error');
            button.disabled = true;
            button.textContent = 'Recording…';
            try {
                await api(`/orders/${order._id}/payments`, { method: 'POST', body: JSON.stringify({ amount: Math.round(Number(values.amount) * 100), note: values.note }) });
                closeModal();
                toast('Payment recorded successfully.');
                renderOrderDetail(order._id);
            } catch (err) {
                error.textContent = err.message;
                error.classList.add('show');
                button.disabled = false;
                button.textContent = 'Record payment';
            }
        });
    }

    function showNewOrderModal() {
        const tomorrow = new Date(Date.now() + 86400000);
        const defaultDate = tomorrow.toISOString().slice(0, 10);
        showModal(`<div class="modal-head"><h2>Create a new order</h2><button class="close-button" data-close-modal aria-label="Close">${icons.close}</button></div>
            <form id="new-order-form"><div class="modal-body form-stack"><div class="form-field"><label for="due-date">Due date</label><input id="due-date" name="dueDate" type="date" min="${defaultDate}" value="${defaultDate}" required></div><div><label class="section-label">Line items</label><div id="line-items"></div><button class="add-item-link" id="add-item-button" type="button">+ Add another item</button></div><div class="form-error" id="order-error"></div></div><div class="modal-actions"><button class="secondary-button" data-close-modal type="button">Cancel</button><button class="primary-button" id="order-submit" type="submit">Create order</button></div></form>`);
        addLineItemEditor();
        document.getElementById('add-item-button').addEventListener('click', addLineItemEditor);
        document.getElementById('new-order-form').addEventListener('submit', createOrder);
    }

    function addLineItemEditor() {
        const container = document.getElementById('line-items');
        const item = document.createElement('div');
        item.className = 'line-item-editor';
        item.innerHTML = `<div class="form-field description-field"><label>Description</label><input name="description" placeholder="Service or product" required></div><div class="form-field"><label>Qty</label><input name="quantity" type="number" min="1" step="1" value="1" required></div><div class="form-field"><label>Price (₹)</label><input name="unitPrice" type="number" min="0.01" step="0.01" required></div><button class="remove-item" type="button" aria-label="Remove item">${icons.trash}</button>`;
        item.querySelector('.remove-item').addEventListener('click', () => {
            if (container.children.length > 1) item.remove();
            else toast('An order needs at least one line item.', 'error');
        });
        container.appendChild(item);
    }

    async function createOrder(event) {
        event.preventDefault();
        const rows = [...document.querySelectorAll('.line-item-editor')];
        const payload = {
            dueDate: document.getElementById('due-date').value,
            lineItems: rows.map(row => ({
                description: row.querySelector('[name="description"]').value.trim(),
                quantity: Number(row.querySelector('[name="quantity"]').value),
                unitPrice: Math.round(Number(row.querySelector('[name="unitPrice"]').value) * 100)
            }))
        };
        const button = document.getElementById('order-submit');
        const error = document.getElementById('order-error');
        button.disabled = true;
        button.textContent = 'Creating…';
        try {
            const result = await api('/orders', { method: 'POST', body: JSON.stringify(payload) });
            closeModal();
            toast('Order created successfully.');
            navigate(`/orders/${result.data.orderId}`);
        } catch (err) {
            error.textContent = err.message;
            error.classList.add('show');
            button.disabled = false;
            button.textContent = 'Create order';
        }
    }

    function showModal(content) {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.id = 'modal-backdrop';
        backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${content}</div>`;
        document.body.appendChild(backdrop);
        backdrop.addEventListener('mousedown', event => { if (event.target === backdrop) closeModal(); });
        backdrop.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
        document.addEventListener('keydown', escapeModal);
    }

    function escapeModal(event) { if (event.key === 'Escape') closeModal(); }
    function closeModal() { document.getElementById('modal-backdrop')?.remove(); document.removeEventListener('keydown', escapeModal); }

    function route() {
        closeModal();
        const path = window.location.pathname;
        if (path === '/') return renderAuth();
        if (path === '/dashboard') return renderDashboard();
        const match = path.match(/^\/orders\/([^/]+)$/);
        if (match) return renderOrderDetail(decodeURIComponent(match[1]));
        navigate(getAuth() ? '/dashboard' : '/');
    }

    window.addEventListener('popstate', route);
    document.addEventListener('click', event => {
        const link = event.target.closest('a[data-link]');
        if (!link) return;
        event.preventDefault();
        navigate(link.getAttribute('href'));
    });
    route();
})();
