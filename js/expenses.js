/**
 * expenses.js
 * إدارة المصروفات العامة (إعلانات، شحن، تغليف، جمارك، إلخ)
 */

const Expenses = {
  async renderExpensesView() {
    const tableBody = document.getElementById('all-expenses-table-body');
    if (!tableBody) return;

    try {
      const expenses = await Database.getAllExpenses();
      const businesses = await Database.getAllBusinesses();
      const bizMap = {};
      businesses.forEach(b => bizMap[b.id] = b);

      // تحديث فلتر البزنس
      const filterBiz = document.getElementById('expense-filter-business');
      if (filterBiz) {
        const cur = filterBiz.value;
        filterBiz.innerHTML = '<option value="">جميع البزنسات</option>' +
          businesses.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        filterBiz.value = cur;
      }

      const selectedBiz = filterBiz ? filterBiz.value : '';
      const filterCategory = document.getElementById('expense-filter-category');
      const selectedCat = filterCategory ? filterCategory.value : '';

      const filtered = expenses.filter(e => {
        if (selectedBiz && e.businessId !== selectedBiz) return false;
        if (selectedCat && e.category !== selectedCat) return false;
        return true;
      });

      if (filtered.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-5 text-muted">
              <i class="bi bi-wallet2 fs-2 d-block text-pink-soft mb-2"></i>
              لا توجد مصروفات مسجلة
            </td>
          </tr>
        `;
        return;
      }

      const catMap = {
        ads: { label: 'إعلانات ممولة', badge: 'bg-pink-soft text-pink' },
        packaging: { label: 'تغليف وتعبئة', badge: 'bg-purple-soft text-purple' },
        shipping: { label: 'شحن وتوصيل', badge: 'bg-info-soft text-info' },
        customs: { label: 'جمارك ورسوم', badge: 'bg-warning-soft text-warning' },
        returns: { label: 'مرتجع وتعويض', badge: 'bg-danger-soft text-danger' },
        other: { label: 'أخرى', badge: 'bg-secondary-soft text-secondary' }
      };

      tableBody.innerHTML = filtered.map(e => {
        const biz = bizMap[e.businessId] || { name: 'عام / غير محدد' };
        const catInfo = catMap[e.category] || catMap.other;
        const rate = parseFloat(e.exchangeRate) || 1;
        const amt = parseFloat(e.amount) || 0;
        const amtLYD = e.currency === 'USD' ? amt * rate : amt;

        return `
          <tr>
            <td><small class="text-muted">${e.date}</small></td>
            <td class="fw-bold">${biz.name}</td>
            <td><span class="badge ${catInfo.badge}">${catInfo.label}</span></td>
            <td>${e.description || '-'}</td>
            <td>${amt} ${e.currency} ${e.currency === 'USD' ? `<small class="text-muted d-block">(صرف: ${rate})</small>` : ''}</td>
            <td class="fw-bold text-dark">${Calculations.formatCurrency(amtLYD)}</td>
            <td>
              <button class="btn btn-sm btn-outline-danger py-0 px-2 rounded-circle" onclick="Expenses.deleteExpense('${e.id}')" title="حذف">
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

  async openAddExpenseModal(businessId = null) {
    const modalEl = document.getElementById('expenseModal');
    const form = document.getElementById('expense-form');
    form.reset();

    const businesses = await Database.getAllBusinesses();
    const selectEl = document.getElementById('expense-business-select');
    selectEl.innerHTML = '<option value="">-- اختاري البزنس --</option>' +
      businesses.map(b => `<option value="${b.id}">${b.name} (${b.productName})</option>`).join('');

    if (businessId) {
      selectEl.value = businessId;
      selectEl.disabled = true;
    } else {
      selectEl.disabled = false;
    }

    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('expense-currency').value = 'LYD';
    document.getElementById('expense-usd-rate-group').style.display = 'none';

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  },

  toggleCurrency() {
    const curr = document.getElementById('expense-currency').value;
    const rateGroup = document.getElementById('expense-usd-rate-group');
    rateGroup.style.display = curr === 'USD' ? 'block' : 'none';
  },

  async handleSaveExpense(e) {
    e.preventDefault();
    const selectEl = document.getElementById('expense-business-select');
    const businessId = selectEl.value;
    const category = document.getElementById('expense-category').value;
    const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
    const currency = document.getElementById('expense-currency').value;
    const exchangeRate = parseFloat(document.getElementById('expense-exchange-rate').value) || 1;
    const date = document.getElementById('expense-date').value;
    const description = document.getElementById('expense-description').value.trim();

    if (!businessId) {
      App.showToast('يرجى تحديد البزنس', 'error');
      return;
    }

    const submitBtn = document.getElementById('expense-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> جارِ الحفظ...';

    try {
      await Database.addExpense({
        businessId,
        category,
        amount,
        currency,
        exchangeRate,
        date,
        description
      });

      const modal = bootstrap.Modal.getInstance(document.getElementById('expenseModal'));
      if (modal) modal.hide();

      App.showToast('تم تسجيل المصروف بنجاح!', 'success');
      App.refreshCurrentView();
    } catch (err) {
      console.error(err);
      App.showToast('حدث خطأ أثناء حفظ المصروف', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> حفظ المصروف';
    }
  },

  async deleteExpense(id) {
    if (confirm('هل أنتِ متأكدة من حذف هذا المصروف؟ سيتم تعديل الحسابات المالية تلقائياً.')) {
      await Database.deleteExpense(id);
      App.showToast('تم حذف المصروف بنجاح.', 'success');
      App.refreshCurrentView();
    }
  }
};

window.Expenses = Expenses;
