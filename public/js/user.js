function updateReturnPreview() {
  const val = parseInt(document.getElementById('modalDurationValue').value) || 1;
  const type = document.getElementById('modalDurationType').value;
  const now = new Date();
  if (type === 'hours') now.setHours(now.getHours() + val);
  else now.setDate(now.getDate() + val);
  document.getElementById('returnDatePreview').textContent = now.toLocaleString();
}

function openRequestModal(id, name, maxQty) {
  document.getElementById('modalEquipmentName').value = name;
  document.getElementById('modalEquipmentId').value = id;
  document.getElementById('modalQuantity').max = maxQty;
  document.getElementById('modalQuantity').value = 1;
  document.getElementById('modalDurationValue').value = 1;
  document.getElementById('modalDurationType').value = 'days';
  document.getElementById('modalPurpose').value = '';
  updateReturnPreview();
  document.getElementById('requestModal').classList.add('active');
}

function closeModal() {
  document.getElementById('requestModal').classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modalDurationValue').addEventListener('input', updateReturnPreview);
  document.getElementById('modalDurationType').addEventListener('change', updateReturnPreview);
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('categoryFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  loadMyRequests();
  document.getElementById('requestModal').addEventListener('click', (e) => {
    if (e.target.id === 'requestModal') closeModal();
  });
});

function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const category = document.getElementById('categoryFilter').value;
  const status = document.getElementById('statusFilter').value;
  document.querySelectorAll('.card').forEach(card => {
    const name = card.dataset.name || '';
    const cat = card.dataset.category || '';
    const st = card.dataset.status || '';
    card.classList.toggle('hidden', !(name.includes(search) && (!category || cat === category) && (!status || st === status)));
  });
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('categoryFilter').value = '';
  document.getElementById('statusFilter').value = '';
  document.querySelectorAll('.card').forEach(c => c.classList.remove('hidden'));
}

async function submitRequest() {
  const equipmentId = document.getElementById('modalEquipmentId').value;
  const equipmentName = document.getElementById('modalEquipmentName').value;
  const quantity = document.getElementById('modalQuantity').value;
  const durationValue = document.getElementById('modalDurationValue').value;
  const durationType = document.getElementById('modalDurationType').value;
  const purpose = document.getElementById('modalPurpose').value.trim();

  if (!purpose) { showToast('Please describe the purpose', 'error'); return; }

  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipment_id: equipmentId, equipment_name: equipmentName, quantity, duration_type: durationType, duration_value: durationValue, purpose })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ Request submitted for ${equipmentName}!`, 'success');
      closeModal();
      loadMyRequests();
    } else {
      showToast(data.message || 'Error submitting request', 'error');
    }
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
  }
}

async function loadMyRequests() {
  try {
    const res = await fetch('/api/my-requests');
    const data = await res.json();
    if (!data.success) return;
    const list = document.getElementById('requestsList');
    const requests = data.data;
    document.getElementById('requestCount').textContent = requests.filter(r => r.status === 'pending').length;
    if (requests.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><h3>No Requests Yet</h3><p>Submit a request for equipment to see it here</p></div>`;
      return;
    }
    list.innerHTML = requests.map(req => `
      <div class="request-item">
        <div class="request-info">
          <h3>${req.equipment_name}</h3>
          <p><strong>Qty:</strong> ${req.quantity} &nbsp;|&nbsp; <strong>Duration:</strong> ${req.duration_value} ${req.duration_type}</p>
          <p><strong>Return by:</strong> ${new Date(req.return_date).toLocaleString()}</p>
          <p><strong>Purpose:</strong> ${req.purpose}</p>
          <p style="font-size:0.85rem;color:#999;">Submitted: ${new Date(req.submitted_at).toLocaleDateString()}</p>
          ${req.rejection_reason ? `<p style="color:#c62828;font-size:0.9rem;margin-top:0.5rem;"><strong>Rejected:</strong> ${req.rejection_reason}</p>` : ''}
        </div>
        <div class="request-status">
          <span class="status-label status-${req.status}">${req.status}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading requests:', err);
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}