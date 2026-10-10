/**
 * database.js
 * طبقة الوصول للبيانات Data Access Layer (DAL)
 * تستخدم Firebase Realtime Database (RTDB) بالكامل:
 * ref(), set(), get(), update(), remove(), push(), onValue() (on('value'))
 * مع دعم التحديث اللحظي المباشر (Realtime Listeners) والتخزين المحلي الاحتياطي
 */

const Database = {
  // مسارات العقد الرئيسية في Realtime Database
  PATHS: {
    BUSINESSES: 'businesses',
    SALES: 'sales',
    EXPENSES: 'expenses',
    SETTINGS: 'settings'
  },

  _realtimeListenersAttached: false,
  _lastCloudState: null,

  // التحقق إن كانت إعدادات Firebase مهيأة وصالحة للاتصال بـ Realtime Database
  canUseRTDB() {
    const config = FirebaseApp.getConfig();
    const isDummy = !config.apiKey || config.apiKey.includes('DummyKey');
    const auth = FirebaseApp.getAuth();
    const db = FirebaseApp.getDb();
    return FirebaseApp.isInitialized() && !isDummy && db && auth && auth.currentUser;
  },

  /**
   * فحص حالة الاتصال الحقيقي بسحابة Firebase والأذونات
   */
  async checkCloudStatus() {
    if (!this.canUseRTDB()) {
      this._lastCloudState = { online: false, reason: 'غير مسجل الدخول في Firebase أو التهيئة غير مكتملة' };
      return this._lastCloudState;
    }
    try {
      const db = FirebaseApp.getDb();
      // محاولة قراءة خفيفة للتحقق من صلاحية القواعد (Rules) والاتصال
      await db.ref(this.PATHS.BUSINESSES).limitToFirst(1).get();
      this._lastCloudState = { online: true };
      return this._lastCloudState;
    } catch (err) {
      console.warn('Firebase RTDB permission/connection check failed:', err);
      const isPermission = err.message && (err.message.includes('Permission denied') || err.message.includes('permission_denied'));
      this._lastCloudState = {
        online: false,
        permissionDenied: isPermission,
        reason: isPermission 
          ? 'تم رفض الإذن (Permission Denied). يرجى مراجعة قواعد الأمان Rules في Firebase.'
          : (err.message || 'فشل الاتصال بقاعدة البيانات')
      };
      return this._lastCloudState;
    }
  },

  /**
   * مزامنة ونقل كافة البيانات المخزنة محلياً على هذا الجهاز إلى سحابة Firebase
   */
  async syncLocalDataToCloud() {
    if (!this.canUseRTDB()) {
      return {
        success: false,
        error: 'يجب تسجيل الدخول بحساب Firebase المصرح له أولاً لإتمام المزامنة السحابية.'
      };
    }

    try {
      const db = FirebaseApp.getDb();
      let syncedBizCount = 0;
      let syncedSalesCount = 0;
      let syncedExpCount = 0;

      // 1. مزامنة البزنسات
      const localBiz = JSON.parse(localStorage.getItem('bm_local_businesses') || '[]');
      for (const biz of localBiz) {
        const id = (biz.id && !biz.id.startsWith('biz_')) ? biz.id : db.ref(this.PATHS.BUSINESSES).push().key;
        const toSave = { ...biz, id };
        await db.ref(`${this.PATHS.BUSINESSES}/${id}`).set(toSave);
        syncedBizCount++;
      }

      // 2. مزامنة المبيعات
      const localSales = JSON.parse(localStorage.getItem('bm_local_sales') || '[]');
      for (const sale of localSales) {
        const id = (sale.id && !sale.id.startsWith('sale_')) ? sale.id : db.ref(this.PATHS.SALES).push().key;
        const toSave = { ...sale, id };
        await db.ref(`${this.PATHS.SALES}/${id}`).set(toSave);
        syncedSalesCount++;
      }

      // 3. مزامنة المصروفات
      const localExp = JSON.parse(localStorage.getItem('bm_local_expenses') || '[]');
      for (const exp of localExp) {
        const id = (exp.id && !exp.id.startsWith('exp_')) ? exp.id : db.ref(this.PATHS.EXPENSES).push().key;
        const toSave = { ...exp, id };
        await db.ref(`${this.PATHS.EXPENSES}/${id}`).set(toSave);
        syncedExpCount++;
      }

      return {
        success: true,
        counts: {
          businesses: syncedBizCount,
          sales: syncedSalesCount,
          expenses: syncedExpCount
        }
      };
    } catch (err) {
      console.error('Sync to cloud error:', err);
      return {
        success: false,
        error: err.message || 'حدث خطأ أثناء رفع البيانات إلى Firebase'
      };
    }
  },

  /**
   * ربط مستمعات التحديث اللحظي (Realtime Listeners)
   * عند حدوث أي إضافة أو تعديل أو حذف في قاعدة البيانات السحابية،
   * تتحدث واجهة المستخدم فوراً دون الحاجة لتحديث الصفحة
   */
  initRealtimeSync(onDataChangeCallback) {
    if (this._realtimeListenersAttached) return;

    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();

        // مراقبة مسار البزنسات لحظياً
        const bizRef = db.ref(this.PATHS.BUSINESSES);
        bizRef.on('value', (snapshot) => {
          console.log('RTDB Realtime Update: Businesses changed');
          if (onDataChangeCallback) onDataChangeCallback('businesses');
        });

        // مراقبة مسار المبيعات لحظياً
        const salesRef = db.ref(this.PATHS.SALES);
        salesRef.on('value', (snapshot) => {
          console.log('RTDB Realtime Update: Sales changed');
          if (onDataChangeCallback) onDataChangeCallback('sales');
        });

        // مراقبة مسار المصروفات لحظياً
        const expRef = db.ref(this.PATHS.EXPENSES);
        expRef.on('value', (snapshot) => {
          console.log('RTDB Realtime Update: Expenses changed');
          if (onDataChangeCallback) onDataChangeCallback('expenses');
        });

        this._realtimeListenersAttached = true;
      } catch (err) {
        console.warn('Failed to bind RTDB realtime listeners:', err);
      }
    }
  },

  // =========================================================================
  // 1. إدارة البزنسات BUSINESSES (Realtime Database)
  // =========================================================================
  async getAllBusinesses() {
    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();
        const bizRef = db.ref(this.PATHS.BUSINESSES);
        const snapshot = await bizRef.get();
        if (snapshot.exists()) {
          const data = snapshot.val();
          const list = [];
          Object.keys(data).forEach(key => {
            list.push({ id: key, ...data[key] });
          });
          // ترتيب حسب تاريخ الإنشاء تنازلياً
          return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }
        return [];
      } catch (err) {
        console.warn('RTDB getAllBusinesses failed, using fallback:', err);
      }
    }

    // Fallback LocalStorage
    const local = localStorage.getItem('bm_local_businesses');
    return local ? JSON.parse(local) : [];
  },

  async getBusinessById(id) {
    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();
        const docRef = db.ref(`${this.PATHS.BUSINESSES}/${id}`);
        const snapshot = await docRef.get();
        if (snapshot.exists()) {
          return { id, ...snapshot.val() };
        }
      } catch (err) {
        console.warn('RTDB getBusinessById error:', err);
      }
    }
    const all = await this.getAllBusinesses();
    return all.find(b => b.id === id) || null;
  },

  async saveBusiness(businessData, existingId = null) {
    const now = new Date().toISOString();
    const item = {
      ...businessData,
      updatedAt: now
    };

    let savedToCloud = false;
    let cloudError = null;

    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();
        if (existingId) {
          const bizRef = db.ref(`${this.PATHS.BUSINESSES}/${existingId}`);
          await bizRef.update(item);
          savedToCloud = true;
          this._updateLocalBusinessCache({ id: existingId, ...item });
          return { id: existingId, ...item, savedToCloud: true };
        } else {
          item.createdAt = now;
          item.status = item.status || 'active';
          const newRef = db.ref(this.PATHS.BUSINESSES).push();
          const newId = newRef.key;
          await newRef.set(item);
          savedToCloud = true;
          this._updateLocalBusinessCache({ id: newId, ...item });
          return { id: newId, ...item, savedToCloud: true };
        }
      } catch (err) {
        console.warn('RTDB saveBusiness failed, falling back to local storage:', err);
        cloudError = err.message || 'فشل الاتصال بـ Firebase أو تم رفض الإذن';
      }
    } else {
      cloudError = 'المستخدم غير مسجل الدخول في Firebase';
    }

    // Local Storage Mode
    const list = await this.getAllBusinesses();
    let savedItem;
    if (existingId) {
      const idx = list.findIndex(b => b.id === existingId);
      if (idx !== -1) {
        savedItem = { ...list[idx], ...item };
        list[idx] = savedItem;
      } else {
        savedItem = { id: existingId, ...item };
        list.push(savedItem);
      }
    } else {
      const newId = 'biz_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      item.id = newId;
      item.createdAt = now;
      item.status = item.status || 'active';
      savedItem = item;
      list.unshift(savedItem);
    }
    localStorage.setItem('bm_local_businesses', JSON.stringify(list));
    return { ...savedItem, savedToCloud: false, cloudError };
  },

  _updateLocalBusinessCache(item) {
    try {
      const local = localStorage.getItem('bm_local_businesses');
      const list = local ? JSON.parse(local) : [];
      const idx = list.findIndex(b => b.id === item.id);
      if (idx !== -1) {
        list[idx] = item;
      } else {
        list.unshift(item);
      }
      localStorage.setItem('bm_local_businesses', JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to update local cache', e);
    }
  },

  async updateBusinessStatus(id, newStatus, closeNotes = '') {
    const updatePayload = {
      status: newStatus,
      statusUpdatedAt: new Date().toISOString()
    };
    if (newStatus === 'closed') {
      updatePayload.closedAt = new Date().toISOString();
      updatePayload.closeNotes = closeNotes;
    } else if (newStatus === 'active') {
      updatePayload.reopenedAt = new Date().toISOString();
    }

    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();
        const bizRef = db.ref(`${this.PATHS.BUSINESSES}/${id}`);
        await bizRef.update(updatePayload);
        return true;
      } catch (e) {
        console.warn('RTDB update status failed, fallback to local:', e);
      }
    }

    const list = await this.getAllBusinesses();
    const idx = list.findIndex(b => b.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updatePayload };
      localStorage.setItem('bm_local_businesses', JSON.stringify(list));
      return true;
    }
    return false;
  },

  async deleteBusiness(id) {
    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();
        // حذف البزنس
        await db.ref(`${this.PATHS.BUSINESSES}/${id}`).remove();

        // حذف المبيعات المرتبطة به
        const salesSnap = await db.ref(this.PATHS.SALES).orderByChild('businessId').equalTo(id).get();
        if (salesSnap.exists()) {
          const salesData = salesSnap.val();
          for (const sId of Object.keys(salesData)) {
            await db.ref(`${this.PATHS.SALES}/${sId}`).remove();
          }
        }

        // حذف المصروفات المرتبطة به
        const expSnap = await db.ref(this.PATHS.EXPENSES).orderByChild('businessId').equalTo(id).get();
        if (expSnap.exists()) {
          const expData = expSnap.val();
          for (const eId of Object.keys(expData)) {
            await db.ref(`${this.PATHS.EXPENSES}/${eId}`).remove();
          }
        }
      } catch (e) {
        console.warn('RTDB deleteBusiness error:', e);
      }
    }

    const list = await this.getAllBusinesses();
    const filtered = list.filter(b => b.id !== id);
    localStorage.setItem('bm_local_businesses', JSON.stringify(filtered));

    const sales = await this.getAllSales();
    const filteredSales = sales.filter(s => s.businessId !== id);
    localStorage.setItem('bm_local_sales', JSON.stringify(filteredSales));

    const expenses = await this.getAllExpenses();
    const filteredExpenses = expenses.filter(e => e.businessId !== id);
    localStorage.setItem('bm_local_expenses', JSON.stringify(filteredExpenses));
    return true;
  },

  // =========================================================================
  // 2. إدارة المبيعات SALES (Realtime Database)
  // =========================================================================
  async getAllSales(businessId = null) {
    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();
        let salesRef = db.ref(this.PATHS.SALES);
        let snapshot;
        if (businessId) {
          snapshot = await salesRef.orderByChild('businessId').equalTo(businessId).get();
        } else {
          snapshot = await salesRef.get();
        }

        if (snapshot.exists()) {
          const data = snapshot.val();
          const list = [];
          Object.keys(data).forEach(key => {
            list.push({ id: key, ...data[key] });
          });
          return list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        }
        return [];
      } catch (err) {
        console.warn('RTDB getAllSales error, fallback:', err);
      }
    }

    const local = localStorage.getItem('bm_local_sales');
    let list = local ? JSON.parse(local) : [];
    if (businessId) {
      list = list.filter(s => s.businessId === businessId);
    }
    return list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  },

  async addSale(saleData) {
    const now = new Date().toISOString();
    const item = {
      ...saleData,
      createdAt: now
    };

    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();
        const newRef = db.ref(this.PATHS.SALES).push();
        const newId = newRef.key;
        await newRef.set(item);
        return { id: newId, ...item };
      } catch (err) {
        console.warn('RTDB addSale failed, fallback:', err);
      }
    }

    const list = await this.getAllSales();
    const newId = 'sale_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const saved = { id: newId, ...item };
    list.unshift(saved);
    localStorage.setItem('bm_local_sales', JSON.stringify(list));
    return saved;
  },

  async updateSale(id, saleData) {
    const now = new Date().toISOString();
    const item = { ...saleData, updatedAt: now };

    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();
        await db.ref(`${this.PATHS.SALES}/${id}`).update(item);
        return { id, ...item };
      } catch (err) {
        console.warn('RTDB updateSale error:', err);
      }
    }

    const list = await this.getAllSales();
    const idx = list.findIndex(s => s.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...item };
      localStorage.setItem('bm_local_sales', JSON.stringify(list));
      return list[idx];
    }
    return null;
  },

  async deleteSale(id) {
    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();
        await db.ref(`${this.PATHS.SALES}/${id}`).remove();
      } catch (e) {
        console.warn('RTDB deleteSale error:', e);
      }
    }
    const list = await this.getAllSales();
    const filtered = list.filter(s => s.id !== id);
    localStorage.setItem('bm_local_sales', JSON.stringify(filtered));
    return true;
  },

  // =========================================================================
  // 3. إدارة المصروفات EXPENSES (Realtime Database)
  // =========================================================================
  async getAllExpenses(businessId = null) {
    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();
        let expRef = db.ref(this.PATHS.EXPENSES);
        let snapshot;
        if (businessId) {
          snapshot = await expRef.orderByChild('businessId').equalTo(businessId).get();
        } else {
          snapshot = await expRef.get();
        }

        if (snapshot.exists()) {
          const data = snapshot.val();
          const list = [];
          Object.keys(data).forEach(key => {
            list.push({ id: key, ...data[key] });
          });
          return list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        }
        return [];
      } catch (err) {
        console.warn('RTDB getAllExpenses error:', err);
      }
    }

    const local = localStorage.getItem('bm_local_expenses');
    let list = local ? JSON.parse(local) : [];
    if (businessId) {
      list = list.filter(e => e.businessId === businessId);
    }
    return list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  },

  async addExpense(expenseData) {
    const now = new Date().toISOString();
    const item = {
      ...expenseData,
      createdAt: now
    };

    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();
        const newRef = db.ref(this.PATHS.EXPENSES).push();
        const newId = newRef.key;
        await newRef.set(item);
        return { id: newId, ...item };
      } catch (err) {
        console.warn('RTDB addExpense error:', err);
      }
    }

    const list = await this.getAllExpenses();
    const newId = 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const saved = { id: newId, ...item };
    list.unshift(saved);
    localStorage.setItem('bm_local_expenses', JSON.stringify(list));
    return saved;
  },

  async updateExpense(id, expenseData) {
    const now = new Date().toISOString();
    const item = { ...expenseData, updatedAt: now };

    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();
        await db.ref(`${this.PATHS.EXPENSES}/${id}`).update(item);
        return { id, ...item };
      } catch (err) {
        console.warn('RTDB updateExpense error:', err);
      }
    }

    const list = await this.getAllExpenses();
    const idx = list.findIndex(e => e.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...item };
      localStorage.setItem('bm_local_expenses', JSON.stringify(list));
      return list[idx];
    }
    return null;
  },

  async deleteExpense(id) {
    if (this.canUseRTDB()) {
      try {
        const db = FirebaseApp.getDb();
        await db.ref(`${this.PATHS.EXPENSES}/${id}`).remove();
      } catch (e) {
        console.warn('RTDB deleteExpense error:', e);
      }
    }
    const list = await this.getAllExpenses();
    const filtered = list.filter(e => e.id !== id);
    localStorage.setItem('bm_local_expenses', JSON.stringify(filtered));
    return true;
  },

  // =========================================================================
  // 4. رفع الصور وتخزينها (Firebase Storage أو Base64)
  // =========================================================================
  async uploadImage(file, pathPrefix = 'products') {
    if (!file) return null;

    if (this.canUseRTDB() && FirebaseApp.getStorage()) {
      try {
        const storage = FirebaseApp.getStorage();
        const ext = file.name.split('.').pop() || 'png';
        const filename = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
        const ref = storage.ref().child(filename);
        const snapshot = await ref.put(file);
        const downloadUrl = await snapshot.ref.getDownloadURL();
        return downloadUrl;
      } catch (err) {
        console.warn('Firebase Storage upload failed, converting to compressed data URL:', err);
      }
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
};

window.Database = Database;
