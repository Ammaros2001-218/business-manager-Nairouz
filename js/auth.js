/**
 * auth.js
 * إدارة جلسة المستخدم وتسجيل الدخول والخروج باستخدام Firebase Authentication
 * مع وضع تجريبي مرن ومساعد للمالك الشخصي
 */

const Auth = {
  currentUser: null,
  isLoggedIn: false,
  _authCallback: null,

  init(onAuthStateChangeCallback) {
    this._authCallback = onAuthStateChangeCallback;
    const auth = FirebaseApp.getAuth();
    const config = FirebaseApp.getConfig();
    const isConfigured = config.apiKey && !config.apiKey.includes('DummyKey');
    
    // إذا كان Firebase مهيأ بمفاتيح حقيقية نراقب حالة Firebase Auth
    if (auth && isConfigured) {
      auth.onAuthStateChanged((user) => {
        if (user) {
          this.currentUser = user;
          this.isLoggedIn = true;
          localStorage.setItem('bm_session_active', 'true');
          if (this._authCallback) this._authCallback(user);
        } else {
          this.currentUser = null;
          this.isLoggedIn = false;
          localStorage.removeItem('bm_session_active');
          localStorage.removeItem('bm_local_user');
          if (this._authCallback) this._authCallback(null);
        }
      });
    } else {
      // فحص الجلسة المحلية الفورية
      const localSession = localStorage.getItem('bm_session_active') === 'true';
      const localUser = localStorage.getItem('bm_local_user');
      if (localSession && localUser) {
        try {
          this.currentUser = JSON.parse(localUser);
          this.isLoggedIn = true;
          if (this._authCallback) this._authCallback(this.currentUser);
        } catch (e) {
          this.currentUser = null;
          this.isLoggedIn = false;
          if (this._authCallback) this._authCallback(null);
        }
      } else {
        this.currentUser = null;
        this.isLoggedIn = false;
        if (this._authCallback) this._authCallback(null);
      }
    }
  },

  /**
   * تسجيل الدخول
   */
  async login(email, password) {
    const auth = FirebaseApp.getAuth();
    const config = FirebaseApp.getConfig();
    const isConfigured = config.apiKey && !config.apiKey.includes('DummyKey');

    if (auth && isConfigured) {
      try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        this.currentUser = userCredential.user;
        this.isLoggedIn = true;
        localStorage.setItem('bm_session_active', 'true');
        localStorage.setItem('bm_local_user', JSON.stringify({
          uid: this.currentUser.uid,
          email: this.currentUser.email,
          displayName: this.currentUser.displayName || 'صاحبة البزنس'
        }));
        if (this._authCallback) this._authCallback(this.currentUser);
        return { success: true, user: this.currentUser };
      } catch (error) {
        console.error('Firebase Auth Login Error:', error);
        return { success: false, error: this.getArabicAuthError(error.code) };
      }
    } else {
      // وضع المالك الشخصي الافتراضي بدون خادم
      // يسمح للمالك بالدخول والعمل الفوري وحفظ البيانات محلياً حتى يقوم بربط مفاتيح مشروعه
      const ownerEmail = (localStorage.getItem('bm_owner_email') || 'admin@business.com').trim().toLowerCase();
      const ownerPass = (localStorage.getItem('bm_owner_password') || 'admin123').trim();
      const inputEmail = (email || '').trim().toLowerCase();
      const inputPass = (password || '').trim();

      if (inputEmail === ownerEmail && inputPass === ownerPass) {
        const mockUser = {
          uid: 'owner_primary',
          email: ownerEmail,
          displayName: 'صاحبة البزنس'
        };
        this.currentUser = mockUser;
        this.isLoggedIn = true;
        localStorage.setItem('bm_session_active', 'true');
        localStorage.setItem('bm_local_user', JSON.stringify(mockUser));
        if (this._authCallback) this._authCallback(mockUser);
        return { success: true, user: mockUser };
      } else {
        return {
          success: false,
          error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة. (بيانات الدخول التجريبية الافتراضية: admin@business.com / admin123)'
        };
      }
    }
  },

  /**
   * تسجيل الخروج
   */
  async logout() {
    const auth = FirebaseApp.getAuth();
    if (auth) {
      try {
        await auth.signOut();
      } catch (e) {
        console.warn('SignOut error:', e);
      }
    }
    this.currentUser = null;
    this.isLoggedIn = false;
    localStorage.removeItem('bm_session_active');
    localStorage.removeItem('bm_local_user');
    window.location.reload();
  },

  /**
   * استعادة كلمة المرور
   */
  async resetPassword(email) {
    const auth = FirebaseApp.getAuth();
    const config = FirebaseApp.getConfig();
    const isConfigured = config.apiKey && !config.apiKey.includes('DummyKey');

    if (auth && isConfigured) {
      try {
        await auth.sendPasswordResetEmail(email);
        return { success: true, message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.' };
      } catch (error) {
        return { success: false, error: this.getArabicAuthError(error.code) };
      }
    } else {
      return {
        success: true,
        message: 'في الوضع التجريبي / المحلي: كلمة المرور الافتراضية هي "admin123". يمكنك تغييرها من قسم الإعدادات.'
      };
    }
  },

  getArabicAuthError(code) {
    switch (code) {
      case 'auth/user-not-found':
        return 'لا يوجد حساب مسجل بهذا البريد الإلكتروني.';
      case 'auth/wrong-password':
        return 'كلمة المرور غير صحيحة.';
      case 'auth/invalid-email':
        return 'صيغة البريد الإلكتروني غير صالحة.';
      case 'auth/user-disabled':
        return 'تم تعطيل هذا الحساب.';
      case 'auth/too-many-requests':
        return 'تم حظر الدخول مؤقتاً لكثرة المحاولات الفاشلة، يرجى المحاولة لاحقاً.';
      default:
        return 'حدث خطأ أثناء تسجيل الدخول: ' + code;
    }
  }
};

window.Auth = Auth;
