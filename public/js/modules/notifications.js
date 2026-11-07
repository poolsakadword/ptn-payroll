/**
 * ==============================================================================
 * PTN Payroll - Notifications & Web Push Module
 * ==============================================================================
 */

// REALTIME IN-APP NOTIFICATION CENTER & ALERTS (PAYROLL ADMIN)
// =======================================================

var AdminNotifState = {
  soundEnabled: localStorage.getItem('ptn_admin_notif_sound') !== 'false',
  unreadCount: 0,
  seenItemIds: new Set(JSON.parse(localStorage.getItem('ptn_admin_seen_items') || '[]')),
  lastData: null,
  pollerInterval: null
};

function initAdminNotificationCenter() {
  if (typeof AdminNotifState === 'undefined' || !AdminNotifState) {
    try {
      AdminNotifState = {
        soundEnabled: localStorage.getItem('ptn_admin_notif_sound') !== 'false',
        unreadCount: 0,
        seenItemIds: new Set(JSON.parse(localStorage.getItem('ptn_admin_seen_items') || '[]')),
        lastData: null,
        pollerInterval: null
      };
    } catch(e) {
      AdminNotifState = { soundEnabled: true, unreadCount: 0, seenItemIds: new Set(), lastData: null, pollerInterval: null };
    }
  }
  updateSoundIcon();
  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    var wrapper = document.querySelector('.notif-dropdown-wrapper');
    var dropdown = document.getElementById('adminNotifDropdown');
    if (dropdown && wrapper && !wrapper.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Start periodic polling every 30 seconds
  if (AdminNotifState.pollerInterval) clearInterval(AdminNotifState.pollerInterval);
  AdminNotifState.pollerInterval = setInterval(pollAdminRealtimeAlerts, 30000);

  // Poll when browser tab gains focus
  window.addEventListener('focus', function() {
    pollAdminRealtimeAlerts();
  });

  // Initial poll after auth
  setTimeout(pollAdminRealtimeAlerts, 2000);
}

function toggleAdminNotifDropdown() {
  var dropdown = document.getElementById('adminNotifDropdown');
  if (!dropdown) return;
  if (dropdown.style.display === 'none' || !dropdown.style.display) {
    dropdown.style.display = 'block';
    // Mark badge as seen
    AdminNotifState.unreadCount = 0;
    updateAdminNotifBadge();
    // Render current or fetch fresh
    pollAdminRealtimeAlerts();
  } else {
    dropdown.style.display = 'none';
  }
}

function pollAdminRealtimeAlerts() {
  if (!State.currentUser || !State.currentUser.username) return;

  callApi('getAdminRealtimeAlerts', { username: State.currentUser.username })
    .then(function(res) {
      if (res && res.success) {
        processAdminAlerts(res);
      }
    })
    .catch(function(err) {
      console.warn('Realtime poller note:', err);
    });
}

function processAdminAlerts(data) {
  AdminNotifState.lastData = data;
  var leaves = data.pendingLeaves || [];
  var ots = data.pendingOts || [];
  var advances = data.pendingAdvances || [];
  var anomalies = data.anomalies || [];

  var newItems = [];

  // Check leaves
  leaves.forEach(function(lv) {
    var key = 'lv_' + lv.id;
    if (!AdminNotifState.seenItemIds.has(key)) {
      newItems.push({
        type: 'leave',
        title: 'มีคำขอลางานใหม่ 🏖️',
        desc: (lv.full_name || ('พนักงาน ' + lv.emp_id)) + ' ขอลางาน ' + (lv.days || 1) + ' วัน (' + (lv.start_date || '') + ')'
      });
      AdminNotifState.seenItemIds.add(key);
    }
  });

  // Check OTs
  ots.forEach(function(ot) {
    var key = 'ot_' + ot.id;
    if (!AdminNotifState.seenItemIds.has(key)) {
      newItems.push({
        type: 'ot',
        title: 'มีคำขอ OT เข้าใหม่ ⏳',
        desc: (ot.full_name || ('พนักงาน ' + ot.emp_id)) + ' ร้องขอ OT ' + (ot.ot_hours || 0) + ' ชม. วันที่ ' + (ot.ot_date || '')
      });
      AdminNotifState.seenItemIds.add(key);
    }
  });

  // Check Advances
  advances.forEach(function(ad) {
    var key = 'ad_' + ad.id;
    if (!AdminNotifState.seenItemIds.has(key)) {
      newItems.push({
        type: 'advance',
        title: 'มีคำขอเบิกเงินล่วงหน้า 💵',
        desc: (ad.full_name || ('พนักงาน ' + ad.emp_id)) + ' ขอเบิกเงิน ฿' + Number(ad.amount || 0).toLocaleString()
      });
      AdminNotifState.seenItemIds.add(key);
    }
  });

  // Check Anomalies
  anomalies.forEach(function(an) {
    var key = 'an_' + an.id + '_' + (an.overbreak_minutes || 0);
    if (!AdminNotifState.seenItemIds.has(key)) {
      newItems.push({
        type: 'anomaly',
        title: '⚠️ แจ้งเตือนพักเกินเวลา',
        desc: (an.full_name || an.emp_id) + ' พักเกินเกณฑ์ ' + an.overbreak_minutes + ' นาที'
      });
      AdminNotifState.seenItemIds.add(key);
    }
  });

  // Save seen IDs (cap at 100)
  var arr = Array.from(AdminNotifState.seenItemIds);
  if (arr.length > 100) arr = arr.slice(arr.length - 100);
  AdminNotifState.seenItemIds = new Set(arr);
  localStorage.setItem('ptn_admin_seen_items', JSON.stringify(arr));

  // If there are new incoming items and not first load: trigger alerts
  if (newItems.length > 0) {
    AdminNotifState.unreadCount += newItems.length;
    updateAdminNotifBadge();

    // Trigger Toast & Audio for first few items
    newItems.slice(0, 2).forEach(function(item) {
      showToast(item.title + ': ' + item.desc, item.type === 'anomaly' ? 'error' : 'success');
      triggerDesktopNotification(item.title, item.desc);
    });

    if (AdminNotifState.soundEnabled) {
      playAdminNotificationSound();
    }
  }

  renderAdminNotifList(data);
}

function updateAdminNotifBadge() {
  var badge = document.getElementById('adminNotifBadge');
  if (!badge) return;
  var total = (AdminNotifState.lastData && AdminNotifState.lastData.totalPending) || 0;
  var displayCount = AdminNotifState.unreadCount > 0 ? AdminNotifState.unreadCount : total;

  if (displayCount > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = displayCount > 99 ? '99+' : displayCount;
  } else {
    badge.style.display = 'none';
  }
}

function renderAdminNotifList(data) {
  var container = document.getElementById('adminNotifList');
  if (!container) return;

  var leaves = data.pendingLeaves || [];
  var ots = data.pendingOts || [];
  var advances = data.pendingAdvances || [];
  var anomalies = data.anomalies || [];

  var allItems = [];

  ots.forEach(function(ot) {
    allItems.push({
      type: 'ot',
      icon: 'fa-clock',
      iconCol: '#f59e0b',
      iconBg: '#fef3c7',
      title: 'คำขอ OT: ' + (ot.full_name || ot.emp_id),
      desc: 'ขอทำ OT ' + (ot.ot_hours || 0) + ' ชม. (' + (ot.ot_date || '-') + ')',
      actionTab: 'attendance',
      actionSection: 'ot'
    });
  });

  leaves.forEach(function(lv) {
    allItems.push({
      type: 'leave',
      icon: 'fa-umbrella-beach',
      iconCol: '#10b981',
      iconBg: '#ecfdf5',
      title: 'คำขอลางาน: ' + (lv.full_name || lv.emp_id),
      desc: 'ขอลางาน ' + (lv.days || 1) + ' วัน (' + (lv.start_date || '-') + ')',
      actionTab: 'attendance',
      actionSection: 'leave'
    });
  });

  advances.forEach(function(ad) {
    allItems.push({
      type: 'advance',
      icon: 'fa-money-bill-wave',
      iconCol: '#3b82f6',
      iconBg: '#eff6ff',
      title: 'ขอเบิกเงิน: ' + (ad.full_name || ad.emp_id),
      desc: 'ขอเบิกเงิน ฿' + Number(ad.amount || 0).toLocaleString() + ' วันที่ ' + (ad.request_date || '-'),
      actionTab: 'attendance',
      actionSection: 'advance'
    });
  });

  anomalies.forEach(function(an) {
    allItems.push({
      type: 'anomaly',
      icon: 'fa-triangle-exclamation',
      iconCol: '#ef4444',
      iconBg: '#fef2f2',
      title: 'พักเกินเวลา: ' + (an.full_name || an.emp_id),
      desc: 'เกินเกณฑ์ ' + an.overbreak_minutes + ' นาที (พัก ' + (an.break_out || '-') + ' ถึง ' + (an.break_in || '-') + ')',
      actionTab: 'attendance',
      actionSection: 'today'
    });
  });

  if (allItems.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:24px 12px;color:#94a3b8;font-size:12px">' +
      '<i class="fa-regular fa-bell-slash" style="font-size:24px;display:block;margin-bottom:6px"></i>' +
      'ไม่มีการแจ้งเตือนใหม่ในขณะนี้ ✨' +
      '</div>';
    return;
  }

  var html = '';
  allItems.forEach(function(item) {
    html += '<div onclick="handleAdminNotifClick(\'' + item.actionTab + '\')" style="display:flex;align-items:flex-start;gap:10px;padding:9px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;cursor:pointer;transition:all 0.15s ease" onmouseover="this.style.background=\'#eff6ff\'" onmouseout="this.style.background=\'#f8fafc\'">' +
      '<div style="width:30px;height:30px;border-radius:8px;background:' + item.iconBg + ';color:' + item.iconCol + ';display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">' +
        '<i class="fa-solid ' + item.icon + '"></i>' +
      '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:700;font-size:12px;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(item.title) + '</div>' +
        '<div style="font-size:11px;color:#64748b;margin-top:1px;line-height:1.3">' + esc(item.desc) + '</div>' +
      '</div>' +
    '</div>';
  });

  container.innerHTML = html;
}

function handleAdminNotifClick(tabName) {
  var dropdown = document.getElementById('adminNotifDropdown');
  if (dropdown) dropdown.style.display = 'none';
  if (typeof switchTab === 'function') {
    switchTab(tabName);
  }
}

function clearAdminNotifications() {
  AdminNotifState.unreadCount = 0;
  updateAdminNotifBadge();
  var container = document.getElementById('adminNotifList');
  if (container) {
    container.innerHTML = '<div style="text-align:center;padding:24px 12px;color:#94a3b8;font-size:12px">' +
      '<i class="fa-regular fa-bell-slash" style="font-size:24px;display:block;margin-bottom:6px"></i>' +
      'ล้างการแจ้งเตือนแล้ว' +
      '</div>';
  }
}

function toggleSoundAlert() {
  AdminNotifState.soundEnabled = !AdminNotifState.soundEnabled;
  localStorage.setItem('ptn_admin_notif_sound', AdminNotifState.soundEnabled ? 'true' : 'false');
  updateSoundIcon();
  if (AdminNotifState.soundEnabled) {
    playAdminNotificationSound();
    showToast('เปิดเสียงแจ้งเตือนแล้ว', 'success');
  } else {
    showToast('ปิดเสียงแจ้งเตือนแล้ว', 'info');
  }
}

function updateSoundIcon() {
  var icon = document.getElementById('iconSoundToggle');
  if (!icon) return;
  var isSoundOn = (typeof AdminNotifState !== 'undefined' && AdminNotifState && AdminNotifState.soundEnabled);
  if (isSoundOn) {
    icon.className = 'fa-solid fa-volume-high';
    icon.style.color = '#2563eb';
  } else {
    icon.className = 'fa-solid fa-volume-xmark';
    icon.style.color = '#94a3b8';
  }
}

function playAdminNotificationSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

// ==============================================================================

// WEB PUSH NOTIFICATION CLIENT CONTROLLER (VAPID + SERVICE WORKER)
// ==============================================================================
var _currentPushSubscription = null;

function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = window.atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function initServiceWorkerAndPush() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker is not supported by this browser');
    return;
  }

  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then(function(reg) {
      console.log('PTN Service Worker active:', reg.scope);
      checkPushSubscriptionStatus(reg);
    })
    .catch(function(err) {
      console.warn('Service Worker registration note:', err);
    });
}

