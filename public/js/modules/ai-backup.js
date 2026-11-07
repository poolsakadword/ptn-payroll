/**
 * ==============================================================================
 * PTN Payroll - AI Assistant (Gemini) & Database Backup Module
 * ==============================================================================
 */

// BACKUP & RESTORE HANDLERS (ENTERPRISE FULL TABLE COVERAGE & SELECTIVE RESTORE)
window.pendingRestoreBackupData = null;

function backupDatabase(isAutoSafety) {
  if (!isAutoSafety && !hasPermission('manage_backup')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์สำรองข้อมูลระบบ', 'error');
    return Promise.reject(new Error('สิทธิ์ไม่เพียงพอ'));
  }
  if (!isAutoSafety) showToast('กำลังเตรียมไฟล์สำรองข้อมูลทั้งระบบ...', 'info');
  return callApi('backupDatabase', { username: (State.currentUser && State.currentUser.username) || (window.currentUser && window.currentUser.username) || 'Admin' })
    .then(function(r) {
      if (!r.success || !r.backup) {
        showToast(r.message || 'ไม่สามารถสำรองข้อมูลได้', 'error');
        return null;
      }
      var jsonStr = JSON.stringify(r.backup, null, 2);
      var nowStr = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      var prefix = isAutoSafety ? 'SAFETY_PRE_RESTORE_BACKUP_' : 'PTN_FULL_SYSTEM_BACKUP_';
      var filename = prefix + nowStr + '.json';

      var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (!isAutoSafety) {
        showToast('ดาวน์โหลดไฟล์สำรองข้อมูลสมบูรณ์ทุกตารางเรียบร้อย');
      }
      return r.backup;
    })
    .catch(function(err) {
      showToast('Error Backup: ' + err.message, 'error');
      return null;
    });
}

