import { isPasscodeSet, setPasscode, verifyPasscode } from './auth.js';
import {
  openDB,
  addEntry,
  getAllEntries,
  getEntry,
  updateEntry,
  deleteEntry,
  getAllTags,
} from './db.js';

/* ── State ── */
let entries = [];
let allTags = [];
let selectedTags = new Set();
let editingId = null;

/* ── DOM refs ── */
const $ = (s) => document.querySelector(s);

/* ── Auth Screen ── */
function showAuth() {
  const isNew = !isPasscodeSet();
  $('#auth-screen').classList.remove('hidden');
  $('#app-screen').classList.add('hidden');
  $('#auth-title').textContent = isNew ? 'パスコードを設定' : 'パスコードを入力';
  $('#auth-submit').textContent = isNew ? '設定' : 'ログイン';
  $('#auth-confirm-group').classList.toggle('hidden', !isNew);
  $('#auth-error').textContent = '';
  $('#auth-passcode').value = '';
  $('#auth-confirm').value = '';
  $('#auth-passcode').focus();
}

async function handleAuth(e) {
  e.preventDefault();
  const pass = $('#auth-passcode').value;

  if (!isPasscodeSet()) {
    const confirm = $('#auth-confirm').value;
    if (pass.length < 4) {
      $('#auth-error').textContent = '4文字以上で入力してください';
      return;
    }
    if (pass !== confirm) {
      $('#auth-error').textContent = 'パスコードが一致しません';
      return;
    }
    await setPasscode(pass);
  } else {
    const ok = await verifyPasscode(pass);
    if (!ok) {
      $('#auth-error').textContent = 'パスコードが違います';
      return;
    }
  }

  $('#auth-screen').classList.add('hidden');
  $('#app-screen').classList.remove('hidden');
  await refresh();
}

/* ── Refresh Data ── */
async function refresh() {
  entries = await getAllEntries();
  allTags = await getAllTags();
  renderTagFilter();
  renderTable();
}

/* ── Tag Filter ── */
function renderTagFilter() {
  const container = $('#tag-filters');
  container.innerHTML = '';

  allTags.forEach((tag) => {
    const btn = document.createElement('button');
    btn.className = 'tag-btn' + (selectedTags.has(tag) ? ' active' : '');
    btn.textContent = tag;
    btn.addEventListener('click', () => {
      if (selectedTags.has(tag)) selectedTags.delete(tag);
      else selectedTags.add(tag);
      renderTagFilter();
      renderTable();
    });
    container.appendChild(btn);
  });

  if (selectedTags.size > 0) {
    const clear = document.createElement('button');
    clear.className = 'tag-btn clear';
    clear.textContent = 'クリア';
    clear.addEventListener('click', () => {
      selectedTags.clear();
      renderTagFilter();
      renderTable();
    });
    container.appendChild(clear);
  }
}

/* ── Table ── */
function renderTable() {
  const tbody = $('#entry-table tbody');
  tbody.innerHTML = '';

  const searchText = ($('#search-input')?.value || '').toLowerCase();

  const filtered = entries.filter((e) => {
    if (selectedTags.size > 0) {
      const has = [...selectedTags].every((t) => e.tags.includes(t));
      if (!has) return false;
    }
    if (searchText) {
      const hay = `${e.name} ${e.contactId} ${e.memo} ${e.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(searchText)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" class="empty">データがありません</td>';
    tbody.appendChild(tr);
    return;
  }

  filtered.forEach((e) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(e.name)}</td>
      <td>${esc(e.contactId)}</td>
      <td>${e.lastContact ? e.lastContact.slice(0, 10) : '-'}</td>
      <td class="tags-cell">${e.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</td>
      <td class="actions">
        <button class="btn-icon edit" data-id="${e.id}" title="編集">&#9998;</button>
        <button class="btn-icon del" data-id="${e.id}" title="削除">&#128465;</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ── Form ── */
function openForm(entry = null) {
  editingId = entry ? entry.id : null;
  $('#form-title').textContent = entry ? '連絡先を編集' : '連絡先を追加';
  $('#f-name').value = entry ? entry.name : '';
  $('#f-contact').value = entry ? entry.contactId : '';
  $('#f-date').value = entry ? (entry.lastContact || '').slice(0, 10) : '';
  $('#f-memo').value = entry ? entry.memo : '';
  $('#f-tags').value = entry ? entry.tags.join(', ') : '';
  $('#form-overlay').classList.remove('hidden');
  $('#f-name').focus();
}

function closeForm() {
  $('#form-overlay').classList.add('hidden');
  editingId = null;
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const data = {
    name: $('#f-name').value.trim(),
    contactId: $('#f-contact').value.trim(),
    lastContact: $('#f-date').value || '',
    memo: $('#f-memo').value.trim(),
    tags: $('#f-tags').value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  };

  if (!data.name) return;

  if (editingId !== null) {
    await updateEntry(editingId, data);
  } else {
    await addEntry(data);
  }

  closeForm();
  await refresh();
}

async function handleDelete(id) {
  if (!confirm('この連絡先を削除しますか？')) return;
  await deleteEntry(id);
  await refresh();
}

/* ── Init ── */
async function init() {
  await openDB();

  // Auth
  $('#auth-form').addEventListener('submit', handleAuth);

  // Toolbar
  $('#btn-add').addEventListener('click', () => openForm());
  $('#search-input').addEventListener('input', () => renderTable());

  // Form
  $('#entry-form').addEventListener('submit', handleFormSubmit);
  $('#btn-cancel').addEventListener('click', closeForm);

  // Table delegation
  $('#entry-table').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.classList.contains('edit')) {
      const entry = await getEntry(id);
      if (entry) openForm(entry);
    } else if (btn.classList.contains('del')) {
      await handleDelete(id);
    }
  });

  showAuth();
}

init();
