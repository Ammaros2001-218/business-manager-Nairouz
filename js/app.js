/**
 * app.js
 * المنسق العام للتطبيق (Single Page Application Router & State Manager)
 * التحكم في شاشات العرض، التنقل السلس، الإشعارات Toast، والإعدادات
 */

const App = {
  currentView: 'dashboard',

  init() {
    // مراقبة حالة تسجيل الدخول
    Auth.init((user) => {
      this.handleAuthStateChange(user);
    });

    // ربط مستمعي الأحداث
    this.bindEvents();

    // فحص المسار المبدئي
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigateTo(hash);
  },

  handleAuthStateChange(user) {
    const authWrapper = document.getElementById('auth-wrapper');
    const appWrapper = document.getElementById('app-wrapper');

    if (user) {
      if (authWrapper) authWrapper.style.display = 'none';
      if (appWrapper) appWrapper.style.display = 'flex';
      
      const userEmailEl = document.getElementById('current-user-email');
      if (userEmailEl) userEmailEl.textContent = user.email || 'صاحبة البزنس';

      // تفعيل المزامنة اللحظية مع Realtime Database
      Database.initRealtimeSync((collectionChanged) => {
        console.log(`Realtime update received for: ${collectionChanged}`);
        this.refreshCurrentView();
      });

      this.refreshCurrentView();
    } else {
      if (authWrapper) authWrapper.style.display = 'flex';
      if (appWrapper) appWrapper.style.display = 'none';
    }
  },

  bindEvents() {
    // 1. تسجيل الدخول
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('login-btn');
        const errEl = document.getElementById('login-error-msg');

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> جارِ الدخول...';
        if (errEl) errEl.style.display = 'none';

        const result = await Auth.login(email, password);
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-box-arrow-in-left me-1"></i> تسجيل الدخول';

        if (result.success) {
          App.handleAuthStateChange(result.user);
          App.navigateTo('dashboard');
        } else {
          if (errEl) {
            errEl.textContent = result.error;
            errEl.style.display = 'block';
          }
        }
      });
    }

    // إظهار/إخفاء كلمة المرور
    const togglePassBtn = document.getElementById('toggle-password-btn');
    if (togglePassBtn) {
      togglePassBtn.addEventListener('click', () => {
        const passInput = document.getElementById('login-password');
        const icon = togglePassBtn.querySelector('i');
        if (passInput.type === 'password') {
          passInput.type = 'text';
          icon.className = 'bi bi-eye-slash';
        } else {
          passInput.type = 'password';
          icon.className = 'bi bi-eye';
        }
      });
    }

    // استعادة كلمة المرور
    const forgotPassBtn = document.getElementById('forgot-password-link');
    if (forgotPassBtn) {
      forgotPassBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        if (!email) {
          alert('يرجى كتابة بريدك الإلكتروني أولاً في حقل البريد');
          return;
        }
        const res = await Auth.resetPassword(email);
        alert(res.message || res.error);
      });
    }

    // تسجيل الخروج
    const logoutBtns = document.querySelectorAll('.action-logout-btn');
    logoutBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('هل ترغبين بالتأكيد في تسجيل الخروج؟')) {
          Auth.logout();
        }
      });
    });

    // نماذج البزنس والمبيعات والمصروفات
    const bizForm = document.getElementById('business-form');
    if (bizForm) bizForm.addEventListener('submit', (e) => Businesses.handleSaveBusiness(e));

    const saleForm = document.getElementById('sale-form');
    if (saleForm) saleForm.addEventListener('submit', (e) => Sales.handleSaveSale(e));

    const expForm = document.getElementById('expense-form');
    if (expForm) expForm.addEventListener('submit', (e) => Expenses.handleSaveExpense(e));

    // أحداث حقول البزنس الحية
    const liveFields = [
      'biz-currency', 'biz-cost-lyd', 'biz-cost-usd', 'biz-exchange-rate',
      'biz-shipping-cost', 'biz-customs-cost', 'biz-additional-cost', 'biz-total-units'
    ];
    liveFields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => Businesses.updateLiveCostSummary());
        el.addEventListener('change', () => Businesses.updateLiveCostSummary());
      }
    });

    const bizCurrency = document.getElementById('biz-currency');
    if (bizCurrency) {
      bizCurrency.addEventListener('change', () => Businesses.toggleCurrencyInputs());
    }

    const enableAds = document.getElementById('biz-enable-ads');
    if (enableAds) {
      enableAds.addEventListener('change', () => Businesses.toggleAdsFields());
    }

    // أحداث نموذج البيع الحي
    const saleBizSelect = document.getElementById('sale-business-select');
    if (saleBizSelect) saleBizSelect.addEventListener('change', () => Sales.onBusinessOrQuantityChange());

    const saleQty = document.getElementById('sale-quantity');
    if (saleQty) saleQty.addEventListener('input', () => Sales.onBusinessOrQuantityChange());

    const salePrice = document.getElementById('sale-unit-price');
    if (salePrice) salePrice.addEventListener('input', () => Sales.onBusinessOrQuantityChange());

    const saleDisc = document.getElementById('sale-discount');
    if (saleDisc) saleDisc.addEventListener('input', () => Sales.onBusinessOrQuantityChange());

    const salePaid = document.getElementById('sale-paid-amount');
    if (salePaid) salePaid.addEventListener('input', () => { salePaid.dataset.manual = 'true'; });

    // أحداث المصروفات
    const expCurrency = document.getElementById('expense-currency');
    if (expCurrency) expCurrency.addEventListener('change', () => Expenses.toggleCurrency());

    // أحداث الفلاتر
    const bizSearch = document.getElementById('business-search-input');
    if (bizSearch) bizSearch.addEventListener('input', () => Businesses.renderActiveList());

    const archiveSearch = document.getElementById('archive-search-input');
    if (archiveSearch) archiveSearch.addEventListener('input', () => Archive.renderArchiveList());

    const archiveSort = document.getElementById('archive-sort-select');
    if (archiveSort) archiveSort.addEventListener('change', () => Archive.renderArchiveList());

    const salesFilter = document.getElementById('sales-filter-business');
    if (salesFilter) salesFilter.addEventListener('change', () => Sales.renderAllSalesView());

    const expFilterBiz = document.getElementById('expense-filter-business');
    if (expFilterBiz) expFilterBiz.addEventListener('change', () => Expenses.renderExpensesView());

    const expFilterCat = document.getElementById('expense-filter-category');
    if (expFilterCat) expFilterCat.addEventListener('change', () => Expenses.renderExpensesView());

    // حفظ إعدادات Firebase من واجهة الإعدادات
    const fbSettingsForm = document.getElementById('firebase-settings-form');
    if (fbSettingsForm) {
      fbSettingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const cfg = {
          apiKey: document.getElementById('cfg-api-key').value.trim(),
          databaseURL: document.getElementById('cfg-database-url').value.trim(),
          authDomain: document.getElementById('cfg-auth-domain').value.trim(),
          projectId: document.getElementById('cfg-project-id').value.trim(),
          storageBucket: document.getElementById('cfg-storage-bucket').value.trim(),
          appId: document.getElementById('cfg-app-id').value.trim()
        };
        FirebaseApp.saveConfig(cfg);
        alert('تم حفظ إعدادات Firebase Realtime Database بنجاح وإعادة تشغيل التطبيق.');
      });
    }

    // زر إضافة بيانات تجريبية سريعة للمعاينة
    const seedDataBtn = document.getElementById('btn-seed-sample-data');
    if (seedDataBtn) {
      seedDataBtn.addEventListener('click', () => this.seedSampleData());
    }

    // مسح كافة البيانات
    const clearDataBtn = document.getElementById('btn-clear-all-data');
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', () => {
        if (confirm('تحذير: هل أنتِ متأكدة تماماً من مسح كافة بيانات البزنس والمبيعات والمصروفات؟')) {
          localStorage.removeItem('bm_local_businesses');
          localStorage.removeItem('bm_local_sales');
          localStorage.removeItem('bm_local_expenses');
          window.location.reload();
        }
      });
    }

    // استجابة للشاشات الصغيرة (Sidebar Toggle)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('app-sidebar');
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('show');
      });
    }
  },

  /**
   * التوجيه بين الأقسام (SPA Navigation)
   */
  navigateTo(viewId) {
    this.currentView = viewId;
    window.location.hash = viewId;

    // إخفاء جميع الواجهات
    const views = document.querySelectorAll('.app-view');
    views.forEach(v => v.style.display = 'none');

    // إظهار الواجهة المحددة
    const target = document.getElementById(`${viewId}-view`);
    if (target) {
      target.style.display = 'block';
    } else {
      const fallback = document.getElementById('dashboard-view');
      if (fallback) fallback.style.display = 'block';
      this.currentView = 'dashboard';
    }

    // تحديث أزرار القائمة الجانبية النشطة
    const navLinks = document.querySelectorAll('.sidebar-nav-link');
    navLinks.forEach(link => {
      if (link.getAttribute('data-view') === this.currentView) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // تحديث عنوان الصفحة في الشريط العلوي
    const titles = {
      'dashboard': 'لوحة التحكم والإحصائيات',
      'active-businesses': 'البزنسات النشطة',
      'add-business': 'إضافة بزنس جديد',
      'archive': 'أرشيف البزنسات المغلقة',
      'sales': 'جميع المبيعات',
      'expenses': 'المصروفات العامة',
      'reports': 'التقارير المالية الشاملة',
      'settings': 'إعدادات النظام و Firebase'
    };
    const pageTitleEl = document.getElementById('topbar-page-title');
    if (pageTitleEl) pageTitleEl.textContent = titles[this.currentView] || 'لوحة التحكم';

    // إغلاق الشريط الجانبي في الهاتف بعد الضغط
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && window.innerWidth < 992) {
      sidebar.classList.remove('show');
    }

    this.refreshCurrentView();
  },

  refreshCurrentView() {
    switch (this.currentView) {
      case 'dashboard':
        Dashboard.render();
        break;
      case 'active-businesses':
        Businesses.renderActiveList();
        break;
      case 'add-business':
        // لا نحتاج لإعادة الرسم
        break;
      case 'archive':
        Archive.renderArchiveList();
        break;
      case 'sales':
        Sales.renderAllSalesView();
        break;
      case 'expenses':
        Expenses.renderExpensesView();
        break;
      case 'reports':
        Reports.render();
        break;
      case 'settings':
        this.loadSettingsView();
        break;
    }
  },

  loadSettingsView() {
    const cfg = FirebaseApp.getConfig();
    if (document.getElementById('cfg-api-key')) {
      document.getElementById('cfg-api-key').value = cfg.apiKey || '';
      document.getElementById('cfg-database-url').value = cfg.databaseURL || '';
      document.getElementById('cfg-auth-domain').value = cfg.authDomain || '';
      document.getElementById('cfg-project-id').value = cfg.projectId || '';
      document.getElementById('cfg-storage-bucket').value = cfg.storageBucket || '';
      document.getElementById('cfg-app-id').value = cfg.appId || '';
    }
  },

  /**
   * عرض رسائل التنبيه العصرية Toast
   */
  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toastId = 'toast_' + Date.now();
    const bgClass = type === 'success' ? 'bg-success text-white' : type === 'error' ? 'bg-danger text-white' : 'bg-dark text-white';
    const icon = type === 'success' ? 'bi-check-circle-fill' : type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill';

    const toastHtml = `
      <div id="${toastId}" class="toast align-items-center ${bgClass} border-0 shadow-lg rounded-3 mb-2" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body d-flex align-items-center gap-2">
            <i class="bi ${icon} fs-5"></i>
            <span>${message}</span>
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastEl = document.getElementById(toastId);
    const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
    bsToast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  },

  /**
   * توليد عينة بيانات واقعية بنقرة واحدة لتجربة فورية مبهجة
   */
  async seedSampleData() {
    if (!confirm('هل ترغبين في ملء بيانات تجريبية توضيحية (بزنس عبايات، مكياج، ساعات مع مبيعات ومصروفات)؟')) return;

    const b1 = await Database.saveBusiness({
      name: 'بوتيك العبايات الحريرية',
      productName: 'عباءة نوار الخليجية',
      purchaseLocation: 'china',
      purchaseDate: '2026-09-15',
      totalUnits: 50,
      description: 'عبايات فاخرة قماش كريب إنترنت ياباني مع تطريز راقي',
      productImage: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&auto=format&fit=crop&q=60',
      currency: 'USD',
      costInUSD: 1200,
      exchangeRate: 5.2,
      shippingCost: 450,
      customsCost: 200,
      additionalCost: 100,
      totalCostLYD: (1200 * 5.2) + 450 + 200 + 100, // 6990
      unitCost: ((1200 * 5.2) + 450 + 200 + 100) / 50, // 139.8
      enableAds: true,
      adBudget: 150,
      adCurrency: 'USD',
      adSpent: 120,
      status: 'active'
    });

    const b2 = await Database.saveBusiness({
      name: 'روز بيوتي - Rose Glow',
      productName: 'مجموعة أحمر الشفاه المخملي',
      purchaseLocation: 'libya',
      purchaseDate: '2026-09-20',
      totalUnits: 100,
      description: 'أرواج سائلة ثابتة 12 درجة أنثوية جذابة',
      productImage: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&auto=format&fit=crop&q=60',
      currency: 'LYD',
      costInLYD: 2500,
      shippingCost: 150,
      customsCost: 0,
      additionalCost: 50,
      totalCostLYD: 2700,
      unitCost: 27,
      enableAds: true,
      adBudget: 200,
      adCurrency: 'LYD',
      adSpent: 180,
      status: 'active'
    });

    // تسجيل مبيعات
    await Database.addSale({
      businessId: b1.id,
      quantity: 12,
      unitPrice: 280,
      discount: 60,
      saleExpense: 40,
      paidAmount: 3300,
      paymentStatus: 'paid',
      date: '2026-09-25',
      notes: 'طلبيات إنستغرام لزبونات طرابلس وبنغازي'
    });

    await Database.addSale({
      businessId: b2.id,
      quantity: 45,
      unitPrice: 65,
      discount: 100,
      saleExpense: 50,
      paidAmount: 2825,
      paymentStatus: 'paid',
      date: '2026-09-28',
      notes: 'عرض اليوم الوطني الخاص'
    });

    // تسجيل مصاريف
    await Database.addExpense({
      businessId: b1.id,
      category: 'ads',
      amount: 624,
      currency: 'LYD',
      exchangeRate: 1,
      date: '2026-09-22',
      description: 'حملة إعلانات ممولة فيسبوك وإنستغرام (120 دولار)'
    });

    await Database.addExpense({
      businessId: b2.id,
      category: 'packaging',
      amount: 120,
      currency: 'LYD',
      exchangeRate: 1,
      date: '2026-09-21',
      description: 'أكياس وردية فاخرة وشرائط حريرية للتغليف'
    });

    this.showToast('تمت إضافة البيانات التوضيحية بنجاح!', 'success');
    this.refreshCurrentView();
  }
};

// تشغيل التطبيق بمجرد اكتمال تحميل DOM
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