function triggerRestoreBackup() {
  if (!hasPermission('manage_backup')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์กู้คืนข้อมูลระบบ', 'error');
    return;
  }
  var fileInput = document.getElementById('restoreBackupFileInput');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

function handleRestoreBackupFile(event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var backupData = JSON.parse(e.target.result);
      var data = backupData.data || backupData;

      if (!data.employees && !data.settings && !data.users && !data.monthly_inputs && !data.branches) {
        showToast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของระบบ PTN หรือโครงสร้างข้อมูลไม่ถูกต้อง', 'error');
        return;
      }

      window.pendingRestoreBackupData = backupData;

      // Extract metadata
      var metaName = file.name + ' (' + (file.size > 1048576 ? (file.size/1048576).toFixed(2) + ' MB' : (file.size/1024).toFixed(1) + ' KB') + ')';
      var lblMeta = document.getElementById('restoreFileMetaName');
      if (lblMeta) lblMeta.textContent = metaName;

      var bDate = backupData.backupDate || backupData.date;
      var dateDisplay = '-';
      if (bDate) {
        try {
          var d = new Date(bDate);
          dateDisplay = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch(ex) { dateDisplay = String(bDate); }
      } else {
        dateDisplay = 'ไม่ระบุในไฟล์';
      }

      var empCount = (data.employees || []).length;
      var branchCount = (data.branches || []).length;

      // Extract unique periods from monthly_inputs or payroll_calcs
      var periodSet = new Set();
      (data.monthly_inputs || []).forEach(function(i) { if (i.period) periodSet.add(i.period); });
      (data.payroll_calcs || []).forEach(function(p) { if (p.period) periodSet.add(p.period); });
      var periods = Array.from(periodSet).sort();

      var elDate = document.getElementById('lblRestoreDate');
      if (elDate) elDate.textContent = dateDisplay;
      var elEmp = document.getElementById('lblRestoreEmpCount');
      if (elEmp) elEmp.textContent = empCount + ' คน';
      var elBranch = document.getElementById('lblRestoreBranchCount');
      if (elBranch) elBranch.textContent = branchCount > 0 ? branchCount + ' สาขา' : 'ไม่มีในไฟล์';
      var elPeriods = document.getElementById('lblRestorePeriodsCount');
      if (elPeriods) elPeriods.textContent = periods.length + ' งวด';

      // Populate Period Checkboxes
      var periodBox = document.getElementById('restorePeriodCheckboxes');
      if (periodBox) {
        if (periods.length === 0) {
          periodBox.innerHTML = '<span style="color:#94a3b8">ไม่มีรายการงวดเงินเดือนในไฟล์</span>';
        } else {
          periodBox.innerHTML = periods.map(function(p) {
            return '<label style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer">' +
              '<input type="checkbox" class="restore-period-chk" value="' + p + '" checked style="accent-color:#2563eb"> ' +
              '<span>' + p + '</span>' +
            '</label>';
          }).join('');
        }
      }

      // Reset checkboxes
      if (document.getElementById('chkAutoSafetyBackup')) document.getElementById('chkAutoSafetyBackup').checked = true;
      if (document.getElementById('chkRestoreEmployees')) document.getElementById('chkRestoreEmployees').checked = true;
      if (document.getElementById('chkRestoreDevices')) document.getElementById('chkRestoreDevices').checked = (data.employee_devices || []).length > 0;
      if (document.getElementById('chkRestorePayroll')) document.getElementById('chkRestorePayroll').checked = periods.length > 0;
      if (document.getElementById('chkRestorePtnTime')) document.getElementById('chkRestorePtnTime').checked = Boolean(data.time_logs || data.leave_requests || data.ot_requests || data.advance_requests);
      if (document.getElementById('chkRestorePushSubs')) document.getElementById('chkRestorePushSubs').checked = (data.push_subscriptions || []).length > 0;
      if (document.getElementById('chkRestoreSettings')) document.getElementById('chkRestoreSettings').checked = true;
      if (document.getElementById('chkRestoreUsers')) document.getElementById('chkRestoreUsers').checked = false; // default false for security

      toggleRestorePeriodOptions();

      // Open Modal
      openModal('modalRestoreInspection');

    } catch(err) {
      showToast('ไฟล์ JSON ไม่ถูกต้อง หรือเสียหาย: ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'utf-8');
}

function toggleRestorePeriodOptions() {
  var chkPayroll = document.getElementById('chkRestorePayroll');
  var area = document.getElementById('restorePeriodScopeArea');
  if (area && chkPayroll) {
    area.style.display = chkPayroll.checked ? 'flex' : 'none';
  }
}

function toggleSelectAllRestorePeriods() {
  var chks = document.querySelectorAll('.restore-period-chk');
  if (chks.length === 0) return;
  var allChecked = Array.from(chks).every(function(c) { return c.checked; });
  chks.forEach(function(c) { c.checked = !allChecked; });
}

function executeSelectiveRestore() {
  if (!hasPermission('manage_backup')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์กู้คืนข้อมูลระบบ', 'error');
    return;
  }
  if (!window.pendingRestoreBackupData) {
    showToast('ไม่พบข้อมูลไฟล์สำรอง กรุณาเลือกไฟล์ใหม่อีกครั้ง', 'error');
    return;
  }

  var doSafety = document.getElementById('chkAutoSafetyBackup') ? document.getElementById('chkAutoSafetyBackup').checked : false;
  var doEmployees = document.getElementById('chkRestoreEmployees') ? document.getElementById('chkRestoreEmployees').checked : true;
  var doDevices = document.getElementById('chkRestoreDevices') ? document.getElementById('chkRestoreDevices').checked : true;
  var doPayroll = document.getElementById('chkRestorePayroll') ? document.getElementById('chkRestorePayroll').checked : true;
  var doPtnTime = document.getElementById('chkRestorePtnTime') ? document.getElementById('chkRestorePtnTime').checked : true;
  var doPushSubs = document.getElementById('chkRestorePushSubs') ? document.getElementById('chkRestorePushSubs').checked : true;
  var doSettings = document.getElementById('chkRestoreSettings') ? document.getElementById('chkRestoreSettings').checked : true;
  var doUsers = document.getElementById('chkRestoreUsers') ? document.getElementById('chkRestoreUsers').checked : false;

  var selectedPeriods = [];
  if (doPayroll) {
    var periodChks = document.querySelectorAll('.restore-period-chk:checked');
    periodChks.forEach(function(c) { selectedPeriods.push(c.value); });
    var allPeriodChks = document.querySelectorAll('.restore-period-chk');
    if (allPeriodChks.length > 0 && selectedPeriods.length === 0) {
      showToast('กรุณาเลือกงวดเงินเดือนอย่างน้อย 1 งวด หรือยกเลิกการเลือกหมวดเงินเดือน', 'warning');
      return;
    }
  }

  var btn = document.getElementById('btnConfirmExecuteRestore');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังดำเนินการ...';
  }

  var proceedRestore = function() {
    showToast('กำลังกู้คืนข้อมูลเข้าสู่ฐานข้อมูล Cloudflare D1...', 'info');

    var options = {
      selectiveMode: true,
      restoreEmployees: doEmployees,
      restoreBranches: doEmployees,
      restoreDevices: doDevices,
      restorePayroll: doPayroll,
      selectedPeriods: selectedPeriods,
      restorePtnTime: doPtnTime,
      restorePushSubs: doPushSubs,
      restoreSettings: doSettings,
      restoreUsers: doUsers
    };

    callApi('restoreDatabase', {
      backup: window.pendingRestoreBackupData,
      options: options,
      username: (State.currentUser && State.currentUser.username) || (window.currentUser && window.currentUser.username) || 'Admin'
    })
      .then(function(r) {
        if (r.success) {
          closeModal('modalRestoreInspection');
          window.pendingRestoreBackupData = null;
          showToast(r.message || 'กู้คืนข้อมูลสำเร็จเรียบร้อยแล้ว');
          setTimeout(function() {
            loadAppData();
          }, 600);
        } else {
          showToast(r.message || 'เกิดข้อผิดพลาดในการกู้คืนข้อมูล', 'error');
        }
      })
      .catch(function(err) {
        showToast('Restore Error: ' + err.message, 'error');
      })
      .finally(function() {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-check-double"></i> ยืนยันการกู้คืนข้อมูล';
        }
      });
  };

  if (doSafety) {
    showToast('กำลังดาวน์โหลดข้อมูลสำรองปัจจุบัน (Auto-Safety Snapshot)...', 'info');
    backupDatabase(true)
      .then(function() {
        setTimeout(proceedRestore, 800);
      })
      .catch(function() {
        proceedRestore();
      });
  } else {
    proceedRestore();
  }
}

function exportAllEmployeeHistory() {
  if (!hasPermission('view_salary') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่มีสิทธิ์ดาวน์โหลดรายงานเงินเดือน', 'warning');
    return;
  }
  if (!hasPermission('export_csv') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่มีสิทธิ์ส่งออกข้อมูล CSV', 'warning');
    return;
  }
  showToast('กำลังเตรียมข้อมูลประวัติพนักงานทั้งหมด...', 'info');
  callApi('getAllEmployeeHistory')
    .then(function(r) {
      if (!r.success || !r.allHistory) {
        showToast(r.message || 'ไม่พบข้อมูลประวัติพนักงาน', 'error');
        return;
      }
      var list = r.allHistory;
      if (list.length === 0) {
        showToast('ยังไม่มีข้อมูลประวัติเงินเดือนในระบบ', 'warning');
        return;
      }

      var csv = '\uFEFF';
      csv += 'งวด,รหัสพนักงาน,ชื่อ-นามสกุล,ชื่อเล่น,แผนก,ตำแหน่ง,เงินเดือนฐาน,ขาด(วัน),ลากิจ(วัน),ลาป่วย(วัน),หักสาย(บาท),OT(ชม),อัตราOT,เงินOT,เบี้ยขยัน,โบนัส,รวมหักขาดลาสาย,เงินได้รวมGross,ประกันสังคม,กองทุนPF,ภาษี,หักเงินเบิก,หักอื่นๆ,รวมหักทั้งหมด,เงินได้สุทธิNet\n';

      list.forEach(function(row) {
        var line = [
          '"' + (row.period || '').replace(/"/g, '""') + '"',
          '"' + (row.empId || '').replace(/"/g, '""') + '"',
          '"' + (row.fullName || '').replace(/"/g, '""') + '"',
          '"' + (row.nickname || '').replace(/"/g, '""') + '"',
          '"' + (row.department || '').replace(/"/g, '""') + '"',
          '"' + (row.position || '').replace(/"/g, '""') + '"',
          Number(row.baseSalary) || 0,
          Number(row.absentDays) || 0,
          Number(row.leaveDays) || 0,
          Number(row.sickLeaveDays) || 0,
          Number(row.lateDeduct) || 0,
          Number(row.otHours) || 0,
          Number(row.otRate) || 40,
          Number(row.otPay) || 0,
          Number(row.allowance) || 0,
          Number(row.bonus) || 0,
          Number(row.leaveDeduction) || 0,
          Number(row.grossPay) || 0,
          Number(row.sso) || 0,
          Number(row.pf) || 0,
          Number(row.tax) || 0,
          Number(row.advanceDeduct) || 0,
          Number(row.otherDeduct) || 0,
          Number(row.totalDeductions) || 0,
          Number(row.netPay) || 0
        ];
        csv += line.join(',') + '\n';
      });

      var filename = 'PTN_All_Employees_History_' + new Date().toISOString().substring(0, 10) + '.csv';
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('ดาวน์โหลดไฟล์ประวัติพนักงานทั้งหมด (' + list.length + ' รายการ) สำเร็จ');
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

function printAllEmployeesBatch() {
  if (!hasPermission('view_salary') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่มีสิทธิ์พิมพ์รายงานประวัติพนักงาน', 'warning');
    return;
  }
  if (!hasPermission('print_history') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่มีสิทธิ์พิมพ์รายงานประวัติพนักงาน', 'warning');
    return;
  }
  showToast('กำลังเตรียมเอกสารประวัติพนักงานทุกคนสำหรับพิมพ์...', 'info');
  var yrSel = document.getElementById('histYearSelect');
  var yr = yrSel ? yrSel.value : 'ALL';

  callApi('getAllEmployeeHistory')
    .then(function(r) {
      if (!r.success || !r.allHistory || r.allHistory.length === 0) {
        showToast('ไม่พบข้อมูลประวัติพนักงานสำหรับพิมพ์', 'warning');
        return;
      }

      var all = r.allHistory;
      if (yr && yr !== 'ALL') {
        all = all.filter(function(x) { return x.period && x.period.indexOf(yr) >= 0; });
      }

      if (all.length === 0) {
        showToast('ไม่พบข้อมูลประวัติพนักงานในปี ' + yr, 'warning');
        return;
      }

      // Group by empId
      var grouped = {};
      (State.employees || []).forEach(function(e) {
        grouped[e.empId] = { emp: e, rows: [] };
      });

      all.forEach(function(row) {
        if (!grouped[row.empId]) {
          grouped[row.empId] = {
            emp: {
              empId: row.empId,
              fullName: row.fullName,
              nickname: row.nickname,
              department: row.department,
              position: row.position,
              baseSalary: row.baseSalary
            },
            rows: []
          };
        }
        grouped[row.empId].rows.push(row);
      });

      var container = document.getElementById('histBatchPrintArea');
      if (!container) return;

      var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
      var html = '';

      Object.keys(grouped).sort().forEach(function(empId) {
        var item = grouped[empId];
        var emp = item.emp;
        var rows = item.rows;
        if (rows.length === 0) return; // Skip employees with no records in this year
        rows.sort(function(a, b) {
          return getPeriodSortKey(a.period) - getPeriodSortKey(b.period);
        });

        var pfText = (emp.pfRate !== null && emp.pfRate !== undefined && !isNaN(Number(emp.pfRate)) && Number(emp.pfRate) > 0) ? (Math.round(Number(emp.pfRate) * 100) + '%') : 'ไม่หัก PF';

        html += '<div class="batch-emp-page">';
        html += '<div style="text-align:center;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:10px">';
        html += '<h2 style="font-size:16px;font-weight:700;margin:0 0 3px">' + esc(compName) + '</h2>';
        html += '<p style="font-size:12px;font-weight:700;color:#1e3a8a;margin:2px 0">รายงานประวัติการทำงานและเงินเดือนรายบุคคล (ประจำปี ' + (yr === 'ALL' ? 'ทั้งหมด' : yr) + ')</p>';
        html += '</div>';

        // Profile card
        html += '<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:10.5px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px">';
        html += '<div><span style="color:#64748b">รหัสพนักงาน:</span> <strong>' + esc(emp.empId) + '</strong></div>';
        html += '<div><span style="color:#64748b">ชื่อ-นามสกุล:</span> <strong>' + esc(emp.fullName) + (emp.nickname ? ' (' + esc(emp.nickname) + ')' : '') + '</strong></div>';
        html += '<div><span style="color:#64748b">แผนก/ตำแหน่ง:</span> <strong>' + esc(emp.department || '-') + ' / ' + esc(emp.position || '-') + '</strong></div>';
        html += '<div><span style="color:#64748b">เงินเดือนฐาน:</span> <strong>' + fmt(emp.baseSalary) + '</strong></div>';
        html += '<div><span style="color:#64748b">วันเกิด/อายุ:</span> <strong>' + esc(formatDateThaiBE(emp.birthDate)) + ' (' + (emp.age || 0) + ' ปี)</strong></div>';
        html += '<div><span style="color:#64748b">ธนาคาร:</span> <strong>' + esc(emp.bankName || '-') + ' ' + esc(emp.bankAccount || '-') + '</strong></div>';
        html += '<div><span style="color:#64748b">วันเริ่มงาน:</span> <strong>' + esc(formatDateThaiBE(emp.joinDate)) + '</strong></div>';
        html += '<div><span style="color:#64748b">กองทุน PF:</span> <strong>' + pfText + '</strong></div>';
        html += '</div>';

        // Table
        html += '<table class="data-table" style="font-size:7.5pt">';
        html += '<thead><tr>';
        html += '<th style="width:90px">งวด</th><th class="text-right">ฐาน</th><th class="text-right">ขาด</th><th class="text-right">ลากิจ</th><th class="text-right">ลาป่วย</th><th class="text-right">สาย</th><th class="text-right">OT ชม.</th><th class="text-right">เงินOT</th><th class="text-right">เบี้ยขยัน</th><th class="text-right">โบนัส</th><th class="text-right">Gross</th><th class="text-right">ปกส.</th><th class="text-right">PF</th><th class="text-right">ภาษี</th><th class="text-right">รวมหัก</th><th class="text-right">สุทธิ(Net)</th>';
        html += '</tr></thead><tbody>';

        var sumBase = 0, sumAbs = 0, sumLev = 0, sumSck = 0, sumLate = 0, sumOtH = 0, sumOtP = 0, sumAllow = 0, sumBon = 0, sumGross = 0, sumSso = 0, sumPf = 0, sumTax = 0, sumDed = 0, sumNet = 0;

        rows.forEach(function(r) {
          sumBase += Number(r.baseSalary) || 0; sumAbs += Number(r.absentDays) || 0; sumLev += Number(r.leaveDays) || 0; sumSck += Number(r.sickLeaveDays) || 0;
          sumLate += Number(r.lateDeduct) || 0; sumOtH += Number(r.otHours) || 0; sumOtP += Number(r.otPay) || 0; sumAllow += Number(r.allowance) || 0;
          sumBon += Number(r.bonus) || 0; sumGross += Number(r.grossPay) || 0; sumSso += Number(r.sso) || 0; sumPf += Number(r.pf) || 0;
          sumTax += Number(r.tax) || 0; sumDed += Number(r.totalDeductions) || 0; sumNet += Number(r.netPay) || 0;

          html += '<tr>' +
            '<td class="font-bold">' + esc(r.period) + '</td>' +
            '<td class="text-right font-mono">' + fmt(r.baseSalary) + '</td>' +
            '<td class="text-right font-mono">' + (r.absentDays || 0) + '</td>' +
            '<td class="text-right font-mono">' + (r.leaveDays || 0) + '</td>' +
            '<td class="text-right font-mono">' + (r.sickLeaveDays || 0) + '</td>' +
            '<td class="text-right font-mono">' + fmt(r.lateDeduct || 0) + '</td>' +
            '<td class="text-right font-mono">' + (r.otHours || 0) + '</td>' +
            '<td class="text-right font-mono text-blue font-bold">' + fmt(r.otPay || 0) + '</td>' +
            '<td class="text-right font-mono text-green font-bold">' + fmt(r.allowance || 0) + '</td>' +
            '<td class="text-right font-mono">' + fmt(r.bonus || 0) + '</td>' +
            '<td class="text-right font-mono font-bold text-blue">' + fmt(r.grossPay || 0) + '</td>' +
            '<td class="text-right font-mono font-bold text-red">' + fmt(r.sso || 0) + '</td>' +
            '<td class="text-right font-mono text-blue font-bold">' + fmt(r.pf || 0) + '</td>' +
            '<td class="text-right font-mono">' + fmt(r.tax || 0) + '</td>' +
            '<td class="text-right font-mono font-bold text-red">' + fmt(r.totalDeductions || 0) + '</td>' +
            '<td class="text-right font-mono font-bold text-green">' + fmt(r.netPay || 0) + '</td>' +
          '</tr>';
        });

        html += '</tbody>';
        html += '<tfoot style="background:#eff6ff;font-weight:700;border-top:1.5px solid #93c5fd"><tr>';
        html += '<td class="font-bold">รวมสะสม (' + rows.length + ' งวด)</td>' +
          '<td class="text-right font-mono">' + fmt(sumBase) + '</td>' +
          '<td class="text-right font-mono">' + sumAbs + '</td>' +
          '<td class="text-right font-mono">' + sumLev + '</td>' +
          '<td class="text-right font-mono">' + sumSck + '</td>' +
          '<td class="text-right font-mono">' + fmt(sumLate) + '</td>' +
          '<td class="text-right font-mono">' + sumOtH + '</td>' +
          '<td class="text-right font-mono text-blue font-bold">' + fmt(sumOtP) + '</td>' +
          '<td class="text-right font-mono text-green font-bold">' + fmt(sumAllow) + '</td>' +
          '<td class="text-right font-mono">' + fmt(sumBon) + '</td>' +
          '<td class="text-right font-mono font-bold text-blue">' + fmt(sumGross) + '</td>' +
          '<td class="text-right font-mono font-bold text-red">' + fmt(sumSso) + '</td>' +
          '<td class="text-right font-mono text-blue font-bold">' + fmt(sumPf) + '</td>' +
          '<td class="text-right font-mono">' + fmt(sumTax) + '</td>' +
          '<td class="text-right font-mono font-bold text-red">' + fmt(sumDed) + '</td>' +
          '<td class="text-right font-mono font-bold text-green">' + fmt(sumNet) + '</td>' +
        '</tr></tfoot>';
        html += '</table>';
        html += '</div>'; // end .batch-emp-page
      });

      container.innerHTML = html;

      clearAllPrintClasses();
      document.body.classList.add('printing-batch-history');

      setTimeout(function() {
        window.print();
        setTimeout(clearAllPrintClasses, 1500);
      }, 50);
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}


// ==============================================================================

// GEMINI SETTINGS & DRAGGABLE AI ASSISTANT CONTROLLER
// ==============================================================================
function toggleGeminiKeyVisibility() {
  var inp = document.getElementById('inputGeminiApiKey');
  var icon = document.getElementById('iconToggleGeminiKey');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
  } else {
    inp.type = 'password';
    if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
  }
}

function testGeminiConnection() {
  var inp = document.getElementById('inputGeminiApiKey');
  var key = inp ? inp.value.trim() : '';
  if (!key) {
    showToast('กรุณากรอก API Key ก่อนทดสอบ', 'warning');
    return;
  }
  showToast('กำลังทดสอบเชื่อมต่อ Google Gemini 3.6 Flash...', 'info');
  callApi('testGeminiApiKey', { apiKey: key })
    .then(function(r) {
      if (r.success) {
        showToast(r.message || 'เชื่อมต่อสำเร็จ');
        var badge = document.getElementById('geminiConnectionStatusBadge');
        if (badge) {
          badge.style.background = '#ecfdf5';
          badge.style.color = '#059669';
          badge.style.borderColor = '#a7f3d0';
          badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> พร้อมใช้งาน';
        }
      } else {
        showToast(r.message || 'เชื่อมต่อไม่สำเร็จ', 'error');
        var badge = document.getElementById('geminiConnectionStatusBadge');
        if (badge) {
          badge.style.background = '#fef2f2';
          badge.style.color = '#dc2626';
          badge.style.borderColor = '#fecaca';
          badge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> ผิดพลาด';
        }
      }
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

function saveGeminiApiKey() {
  var inp = document.getElementById('inputGeminiApiKey');
  var key = inp ? inp.value.trim() : '';
  showToast('กำลังบันทึก Google Gemini API Key...', 'info');
  callApi('saveCompanyInfo', { settings: { geminiApiKey: key } })
    .then(function(r) {
      showToast('บันทึก API Key สำเร็จเรียบร้อย');
      if (State.company) State.company.geminiApiKey = key;
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

var isAiChatOpen = false;

function toggleAiChat() {
  isAiChatOpen = !isAiChatOpen;
  var drawer = document.getElementById('aiChatDrawer');
  var btn = document.getElementById('aiChatToggleBtn');
  if (drawer) {
    if (isAiChatOpen) {
      if (btn) {
        var rect = btn.getBoundingClientRect();
        if (rect.left < window.innerWidth / 2) {
          drawer.style.left = Math.max(16, rect.left) + 'px';
          drawer.style.right = 'auto';
        } else {
          drawer.style.right = Math.max(16, window.innerWidth - rect.right) + 'px';
          drawer.style.left = 'auto';
        }
      }
      drawer.classList.add('active');
      if (btn) btn.style.display = 'none';
      var inp = document.getElementById('aiChatInput');
      if (inp) setTimeout(function() { inp.focus(); }, 300);
    } else {
      drawer.classList.remove('active');
      if (btn) btn.style.display = 'flex';
    }
  }
}

function initDraggableAiChatBtn() {
  var btn = document.getElementById('aiChatToggleBtn');
  if (!btn) return;

  // Restore saved position
  try {
    var savedPos = localStorage.getItem('ptn_ai_btn_pos');
    if (savedPos) {
      var p = JSON.parse(savedPos);
      var maxLeft = window.innerWidth - (btn.offsetWidth || 130) - 10;
      var maxTop = window.innerHeight - (btn.offsetHeight || 44) - 10;
      var left = Math.max(10, Math.min(p.left, maxLeft));
      var top = Math.max(10, Math.min(p.top, maxTop));
      btn.style.left = left + 'px';
      btn.style.top = top + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }
  } catch(e) {}

  var isDragging = false;
  var hasMoved = false;
  var startX = 0, startY = 0;
  var origLeft = 0, origTop = 0;

  function onPointerDown(e) {
    if (e.type === 'mousedown' && e.button !== 0) return;

    isDragging = true;
    hasMoved = false;
    var clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
    var clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
    startX = clientX;
    startY = clientY;

    var rect = btn.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;

    btn.style.transition = 'none';

    document.addEventListener('mousemove', onPointerMove, { passive: false });
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    var clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
    var clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);

    var dx = clientX - startX;
    var dy = clientY - startY;

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      hasMoved = true;
      if (e.cancelable) e.preventDefault();
    }

    if (hasMoved) {
      var newLeft = origLeft + dx;
      var newTop = origTop + dy;

      var maxLeft = window.innerWidth - btn.offsetWidth - 10;
      var maxTop = window.innerHeight - btn.offsetHeight - 10;

      newLeft = Math.max(10, Math.min(newLeft, maxLeft));
      newTop = Math.max(10, Math.min(newTop, maxTop));

      btn.style.left = newLeft + 'px';
      btn.style.top = newTop + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;

    btn.style.transition = '';

    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('touchend', onPointerUp);

    if (hasMoved) {
      var rect = btn.getBoundingClientRect();
      try {
        localStorage.setItem('ptn_ai_btn_pos', JSON.stringify({ left: rect.left, top: rect.top }));
      } catch(ex) {}
    } else {
      toggleAiChat();
    }
  }

  btn.addEventListener('mousedown', onPointerDown);
  btn.addEventListener('touchstart', onPointerDown, { passive: false });
}

function clearAiChat() {
  var body = document.getElementById('aiChatBody');
  if (body) {
    body.innerHTML = '<div class="ai-msg bot">' +
      '<div class="ai-avatar" style="width:28px;height:28px;font-size:14px;background:#e0e7ff;color:#4338ca"><i class="fa-solid fa-robot"></i></div>' +
      '<div class="ai-msg-bubble">' +
        'ล้างประวัติการสนทนาเรียบร้อยครับ! สามารถพิมพ์ถามข้อมูลเงินเดือนหรือพนักงานได้เลยครับ 😊' +
      '</div>' +
    '</div>';
  }
}

function askQuickPrompt(text) {
  var inp = document.getElementById('aiChatInput');
  if (inp) {
    inp.value = text;
    handleSendAiMessage();
  }
}

function formatAiMarkdown(text) {
  if (!text) return '';
  var html = text;

  // Escape HTML tags
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<strong style="font-size:13.5px;color:#1e3a8a;display:block;margin:6px 0 4px">$1</strong>');
  html = html.replace(/^## (.*$)/gim, '<strong style="font-size:14px;color:#0f172a;display:block;margin:8px 0 4px">$1</strong>');

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Markdown Tables
  if (html.indexOf('|') >= 0) {
    var lines = html.split('\n');
    var inTable = false;
    var tableHtml = '';
    var newLines = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (line.indexOf('---') >= 0) continue; // skip separator row
        var cells = line.split('|').filter(function(c, idx, arr) { return idx > 0 && idx < arr.length - 1; });
        if (!inTable) {
          inTable = true;
          tableHtml = '<table><thead><tr>';
          cells.forEach(function(c) { tableHtml += '<th>' + c.trim() + '</th>'; });
          tableHtml += '</tr></thead><tbody>';
        } else {
          tableHtml += '<tr>';
          cells.forEach(function(c) { tableHtml += '<td>' + c.trim() + '</td>'; });
          tableHtml += '</tr>';
        }
      } else {
        if (inTable) {
          tableHtml += '</tbody></table>';
          newLines.push(tableHtml);
          inTable = false;
        }
        newLines.push(line);
      }
    }
    if (inTable) {
      tableHtml += '</tbody></table>';
      newLines.push(tableHtml);
    }
    html = newLines.join('\n');
  }

  // Bullet points
  html = html.replace(/^\* (.*$)/gim, '<li style="margin-left:14px">$1</li>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

function handleSendAiMessage(e) {
  if (e && e.preventDefault) e.preventDefault();
  var inp = document.getElementById('aiChatInput');
  if (!inp) return;
  var msg = inp.value.trim();
  if (!msg) return;

  var body = document.getElementById('aiChatBody');
  if (!body) return;

  // Append user message
  var userDiv = document.createElement('div');
  userDiv.className = 'ai-msg user';
  userDiv.innerHTML = '<div class="ai-msg-bubble">' + esc(msg) + '</div>';
  body.appendChild(userDiv);
  inp.value = '';

  // Append typing indicator
  var typingDiv = document.createElement('div');
  typingDiv.className = 'ai-typing';
  typingDiv.id = 'aiTypingIndicator';
  typingDiv.innerHTML = '<div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div>';
  body.appendChild(typingDiv);
  body.scrollTop = body.scrollHeight;

  // Call API
  callApi('askAiAssistant', {
    message: msg,
    period: State.period,
    user: State.currentUser
  })
  .then(function(r) {
    var indicator = document.getElementById('aiTypingIndicator');
    if (indicator) indicator.remove();

    var botDiv = document.createElement('div');
    botDiv.className = 'ai-msg bot';
    var replyHtml = formatAiMarkdown(r.reply || 'ขออภัยครับ ไม่สามารถประมวลผลคำตอบได้ในขณะนี้');
    botDiv.innerHTML = '<div class="ai-avatar" style="width:28px;height:28px;font-size:14px;background:#e0e7ff;color:#4338ca"><i class="fa-solid fa-robot"></i></div>' +
      '<div class="ai-msg-bubble">' + replyHtml + '</div>';
    body.appendChild(botDiv);
    body.scrollTop = body.scrollHeight;
  })
  .catch(function(err) {
    var indicator = document.getElementById('aiTypingIndicator');
    if (indicator) indicator.remove();

    var botDiv = document.createElement('div');
    botDiv.className = 'ai-msg bot';
    botDiv.innerHTML = '<div class="ai-avatar" style="width:28px;height:28px;font-size:14px;background:#fee2e2;color:#dc2626"><i class="fa-solid fa-triangle-exclamation"></i></div>' +
      '<div class="ai-msg-bubble" style="color:#dc2626">เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + esc(err.message) + '</div>';
    body.appendChild(botDiv);
    body.scrollTop = body.scrollHeight;
  });
}


// ==============================================================================

// AUDIT TRAIL MODAL CONTROLLER
function openActivityLogModal() {
  showToast('กำลังโหลดบันทึกประวัติการใช้งาน...', 'info');
  callApi('getActivityLogs')
    .then(function(r) {
      var tbody = document.getElementById('activityLogTableBody');
      if (!tbody) return;
      var logs = r.logs || [];
      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding:20px">ยังไม่มีบันทึกประวัติการใช้งาน</td></tr>';
      } else {
        var h = '';
        logs.forEach(function(l) {
          var actionBadgeClass = 'blue';
          if (l.action === 'LOGIN') actionBadgeClass = 'green';
          else if (l.action === 'PERIOD_CLOSE') actionBadgeClass = 'red';
          else if (l.action === 'USER_SAVE') actionBadgeClass = 'purple';

          h += '<tr>' +
            '<td class="font-mono text-muted" style="font-size:11px">' + esc(l.timestamp) + '</td>' +
            '<td class="font-bold">' + esc(l.username) + '</td>' +
            '<td><span class="period-pill" style="font-size:10.5px">' + esc(l.action) + '</span></td>' +
            '<td>' + esc(l.details) + '</td>' +
          '</tr>';
        });
        tbody.innerHTML = h;
      }
      openModal('activityLogModal');
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}


// ==============================================================================