function checkPushSubscriptionStatus(reg) {
  if (!reg || !reg.pushManager) return;
  reg.pushManager.getSubscription().then(function(sub) {
    _currentPushSubscription = sub;
    updatePushUiStatus(Boolean(sub));
  }).catch(function(e) {
    console.warn('getSubscription note:', e);
  });
}

function updatePushUiStatus(isSubscribed) {
  var btn = document.getElementById('btnToggleWebPush');
  var statusText = document.getElementById('webPushStatusText');
  if (btn) {
    if (isSubscribed) {
      btn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> ปิดรับแจ้งเตือน (Web Push)';
      btn.className = 'btn btn-outline btn-sm';
      btn.style.borderColor = '#cbd5e1';
      btn.style.color = '#64748b';
    } else {
      btn.innerHTML = '<i class="fa-solid fa-bell"></i> เปิดรับแจ้งเตือนหน้าจอ (Web Push)';
      btn.className = 'btn btn-primary btn-sm';
      btn.style.borderColor = '';
      btn.style.color = '';
    }
  }
  if (statusText) {
    if (isSubscribed) {
      statusText.innerHTML = '<span style="color:#059669;font-weight:700"><i class="fa-solid fa-circle-check"></i> เปิดรับแจ้งเตือนแล้ว (เด้งเตือน Real-time 1-3 วิ)</span>';
    } else {
      statusText.innerHTML = '<span style="color:#64748b">⚪ ยังไม่ได้เปิดรับแจ้งเตือนบนอุปกรณ์นี้</span>';
    }
  }
}

