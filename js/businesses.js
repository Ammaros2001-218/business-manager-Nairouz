/**
 * businesses.js
 * إدارة البزنسات (النشطة والجديدة والتفاصيل وتعديل وإغلاق البزنس)
 */

const Businesses = {
  currentViewingBusinessId: null,

  async renderActiveList() {
    const container = document.getElementById('businesses-list-container');
    if (!container) return;

    try {
      const allBusinesses = await Database.getAllBusinesses();
      const activeList = allBusinesses.filter(b => b.status !== 'closed');
      const sales = await Database.getAllSales();
      const expenses = await Database.getAllExpenses();

      const searchInput = document.getElementById('business-search-input');
      const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

      const filtered = activeList.filter(b => {
        if (!searchTerm) return true;
        return (b.name && b.name.toLowerCase().includes(searchTerm)) ||
               (b.productName && b.productName.toLowerCase().includes(searchTerm));
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="col-12 text-center py-5">
            <div class="empty-state-box p-5 rounded-4 bg-white shadow-sm border text-center">
              <i class="bi bi-shop-window display-4 text-pink-soft mb-3 d-block"></i>
              <h5 class="fw-bold mb-2">لا توجد بزنسات نشطة حالياً</h5>
              <p class="text-muted mb-4">ابدأي الآن بإضافة أول مشروع تجاري لمتابعة مبيعاته وأرباحه بدقة</p>
              <button class="btn btn-pink px-4 py-2 rounded-pill" onclick="App.navigateTo('add-business')">
                <i class="bi bi-plus-circle me-1"></i> إضافة بزنس جديد
              </button>
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(biz => {
        const bizSales = sales.filter(s => s.businessId === biz.id);
        const bizExp = expenses.filter(e => e.businessId === biz.id);
        const summary = Calculations.calculateBusinessSummary(biz, bizSales, bizExp);

        const imgSrc = biz.productImage || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500&auto=format&fit=crop&q=60';
        const locationBadge = biz.purchaseLocation === 'china' 
          ? '<span class="badge bg-purple-soft text-purple"><i class="bi bi-globe me-1"></i>الصين</span>'
          : '<span class="badge bg-pink-soft text-pink"><i class="bi bi-geo-alt me-1"></i>ليبيا</span>';

        const profitClass = summary.isProfit ? 'text-profit' : 'text-loss';
        const profitIcon = summary.isProfit ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow';

        return `
          <div class="col-md-6 col-lg-4 mb-4">
            <div class="card business-card h-100 border-0 shadow-sm rounded-4 overflow-hidden position-relative">
              <div class="card-img-wrapper position-relative">
                <img src="${imgSrc}" class="card-img-top object-fit-cover" style="height: 190px;" alt="${biz.name}">
                <div class="position-absolute top-0 end-0 p-3">
                  ${locationBadge}
                </div>
                <div class="position-absolute bottom-0 start-0 w-100 p-3 bg-gradient-dark text-white">
                  <h5 class="card-title fw-bold mb-0">${biz.name}</h5>
                  <small class="text-white-50"><i class="bi bi-box-seam me-1"></i>${biz.productName || 'منتج'}</small>
                </div>
              </div>

              <div class="card-body p-4">
                <!-- شريط تقدم المخزون -->
                <div class="mb-3">
                  <div class="d-flex justify-content-between text-sm mb-1">
                    <span class="text-muted">المخزون (المباع / الإجمالي)</span>
                    <span class="fw-bold">${summary.soldUnits} / ${summary.totalUnits} قطعة</span>
                  </div>
                  <div class="progress" style="height: 8px;">
                    <div class="progress-bar bg-pink" role="progressbar" style="width: ${summary.totalUnits ? (summary.soldUnits / summary.totalUnits) * 100 : 0}%"></div>
                  </div>
                  <div class="d-flex justify-content-between text-xs text-muted mt-1">
                    <span>المتبقي: ${summary.remainingUnits} قطعة</span>
                    <span>قيمة المتبقي: ${Calculations.formatCurrency(summary.remainingStockValue)}</span>
                  </div>
                </div>

                <div class="row g-2 text-center py-2 mb-3 bg-pink-subtle rounded-3">
                  <div class="col-6 border-end border-pink-soft">
                    <small class="text-muted d-block text-xs">إجمالي المبيعات</small>
                    <span class="fw-bold text-dark">${Calculations.formatCurrency(summary.totalSalesRevenue)}</span>
                  </div>
                  <div class="col-6">
                    <small class="text-muted d-block text-xs">صافي الربح / الخسارة</small>
                    <span class="fw-bold ${profitClass}">
                      <i class="bi ${profitIcon} me-1"></i>${Calculations.formatCurrency(summary.netProfitOrLoss)}
                    </span>
                  </div>
                </div>

                <div class="d-flex gap-2">
                  <button class="btn btn-outline-pink flex-grow-1 rounded-pill btn-sm py-2" onclick="Businesses.openDetailsModal('${biz.id}')">
                    <i class="bi bi-eye me-1"></i> التفاصيل والعمليات
                  </button>
                  <button class="btn btn-pink rounded-pill btn-sm px-3" onclick="Sales.openAddSaleModal('${biz.id}')" title="تسجيل بيع">
                    <i class="bi bi-cart-plus"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  },

  /**
   * فتح نافذة تفاصيل البزنس الشاملة
   */
  async openDetailsModal(businessId) {
    this.currentViewingBusinessId = businessId;
    const biz = await Database.getBusinessById(businessId);
    if (!biz) return;

    const sales = await Database.getAllSales(businessId);
    const expenses = await Database.getAllExpenses(businessId);
    const summary = Calculations.calculateBusinessSummary(biz, sales, expenses);

    document.getElementById('biz-details-title').textContent = biz.name;
    document.getElementById('biz-details-product').textContent = biz.productName || 'غير محدد';
    document.getElementById('biz-details-location').textContent = biz.purchaseLocation === 'china' ? 'الصين' : 'ليبيا';
    document.getElementById('biz-details-date').textContent = biz.purchaseDate || 'غير مسجل';

    document.getElementById('biz-details-total-units').textContent = `${summary.totalUnits} قطعة`;
    document.getElementById('biz-details-sold-units').textContent = `${summary.soldUnits} قطعة`;
    document.getElementById('biz-details-remaining-units').textContent = `${summary.remainingUnits} قطعة`;
    document.getElementById('biz-details-unit-cost').textContent = Calculations.formatCurrency(summary.unitCost);

    document.getElementById('biz-details-invested').textContent = Calculations.formatCurrency(summary.totalCostLYD);
    document.getElementById('biz-details-sales').textContent = Calculations.formatCurrency(summary.totalSalesRevenue);
    document.getElementById('biz-details-cogs').textContent = Calculations.formatCurrency(summary.cogs);
    document.getElementById('biz-details-expenses').textContent = Calculations.formatCurrency(summary.totalExpenses);

    const netProfitEl = document.getElementById('biz-details-net-profit');
    netProfitEl.textContent = Calculations.formatCurrency(summary.netProfitOrLoss);
    netProfitEl.className = summary.isProfit ? 'fw-bold fs-4 text-profit' : 'fw-bold fs-4 text-loss';

    document.getElementById('biz-details-profit-rate').textContent = `${summary.profitMarginPercentage}%`;
    document.getElementById('biz-details-collected').textContent = Calculations.formatCurrency(summary.totalCollectedSales);
    document.getElementById('biz-details-receivable').textContent = Calculations.formatCurrency(summary.totalReceivable);

    // تفاصيل الإعلانات الممولة
    const adsContainer = document.getElementById('biz-details-ads-section');
    if (biz.enableAds) {
      adsContainer.style.display = 'block';
      document.getElementById('biz-details-ads-budget').textContent = `${biz.adBudget || 0} ${biz.adCurrency || 'USD'}`;
      document.getElementById('biz-details-ads-spent').textContent = Calculations.formatCurrency(summary.adExpensesTotal);
    } else {
      adsContainer.style.display = 'none';
    }

    // جدول مبيعات البزنس
    const salesTableBody = document.getElementById('biz-details-sales-table-body');
    if (sales.length === 0) {
      salesTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">لم يتم تسجيل أي عملية بيع لهذا البزنس بعد</td></tr>`;
    } else {
      salesTableBody.innerHTML = sales.map(s => {
        const calc = Calculations.calculateSaleItem(s, summary.unitCost);
        const badge = s.paymentStatus === 'unpaid'
          ? '<span class="badge bg-danger-soft text-danger">غير مدفوع</span>'
          : s.paymentStatus === 'partial'
          ? '<span class="badge bg-warning-soft text-warning">جزئي</span>'
          : '<span class="badge bg-success-soft text-success">مكتمل</span>';

        return `
          <tr>
            <td>${s.date}</td>
            <td><span class="badge bg-pink-soft text-pink">${s.quantity} قطع</span></td>
            <td>${Calculations.formatCurrency(s.unitPrice)}</td>
            <td>${Calculations.formatCurrency(calc.netTotal)}</td>
            <td class="${calc.netProfit >= 0 ? 'text-profit' : 'text-loss'} fw-bold">${Calculations.formatCurrency(calc.netProfit)}</td>
            <td>${badge}</td>
            <td>
              <button class="btn btn-sm btn-outline-danger py-0 px-2 rounded-circle" onclick="Sales.deleteSale('${s.id}')" title="حذف">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // جدول مصروفات البزنس
    const expTableBody = document.getElementById('biz-details-expenses-table-body');
    if (expenses.length === 0) {
      expTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">لا توجد مصاريف إضافية مسجلة</td></tr>`;
    } else {
      expTableBody.innerHTML = expenses.map(e => {
        const catMap = { ads: 'إعلانات', packaging: 'تغليف', shipping: 'شحن', customs: 'جمارك', returns: 'مرتجع', other: 'أخرى' };
        return `
          <tr>
            <td>${e.date}</td>
            <td><span class="badge bg-purple-soft text-purple">${catMap[e.category] || e.category}</span></td>
            <td>${e.description || '-'}</td>
            <td class="fw-bold text-dark">${Calculations.formatCurrency(e.amount)} ${e.currency}</td>
            <td>
              <button class="btn btn-sm btn-outline-danger py-0 px-2 rounded-circle" onclick="Expenses.deleteExpense('${e.id}')" title="حذف">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // تجهيز زر إغلاق البزنس
    const closeBtn = document.getElementById('biz-action-close-btn');
    if (biz.status === 'closed') {
      closeBtn.className = 'btn btn-outline-success rounded-pill';
      closeBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise me-1"></i> إعادة فتح البزنس';
      closeBtn.onclick = () => Businesses.reopenBusiness(businessId);
    } else {
      closeBtn.className = 'btn btn-outline-danger rounded-pill';
      closeBtn.innerHTML = '<i class="bi bi-archive me-1"></i> إغلاق البزنس وأرشفته';
      closeBtn.onclick = () => Businesses.openCloseModal(businessId);
    }

    // تجهيز أزرار الإجراءات
    document.getElementById('biz-action-add-sale').onclick = () => {
      const modal = bootstrap.Modal.getInstance(document.getElementById('businessDetailsModal'));
      if (modal) modal.hide();
      Sales.openAddSaleModal(businessId);
    };

    document.getElementById('biz-action-add-exp').onclick = () => {
      const modal = bootstrap.Modal.getInstance(document.getElementById('businessDetailsModal'));
      if (modal) modal.hide();
      Expenses.openAddExpenseModal(businessId);
    };

    document.getElementById('biz-action-edit-btn').onclick = () => {
      const modal = bootstrap.Modal.getInstance(document.getElementById('businessDetailsModal'));
      if (modal) modal.hide();
      Businesses.openEditForm(businessId);
    };

    const detailsModal = new bootstrap.Modal(document.getElementById('businessDetailsModal'));
    detailsModal.show();
  },

  /**
   * فتح نموذج إضافة/تعديل البزنس
   */
  async openEditForm(businessId = null) {
    const form = document.getElementById('business-form');
    form.reset();
    document.getElementById('form-edit-business-id').value = businessId || '';

    if (businessId) {
      document.getElementById('business-form-title').textContent = 'تعديل بيانات البزنس';
      const biz = await Database.getBusinessById(businessId);
      if (biz) {
        document.getElementById('biz-name-input').value = biz.name || '';
        document.getElementById('biz-product-name').value = biz.productName || '';
        document.getElementById('biz-location').value = biz.purchaseLocation || 'libya';
        document.getElementById('biz-purchase-date').value = biz.purchaseDate || '';
        document.getElementById('biz-total-units').value = biz.totalUnits || '';
        document.getElementById('biz-description').value = biz.description || '';

        // التكاليف
        document.getElementById('biz-currency').value = biz.currency || 'LYD';
        document.getElementById('biz-cost-lyd').value = biz.costInLYD || '';
        document.getElementById('biz-cost-usd').value = biz.costInUSD || '';
        document.getElementById('biz-exchange-rate').value = biz.exchangeRate || '';
        document.getElementById('biz-shipping-cost').value = biz.shippingCost || '';
        document.getElementById('biz-customs-cost').value = biz.customsCost || '';
        document.getElementById('biz-additional-cost').value = biz.additionalCost || '';

        // الإعلانات
        const adsCheck = document.getElementById('biz-enable-ads');
        adsCheck.checked = !!biz.enableAds;
        document.getElementById('biz-ad-budget').value = biz.adBudget || '';
        document.getElementById('biz-ad-currency').value = biz.adCurrency || 'USD';
        document.getElementById('biz-ad-spent').value = biz.adSpent || '';

        this.toggleCurrencyInputs();
        this.toggleAdsFields();
        this.updateLiveCostSummary();
      }
    } else {
      document.getElementById('business-form-title').textContent = 'إضافة بزنس جديد';
      document.getElementById('biz-purchase-date').value = new Date().toISOString().split('T')[0];
      this.toggleCurrencyInputs();
      this.toggleAdsFields();
      this.updateLiveCostSummary();
    }

    App.navigateTo('add-business');
  },

  /**
   * تبديل حقول العملة وحساب التكاليف فورياً
   */
  toggleCurrencyInputs() {
    const currency = document.getElementById('biz-currency').value;
    const usdGroup = document.getElementById('biz-usd-group');
    const lydGroup = document.getElementById('biz-lyd-group');
    if (currency === 'USD') {
      usdGroup.style.display = 'block';
      lydGroup.style.display = 'none';
    } else {
      usdGroup.style.display = 'none';
      lydGroup.style.display = 'block';
    }
  },

  toggleAdsFields() {
    const enabled = document.getElementById('biz-enable-ads').checked;
    document.getElementById('biz-ads-container').style.display = enabled ? 'block' : 'none';
  },

  /**
   * حساب الملخص الحي للتكلفة قبل الحفظ لمنع الأخطاء
   */
  updateLiveCostSummary() {
    const currency = document.getElementById('biz-currency').value;
    const costInLYD = document.getElementById('biz-cost-lyd').value;
    const costInUSD = document.getElementById('biz-cost-usd').value;
    const exchangeRate = document.getElementById('biz-exchange-rate').value;
    const shippingCost = document.getElementById('biz-shipping-cost').value;
    const customsCost = document.getElementById('biz-customs-cost').value;
    const additionalCost = document.getElementById('biz-additional-cost').value;
    const totalUnits = document.getElementById('biz-total-units').value;

    const costBreakdown = Calculations.calculateTotalInitialCost({
      currency,
      costInLYD,
      costInUSD,
      exchangeRate,
      shippingCost,
      customsCost,
      additionalCost
    });

    const unitCost = Calculations.calculateUnitCost(costBreakdown.totalCostLYD, totalUnits);

    document.getElementById('live-summary-base-cost').textContent = Calculations.formatCurrency(costBreakdown.baseInventoryCostLYD);
    document.getElementById('live-summary-shipping').textContent = Calculations.formatCurrency(costBreakdown.shippingCost);
    document.getElementById('live-summary-customs').textContent = Calculations.formatCurrency(costBreakdown.customsCost);
    document.getElementById('live-summary-total-cost').textContent = Calculations.formatCurrency(costBreakdown.totalCostLYD);
    document.getElementById('live-summary-unit-cost').textContent = Calculations.formatCurrency(unitCost);
    document.getElementById('live-summary-units').textContent = `${parseInt(totalUnits, 10) || 0} قطعة`;

    return { costBreakdown, unitCost };
  },

  /**
   * حفظ البزنس
   */
  async handleSaveBusiness(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('biz-submit-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> جارِ الحفظ...';

    try {
      const existingId = document.getElementById('form-edit-business-id').value;
      const { costBreakdown, unitCost } = this.updateLiveCostSummary();

      // معالجة صورة المنتج إن وجدت
      const imageFileInput = document.getElementById('biz-image-file');
      let imageUrl = null;
      if (imageFileInput && imageFileInput.files && imageFileInput.files[0]) {
        imageUrl = await Database.uploadImage(imageFileInput.files[0]);
      } else if (existingId) {
        const old = await Database.getBusinessById(existingId);
        if (old) imageUrl = old.productImage;
      }

      const businessData = {
        name: document.getElementById('biz-name-input').value.trim(),
        productName: document.getElementById('biz-product-name').value.trim(),
        purchaseLocation: document.getElementById('biz-location').value,
        purchaseDate: document.getElementById('biz-purchase-date').value,
        totalUnits: parseInt(document.getElementById('biz-total-units').value, 10) || 0,
        description: document.getElementById('biz-description').value.trim(),
        productImage: imageUrl,

        // التكاليف
        currency: document.getElementById('biz-currency').value,
        costInLYD: parseFloat(document.getElementById('biz-cost-lyd').value) || 0,
        costInUSD: parseFloat(document.getElementById('biz-cost-usd').value) || 0,
        exchangeRate: parseFloat(document.getElementById('biz-exchange-rate').value) || 1,
        shippingCost: parseFloat(document.getElementById('biz-shipping-cost').value) || 0,
        customsCost: parseFloat(document.getElementById('biz-customs-cost').value) || 0,
        additionalCost: parseFloat(document.getElementById('biz-additional-cost').value) || 0,

        totalCostLYD: costBreakdown.totalCostLYD,
        unitCost: unitCost,

        // الإعلانات
        enableAds: document.getElementById('biz-enable-ads').checked,
        adBudget: parseFloat(document.getElementById('biz-ad-budget').value) || 0,
        adCurrency: document.getElementById('biz-ad-currency').value,
        adSpent: parseFloat(document.getElementById('biz-ad-spent').value) || 0
      };

      await Database.saveBusiness(businessData, existingId || null);

      App.showToast(existingId ? 'تم تحديث بيانات البزنس بنجاح!' : 'تم حفظ البزنس الجديد بنجاح!', 'success');
      App.navigateTo('active-businesses');
    } catch (err) {
      console.error(err);
      App.showToast('حدث خطأ أثناء حفظ البزنس. يرجى المحاولة ثانية.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i> حفظ وتثبيت البزنس';
    }
  },

  /**
   * نافذة إغلاق البزنس
   */
  async openCloseModal(businessId) {
    const biz = await Database.getBusinessById(businessId);
    if (!biz) return;

    const sales = await Database.getAllSales(businessId);
    const expenses = await Database.getAllExpenses(businessId);
    const summary = Calculations.calculateBusinessSummary(biz, sales, expenses);

    document.getElementById('close-modal-biz-name').textContent = biz.name;
    document.getElementById('close-modal-remaining-units').textContent = `${summary.remainingUnits} قطعة`;
    document.getElementById('close-modal-remaining-val').textContent = Calculations.formatCurrency(summary.remainingStockValue);
    document.getElementById('close-modal-net-profit').textContent = Calculations.formatCurrency(summary.netProfitOrLoss);
    document.getElementById('close-modal-net-profit').className = summary.isProfit ? 'fw-bold text-profit' : 'fw-bold text-loss';

    document.getElementById('confirm-close-biz-btn').onclick = async () => {
      const notes = document.getElementById('close-modal-notes').value.trim();
      await Database.updateBusinessStatus(businessId, 'closed', notes);
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('closeBusinessModal'));
      if (modal) modal.hide();
      
      const detailsModal = bootstrap.Modal.getInstance(document.getElementById('businessDetailsModal'));
      if (detailsModal) detailsModal.hide();

      App.showToast('تم إغلاق البزنس ونقله إلى الأرشيف بنجاح.', 'success');
      App.navigateTo('archive');
    };

    const modal = new bootstrap.Modal(document.getElementById('closeBusinessModal'));
    modal.show();
  },

  async reopenBusiness(businessId) {
    if (confirm('هل ترغبين بالتأكيد في إعادة فتح هذا البزنس ونقله إلى البزنسات النشطة؟')) {
      await Database.updateBusinessStatus(businessId, 'active');
      const detailsModal = bootstrap.Modal.getInstance(document.getElementById('businessDetailsModal'));
      if (detailsModal) detailsModal.hide();
      App.showToast('تمت إعادة فتح البزنس بنجاح!', 'success');
      App.navigateTo('active-businesses');
    }
  }
};

window.Businesses = Businesses;
