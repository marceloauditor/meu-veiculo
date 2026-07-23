(() => {
  const config = window.FIREBASE_CONFIG || {};
  const configured = config.apiKey && !String(config.apiKey).includes('PREENCHER');
  let user = null, stateRef = null, unsubscribe = null, timer = null, applyingRemote = false;

  function addPanel() {
    const about = document.querySelector('#sobre .about-card');
    if (!about || document.querySelector('#cloudPanel')) return;
    const panel = document.createElement('div');
    panel.id = 'cloudPanel';
    panel.className = 'cloud-panel';
    panel.innerHTML = `<h3>Dados online</h3><p id="cloudStatus">${configured ? 'Aguardando login…' : 'Firebase ainda não configurado.'}</p><button id="cloudLogin" type="button" ${configured ? '' : 'disabled'}>Entrar com Google</button><button id="cloudLogout" type="button" hidden>Sair</button>`;
    about.appendChild(panel);
    if (configured) document.querySelector('#cloudLogin').onclick = login;
    document.querySelector('#cloudLogout').onclick = () => firebase.auth().signOut();
  }

  function status(message, error = false) {
    const el = document.querySelector('#cloudStatus');
    if (el) { el.textContent = message; el.classList.toggle('cloud-error', error); }
  }

  async function login() {
    try { await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch (error) { console.error(error); status('Não foi possível entrar: ' + error.message, true); }
  }

  async function pushState() {
    if (!user || !stateRef || applyingRemote || !window.vehicleAppBridge) return;
    try {
      status('Sincronizando…');
      await stateRef.set({ ...window.vehicleAppBridge.getState(), updatedAt: firebase.firestore.FieldValue.serverTimestamp(), schemaVersion: 1 });
      status('Dados sincronizados na nuvem.');
    } catch (error) {
      console.error(error); status('Falha ao sincronizar. Os dados continuam salvos neste aparelho.', true);
    }
  }

  window.cloudSync = { queueSave() { if (!user || applyingRemote) return; clearTimeout(timer); timer = setTimeout(pushState, 700); } };

  async function connectUser(currentUser) {
    user = currentUser;
    document.querySelector('#cloudLogin').hidden = !!user;
    document.querySelector('#cloudLogout').hidden = !user;
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (!user) { stateRef = null; status('Entre com Google para acessar os mesmos dados em todos os aparelhos.'); return; }
    status(`Conectado como ${user.email}. Carregando dados…`);
    stateRef = firebase.firestore().collection('users').doc(user.uid).collection('app').doc('state');
    try {
      const snapshot = await stateRef.get();
      if (snapshot.exists) {
        applyingRemote = true; window.vehicleAppBridge.applyState(snapshot.data()); applyingRemote = false;
        status('Dados online carregados.');
      } else await pushState();
      unsubscribe = stateRef.onSnapshot(snap => {
        if (!snap.exists || snap.metadata.hasPendingWrites) return;
        applyingRemote = true; window.vehicleAppBridge.applyState(snap.data()); applyingRemote = false;
        status('Dados atualizados e sincronizados.');
      }, error => { console.error(error); status('Conexão com a nuvem interrompida.', true); });
    } catch (error) { console.error(error); status('Não foi possível carregar os dados online.', true); }
  }

  async function initialize() {
    addPanel();
    if (!configured) return;
    try {
      firebase.initializeApp(config);
      firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(() => {});
      await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      firebase.auth().onAuthStateChanged(connectUser);
    } catch (error) { console.error(error); status('Configuração do Firebase inválida.', true); }
  }

  if (window.vehicleAppReady) initialize(); else window.addEventListener('vehicle-app-ready', initialize, { once: true });
})();