function toggleWebPushSubscription() {
  if (_currentPushSubscription) {
    unsubscribeWebPush();
  } else {
    subscribeWebPush();
  }
}

function subscribeWebPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ Web Push Notification\n(หากใช้ iPhone ต้องกด "เพิ่มไปยังหน้าจอโฮม / Add to Home Screen" ก่อน)');
    return;
  }

  showToast('กำลังขออนุญาตและลงทะเบียนรับการแจ้งเตือน...', 'info');

  callApi('getVapidPublicKey')
    .then(function(res) {
      if (!res || !res.publicKey) {
        throw new Error('ไม่สามารถดึง VAPID Public Key จากเซิร์ฟเวอร์ได้');
      }
      var vapidKey = res.publicKey;
      return navigator.serviceWorker.ready.then(function(reg) {
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
      });
    })
    .then(function(sub) {
      _currentPushSubscription = sub;
      var subJson = sub.toJSON();
      var p256dh = (subJson.keys && subJson.keys.p256dh) || '';
      var auth = (subJson.keys && subJson.keys.auth) || '';
      var endpoint = sub.endpoint;

      return callApi('savePushSubscription', {
        empId: (State.currentUser && State.currentUser.empId) || (State.currentUser && State.currentUser.username) || 'ADMIN',
        endpoint: endpoint,
        p256dh: p256dh,
        auth: auth,
        userAgent: navigator.userAgent,
        appType: 'PAYROLL'
      });
    })
    .then(function(saveRes) {
      updatePushUiStatus(true);
      showToast('เปิดรับการแจ้งเตือน Web Push สำเร็จ! พร้อมเด้งเตือนแบบ Real-time', 'success');
      // Trigger instant test notification
      sendTestWebPush();
    })
    .catch(function(err) {
      console.error('Subscription error:', err);
      showToast('ไม่สามารถเปิดการแจ้งเตือนได้: ' + err.message, 'error');
    });
}

