window.CM = window.CM || {};

// Firebase v10 modular SDK (dynamic import to keep single-file HTML)
import('https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js').then(({ initializeApp }) => {
  import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js').then((fire) => {
    const app = initializeApp(window.CM.firebaseConfig);
    const db = fire.getFirestore(app);

    window.CM.firebase = { app, db, fire };
    document.dispatchEvent(new CustomEvent('cm:firebase-ready'));
  });
});
