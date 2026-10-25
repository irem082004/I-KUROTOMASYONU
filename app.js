// =========================================================================
// İŞKUR OTOMASYONU — FRONTEND UYGULAMA MANTIĞI
// =========================================================================

const state = {
  currentUser: null,
  currentRole: 'student',
  currentSubView: null,
  departments: [],
  advisors: [],
  students: [],
  announcements: [],
  selectedStudentId: 1,
  selectedDates: new Set(),
  currentStudentData: null,
  qrSecondsLeft: 30,
  tableData: {
    studentAtt: [],
    studentTasks: [],
    studentExcuses: [],
    advisorWorkers: [],
    advisorTasks: [],
    headStudents: [],
    secretaryStudents: [],
    secretaryExcuses: [],
    deanBudget: [],
    deanLeaves: []
  },
  sortState: {}
};

const ROLE_TITLES = {
  student: 'Öğrenci Paneli',
  advisor: 'Danışman Öğretmen Paneli',
  head: 'Bölüm Başkanı Paneli',
  secretary: 'Fakülte Sekreteri Paneli',
  dean: 'Dekan Paneli'
};

// Her rolün sol menü öğeleri (Tıklandığında sağ taraftaki ilgili ekranı yükler)
const ROLE_SIDEBAR_MODULES = {
  student: [
    { icon: '⌂', label: 'Genel Bakış', viewId: 'view-student-home', showFilter: true },
    { icon: '📅', label: 'Aylık Çalışma Planı', viewId: 'view-student-calendar', showFilter: true },
    { icon: '▣', label: 'QR Yoklama & Devam', viewId: 'view-student-qr', showFilter: false },
    { icon: '✉', label: 'Mazeret Talebi', viewId: 'view-student-excuses', showFilter: false },
    { icon: '✓', label: 'Atanan Görevlerim', viewId: 'view-student-tasks', showFilter: false }
  ],
  advisor: [
    { icon: '👥', label: 'Günlük Çalışanlar', viewId: 'view-advisor-workers', showFilter: true },
    { icon: '📋', label: 'Görev Tanımla & Liste', viewId: 'view-advisor-tasks', showFilter: true }
  ],
  head: [
    { icon: '🎓', label: 'Öğrenci Danışman Ataması', viewId: 'view-head-assign', showFilter: true },
    { icon: '📢', label: 'Genel Duyurular', viewId: 'view-head-announcements', showFilter: false }
  ],
  secretary: [
    { icon: '📊', label: 'Öğrenci & Maaş Tablosu', viewId: 'view-secretary-payroll', showFilter: true },
    { icon: '⚖', label: 'Mazeret Onay Merkezi', viewId: 'view-secretary-excuses', showFilter: true }
  ],
  dean: [
    { icon: '💰', label: 'Ödenek Planlaması', viewId: 'view-dean-budget', showFilter: true },
    { icon: '⚠', label: '10 Gün Yasal İzin Takibi', viewId: 'view-dean-leaves', showFilter: false }
  ]
};

// Giriş ekranında hızlı rol girişi
window.quickFillLogin = function (identifier) {
  document.getElementById('loginIdentifier').value = identifier;
  document.getElementById('loginPassword').value = '123456';
  document.getElementById('loginForm').requestSubmit();
};

// Sol menüden alt ekran seçildiğinde sağ içerik alanına yükle
window.openSubView = function (viewId) {
  const role = state.currentRole;
  const modules = ROLE_SIDEBAR_MODULES[role] || [];
  const targetMod = modules.find(m => m.viewId === viewId) || modules[0];
  if (!targetMod) return;

  state.currentSubView = targetMod.viewId;

  // Aktif rol panelindeki yalnızca seçili alt ekranı göster
  const rolePanel = document.getElementById(`panel-${role}`);
  if (rolePanel) {
    rolePanel.querySelectorAll('.sub-view').forEach(v => {
      v.style.display = v.id === targetMod.viewId ? 'block' : 'none';
    });
  }

  // Sol menü aktif durumunu güncelle
  document.querySelectorAll('#sidebarRoleModules .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === targetMod.viewId);
  });

  // Üst bar alt başlığını güncelle
  const subTitleEl = document.getElementById('activeSubViewTitle');
  if (subTitleEl) subTitleEl.textContent = targetMod.label;

  // Filtre çubuğunu sadece ilgili ekranlarda sade şekilde göster
  const filterBar = document.getElementById('globalFilterBar');
  if (filterBar) {
    filterBar.style.display = targetMod.showFilter ? 'flex' : 'none';
  }
};

