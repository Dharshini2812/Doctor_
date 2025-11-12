// ========================================
// Doctor Dashboard Application
// ========================================

class DoctorDashboard {
  constructor() {
    this.socket = null;
    this.currentPatientId = null;
    this.patients = new Map();
    this.messages = new Map(); // patientId -> messages array
    this.analytics = {
      totalMessages: 0,
      messagesToday: 0,
      activeChats: 0,
      responseTimes: [],
      symptomsData: {}
    };
    this.isDarkMode = localStorage.getItem('darkMode') === 'true';
    this.recognition = null;
    this.isRecording = false;
    this.isFullscreen = false;
    this.draggingEnabled = localStorage.getItem('draggingEnabled') !== 'false';
    this.draggedPanel = null;
    this.dragOffset = { x: 0, y: 0 };
    this.panelLayout = JSON.parse(localStorage.getItem('panelLayout') || 'null');
    this.isSending = false; // Prevent double-sending
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupSpeechRecognition();
    this.loadTheme();
    this.setupCharts();
    this.setupDraggablePanels();
    this.setupSettings();
    this.loadSettings();
    this.setupMobileNavigation();
    
    // Update right panel toggle button on resize
    window.addEventListener('resize', () => {
      this.updateRightPanelToggleButton();
    });
  }

  setupEventListeners() {
    // Join screen
    document.getElementById('joinBtn').addEventListener('click', () => this.handleJoin());
    document.getElementById('demoBtn').addEventListener('click', () => this.handleDemoPatient());
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
    
    // Fullscreen toggle
    document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());
    
    // Settings
    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
    document.getElementById('closeSettingsBtn').addEventListener('click', () => this.closeSettings());
    
    // Hamburger menu
    document.getElementById('hamburgerBtn').addEventListener('click', () => this.toggleMobileMenu());
    
    // Toggle right panel (for tablet view)
    const toggleRightPanelBtn = document.getElementById('toggleRightPanelBtn');
    if (toggleRightPanelBtn) {
      toggleRightPanelBtn.addEventListener('click', () => this.toggleRightPanel());
      // Show button on tablet/desktop when right panel is hidden
      this.updateRightPanelToggleButton();
    }
    
