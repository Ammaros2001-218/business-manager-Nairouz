/**
 * archive.js
 * أرشيف البزنسات المغلقة، البحث والفرز، وإمكانية إعادة التنشيط
 */

const Archive = {
  async renderArchiveList() {
    const container = document.getElementById('archive-list-container');
    if (!container) return;

    try {
      const allBusinesses = await Database.getAllBusinesses();
      const closedList = allBusinesses.filter(b => b.status === 'closed');
      const sales = await Database.getAllSales();
      const expenses = await Database.getAllExpenses();

      const searchInput = document.getElementById('archive-search-input');
      const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

      const sortSelect = document.getElementById('archive-sort-select');
      const sortBy = sortSelect ? sortSelect.value : 'date-desc';

      let filtered = closedList.filter(b => {
        if (!searchTerm) return true;
        return (b.name && b.name.toLowerCase().includes(searchTerm)) ||
               (b.productName && b.productName.toLowerCase().includes(searchTerm));
      });

      // الفرز
      filtered.sort((a, b) => {
        const aSales = sales.filter(s => s.businessId === a.id);
        const aExp = expenses.filter(e => e.businessId === a.id);
        const aSum = Calculations.calculateBusinessSummary(a, aSales, aExp);

        const bSales = sales.filter(s => s.businessId === b.id);
        const bExp = expenses.filter(e => e.businessId === b.id);
        const bSum = Calculations.calculateBusinessSummary(b, bSales, bExp);

        if (sortBy === 'profit-desc') {
          return bSum.netProfitOrLoss - aSum.netProfitOrLoss;
        } else if (sortBy === 'profit-asc') {
          return aSum.netProfitOrLoss - bSum.netProfitOrLoss;
        } else if (sortBy === 'name-asc') {
          return (a.name || '').localeCompare(b.name || '');
        } else {
          return new Date(b.closedAt || b.createdAt) - new Date(a.closedAt || a.createdAt);
        }
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="col-12 text-center py-5">
            <div class="empty-state-box p-5 rounded-4 bg-white shadow-sm border text-center">
              <i class="bi bi-archive display-4 text-pink-soft mb-3 d-block"></i>
              <h5 class="fw-bold mb-2">لا توجد مشاريع في الأرشيف</h5>
              <p class="text-muted">المشاريع المغلقة والمكتملة ستظهر هنا مع سجلها المالي الكامل للرجوع إليها مستقبلاً.</p>
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
        const profitClass = summary.isProfit ? 'text-profit' : 'text-loss';

        return `
          <div class="col-md-6 col-lg-4 mb-4">
            <div class="card archive-card h-100 border-0 shadow-sm rounded-4 overflow-hidden position-relative">
              <div class="card-img-wrapper position-relative">
                <img src="${imgSrc}" class="card-img-top object-fit-cover filter-grayscale" style="height: 180px;" alt="${biz.name}">
                <div class="position-absolute top-0 end-0 p-3">
                  <span class="badge bg-secondary"><i class="bi bi-lock me-1"></i>مغلق ومؤرشف</span>
                </div>
                <div class="position-absolute bottom-0 start-0 w-100 p-3 bg-gradient-dark text-white">
                  <h5 class="card-title fw-bold mb-0">${biz.name}</h5>
                  <small class="text-white-50"><i class="bi bi-calendar-x me-1"></i>أُغلق في: ${biz.closedAt ? biz.closedAt.split('T')[0] : 'سابقاً'}</small>
                </div>
              </div>

              <div class="card-body p-4">
                <div class="row g-2 mb-3 text-sm">
                  <div class="col-6">
                    <span class="text-muted d-block text-xs">القطع المباعة</span>
                    <span class="fw-bold">${summary.soldUnits} من ${summary.totalUnits} قطعة</span>
                  </div>
                  <div class="col-6">
                    <span class="text-muted d-block text-xs">المخزون المتبقي</span>
                    <span class="fw-bold ${summary.remainingUnits > 0 ? 'text-warning' : 'text-muted'}">${summary.remainingUnits} قطعة</span>
                  </div>
                </div>

                <div class="row g-2 text-center py-2 mb-3 bg-pink-subtle rounded-3">
                  <div class="col-6 border-end border-pink-soft">
                    <small class="text-muted d-block text-xs">إجمالي المبيعات</small>
                    <span class="fw-bold">${Calculations.formatCurrency(summary.totalSalesRevenue)}</span>
                  </div>
                  <div class="col-6">
                    <small class="text-muted d-block text-xs">صافي النتيجة</small>
                    <span class="fw-bold ${profitClass}">${Calculations.formatCurrency(summary.netProfitOrLoss)}</span>
                  </div>
                </div>

                <div class="d-flex flex-column gap-2">
                  <button class="btn btn-outline-pink w-100 rounded-pill btn-sm py-2" onclick="Businesses.openDetailsModal('${biz.id}')">
                    <i class="bi bi-receipt me-1"></i> مراجعة السجل المالي والتفاصيل
                  </button>
                  <div class="d-flex gap-2">
                    <button class="btn btn-pink-subtle text-pink flex-grow-1 rounded-pill btn-sm py-2" onclick="Businesses.reopenBusiness('${biz.id}')">
                      <i class="bi bi-arrow-counterclockwise me-1"></i> إعادة فتح
                    </button>
                    <button class="btn btn-outline-danger rounded-pill btn-sm px-3 py-2" onclick="event.stopPropagation(); Businesses.openDeleteModal('${biz.id}')" title="حذف البزنس نهائياً">
                      <i class="bi bi-trash3 me-1"></i> حذف
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  }
};

window.Archive = Archive;
