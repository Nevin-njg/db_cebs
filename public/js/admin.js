// ===== EQUIPMENT MANAGEMENT =====
let currentEditId = null;
let currentDeleteId = null;

function openAddModal() {
  currentEditId = null;
  document.getElementById('modalTitle').textContent = 'Add New Equipment';
  document.getElementById('equipmentName').value = '';
  document.getElementById('equipmentCategory').value = '';
  document.getElementById('equipmentIcon').value = '';
  document.getElementById('equipmentQuantity').value = '';
  document.getElementById('equipmentAvailable').value = '';
  document.getElementById('equipmentSpecs').value = '';
  document.getElementById('equipmentStatus').value = 'available';
  document.getElementById('equipmentNextAvailable').value = '';
  document.getElementById('equipmentModal').classList.add('active');
}

function openEditModal(item) {
  currentEditId = item.id;
  document.getElementById('modalTitle').textContent = 'Edit Equipment';
  document.getElementById('equipmentName').value = item.name;
  document.getElementById('equipmentCategory').value = item.category;
  document.getElementById('equipmentIcon').value = item.icon;
  document.getElementById('equipmentQuantity').value = item.total_quantity;
  document.getElementById('equipmentAvailable').value = item.available_quantity;
  document.getElementById('equipmentSpecs').value = item.specifications || '';
  document.getElementById('equipmentStatus').value = item.status;
  document.getElementById('equipmentNextAvailable').value = item.next_available || '';
  document.getElementById('equipmentModal').classList.add('active');
}

function closeModal() {
  document.getElementById('equipmentModal').classList.remove('active');
}

async function submitEquipment() {
  const body = {
    name: document.getElementById('equipmentName').value,
    category: document.getElementById('equipmentCategory').value,
    icon: document.getElementById('equipmentIcon').value || '🔧',
    total_quantity: document.getElementById('equipmentQuantity').value,
    available_quantity: document.getElementById('equipmentAvailable').value,
    specifications: document.getElementById('equipmentSpecs').value,
    status: document.getElementById('equipmentStatus').value,
    next_available: document.getElementById('equipmentNextAvailable').value || null
  };

  if (!body.name || !body.category || !body.total_quantity) {
    showToast('Please fill all required fields', 'error'); return;
  }

  try {
    const url = currentEditId ? `/api/equipment/${currentEditId}` : '/api/equipment';
    const method = currentEditId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeModal();
      setTimeout(() => location.reload(), 800);
    } else {
      showToast(data.message || 'Error saving equipment', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

function openDeleteModal(id, name) {
  currentDeleteId = id;
  document.getElementById('deleteItemName').textContent = name;
  document.getElementById('deleteModal').classList.add('active');
  document.getElementById('confirmDeleteBtn').onclick = confirmDelete;
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('active');
  currentDeleteId = null;
}

async function confirmDelete() {
  if (!currentDeleteId) return;
  try {
    const res = await fetch(`/api/equipment/${currentDeleteId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeDeleteModal();
      setTimeout(() => location.reload(), 800);
    } else {
      showToast(data.message || 'Error deleting', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

// ===== REQUEST MANAGEMENT =====
function filterRequests(status, btn) {
  document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.request-card').forEach(card => {
    card.classList.toggle('hidden', status !== 'all' && card.dataset.status !== status);
  });
}

async function approveRequest(id, btn) {
  btn.disabled = true;
  try {
    const res = await fetch(`/api/requests/${id}/approve`, { method: 'PUT' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      setTimeout(() => location.reload(), 800);
    } else {
      showToast(data.message || 'Error approving', 'error');
      btn.disabled = false;
    }
  } catch (err) {
    showToast('Network error', 'error');
    btn.disabled = false;
  }
}

let currentRejectionId = null;

function openRejectionModal(id, equipmentName, purpose, quantity) {
  currentRejectionId = id;
  document.getElementById('rejectionInfo').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
      <div><strong>Equipment:</strong> ${equipmentName}</div>
      <div><strong>Quantity:</strong> ${quantity} units</div>
    </div>
    <div style="margin-top:1rem;"><strong>Purpose:</strong> ${purpose}</div>
  `;
  document.getElementById('rejectionReasonSelect').value = '';
  document.getElementById('rejectionDetails').value = '';
  document.getElementById('rejectionModal').classList.add('active');
}

function closeRejectionModal() {
  document.getElementById('rejectionModal').classList.remove('active');
  currentRejectionId = null;
}

async function submitRejection() {
  const reason = document.getElementById('rejectionReasonSelect').value;
  const details = document.getElementById('rejectionDetails').value;
  if (!reason) { showToast('Please select a rejection reason', 'error'); return; }

  try {
    const res = await fetch(`/api/requests/${currentRejectionId}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejection_reason: reason, rejection_details: details })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Request rejected', 'info');
      closeRejectionModal();
      setTimeout(() => location.reload(), 800);
    } else {
      showToast(data.message || 'Error rejecting', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

async function markReturned(id, btn) {
  if (!confirm('Mark this equipment as returned? This will restore availability.')) return;
  btn.disabled = true;
  try {
    const res = await fetch(`/api/requests/${id}/return`, { method: 'PUT' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      setTimeout(() => location.reload(), 800);
    } else {
      showToast(data.message || 'Error', 'error');
      btn.disabled = false;
    }
  } catch (err) {
    showToast('Network error', 'error');
    btn.disabled = false;
  }
}

// ===== UTILITIES =====
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Close modals on backdrop click
document.addEventListener('DOMContentLoaded', () => {
  const equipmentModal = document.getElementById('equipmentModal');
  const deleteModal = document.getElementById('deleteModal');
  const rejectionModal = document.getElementById('rejectionModal');

  if (equipmentModal) equipmentModal.addEventListener('click', e => { if (e.target.id === 'equipmentModal') closeModal(); });
  if (deleteModal) deleteModal.addEventListener('click', e => { if (e.target.id === 'deleteModal') closeDeleteModal(); });
  if (rejectionModal) rejectionModal.addEventListener('click', e => { if (e.target.id === 'rejectionModal') closeRejectionModal(); });
});