function showToast(msg) {
  const el = document.getElementById('toastBox');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function formatMoney(val) {
  return Number(val || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

function getInitials(name) {
  if (!name) return 'K';
  const parts = name
    .replace(/Prof\.|Doç\.|Dr\.|Öğr\.|Üyesi|\(.*?\)/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'KA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderEmptyRow(colSpan, title = 'Veri Bulunamadı', sub = 'Seçilen kriterlere uygun kayıt bulunmuyor.') {
  return `
    <tr>
      <td colspan="${colSpan}">
        <div class="empty-state-box">
          <div class="empty-state-title">${title}</div>
          <div class="empty-state-sub">${sub}</div>
        </div>
      </td>
    </tr>
  `;
}

// Tablo Sıralama
window.sortTableData = function (tableKey, field) {
  const current = state.sortState[tableKey] || { field: null, dir: 'asc' };
  const nextDir = current.field === field && current.dir === 'asc' ? 'desc' : 'asc';
  state.sortState[tableKey] = { field, dir: nextDir };

  const arr = state.tableData[tableKey] || [];
  arr.sort((a, b) => {
    let valA = a[field];
    let valB = b[field];
    if (valA === null || valA === undefined) valA = '';
    if (valB === null || valB === undefined) valB = '';

    if (typeof valA === 'number' && typeof valB === 'number') {
      return nextDir === 'asc' ? valA - valB : valB - valA;
    }
    return nextDir === 'asc'
      ? String(valA).localeCompare(String(valB), 'tr')
      : String(valB).localeCompare(String(valA), 'tr');
  });

  if (tableKey === 'studentAtt') renderStudentAttendanceRows();
  else if (tableKey === 'studentTasks') renderStudentTasksRows();
  else if (tableKey === 'studentExcuses') renderStudentExcusesRows();
  else if (tableKey === 'advisorWorkers') renderAdvisorWorkersRows();
  else if (tableKey === 'advisorTasks') renderAdvisorTasksRows();
  else if (tableKey === 'headStudents') renderHeadStudentsRows();
  else if (tableKey === 'secretaryStudents') renderSecretaryStudentsRows();
  else if (tableKey === 'secretaryExcuses') renderSecretaryExcusesRows();
  else if (tableKey === 'deanBudget') renderDeanBudgetRows();
  else if (tableKey === 'deanLeaves') renderDeanLeavesRows();
};

function updateLiveClock() {
  const el = document.getElementById('liveDateDisplay');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

async function applyUserSession(user) {
  state.currentUser = user;
  if (user.student_id) {
    state.selectedStudentId = user.student_id;
  }

  document.getElementById('userAvatarInitials').textContent = getInitials(user.full_name);
  document.getElementById('loggedInUserName').textContent = user.full_name;
  document.getElementById('loggedInUserRole').textContent = ROLE_TITLES[user.role] || user.role;

  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';

  switchActiveRoleTab(user.role);
  await loadInitData();

  if (user.role === 'advisor') {
    document.getElementById('filterAdvisor').value = String(user.id);
    document.getElementById('taskAdvisorSelect').value = String(user.id);
    await refreshCurrentRolePanel();
  } else {
    document.getElementById('filterAdvisor').value = 'all';
  }
}

function switchActiveRoleTab(role) {
  state.currentRole = role;
  document.getElementById('activeRolePanelTitle').textContent = ROLE_TITLES[role] || 'Kullanıcı Paneli';

  document.querySelectorAll('.role-panel').forEach(p => {
    const isTarget = p.id === `panel-${role}`;
    p.classList.toggle('active', isTarget);
    p.style.display = isTarget ? 'block' : 'none';
  });

  // Sol menü öğelerini oluştur
  const modContainer = document.getElementById('sidebarRoleModules');
  const modules = ROLE_SIDEBAR_MODULES[role] || [];
  modContainer.innerHTML = modules.map(m => `
    <button type="button" class="nav-item" data-view="${m.viewId}" onclick="openSubView('${m.viewId}')">
      <span class="nav-icon">${m.icon}</span>
      <span class="nav-label">${m.label}</span>
    </button>
  `).join('');

  // Öğrenci veya Dekan rolüne göre filtre alanlarını sadeleştir
  const isStudent = role === 'student';
  const isAdvisor = role === 'advisor';
  const isDean = role === 'dean';

  document.getElementById('fieldFilterDepartment').style.display = (isStudent || isAdvisor || isDean) ? 'none' : 'flex';
  document.getElementById('fieldFilterAdvisor').style.display = (isStudent || isDean) ? 'none' : 'flex';
  document.getElementById('fieldFilterSearch').style.display = (isStudent || isAdvisor || isDean) ? 'none' : 'flex';
  document.getElementById('boxAddStudentBtn').style.display = (role === 'secretary') ? 'block' : 'none';

  // İlk menü öğesini varsayılan olarak aç
  if (modules.length > 0) {
    openSubView(modules[0].viewId);
  }
}

function getFilters() {
  return {
    month: Number(document.getElementById('filterMonth').value) || 10,
    year: Number(document.getElementById('filterYear').value) || 2026,
    department_id: document.getElementById('filterDepartment').value,
    advisor_id: document.getElementById('filterAdvisor').value,
    search: document.getElementById('filterSearch').value.trim()
  };
}

async function loadInitData() {
  const res = await fetch('/api/init');
  const data = await res.json();

  state.departments = data.departments || [];
  state.advisors = data.advisors || [];
  state.students = data.students || [];
  state.announcements = data.announcements || [];

  populateSelectBoxes();
  await refreshCurrentRolePanel();
}

function populateSelectBoxes() {
  const deptSelect = document.getElementById('filterDepartment');
  const annDeptSelect = document.getElementById('annDeptSelect');
  const newStDept = document.getElementById('newStDept');
  const editStDept = document.getElementById('editStDept');

  const currentDeptVal = deptSelect.value || 'all';
  deptSelect.innerHTML = '<option value="all">Tüm Bölümler</option>';
  annDeptSelect.innerHTML = '<option value="all">Tüm Fakülte Öğrencileri</option>';
  newStDept.innerHTML = '';
  editStDept.innerHTML = '';

  state.departments.forEach(d => {
    deptSelect.innerHTML += `<option value="${d.id}">${d.name}</option>`;
    annDeptSelect.innerHTML += `<option value="${d.id}">${d.name}</option>`;
    newStDept.innerHTML += `<option value="${d.id}">${d.name}</option>`;
    editStDept.innerHTML += `<option value="${d.id}">${d.name}</option>`;
  });
  deptSelect.value = currentDeptVal;

  const advSelect = document.getElementById('filterAdvisor');
  const taskAdvisorSelect = document.getElementById('taskAdvisorSelect');
  const newStAdvisor = document.getElementById('newStAdvisor');
  const editStAdvisor = document.getElementById('editStAdvisor');

  const currentAdvVal = advSelect.value || 'all';
  advSelect.innerHTML = '<option value="all">Tüm Danışmanlar</option><option value="unassigned">Danışmanı Atanmamış</option>';
  taskAdvisorSelect.innerHTML = '';
  newStAdvisor.innerHTML = '<option value="">Seçiniz (Opsiyonel)</option>';
  editStAdvisor.innerHTML = '<option value="">Danışman Atanmamış</option>';

  state.advisors.forEach(a => {
    advSelect.innerHTML += `<option value="${a.id}">${a.full_name}</option>`;
    taskAdvisorSelect.innerHTML += `<option value="${a.id}">${a.full_name}</option>`;
    newStAdvisor.innerHTML += `<option value="${a.id}">${a.full_name}</option>`;
    editStAdvisor.innerHTML += `<option value="${a.id}">${a.full_name}</option>`;
  });
  advSelect.value = currentAdvVal;

  const stSelect = document.getElementById('activeStudentSelect');
  const taskStSelect = document.getElementById('taskStudentSelect');
  stSelect.innerHTML = '';
  taskStSelect.innerHTML = '';

  state.students.forEach(s => {
    stSelect.innerHTML += `<option value="${s.id}">${s.student_no} — ${s.full_name}</option>`;
    taskStSelect.innerHTML += `<option value="${s.id}">${s.full_name} (${s.unit_name})</option>`;
  });

  if (state.students.some(s => s.id === Number(state.selectedStudentId))) {
    stSelect.value = state.selectedStudentId;
  } else if (state.students.length > 0) {
    state.selectedStudentId = state.students[0].id;
    stSelect.value = state.selectedStudentId;
  }
}

async function refreshCurrentRolePanel() {
  if (!state.currentUser) return;
  const role = state.currentRole;

  if (role === 'student') await renderStudentPanel();
  else if (role === 'advisor') await renderAdvisorPanel();
  else if (role === 'head') await renderHeadPanel();
  else if (role === 'secretary') await renderSecretaryPanel();
  else if (role === 'dean') await renderDeanPanel();
}

// =========================================================================
// ROL 1: ÖĞRENCİ ROLÜ
// =========================================================================
async function renderStudentPanel() {
  const { month, year } = getFilters();
  const res = await fetch(`/api/student-dashboard?student_id=${state.selectedStudentId}&month=${month}&year=${year}`);
  if (!res.ok) return;
  const data = await res.json();
  state.currentStudentData = data;

  const st = data.student;
  document.getElementById('studentHeaderMeta').innerHTML = `
    <div><strong>Ad Soyad:</strong> ${st.full_name}</div>
    <div><strong>Öğrenci Numarası:</strong> ${st.student_no}</div>
    <div><strong>Bölüm:</strong> ${st.department_name}</div>
    <div><strong>Çalışılan Birim:</strong> ${st.unit_name}</div>
    <div><strong>Danışman:</strong> ${st.advisor_name || 'Henüz Atanmadı'}</div>
    <div><strong>Durum:</strong> ${st.status === 'active' ? '<span class="badge badge-mustard">Aktif Çalışan</span>' : '<span class="badge badge-danger">İlişiği Kesildi</span>'}</div>
  `;

  // Duyurular kutusu
  const annBox = document.getElementById('studentAnnouncementsBox');
  if (state.announcements.length === 0) {
    annBox.innerHTML = `<div class="card-inner-white" style="color:var(--text-muted);">Yayınlanmış duyuru bulunmuyor.</div>`;
  } else {
    annBox.innerHTML = state.announcements.map(a => `
      <div class="card-inner-white" style="border-left:3px solid var(--mustard);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px;">
          <strong style="font-size:13px;">${a.title}</strong>
          <span class="badge">${a.department_name || 'Genel'}</span>
        </div>
        <div style="font-size:12.5px; color:var(--text-secondary);">${a.content}</div>
      </div>
    `).join('');
  }

  // İstatistik kartları
  document.getElementById('stStatWorked').textContent = `${data.stats.total_worked_days} Gün`;
  document.getElementById('stStatMonthlyPlan').textContent = `${data.stats.monthly_worked_days} / ${data.stats.monthly_planned_days} Gün`;
  document.getElementById('stStatSalarySub').textContent = `Tahmini Maaş: ${formatMoney(data.stats.monthly_estimated_salary)}`;
  document.getElementById('stStatLeave').textContent = `${data.stats.total_leave_days} / 10 Gün`;
  document.getElementById('stStatAdvisor').textContent = st.advisor_name || 'Henüz Atanmadı';
  document.getElementById('stStatUnit').textContent = st.unit_name;

  // Mazeret formu varsayılanları
  document.getElementById('excuseStudentName').value = st.full_name;
  document.getElementById('excuseUnitName').value = st.unit_name;
  if (!document.getElementById('excuseDate').value) {
    document.getElementById('excuseDate').value = new Date().toISOString().slice(0, 10);
  }

  // Takvim
  state.selectedDates = new Set(data.plans.map(p => p.work_date));
  renderCalendar(month, year, st, data.plans);

  // QR ve tablolar
  generateDynamicQr(st);
  state.tableData.studentAtt = data.all_plans || [];
  state.tableData.studentTasks = data.tasks || [];
  state.tableData.studentExcuses = data.excuses || [];

  renderStudentAttendanceRows();
  renderStudentTasksRows();
  renderStudentExcusesRows();
}

function renderStudentAttendanceRows() {
  const list = state.tableData.studentAtt;
  document.getElementById('studentAttCountBadge').textContent = `${list.length} Kayıt`;
  const tbody = document.getElementById('studentAttendanceTable');
  if (list.length === 0) {
    tbody.innerHTML = renderEmptyRow(4, 'Veri Bulunamadı', 'Henüz yoklama kaydı bulunmuyor.');
    return;
  }
  tbody.innerHTML = list.map(p => {
    let badge = '<span class="badge">Planlandı</span>';
    if (p.attendance_status === 'worked') badge = '<span class="badge badge-mustard">Çalışıldı</span>';
    if (p.attendance_status === 'excused') badge = '<span class="badge">İzinli</span>';
    return `
      <tr>
        <td><strong>${p.work_date}</strong></td>
        <td>${p.check_in || '--:--'}</td>
        <td>${p.check_out || '--:--'}</td>
        <td>${badge}</td>
      </tr>
    `;
  }).join('');
}

function renderStudentTasksRows() {
  const list = state.tableData.studentTasks;
  document.getElementById('studentTasksCountBadge').textContent = `${list.length} Görev`;
  const tbody = document.getElementById('studentTasksTable');
  if (list.length === 0) {
    tbody.innerHTML = renderEmptyRow(5, 'Veri Bulunamadı', 'Atanmış görev bulunmuyor.');
    return;
  }
  tbody.innerHTML = list.map(t => {
    const isDone = t.status === 'completed';
    return `
      <tr>
        <td><strong>${t.title}</strong></td>
        <td>${t.advisor_name}</td>
        <td>${t.due_date}</td>
        <td>${isDone ? '<span class="badge badge-mustard">Tamamlandı</span>' : '<span class="badge">Bekliyor</span>'}</td>
        <td>
          ${!isDone
            ? `<button class="btn btn-sm" onclick="completeStudentTask(${t.id}, 'completed')">Tamamla</button>`
            : `<button class="btn btn-secondary btn-sm" onclick="completeStudentTask(${t.id}, 'pending')">Geri Al</button>`}
        </td>
      </tr>
    `;
  }).join('');
}

function renderStudentExcusesRows() {
  const list = state.tableData.studentExcuses;
  document.getElementById('studentExcusesCountBadge').textContent = `${list.length} Talep`;
  const tbody = document.getElementById('studentExcusesHistoryTable');
  if (list.length === 0) {
    tbody.innerHTML = renderEmptyRow(4, 'Veri Bulunamadı', 'Oluşturulmuş mazeret talebi bulunmuyor.');
    return;
  }
  tbody.innerHTML = list.map(e => {
    let badge = '<span class="badge">Bekliyor</span>';
    if (e.status === 'approved') badge = '<span class="badge badge-mustard">Onaylandı</span>';
    if (e.status === 'rejected') badge = '<span class="badge badge-danger">Reddedildi</span>';
    return `
      <tr>
        <td><strong>${e.excuse_date}</strong></td>
        <td>${e.unit_name}</td>
        <td>${e.reason}</td>
        <td>${badge}</td>
      </tr>
    `;
  }).join('');
}

function renderCalendar(month, year, student, plans) {
  const grid = document.getElementById('calendarGrid');
  const warnBox = document.getElementById('scheduleWarningBox');
  grid.innerHTML = '';

  const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  dayNames.forEach(dn => {
    grid.innerHTML += `<div class="cal-head">${dn}</div>`;
  });

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  let startWeekday = firstDay.getDay();
  startWeekday = startWeekday === 0 ? 7 : startWeekday;

  for (let i = 1; i < startWeekday; i++) {
    grid.innerHTML += '<div class="cal-day empty"></div>';
  }

  const fullDays = (student.full_class_days || '').split(',').map(Number);
  const conflictDays = (student.conflict_days || '').split(',').map(Number);
  const planMap = new Map(plans.map(p => [p.work_date, p]));

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, d);
    let dow = dateObj.getDay();
    dow = dow === 0 ? 7 : dow;

    const isWeekend = dow === 6 || dow === 7;
    const isFullClass = fullDays.includes(dow);
    const isConflict = conflictDays.includes(dow);
    const existingPlan = planMap.get(dateStr);
    const isSelected = state.selectedDates.has(dateStr);

    const classes = ['cal-day'];
    let tagText = 'Uygun';

    if (isWeekend) {
      classes.push('weekend');
      tagText = 'Hafta Sonu';
    } else if (existingPlan && existingPlan.attendance_status === 'worked') {
      classes.push('worked');
      tagText = 'Çalışıldı';
    } else if (existingPlan && existingPlan.attendance_status === 'excused') {
      classes.push('excused');
      tagText = 'İzinli';
    } else if (isSelected) {
      classes.push('selected');
      tagText = 'Planlandı';
    }

    if (!isWeekend && (isFullClass || isConflict)) {
      classes.push('class-warning');
      if (!isSelected && (!existingPlan || existingPlan.attendance_status === 'planned')) {
        tagText = isFullClass ? 'Tam Gün Ders' : 'Ders Çakışması';
      }
    }

    const cell = document.createElement('div');
    cell.className = classes.join(' ');
    cell.innerHTML = `
      <span class="cal-num">${d}</span>
      <span class="cal-tag">${tagText}</span>
    `;

    if (!isWeekend) {
      cell.addEventListener('click', () => {
        if (existingPlan && (existingPlan.attendance_status === 'worked' || existingPlan.attendance_status === 'excused')) {
          showToast('Tamamlanmış veya onaylı izinli gün değiştirilemez.');
          return;
        }

        if (state.selectedDates.has(dateStr)) {
          state.selectedDates.delete(dateStr);
          warnBox.classList.remove('show');
        } else {
          if (isFullClass) {
            warnBox.textContent = `Uyarı: Seçtiğiniz ${dateStr} tarihinde TAM GÜN DERS bulunmaktadır.`;
            warnBox.classList.add('show');
          } else if (isConflict) {
            warnBox.textContent = `Uyarı: Seçtiğiniz ${dateStr} tarihinde DERS ÇAKIŞMASI tespit edildi.`;
            warnBox.classList.add('show');
          } else {
            warnBox.classList.remove('show');
          }
          state.selectedDates.add(dateStr);
        }
        renderCalendar(month, year, student, plans);
      });
    }

    grid.appendChild(cell);
  }
}

function generateDynamicQr(student) {
  if (!student) return;
  state.qrSecondsLeft = 30;
  const badge = document.getElementById('qrCountdownBadge');
  if (badge) badge.textContent = '30 sn';

  const token = `ISKUR-${student.student_no}-${Date.now().toString().slice(-5)}`;
  document.getElementById('qrTokenText').textContent = token;

  let rects = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const isCorner = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
      const fill = isCorner || ((r * 7 + c * 13 + token.charCodeAt((r + c) % token.length)) % 2 === 0);
      if (fill) {
        const color = isCorner ? '#D97706' : '#111827';
        rects += `<rect x="${c * 10 + 5}" y="${r * 10 + 5}" width="8" height="8" rx="1.5" fill="${color}" />`;
      }
    }
  }
  document.getElementById('qrSvgContainer').innerHTML = `<svg viewBox="0 0 100 100" width="94" height="94">${rects}</svg>`;
}

window.completeStudentTask = async function (taskId, newStatus = 'completed') {
  await fetch(`/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
  showToast(newStatus === 'completed' ? 'Görev tamamlandı.' : 'Görev bekleyen durumuna alındı.');
  await refreshCurrentRolePanel();
};

// =========================================================================
// ROL 2: DANIŞMAN ÖĞRETMEN ROLÜ
// =========================================================================
async function renderAdvisorPanel() {
  const dateInput = document.getElementById('advisorDateInput');
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  const { advisor_id } = getFilters();
  const taskStatusFilter = document.getElementById('advisorTaskStatusFilter')?.value || 'all';

  const wRes = await fetch(`/api/advisor/workers?date=${dateInput.value}&advisor_id=${advisor_id}`);
  const workers = await wRes.json();

  const tRes = await fetch(`/api/tasks?advisor_id=${advisor_id}&status=${taskStatusFilter}`);
  const tasks = await tRes.json();

  state.tableData.advisorWorkers = workers;
  state.tableData.advisorTasks = tasks;

  document.getElementById('advStatTodayWorkers').textContent = `${workers.length} Öğrenci`;
  document.getElementById('advStatCheckedIn').textContent = `${workers.filter(w => w.attendance_status === 'worked').length} Öğrenci`;
  document.getElementById('advStatPendingTasks').textContent = `${tasks.filter(t => t.status === 'pending').length} Görev`;
  document.getElementById('advStatCompletedTasks').textContent = `${tasks.filter(t => t.status === 'completed').length} Görev`;

  renderAdvisorWorkersRows();
  renderAdvisorTasksRows();
}

function renderAdvisorWorkersRows() {
  const list = state.tableData.advisorWorkers;
  const tbody = document.getElementById('advisorWorkersTable');
  if (list.length === 0) {
    tbody.innerHTML = renderEmptyRow(5, 'Veri Bulunamadı', 'Seçili tarihte çalışan öğrenci kaydı bulunamadı.');
    return;
  }
  tbody.innerHTML = list.map(w => {
    let badge = '<span class="badge">Planlandı</span>';
    if (w.attendance_status === 'worked') badge = '<span class="badge badge-mustard">Çalıştı</span>';
    if (w.attendance_status === 'excused') badge = '<span class="badge">İzinli</span>';

    return `
      <tr>
        <td><strong>${w.student_name}</strong><br/><span style="font-size:11px; color:var(--text-muted);">${w.student_no}</span></td>
        <td>${w.unit_name}</td>
        <td>${w.check_in || '--:--'} / ${w.check_out || '--:--'}</td>
        <td>${badge}</td>
        <td>
          ${w.attendance_status !== 'worked'
            ? `<button class="btn btn-sm" onclick="markWorkerAttendance(${w.id}, 'worked')">Onayla</button>`
            : `<span style="font-size:11.5px; color:var(--text-muted);">Onaylı</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

window.markWorkerAttendance = async function (planId, status) {
  await fetch(`/api/advisor/workers/${planId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attendance_status: status })
  });
  showToast('Yoklama durumu güncellendi.');
  await renderAdvisorPanel();
};

