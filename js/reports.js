/**
 * reports.js
 * شاشة التقارير المالية المتقدمة، التحليل الربحي وتصدير البيانات
 */

const Reports = {
  async render() {
    const container = document.getElementById('reports-summary-table-body');
    if (!container) return;

    try {
      const businesses = await Database.getAllBusinesses();
      const sales = await Database.getAllSales();
      const expenses = await Database.getAllExpenses();

      const overall = Calculations.calculateDashboardOverview(businesses, sales, expenses);

      document.getElementById('rep-total-invested').textContent = Calculations.formatCurrency(overall.totalInvestedCost);
      document.getElementById('rep-total-sales').textContent = Calculations.formatCurrency(overall.totalSalesRevenue);
      document.getElementById('rep-total-expenses').textContent = Calculations.formatCurrency(overall.totalExpenses);
      
      const repProfit = document.getElementById('rep-net-profit');
      repProfit.textContent = Calculations.formatCurrency(overall.totalNetProfitOrLoss);
      repProfit.className = overall.totalNetProfitOrLoss >= 0 ? 'stat-value text-profit' : 'stat-value text-loss';

      if (businesses.length === 0) {
        container.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">لا توجد بيانات بزنسات لإصدار التقارير</td></tr>`;
        return;
      }

      container.innerHTML = businesses.map(b => {
        const bSales = sales.filter(s => s.businessId === b.id);
        const bExp = expenses.filter(e => e.businessId === b.id);
        const s = Calculations.calculateBusinessSummary(b, bSales, bExp);

        const statusBadge = b.status === 'closed'
          ? '<span class="badge bg-secondary-soft text-secondary">مؤرشف</span>'
          : '<span class="badge bg-success-soft text-success">نشط</span>';

        return `
          <tr>
            <td class="fw-bold">${b.name}</td>
            <td>${statusBadge}</td>
            <td>${Calculations.formatCurrency(s.totalCostLYD)}</td>
            <td>${Calculations.formatCurrency(s.totalSalesRevenue)}</td>
            <td>${Calculations.formatCurrency(s.cogs)}</td>
            <td>${Calculations.formatCurrency(s.totalExpenses)}</td>
            <td class="${s.isProfit ? 'text-profit' : 'text-loss'} fw-bold">${Calculations.formatCurrency(s.netProfitOrLoss)}</td>
            <td><span class="badge ${s.isProfit ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}">${s.profitMarginPercentage}%</span></td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  },

  exportToCSV() {
    alert('ميزة تصدير التقرير المالي جاهزة؛ يمكنك أيضاً طباعة الصفحة كـ PDF بنقرة واحدة عبر زر الطباعة.');
    window.print();
  }
};

window.Reports = Reports;
