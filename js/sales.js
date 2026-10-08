/**
 * sales.js
 * إدارة عمليات البيع، منع تجاوز المخزون، والربط اللحظي مع الإحصائيات
 */

const Sales = {
  async renderAllSalesView() {
    const tableBody = document.getElementById('all-sales-table-body');
    if (!tableBody) return;

    try {
      const sales = await Database.getAllSales();
      const businesses = await Database.getAllBusinesses();
      const bizMap = {};
      businesses.forEach(b => bizMap[b.id] = b);

      // فلترة وتصفية
      const filterBiz = document.getElementById('sales-filter-business');
      if (filterBiz) {
        // تحديث خيارات الفلتر بالبزنسات
        const currentVal = filterBiz.value;
        filterBiz.innerHTML = '<option value="">جميع البزنسات</option>' +
          businesses.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        filterBiz.value = currentVal;
      }

      const selectedBizId = filterBiz ? filterBiz.value : '';
      const filteredSales = selectedBizId ? sales.filter(s => s.businessId === selectedBizId) : sales;

      if (filteredSales.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="9" class="text-center py-5 text-muted">
              <i class="bi bi-cart-x fs-2 d-block text-pink-soft mb-2"></i>
              لا توجد مبيعات مسجلة
            </td>
          </tr>
        `;
        return;
      }

      tableBody.innerHTML = filteredSales.map(s => {
        const biz = bizMap[s.businessId] || { name: 'بزنس محذوف', unitCost: 0 };
        const calc = Calculations.calculateSaleItem(s, biz.unitCost || 0);

        const statusBadge = s.paymentStatus === 'unpaid'
          ? '<span class="badge bg-danger-soft text-danger">غير مدفوع</span>'
          : s.paymentStatus === 'partial'
          ? '<span class="badge bg-warning-soft text-warning">مدفوع جزئياً</span>'
          : '<span class="badge bg-success-soft text-success">مدفوع بالكامل</span>';

        return `
          <tr>
            <td><small class="text-muted">${s.date}</small></td>
            <td class="fw-bold">${biz.name}</td>
            <td><span class="badge bg-pink-soft text-pink">${s.quantity} قطع</span></td>
            <td>${Calculations.formatCurrency(s.unitPrice)}</td>
            <td>${Calculations.formatCurrency(s.discount || 0)}</td>
            <td class="fw-bold text-pink">${Calculations.formatCurrency(calc.netTotal)}</td>
            <td class="${calc.netProfit >= 0 ? 'text-profit' : 'text-loss'} fw-bold">${Calculations.formatCurrency(calc.netProfit)}</td>
            <td>${statusBadge}</td>
            <td>
              <button class="btn btn-sm btn-outline-danger py-0 px-2 rounded-circle" onclick="Sales.deleteSale('${s.id}')" title="حذف البيع">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  },

  /**
   * فتح نافذة تسجيل عملية بيع
   */
  async openAddSaleModal(businessId = null) {
    const modalEl = document.getElementById('saleModal');
    const form = document.getElementById('sale-form');
    form.reset();

    const businesses = await Database.getAllBusinesses();
    const activeBusinesses = businesses.filter(b => b.status !== 'closed');

    const selectEl = document.getElementById('sale-business-select');
    selectEl.innerHTML = '<option value="">-- اختاري البزنس --</option>' +
      activeBusinesses.map(b => `<option value="${b.id}">${b.name} (${b.productName})</option>`).join('');

    if (businessId) {
      selectEl.value = businessId;
      selectEl.disabled = true;
    } else {
      selectEl.disabled = false;
    }

    document.getElementById('sale-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('sale-discount').value = 0;
    document.getElementById('sale-expense').value = 0;

    this.onBusinessOrQuantityChange();

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  },

  /**
   * حساب المخزون المتبقي ومنع البيع الزائد
   */
  async onBusinessOrQuantityChange() {
    const selectEl = document.getElementById('sale-business-select');
    const bId = selectEl.value;
    const stockAlert = document.getElementById('sale-stock-warning');
    const submitBtn = document.getElementById('sale-submit-btn');

    if (!bId) {
      stockAlert.style.display = 'none';
      return;
    }

    const biz = await Database.getBusinessById(bId);
    if (!biz) return;

    const sales = await Database.getAllSales(bId);
    const summary = Calculations.calculateBusinessSummary(biz, sales, []);
    const availableStock = summary.remainingUnits;

    const qtyInput = document.getElementById('sale-quantity');
    const enteredQty = parseInt(qtyInput.value, 10) || 0;

    const hintEl = document.getElementById('sale-available-stock-hint');
    hintEl.textContent = `(المتوفر بالمخزون: ${availableStock} قطعة)`;

    if (enteredQty > availableStock) {
      stockAlert.style.display = 'block';
      stockAlert.textContent = `تنبيه: الكمية المدخلة (${enteredQty}) أكبر من المخزون المتوفر (${availableStock} قطعة)!`;
      submitBtn.disabled = true;
    } else {
      stockAlert.style.display = 'none';
      submitBtn.disabled = false;
    }

    // حساب حي لإجمالي الفاتورة
    const unitPrice = parseFloat(document.getElementById('sale-unit-price').value) || 0;
    const discount = parseFloat(document.getElementById('sale-discount').value) || 0;
    const gross = enteredQty * unitPrice;
    const net = Math.max(0, gross - discount);

    document.getElementById('sale-live-net-total').textContent = Calculations.formatCurrency(net);

    // إذا لم يحدد المبلغ المدفوع بعد، نجعله مساوياً لصافي البيع تلقائياً
    const paidInput = document.getElementById('sale-paid-amount');
    if (!paidInput.dataset.manual) {
      paidInput.value = net;
    }
  },

  /**
   * حفظ عملية البيع
   */
  async handleSaveSale(e) {
    e.preventDefault();
    const selectEl = document.getElementById('sale-business-select');
    const businessId = selectEl.value;
    const qty = parseInt(document.getElementById('sale-quantity').value, 10) || 0;
    const unitPrice = parseFloat(document.getElementById('sale-unit-price').value) || 0;
    const discount = parseFloat(document.getElementById('sale-discount').value) || 0;
    const saleExpense = parseFloat(document.getElementById('sale-expense').value) || 0;
    const paidAmount = parseFloat(document.getElementById('sale-paid-amount').value) || 0;
    const paymentStatus = document.getElementById('sale-payment-status').value;
    const date = document.getElementById('sale-date').value;
    const notes = document.getElementById('sale-notes').value.trim();

    if (!businessId) {
      App.showToast('يرجى اختيار البزنس أولاً', 'error');
      return;
    }

    // فحص المخزون الفعلي مرة أخرى للأمان
    const biz = await Database.getBusinessById(businessId);
    const existingSales = await Database.getAllSales(businessId);
    const summary = Calculations.calculateBusinessSummary(biz, existingSales, []);

    if (qty > summary.remainingUnits) {
      App.showToast(`عذراً، المخزون المتوفر (${summary.remainingUnits}) لا يكفي للكمية المطلوبة (${qty})`, 'error');
      return;
    }

    const submitBtn = document.getElementById('sale-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> جارِ الحفظ...';

    try {
      await Database.addSale({
        businessId,
        quantity: qty,
        unitPrice,
        discount,
        saleExpense,
        paidAmount,
        paymentStatus,
        date,
        notes
      });

      const modal = bootstrap.Modal.getInstance(document.getElementById('saleModal'));
      if (modal) modal.hide();

      App.showToast('تم تسجيل عملية البيع وتحديث المخزون بنجاح!', 'success');
      App.refreshCurrentView();
    } catch (err) {
      console.error(err);
      App.showToast('حدث خطأ أثناء حفظ عملية البيع', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> حفظ العملية';
    }
  },

  async deleteSale(id) {
    if (confirm('هل أنتِ متأكدة من حذف عملية البيع هذه؟ ستتم استعادة القطع إلى المخزون تلقائياً.')) {
      await Database.deleteSale(id);
      App.showToast('تم حذف عملية البيع وتحديث المخزون.', 'success');
      App.refreshCurrentView();
    }
  }
};

window.Sales = Sales;