    // Chat actions
    document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
    document.getElementById('messageInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      } else {
        this.handleTyping();
      }
    });
    
    // Voice input
    document.getElementById('voiceBtn').addEventListener('click', () => this.toggleVoiceInput());
    
    // Attach file
    document.getElementById('attachBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileAttach(e));
    
    // Chat management
    document.getElementById('exportPdfBtn').addEventListener('click', () => this.exportToPDF());
    document.getElementById('clearChatBtn').addEventListener('click', () => this.clearChat());
    
    // Patient management
    document.getElementById('addPatientBtn').addEventListener('click', () => this.handleAddPatient());
    document.getElementById('patientSearch').addEventListener('input', (e) => this.filterPatients(e.target.value));
    
    // Close modal on overlay click
    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') {
        this.closeSettings();
      }
    });
  }

  handleJoin() {
    const patientId = document.getElementById('patientIdInput').value.trim();
    if (!patientId) {
      this.showToast('error', 'Please enter a Patient ID');
      return;
    }
    
    document.getElementById('joinScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    this.connect(patientId);
  }

  handleDemoPatient() {
    const patientId = 'P' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    document.getElementById('patientIdInput').value = patientId;
    this.handleJoin();
  }

  handleAddPatient() {
    const patientId = 'P' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.connect(patientId);
  }

  connect(patientId) {
    this.socket = io();

    this.socket.on('connect', () => {
      this.socket.emit('join', { 
        role: 'doctor', 
        patientId, 
        displayName: 'Dr. Dharshini' 
      });
      
      // Request patient list
      this.socket.emit('getPatients');
      
      if (!this.currentPatientId) {
        this.currentPatientId = patientId;
        this.loadPatientChat(patientId);
      }
    });

    this.socket.on('message', (msg) => {
      this.handleMessage(msg);
    });

    this.socket.on('typing', (data) => {
      this.handleTypingIndicator(data);
    });

    this.socket.on('presence', (users) => {
      this.updatePresence(users);
    });

    this.socket.on('patientsList', (patients) => {
      this.updatePatientsList(patients);
    });

    this.socket.on('patientEvent', (event) => {
      this.handlePatientEvent(event);
    });

    this.socket.on('errorMessage', (error) => {
      this.showToast('error', error);
    });

    this.socket.on('connect_error', () => {
      this.showToast('error', 'Unable to connect to server');
    });
  }

  handleMessage(msg) {
    if (!msg.patientId && this.currentPatientId) {
      msg.patientId = this.currentPatientId;
    }

    const patientId = msg.patientId || this.currentPatientId;
    
    if (!this.messages.has(patientId)) {
      this.messages.set(patientId, []);
    }
    
    // Check for duplicate messages (prevent double-sending issue)
    const existingMessages = this.messages.get(patientId);
    const isDuplicate = existingMessages.some(existingMsg => {
      // Check if message with same text, role, and similar timestamp (within 1 second) already exists
      return existingMsg.text === msg.text && 
             existingMsg.role === msg.role &&
             Math.abs((existingMsg.timestamp || 0) - (msg.timestamp || 0)) < 1000;
    });
    
    if (isDuplicate) {
      console.log('Duplicate message detected, skipping:', msg.text);
      return; // Skip duplicate message
    }
    
    this.messages.get(patientId).push(msg);
    this.analytics.totalMessages++;
    this.analytics.messagesToday++;
    
    // Update analytics
    this.updateAnalytics();
    
    // Play notification sound if message from patient
    if (msg.role === 'patient') {
      this.playNotificationSound();
      this.showToast('info', `New message from ${msg.displayName}`);
    }
    
    // Display message if current chat
    if (patientId === this.currentPatientId) {
      this.renderMessage(msg);
      this.scrollToBottom();
    }
    
    // Update patient list badge
    this.updatePatientBadge(patientId);
  }

  renderMessage(msg) {
    const messagesEl = document.getElementById('messages');
    
    // Remove welcome message if exists
    const welcomeMsg = messagesEl.querySelector('.welcome-message');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.role}`;
    
    const initials = msg.role === 'doctor' ? 'DD' : this.getInitials(msg.displayName);
    const showTimestamps = localStorage.getItem('showTimestamps') !== 'false';
    const time = showTimestamps ? this.formatTime(msg.timestamp) : '';
    const status = msg.status === 'delivered' ? '✓✓' : '✓';
    
    let messageContent = this.escapeHtml(msg.text);
    
    // Handle file attachments
    if (msg.file) {
      if (msg.file.type === 'image' && msg.file.content) {
        messageContent += `<br><img src="${msg.file.content}" alt="${msg.file.name}" style="max-width: 300px; border-radius: 8px; margin-top: 8px;">`;
      }
    }
    
    messageDiv.innerHTML = `
      <div class="message-avatar">${initials}</div>
      <div class="message-content">
        <div class="message-bubble">${messageContent}</div>
        ${showTimestamps ? `
        <div class="message-meta">
          <span class="message-time">${time}</span>
          ${msg.role === 'doctor' ? `<span class="message-status">${status}</span>` : ''}
        </div>
        ` : ''}
      </div>
    `;
    
    messagesEl.appendChild(messageDiv);
  }

  handleTypingIndicator(data) {
    if (data.role === 'patient' && data.isTyping) {
      const typingEl = document.getElementById('typingIndicator');
      const typingText = document.getElementById('typingText');
      typingText.textContent = `${data.displayName} is typing...`;
      typingEl.style.display = 'flex';
      
      // Update patient status
      this.updatePatientStatus(data.patientId, 'typing');
    } else {
      document.getElementById('typingIndicator').style.display = 'none';
      if (data.patientId) {
        this.updatePatientStatus(data.patientId, 'online');
      }
    }
  }

  handleTyping() {
    if (!this.socket || !this.currentPatientId) return;
    this.socket.emit('typing', true);
    
    // Clear typing timeout
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.socket.emit('typing', false);
    }, 1000);
  }

  sendMessage() {
    // Prevent double-sending
    if (this.isSending) {
      return;
    }
    
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !this.socket || !this.currentPatientId) return;
    
    // Set sending flag to prevent duplicate sends
    this.isSending = true;
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.disabled = true;
    }
    
    // Clear input immediately for better UX
    input.value = '';
    this.socket.emit('typing', false);
    
    // Send message to server - it will echo back and handleMessage will be called via socket.on('message')
    this.socket.emit('message', { text });
    
    // Reset sending flag after a short delay (message should be sent by then)
    setTimeout(() => {
      this.isSending = false;
      if (sendBtn) {
        sendBtn.disabled = false;
      }
    }, 500);
  }

  updatePatientsList(patients) {
    const patientsList = document.getElementById('patientsList');
    patientsList.innerHTML = '';
    
    patients.forEach(patient => {
      if (!this.patients.has(patient.id)) {
        this.patients.set(patient.id, patient);
        if (!this.messages.has(patient.id)) {
          this.messages.set(patient.id, []);
        }
      }
      
      const patientItem = this.createPatientItem(patient);
      patientsList.appendChild(patientItem);
    });
    
    this.updateAnalyticsSummary();
  }

  createPatientItem(patient) {
    const div = document.createElement('div');
    div.className = `patient-item ${patient.id === this.currentPatientId ? 'active' : ''}`;
    div.dataset.patientId = patient.id;
    
    const initials = this.getInitials(patient.name);
    const unreadCount = this.getUnreadCount(patient.id);
    
    div.innerHTML = `
      <div class="patient-avatar">${initials}</div>
      <div class="patient-info">
        <div class="patient-name">${this.escapeHtml(patient.name)}</div>
        <div class="patient-meta">
          <span class="status-dot ${patient.online ? 'online' : 'offline'}"></span>
          <span>${patient.condition || 'No condition'}</span>
          ${unreadCount > 0 ? `<span class="patient-badge">${unreadCount}</span>` : ''}
        </div>
      </div>
    `;
    
    div.addEventListener('click', () => this.loadPatientChat(patient.id));
    
    return div;
  }

  loadPatientChat(patientId) {
    this.currentPatientId = patientId;
    
    // Update active patient in list
    document.querySelectorAll('.patient-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.patientId === patientId) {
        item.classList.add('active');
      }
    });
    
    // Close mobile menu if open
    if (window.innerWidth <= 768) {
      const leftPanel = document.getElementById('leftPanel');
      if (leftPanel) {
        leftPanel.classList.remove('mobile-visible');
      }
    }
    
    // Load patient profile
    const patient = this.patients.get(patientId);
    if (patient) {
      this.updatePatientHeader(patient);
      this.updatePatientDetails(patient);
    }
    
    // Load messages
    this.renderMessages(patientId);
    
    // Clear unread badge
    this.clearUnreadBadge(patientId);
  }

  renderMessages(patientId) {
    const messagesEl = document.getElementById('messages');
    messagesEl.innerHTML = '';
    
    const messages = this.messages.get(patientId) || [];
    
    if (messages.length === 0) {
      messagesEl.innerHTML = `
        <div class="welcome-message">
          <i class="fas fa-comments"></i>
          <p>Start chatting with ${this.patients.get(patientId)?.name || 'patient'}</p>
        </div>
      `;
      return;
    }
    
    messages.forEach(msg => this.renderMessage(msg));
    this.scrollToBottom();
  }

  updatePatientHeader(patient) {
    document.getElementById('patientNameHeader').textContent = patient.name;
    document.getElementById('patientInitials').textContent = this.getInitials(patient.name);
    
    const statusEl = document.getElementById('patientStatus');
    const statusDot = statusEl.querySelector('.status-dot');
    const statusText = statusEl.querySelector('span:last-child');
    
    statusDot.className = `status-dot ${patient.online ? 'online' : 'offline'}`;
    statusText.textContent = patient.online ? 'Online' : 'Offline';
  }

  updatePatientDetails(patient) {
    const detailsEl = document.getElementById('patientDetails');
    
    if (!patient.profile) {
      detailsEl.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-user-injured"></i>
          <p>Patient profile not available</p>
        </div>
      `;
      return;
    }
    
    const profile = patient.profile;
    
    detailsEl.innerHTML = `
      <div class="patient-detail-item">
        <div class="patient-detail-label">Name</div>
        <div class="patient-detail-value">${this.escapeHtml(profile.name)}</div>
      </div>
      <div class="patient-detail-item">
        <div class="patient-detail-label">Age</div>
        <div class="patient-detail-value">${profile.age} years old</div>
      </div>
      <div class="patient-detail-item">
        <div class="patient-detail-label">Condition</div>
        <div class="patient-detail-value">
          <span class="condition-badge">${this.escapeHtml(profile.condition)}</span>
        </div>
      </div>
      <div class="patient-detail-item">
        <div class="patient-detail-label">Symptoms</div>
        <ul class="symptom-list">
          ${profile.symptoms.map(s => `<li>${this.escapeHtml(s)}</li>`).join('')}
        </ul>
      </div>
      <div class="patient-detail-item">
        <div class="patient-detail-label">Pain Location</div>
        <div class="patient-detail-value">${this.escapeHtml(profile.painLocation)}</div>
      </div>
      <div class="patient-detail-item">
        <div class="patient-detail-label">Pain Level</div>
        <div class="patient-detail-value">${profile.painLevel}/10</div>
      </div>
      ${profile.temperature ? `
      <div class="patient-detail-item">
        <div class="patient-detail-label">Temperature</div>
        <div class="patient-detail-value">${profile.temperature}°C</div>
      </div>
      ` : ''}
      <div class="patient-detail-item">
        <div class="patient-detail-label">Duration</div>
        <div class="patient-detail-value">${profile.duration}</div>
      </div>
    `;
    
    // Update symptoms chart
    this.updateSymptomsChart(profile);
  }

  handlePatientEvent(event) {
    if (event.type === 'connected') {
      this.showToast('success', `New patient ${event.profile.name} connected`);
      this.playNotificationSound();
      
      // Add to patients list
      if (!this.patients.has(event.patientId)) {
        const patient = {
          id: event.patientId,
          name: event.profile.name,
          age: event.profile.age,
          condition: event.profile.condition,
          online: true,
          typing: false,
          profile: event.profile
        };
        this.patients.set(event.patientId, patient);
        this.socket.emit('getPatients');
      }
    } else if (event.type === 'disconnected') {
      this.showToast('warning', 'Patient disconnected');
      this.updatePatientStatus(event.patientId, 'offline');
    }
  }

  updatePatientStatus(patientId, status) {
    const patient = this.patients.get(patientId);
    if (patient) {
      patient.online = status !== 'offline';
      patient.typing = status === 'typing';
      
      // Update in UI
      const patientItem = document.querySelector(`[data-patient-id="${patientId}"]`);
      if (patientItem) {
        const statusDot = patientItem.querySelector('.status-dot');
        if (statusDot) {
          statusDot.className = `status-dot ${status}`;
        }
      }
      
      // Update header if current patient
      if (patientId === this.currentPatientId) {
        this.updatePatientHeader(patient);
      }
    }
  }

  updatePatientBadge(patientId) {
    const patientItem = document.querySelector(`[data-patient-id="${patientId}"]`);
    if (patientItem) {
      const unreadCount = this.getUnreadCount(patientId);
      let badge = patientItem.querySelector('.patient-badge');
      
      if (unreadCount > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'patient-badge';
          patientItem.querySelector('.patient-meta').appendChild(badge);
        }
        badge.textContent = unreadCount;
      } else if (badge) {
        badge.remove();
      }
    }
  }

  getUnreadCount(patientId) {
    if (patientId === this.currentPatientId) return 0;
    const messages = this.messages.get(patientId) || [];
    return messages.filter(m => m.role === 'patient').length;
  }

  clearUnreadBadge(patientId) {
    const patientItem = document.querySelector(`[data-patient-id="${patientId}"]`);
    if (patientItem) {
      const badge = patientItem.querySelector('.patient-badge');
      if (badge) badge.remove();
    }
  }

  updatePresence(users) {
    // Update presence indicators
    this.analytics.activeChats = users.filter(u => u.role === 'patient').length;
    this.updateAnalyticsSummary();
  }

  // Speech Recognition
  setupSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
      
      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('messageInput').value = transcript;
        this.isRecording = false;
        document.getElementById('voiceBtn').classList.remove('recording');
      };
      
      this.recognition.onerror = () => {
        this.isRecording = false;
        document.getElementById('voiceBtn').classList.remove('recording');
        this.showToast('error', 'Speech recognition error');
      };
      
      this.recognition.onend = () => {
        this.isRecording = false;
        document.getElementById('voiceBtn').classList.remove('recording');
      };
    }
  }

  toggleVoiceInput() {
    if (!this.recognition) {
      this.showToast('error', 'Speech recognition not supported');
      return;
    }
    
    if (this.isRecording) {
      this.recognition.stop();
      this.isRecording = false;
      document.getElementById('voiceBtn').classList.remove('recording');
    } else {
      this.recognition.start();
      this.isRecording = true;
      document.getElementById('voiceBtn').classList.add('recording');
    }
  }

  // Theme Management
  loadTheme() {
    if (this.isDarkMode) {
      document.body.classList.add('dark-mode');
      document.getElementById('themeToggle').querySelector('i').className = 'fas fa-sun';
    }
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('darkMode', this.isDarkMode);
    
    if (this.isDarkMode) {
      document.body.classList.add('dark-mode');
      document.getElementById('themeToggle').querySelector('i').className = 'fas fa-sun';
    } else {
      document.body.classList.remove('dark-mode');
      document.getElementById('themeToggle').querySelector('i').className = 'fas fa-moon';
    }
  }

  // PDF Export
  exportToPDF() {
    if (!this.currentPatientId) {
      this.showToast('error', 'No chat selected');
      return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const patient = this.patients.get(this.currentPatientId);
    const messages = this.messages.get(this.currentPatientId) || [];
    
    doc.setFontSize(18);
    doc.text('Chat History', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Patient: ${patient?.name || 'Unknown'}`, 20, 30);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 37);
    
    let y = 50;
    messages.forEach(msg => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`${msg.displayName} - ${this.formatTime(msg.timestamp)}`, 20, y);
      
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      const text = doc.splitTextToSize(msg.text, 170);
      doc.text(text, 20, y + 5);
      
      y += text.length * 5 + 10;
    });
    
    doc.save(`chat-${this.currentPatientId}-${Date.now()}.pdf`);
    this.showToast('success', 'Chat exported to PDF');
  }

  clearChat() {
    if (!this.currentPatientId) return;
    
    if (confirm('Are you sure you want to clear this chat?')) {
      this.messages.set(this.currentPatientId, []);
      this.renderMessages(this.currentPatientId);
      this.showToast('info', 'Chat cleared');
    }
  }

  filterPatients(searchTerm) {
    const items = document.querySelectorAll('.patient-item');
    items.forEach(item => {
      const name = item.querySelector('.patient-name').textContent.toLowerCase();
      if (name.includes(searchTerm.toLowerCase())) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  }

  // Analytics
  setupCharts() {
    const ctx = document.getElementById('symptomsChart');
    if (!ctx) return;
    
    this.symptomsChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [
            '#007BFF',
            '#28A745',
            '#FFC107',
            '#DC3545',
            '#17A2B8',
            '#6F42C1'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  updateSymptomsChart(profile) {
    if (!this.symptomsChart) return;
    
    const symptoms = profile.symptoms || [];
    this.symptomsChart.data.labels = symptoms;
    this.symptomsChart.data.datasets[0].data = symptoms.map(() => 1);
    this.symptomsChart.update();
  }

  updateAnalytics() {
    // Update stats
    document.getElementById('totalMessagesCount').textContent = this.analytics.totalMessages;
    document.getElementById('messagesToday').textContent = this.analytics.messagesToday;
    
    // Calculate average response time (simplified)
    const avgResponse = this.analytics.responseTimes.length > 0
      ? (this.analytics.responseTimes.reduce((a, b) => a + b, 0) / this.analytics.responseTimes.length).toFixed(1)
      : '--';
    document.getElementById('avgResponseTime').textContent = avgResponse + 's';
  }

  updateAnalyticsSummary() {
    document.getElementById('activePatientsCount').textContent = this.patients.size;
  }

  // Utilities
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  scrollToBottom() {
    const autoScroll = localStorage.getItem('autoScroll') !== 'false';
    if (!autoScroll) return;
    
    const messagesEl = document.getElementById('messages');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  showToast(type, message, title = '') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
      <i class="fas ${icons[type]} toast-icon"></i>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close">&times;</button>
    `;
    
    container.appendChild(toast);
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });
    
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  playNotificationSound() {
    const audio = document.getElementById('notificationSound');
    if (audio && localStorage.getItem('soundNotifications') !== 'false') {
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Ignore audio play errors
      });
    }
  }

  // Fullscreen Mode
  toggleFullscreen() {
    const chatPanel = document.getElementById('chatPanel');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const dashboard = document.getElementById('dashboard');
    
    if (!this.isFullscreen) {
      chatPanel.classList.add('fullscreen');
      dashboard.classList.add('fullscreen-mode');
      fullscreenBtn.querySelector('i').className = 'fas fa-compress';
      fullscreenBtn.title = 'Exit Fullscreen';
      this.isFullscreen = true;
    } else {
      chatPanel.classList.remove('fullscreen');
      dashboard.classList.remove('fullscreen-mode');
      fullscreenBtn.querySelector('i').className = 'fas fa-expand';
      fullscreenBtn.title = 'Fullscreen';
      this.isFullscreen = false;
    }
  }

  // Settings Modal
  openSettings() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'flex';
    
    // Load current settings
    document.getElementById('themeSelect').value = this.isDarkMode ? 'dark' : 'light';
    document.getElementById('soundNotifications').checked = localStorage.getItem('soundNotifications') !== 'false';
    document.getElementById('desktopNotifications').checked = localStorage.getItem('desktopNotifications') !== 'false';
    document.getElementById('autoScroll').checked = localStorage.getItem('autoScroll') !== 'false';
    document.getElementById('showTimestamps').checked = localStorage.getItem('showTimestamps') !== 'false';
    document.getElementById('enableDragging').checked = this.draggingEnabled;
  }

  closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
  }

  setupSettings() {
    // Theme select
    document.getElementById('themeSelect').addEventListener('change', (e) => {
      if (e.target.value === 'dark') {
        this.isDarkMode = true;
        this.toggleTheme();
      } else if (e.target.value === 'light') {
        this.isDarkMode = false;
        this.toggleTheme();
      }
      // Auto mode would require system preference detection
    });

    // Sound notifications
    document.getElementById('soundNotifications').addEventListener('change', (e) => {
      localStorage.setItem('soundNotifications', e.target.checked);
    });

    // Desktop notifications
    document.getElementById('desktopNotifications').addEventListener('change', (e) => {
      localStorage.setItem('desktopNotifications', e.target.checked);
      if (e.target.checked && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    });

    // Auto scroll
    document.getElementById('autoScroll').addEventListener('change', (e) => {
      localStorage.setItem('autoScroll', e.target.checked);
    });

    // Show timestamps
    document.getElementById('showTimestamps').addEventListener('change', (e) => {
      localStorage.setItem('showTimestamps', e.target.checked);
      // Re-render messages to show/hide timestamps
      if (this.currentPatientId) {
        this.renderMessages(this.currentPatientId);
      }
    });

    // Enable dragging
    document.getElementById('enableDragging').addEventListener('change', (e) => {
      this.draggingEnabled = e.target.checked;
      localStorage.setItem('draggingEnabled', e.target.checked);
      this.setupDraggablePanels();
    });

    // Reset layout
    document.getElementById('resetLayoutBtn').addEventListener('click', () => {
      if (confirm('Reset panel layout to default?')) {
        localStorage.removeItem('panelLayout');
        this.panelLayout = null;
        location.reload();
      }
    });
  }

  loadSettings() {
    // Load saved settings
    const soundNotifications = localStorage.getItem('soundNotifications');
    const desktopNotifications = localStorage.getItem('desktopNotifications');
    const autoScroll = localStorage.getItem('autoScroll');
    
    if (desktopNotifications !== 'false' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  // Mobile Navigation
  setupMobileNavigation() {
    // Close panels when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        const leftPanel = document.getElementById('leftPanel');
        const rightPanel = document.getElementById('rightPanel');
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        
        if (leftPanel && leftPanel.classList.contains('mobile-visible')) {
          if (!leftPanel.contains(e.target) && !hamburgerBtn.contains(e.target)) {
            leftPanel.classList.remove('mobile-visible');
          }
        }
        
        if (rightPanel && rightPanel.classList.contains('mobile-visible')) {
          if (!rightPanel.contains(e.target)) {
            rightPanel.classList.remove('mobile-visible');
          }
        }
      }
    });
  }

  toggleMobileMenu() {
    const leftPanel = document.getElementById('leftPanel');
    leftPanel.classList.toggle('mobile-visible');
  }

  toggleRightPanel() {
    const rightPanel = document.getElementById('rightPanel');
    rightPanel.classList.toggle('mobile-visible');
    this.updateRightPanelToggleButton();
  }

  updateRightPanelToggleButton() {
    const toggleBtn = document.getElementById('toggleRightPanelBtn');
    const rightPanel = document.getElementById('rightPanel');
    
    if (toggleBtn && rightPanel) {
      // Show button on tablet/desktop when right panel might be hidden
      if (window.innerWidth <= 1024 && window.innerWidth > 768) {
        toggleBtn.style.display = 'flex';
      } else if (window.innerWidth <= 768) {
        toggleBtn.style.display = 'flex';
      } else {
        toggleBtn.style.display = 'none';
      }
    }
  }

  // File Attach
  handleFileAttach(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        this.showToast('error', `File ${file.name} is too large. Maximum size is 10MB.`);
        return;
      }

      // Display file in chat
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileType = file.type.split('/')[0];
        
        if (fileType === 'image') {
          // Send image
          this.sendFileMessage(file.name, e.target.result, 'image');
        } else {
          // Send file info
          this.sendFileMessage(file.name, null, 'file');
        }
      };
      
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });

    // Reset input
    event.target.value = '';
  }

  sendFileMessage(fileName, content, type) {
    if (!this.socket || !this.currentPatientId) return;

    const msg = {
      text: type === 'image' ? `📎 Image: ${fileName}` : `📎 File: ${fileName}`,
      role: 'doctor',
      displayName: 'Dr. Dharshini',
      timestamp: Date.now(),
      status: 'sent',
      file: {
        name: fileName,
        content: content,
        type: type
      }
    };

    this.socket.emit('message', { text: msg.text, file: msg.file });
    this.handleMessage({ ...msg, patientId: this.currentPatientId });
  }

  // Draggable/Resizable Panels
  setupDraggablePanels() {
    if (!this.draggingEnabled) {
      // Disable resize
      document.querySelectorAll('.draggable-panel').forEach(panel => {
        panel.style.resize = 'none';
        const header = panel.querySelector('.panel-header');
        if (header) {
          header.style.cursor = 'default';
        }
      });
      return;
    }

    // Enable resize for panels
    const leftPanel = document.getElementById('leftPanel');
    const rightPanel = document.getElementById('rightPanel');
    
    if (leftPanel) {
      leftPanel.style.resize = 'horizontal';
    }
    if (rightPanel) {
      rightPanel.style.resize = 'horizontal';
    }

    // Restore saved layout
    if (this.panelLayout) {
      this.restorePanelLayout();
    }

    // Save panel widths when resized
    const observer = new ResizeObserver(() => {
      this.savePanelLayout();
    });

    if (leftPanel) observer.observe(leftPanel);
    if (rightPanel) observer.observe(rightPanel);

    // Add visual feedback on panel header hover
    document.querySelectorAll('.draggable-panel').forEach(panel => {
      const header = panel.querySelector('.panel-header');
      if (!header) return;

      header.addEventListener('mouseenter', () => {
        if (this.draggingEnabled) {
          header.style.cursor = 'grab';
        }
      });

      header.addEventListener('mousedown', (e) => {
        if (!this.draggingEnabled || e.button !== 0) return;
        
        panel.classList.add('dragging');
        header.style.cursor = 'grabbing';
        
        const handleMouseUp = () => {
          panel.classList.remove('dragging');
          header.style.cursor = 'grab';
          document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mouseup', handleMouseUp);
      });
    });
  }

  savePanelLayout() {
    // Save current panel widths
    const leftPanel = document.getElementById('leftPanel');
    const rightPanel = document.getElementById('rightPanel');
    
    const layout = {
      leftWidth: leftPanel ? leftPanel.offsetWidth : null,
      rightWidth: rightPanel ? rightPanel.offsetWidth : null,
      timestamp: Date.now()
    };
    
    localStorage.setItem('panelLayout', JSON.stringify(layout));
  }

  restorePanelLayout() {
    if (!this.panelLayout) return;
    
    // Restore panel widths
    const leftPanel = document.getElementById('leftPanel');
    const rightPanel = document.getElementById('rightPanel');
    
    if (this.panelLayout.leftWidth && leftPanel) {
      leftPanel.style.width = this.panelLayout.leftWidth + 'px';
    }
    if (this.panelLayout.rightWidth && rightPanel) {
      rightPanel.style.width = this.panelLayout.rightWidth + 'px';
    }
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new DoctorDashboard();
});