function renderAdvisorTasksRows() {
  const list = state.tableData.advisorTasks;
  const tbody = document.getElementById('advisorAllTasksTable');
  if (list.length === 0) {
    tbody.innerHTML = renderEmptyRow(5, 'Veri Bulunamadı', 'Tanımlanmış görev bulunmuyor.');
    return;
  }
  tbody.innerHTML = list.map(t => {
    const isDone = t.status === 'completed';
    return `
      <tr>
        <td><strong>${t.student_name}</strong><br/><span style="font-size:11px; color:var(--text-muted);">${t.unit_name}</span></td>
        <td><strong>${t.title}</strong></td>
        <td>${t.due_date}</td>
        <td>${isDone ? '<span class="badge badge-mustard">Tamamlandı</span>' : '<span class="badge">Bekliyor</span>'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="completeStudentTask(${t.id}, '${isDone ? 'pending' : 'completed'}')">
            ${isDone ? 'Bekleyene Al' : 'Tamamla'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// =========================================================================
// ROL 3: BÖLÜM BAŞKANI ROLÜ
// =========================================================================
async function renderHeadPanel() {
  const { month, year, department_id, advisor_id, search } = getFilters();
  const res = await fetch(`/api/students?month=${month}&year=${year}&department_id=${department_id}&advisor_id=${advisor_id}&search=${encodeURIComponent(search)}`);
  const students = await res.json();

  state.tableData.headStudents = students;

  const assignedCount = students.filter(s => s.advisor_id).length;
  document.getElementById('headStatTotalStudents').textContent = students.length;
  document.getElementById('headStatAssigned').textContent = assignedCount;
  document.getElementById('headStatUnassigned').textContent = students.length - assignedCount;
  document.getElementById('headStatAnnouncements').textContent = state.announcements.length;

  renderHeadStudentsRows();

  const annContainer = document.getElementById('announcementsList');
  if (state.announcements.length === 0) {
    annContainer.innerHTML = `
      <div class="empty-state-box" style="background:var(--bg-white); border:1px solid var(--border-color); border-radius:8px;">
        <div class="empty-state-title">Veri Bulunamadı</div>
        <div class="empty-state-sub">Henüz duyuru yayınlanmamış.</div>
      </div>
    `;
  } else {
    annContainer.innerHTML = state.announcements.map(a => `
      <div style="background:var(--bg-white); border:1px solid var(--border-color); border-left:3px solid var(--mustard); padding:12px 14px; border-radius:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <strong style="font-size:13.5px;">${a.title}</strong>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="badge badge-mustard">${a.department_name || 'Tüm Fakülte'}</span>
            <button class="btn btn-secondary btn-sm" onclick="deleteAnnouncement(${a.id})">Sil</button>
          </div>
        </div>
        <div style="font-size:12.5px; color:var(--text-secondary); margin-top:6px;">${a.content}</div>
      </div>
    `).join('');
  }
}

function renderHeadStudentsRows() {
  const list = state.tableData.headStudents;
  const tbody = document.getElementById('headAdvisorAssignTable');
  if (list.length === 0) {
    tbody.innerHTML = renderEmptyRow(4, 'Veri Bulunamadı', 'Filtre kriterlerine uygun öğrenci bulunamadı.');
    return;
  }
  tbody.innerHTML = list.map(s => {
    const options = state.advisors.map(a =>
      `<option value="${a.id}" ${s.advisor_id === a.id ? 'selected' : ''}>${a.full_name}</option>`
    ).join('');

    return `
      <tr>
        <td><strong>${s.full_name}</strong><br/><span style="font-size:11px; color:var(--text-muted);">${s.student_no}</span></td>
        <td>${s.department_name}<br/><span style="font-size:11px; color:var(--text-muted);">${s.unit_name}</span></td>
        <td>${s.advisor_name ? `<span class="badge badge-mustard">${s.advisor_name}</span>` : '<span class="badge">Atanmadı</span>'}</td>
        <td>
          <div style="display:flex; gap:6px; align-items:center;">
            <select id="assignAdv_${s.id}" style="padding:6px 8px; font-size:12px;">
              <option value="">Danışman Seçin</option>
              ${options}
            </select>
            <button class="btn btn-sm" onclick="assignAdvisorToStudent(${s.id})">Kaydet</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.assignAdvisorToStudent = async function (studentId) {
  const advisorId = document.getElementById(`assignAdv_${studentId}`).value;
  await fetch(`/api/students/${studentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ advisor_id: advisorId })
  });
  showToast('Danışman ataması güncellendi.');
  await loadInitData();
};

window.deleteAnnouncement = async function (annId) {
  await fetch(`/api/announcements/${annId}`, { method: 'DELETE' });
  showToast('Duyuru silindi.');
  await loadInitData();
};

// =========================================================================
// ROL 4: FAKÜLTE SEKRETERİ ROLÜ
// =========================================================================
async function renderSecretaryPanel() {
  const { month, year, department_id, advisor_id, search } = getFilters();
  const excuseStatus = document.getElementById('secExcuseStatusFilter')?.value || 'all';

  const sRes = await fetch(`/api/students?month=${month}&year=${year}&department_id=${department_id}&advisor_id=${advisor_id}&search=${encodeURIComponent(search)}`);
  const students = await sRes.json();

  const eRes = await fetch(`/api/excuses?department_id=${department_id}&status=${excuseStatus}`);
  const excuses = await eRes.json();

  state.tableData.secretaryStudents = students;
  state.tableData.secretaryExcuses = excuses;

  const totalPayroll = students.reduce((acc, s) => acc + s.calculated_salary, 0);
  const totalLeaves = students.reduce((acc, s) => acc + s.total_leave_days, 0);
  const pendingExcuses = excuses.filter(e => e.status === 'pending').length;

  document.getElementById('secStatTotalStudents').textContent = students.length;
  document.getElementById('secStatPendingExcuses').textContent = pendingExcuses;
  document.getElementById('secStatTotalPayroll').textContent = formatMoney(totalPayroll);
  document.getElementById('secStatTotalLeaves').textContent = `${totalLeaves} Gün`;
  document.getElementById('secTableStudentCount').textContent = `${students.length} Öğrenci`;

  renderSecretaryStudentsRows();
  renderSecretaryExcusesRows();
}

function renderSecretaryStudentsRows() {
  const list = state.tableData.secretaryStudents;
  const tbody = document.getElementById('secretaryStudentsTable');
  if (list.length === 0) {
    tbody.innerHTML = renderEmptyRow(9, 'Veri Bulunamadı', 'Filtre kriterlerine uygun çalışan öğrenci bulunamadı.');
    return;
  }
  tbody.innerHTML = list.map(s => `
    <tr>
      <td>
        <strong>${s.full_name}</strong>
        <br/><span style="font-size:11px; color:var(--text-muted);">${s.student_no}</span>
      </td>
      <td>${s.department_name}</td>
      <td>${s.unit_name}</td>
      <td>${s.advisor_name || '<span class="badge">Atanmadı</span>'}</td>
      <td><strong>${s.worked_days_count}</strong> / ${s.planned_days_count} Gün</td>
      <td><span class="badge badge-mustard">%${s.attendance_rate}</span></td>
      <td>
        <span class="badge ${s.total_leave_days > 10 ? 'badge-danger' : ''}">${s.total_leave_days} / 10 Gün</span>
      </td>
      <td><strong>${formatMoney(s.calculated_salary)}</strong></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openEditStudentModal(${s.id})">Düzenle</button>
      </td>
    </tr>
  `).join('');
}

function renderSecretaryExcusesRows() {
  const list = state.tableData.secretaryExcuses;
  const tbody = document.getElementById('secretaryExcusesTable');
  if (list.length === 0) {
    tbody.innerHTML = renderEmptyRow(7, 'Veri Bulunamadı', 'Görüntülenecek mazeret talebi bulunmuyor.');
    return;
  }
  tbody.innerHTML = list.map(e => {
    let statusBadge = '<span class="badge">Bekliyor</span>';
    if (e.status === 'approved') statusBadge = '<span class="badge badge-mustard">Onaylandı</span>';
    if (e.status === 'rejected') statusBadge = '<span class="badge badge-danger">Reddedildi</span>';

    return `
      <tr>
        <td><strong>${e.student_name}</strong><br/><span style="font-size:11px; color:var(--text-muted);">${e.student_no}</span></td>
        <td>${e.unit_name}</td>
        <td>${e.advisor_name || '-'}</td>
        <td><strong>${e.excuse_date}</strong></td>
        <td>${e.reason}</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm" onclick="decideExcuse(${e.id}, 'approved')">Onayla</button>
            <button class="btn btn-secondary btn-sm" onclick="decideExcuse(${e.id}, 'rejected')">Reddet</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.decideExcuse = async function (excuseId, status) {
  await fetch(`/api/excuses/${excuseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  showToast(`Mazeret talebi ${status === 'approved' ? 'onaylandı' : 'reddedildi'}.`);
  await refreshCurrentRolePanel();
};

window.openEditStudentModal = async function (studentId) {
  const { month, year } = getFilters();
  const res = await fetch(`/api/students?month=${month}&year=${year}`);
  const list = await res.json();
  const st = list.find(x => x.id === studentId);
  if (!st) return;

  document.getElementById('editStId').value = st.id;
  document.getElementById('editStName').value = st.full_name;
  document.getElementById('editStDept').value = st.department_id;
  document.getElementById('editStUnit').value = st.unit_name;
  document.getElementById('editStAdvisor').value = st.advisor_id || '';
  document.getElementById('editStWage').value = st.daily_wage;
  document.getElementById('editStStatus').value = st.status || 'active';

  document.getElementById('modalEditStudent').classList.add('show');
};

// =========================================================================
// ROL 5: DEKAN ROLÜ
// =========================================================================
async function renderDeanPanel() {
  const { month, year } = getFilters();
  const res = await fetch(`/api/dean/summary?month=${month}&year=${year}`);
  const data = await res.json();

  const totalBudget = data.departments.reduce((a, d) => a + d.budget_allocated, 0);
  const usedBudget = data.departments.reduce((a, d) => a + d.used_budget, 0);
  const totalStudents = data.students_leave_tracking.length;
  const activeStudents = data.students_leave_tracking.filter(s => s.status === 'active').length;
  const exceededCount = data.students_leave_tracking.filter(s => s.exceeded_limit).length;

  document.getElementById('deanStatTotalBudget').textContent = formatMoney(totalBudget);
  document.getElementById('deanStatUsedBudget').textContent = formatMoney(usedBudget);
  document.getElementById('deanStatStudents').textContent = `${totalStudents} Öğrenci`;
  document.getElementById('deanStatActiveSub').textContent = `${activeStudents} Aktif • ${totalStudents - activeStudents} İlişiği Kesilen`;
  document.getElementById('deanStatLimitExceeded').textContent = `${exceededCount} Öğrenci`;

  state.tableData.deanBudget = data.departments;

  const leaveFilter = document.getElementById('deanLeaveFilterSelect')?.value || 'all';
  let leavesList = data.students_leave_tracking;
  if (leaveFilter === 'exceeded') {
    leavesList = leavesList.filter(s => s.exceeded_limit);
  } else if (leaveFilter === 'terminated') {
    leavesList = leavesList.filter(s => s.status === 'terminated');
  }
  state.tableData.deanLeaves = leavesList;

  renderDeanBudgetRows();
  renderDeanLeavesRows();
}

function renderDeanBudgetRows() {
  const list = state.tableData.deanBudget;
  const tbody = document.getElementById('deanBudgetTable');
  if (list.length === 0) {
    tbody.innerHTML = renderEmptyRow(6, 'Veri Bulunamadı');
    return;
  }
  tbody.innerHTML = list.map(d => `
    <tr>
      <td><strong>${d.name}</strong></td>
      <td>${d.student_count} Öğrenci</td>
      <td>${formatMoney(d.used_budget)}</td>
      <td><strong style="color:var(--mustard-hover);">${formatMoney(d.remaining_budget)}</strong></td>
      <td>
        <input type="number" id="budgetInput_${d.id}" value="${d.budget_allocated}" style="width:130px; padding:6px 8px;" />
      </td>
      <td>
        <button class="btn btn-sm" onclick="updateDeptBudget(${d.id})">Güncelle</button>
      </td>
    </tr>
  `).join('');
}

function renderDeanLeavesRows() {
  const list = state.tableData.deanLeaves;
  const tbody = document.getElementById('deanLeaveLimitTable');
  if (list.length === 0) {
    tbody.innerHTML = renderEmptyRow(5, 'Veri Bulunamadı', 'Seçilen filtreye uygun öğrenci bulunamadı.');
    return;
  }
  tbody.innerHTML = list.map(s => {
    const isTerminated = s.status === 'terminated';
    let statusBadge = '<span class="badge">Yasal Sınırda</span>';
    if (s.exceeded_limit && !isTerminated) {
      statusBadge = '<span class="badge badge-danger">10 Gün Sınırı Aşıldı</span>';
    } else if (isTerminated) {
      statusBadge = '<span class="badge badge-danger">İlişiği Kesildi</span>';
    }

    return `
      <tr>
        <td><strong>${s.full_name}</strong><br/><span style="font-size:11px; color:var(--text-muted);">${s.student_no}</span></td>
        <td>${s.department_name}</td>
        <td><strong>${s.total_leave_days}</strong> / 10 Gün</td>
        <td>${statusBadge}</td>
        <td>
          ${isTerminated
            ? `<button class="btn btn-secondary btn-sm" onclick="toggleStudentTermination(${s.id}, 'active')">Aktif Et</button>`
            : `<button class="btn ${s.exceeded_limit ? 'btn-danger' : 'btn-secondary'} btn-sm" onclick="toggleStudentTermination(${s.id}, 'terminated')">İlişiği Kes</button>`}
        </td>
      </tr>
    `;
  }).join('');
}

window.updateDeptBudget = async function (deptId) {
  const val = document.getElementById(`budgetInput_${deptId}`).value;
  await fetch(`/api/departments/${deptId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ budget_allocated: Number(val) })
  });
  showToast('Bölüm ödeneği güncellendi.');
  await renderDeanPanel();
};

window.toggleStudentTermination = async function (studentId, newStatus) {
  await fetch(`/api/students/${studentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
  showToast(
    newStatus === 'terminated'
      ? '10 günlük yasal izin sınırının aşılması nedeniyle öğrencinin İŞKUR ilişiği kesildi.'
      : 'Öğrenci kaydı tekrar aktif edildi.'
  );
  await refreshCurrentRolePanel();
};

// =========================================================================
// ETKİLEŞİM VE FORM OLAYLARI
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  updateLiveClock();
  setInterval(updateLiveClock, 30000);

  // 30 Saniyelik Dinamik QR Sayaç Döngüsü
  setInterval(() => {
    if (!state.currentUser || state.currentRole !== 'student' || !state.currentStudentData) return;
    state.qrSecondsLeft -= 1;
    if (state.qrSecondsLeft <= 0) {
      generateDynamicQr(state.currentStudentData.student);
    } else {
      const badge = document.getElementById('qrCountdownBadge');
      if (badge) badge.textContent = `${state.qrSecondsLeft} sn`;
    }
  }, 1000);

  // Sol Açılır-Kapanır Menü
  const sidebar = document.getElementById('appSidebar');
  const toggleSidebar = () => sidebar.classList.toggle('collapsed');
  document.getElementById('btnSidebarCollapse').addEventListener('click', toggleSidebar);
  document.getElementById('btnTopbarToggle').addEventListener('click', toggleSidebar);

  // Giriş (Login) Formu
  const loginForm = document.getElementById('loginForm');
  const loginErrorBox = document.getElementById('loginErrorBox');

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginErrorBox.classList.remove('show');

    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const out = await res.json();

    if (!res.ok) {
      loginErrorBox.textContent = out.error || 'Giriş başarısız.';
      loginErrorBox.classList.add('show');
      return;
    }

    await applyUserSession(out.user);
    showToast(`Hoş geldiniz, ${out.user.full_name}`);
  });

  // Çıkış Yap Butonları
  const handleLogout = () => {
    state.currentUser = null;
    document.getElementById('appShell').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'grid';
    document.getElementById('loginIdentifier').value = '';
    showToast('Oturum kapatıldı.');
  };
  document.getElementById('btnLogout').addEventListener('click', handleLogout);
  document.getElementById('btnSidebarLogout').addEventListener('click', handleLogout);

  // Küresel Filtre Uygula & Sıfırla
  document.getElementById('btnApplyFilter').addEventListener('click', () => {
    refreshCurrentRolePanel();
    showToast('Filtreler uygulandı.');
  });

  document.getElementById('btnResetFilter').addEventListener('click', () => {
    document.getElementById('filterMonth').value = '10';
    document.getElementById('filterYear').value = '2026';
    document.getElementById('filterDepartment').value = 'all';
    document.getElementById('filterAdvisor').value = 'all';
    document.getElementById('filterSearch').value = '';
    refreshCurrentRolePanel();
    showToast('Filtreler sıfırlandı.');
  });

  ['filterMonth', 'filterYear', 'filterDepartment', 'filterAdvisor'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => refreshCurrentRolePanel());
  });

  document.getElementById('filterSearch').addEventListener('input', () => {
    if (state.currentRole === 'head') renderHeadPanel();
    if (state.currentRole === 'secretary') renderSecretaryPanel();
  });

  document.getElementById('advisorTaskStatusFilter')?.addEventListener('change', () => renderAdvisorPanel());
  document.getElementById('secExcuseStatusFilter')?.addEventListener('change', () => renderSecretaryPanel());
  document.getElementById('deanLeaveFilterSelect')?.addEventListener('change', () => renderDeanPanel());

  // Aylık Çalışma Planı Kaydet
  document.getElementById('btnSaveWorkPlan').addEventListener('click', async () => {
    const { month, year } = getFilters();
    const res = await fetch('/api/work-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: state.selectedStudentId,
        month,
        year,
        dates: Array.from(state.selectedDates)
      })
    });
    const out = await res.json();
    showToast(out.message || 'Çalışma planı kaydedildi.');
    await refreshCurrentRolePanel();
  });

  // QR Kod Yenile & Giriş-Çıkış
  document.getElementById('btnRefreshQr').addEventListener('click', () => {
    if (state.currentStudentData) generateDynamicQr(state.currentStudentData.student);
    showToast('QR kod yenilendi.');
  });

  document.getElementById('btnQrCheckIn').addEventListener('click', async () => {
    const nowTime = new Date().toTimeString().slice(0, 5);
    await fetch('/api/attendance/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: state.selectedStudentId, action: 'check_in', time: nowTime })
    });
    showToast(`Giriş saati (${nowTime}) kaydedildi.`);
    await refreshCurrentRolePanel();
  });

  document.getElementById('btnQrCheckOut').addEventListener('click', async () => {
    const nowTime = new Date().toTimeString().slice(0, 5);
    await fetch('/api/attendance/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: state.selectedStudentId, action: 'check_out', time: nowTime })
    });
    showToast(`Çıkış saati (${nowTime}) kaydedildi.`);
    await refreshCurrentRolePanel();
  });

  // Mazeret Talebi Gönder
  document.getElementById('excuseForm').addEventListener('submit', async e => {
    e.preventDefault();
    const unit_name = document.getElementById('excuseUnitName').value;
    const excuse_date = document.getElementById('excuseDate').value;
    const reason = document.getElementById('excuseReason').value;

    const res = await fetch('/api/excuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: state.selectedStudentId,
        unit_name,
        excuse_date,
        reason
      })
    });
    const out = await res.json();
    document.getElementById('excuseReason').value = '';
    showToast(out.message || 'Mazeret talebi gönderildi.');
    await refreshCurrentRolePanel();
  });

  // Danışman Tarih Filtresi ve Görev Atama
  document.getElementById('btnAdvisorFilterDate').addEventListener('click', () => renderAdvisorPanel());
  document.getElementById('taskDueDateInput').value = new Date().toISOString().slice(0, 10);

  document.getElementById('advisorTaskForm').addEventListener('submit', async e => {
    e.preventDefault();
    const advisor_id = document.getElementById('taskAdvisorSelect').value;
    const student_id = document.getElementSelect?.value || document.getElementById('taskStudentSelect').value;
    const title = document.getElementById('taskTitleInput').value;
    const due_date = document.getElementById('taskDueDateInput').value;

    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ advisor_id, student_id, title, due_date })
    });
    document.getElementById('taskTitleInput').value = '';
    showToast('Görev öğrenciye atandı.');
    await refreshCurrentRolePanel();
  });

  // Bölüm Başkanı Duyuru Yayınlama
  document.getElementById('headAnnouncementForm').addEventListener('submit', async e => {
    e.preventDefault();
    const department_id = document.getElementById('annDeptSelect').value;
    const title = document.getElementById('annTitleInput').value;
    const content = document.getElementById('annContentInput').value;

    await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_id: state.currentUser?.id || 3,
        department_id,
        title,
        content
      })
    });
    document.getElementById('annTitleInput').value = '';
    document.getElementById('annContentInput').value = '';
    showToast('Duyuru yayınlandı.');
    await loadInitData();
  });

  // Yeni Öğrenci Modal
  const addModal = document.getElementById('modalAddStudent');
  document.getElementById('btnOpenAddStudent').addEventListener('click', () => addModal.classList.add('show'));
  document.getElementById('btnCloseAddModal').addEventListener('click', () => addModal.classList.remove('show'));

  document.getElementById('addStudentForm').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      full_name: document.getElementById('newStName').value,
      student_no: document.getElementById('newStNo').value,
      department_id: document.getElementById('newStDept').value,
      unit_name: document.getElementById('newStUnit').value,
      advisor_id: document.getElementById('newStAdvisor').value,
      daily_wage: document.getElementById('newStWage').value
    };

    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const out = await res.json();
    if (!res.ok) {
      showToast(out.error || 'Hata oluştu.');
      return;
    }
    addModal.classList.remove('show');
    document.getElementById('addStudentForm').reset();
    showToast('Yeni öğrenci kaydı eklendi.');
    await loadInitData();
  });

  // Öğrenci Düzenle Modal
  const editModal = document.getElementById('modalEditStudent');
  document.getElementById('btnCloseEditModal').addEventListener('click', () => editModal.classList.remove('show'));

  document.getElementById('editStudentForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('editStId').value;
    const payload = {
      full_name: document.getElementById('editStName').value,
      department_id: document.getElementById('editStDept').value,
      unit_name: document.getElementById('editStUnit').value,
      advisor_id: document.getElementById('editStAdvisor').value,
      daily_wage: document.getElementById('editStWage').value,
      status: document.getElementById('editStStatus').value
    };

    await fetch(`/api/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    editModal.classList.remove('show');
    showToast('Öğrenci bilgileri güncellendi.');
    await loadInitData();
  });
});