function unsubscribeWebPush() {
  if (!_currentPushSubscription) return;
  var endpoint = _currentPushSubscription.endpoint;
  _currentPushSubscription.unsubscribe()
    .then(function() {
      _currentPushSubscription = null;
      updatePushUiStatus(false);
      return callApi('removePushSubscription', { endpoint: endpoint });
    })
    .then(function() {
      showToast('ยกเลิกการรับแจ้งเตือนบนอุปกรณ์นี้เรียบร้อยแล้ว', 'info');
    })
    .catch(function(err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    });
}

function sendTestWebPush() {
  showToast('กำลังส่งการแจ้งเตือนทดสอบ...', 'info');
  callApi('sendTestPushNotification', {
    endpoint: _currentPushSubscription ? _currentPushSubscription.endpoint : null,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
  .then(function(r) {
    if (r.success) {
      showToast(r.message || 'ส่งแจ้งเตือนสำเร็จ', 'success');
    } else {
      showToast(r.message || 'เกิดข้อผิดพลาด', 'warning');
    }
  })
  .catch(function(e) {
    showToast('Error: ' + e.message, 'error');
  });
}

function broadcastPayslipPushNotification(period) {
  if (!hasPermission('calc_payroll') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: สงวนสิทธิ์การส่งแจ้งเตือนเฉพาะผู้มีสิทธิ์คำนวณเงินเดือนหรือ Super Admin เท่านั้น', 'warning');
    return;
  }
  var targetPeriod = period || State.period || 'ล่าสุด';
  var msg = 'เงินเดือนงวด ' + targetPeriod + '  เช็กสลิปออนไลน์ได้ทันที';
  if (!confirm('ยืนยันส่งการแจ้งเตือน Web Push ไปยังพนักงานทุกคนใช่หรือไม่?\n\nข้อความที่จะส่ง:\n"บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด: ' + msg + '"')) {
    return;
  }

  showToast('กำลังส่งการแจ้งเตือนสลิปเงินเดือนไปยังอุปกรณ์พนักงานทุกคน...', 'info');
  callApi('broadcastPayslipNotification', {
    period: targetPeriod,
    title: 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด',
    body: msg,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
  .then(function(r) {
    if (r.success) {
      showToast(r.message, 'success');
    } else {
      showToast(r.message || 'เกิดข้อผิดพลาดในการส่งแจ้งเตือน', 'error');
    }
  })
  .catch(function(e) {
    showToast('Error: ' + e.message, 'error');
  });
}

function requestAdminBrowserNotification() {
  toggleWebPushSubscription();
}

function triggerDesktopNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        icon: 'https://cdn-icons-png.flaticon.com/512/2972/2972531.png'
      });
    } catch(e) {}
  }
}

function testAdminNotification() {
  sendTestWebPush();
}

// Auto-register Service Worker on startup
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', function() {
    initServiceWorkerAndPush();
  });
}


