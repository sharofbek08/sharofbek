    (() => {
      const STORAGE_KEY = "satrlarim-entries-v1";
      const CLOUD_ROOT = "satrlarim";
      const LOCKED_TEXT = "[locked]";
      const ENCRYPTION_ITERATIONS = 310000;
      const starterEntries = [
        {
          id: "starter-poem",
          type: "poem",
          text: "Ko‘nglimda bir bahor uyg‘onsa agar,\nUning ilk hidi sening ismingdir.",
          author: "Shaxsiy daftar",
          tags: ["muhabbat", "bahor"],
          favorite: true,
          createdAt: "2026-09-20T08:00:00.000Z"
        },
        {
          id: "starter-quote",
          type: "quote",
          text: "Chiroyli so‘z — qalbga qo‘yilgan eng mayin qo‘ldir.",
          author: "Noma’lum",
          tags: ["so‘z", "ilhom"],
          favorite: false,
          createdAt: "2026-09-19T08:00:00.000Z"
        },
        {
          id: "starter-poem-2",
          type: "poem",
          text: "Yo‘llar uzoq bo‘lsa ham,\nYurak manzilini unutmaydi.",
          author: "Shaxsiy daftar",
          tags: ["sog‘inch", "yo‘l"],
          favorite: false,
          createdAt: "2026-09-18T08:00:00.000Z"
        }
      ];

      const entryList = document.getElementById("entry-list");
      const entryCount = document.getElementById("entry-count");
      const searchInput = document.getElementById("search-input");
      const dialog = document.getElementById("entry-dialog");
      const form = document.getElementById("entry-form");
      const errorMessage = document.getElementById("form-error");
      const toast = document.getElementById("toast");
      const dialogTitle = document.getElementById("dialog-title");
      const dialogDescription = document.getElementById("dialog-description");
      const editingId = document.getElementById("editing-id");
      const textField = document.getElementById("entry-text");
      const authorField = document.getElementById("entry-author");
      const tagsField = document.getElementById("entry-tags");
      const protectedField = document.getElementById("entry-protected");
      const protectedFields = document.getElementById("protected-fields");
      const passphraseField = document.getElementById("entry-passphrase");
      const passphraseConfirmField = document.getElementById("entry-passphrase-confirm");
      const unlockDialog = document.getElementById("unlock-dialog");
      const unlockForm = document.getElementById("unlock-form");
      const unlockPassphraseField = document.getElementById("unlock-passphrase");
      const unlockError = document.getElementById("unlock-error");
      const syncStatus = document.getElementById("sync-status");
      const syncStatusText = document.getElementById("sync-status-text");
      const storageNote = document.getElementById("storage-note");
      
      let activeFilter = "all";
      let entries = loadEntries();
      let toastTimer;
      let entryCardObserver;
      let unlockTargetId = "";
      let unlockForEdit = false;
      const unlockedEntries = new Map();
      const cloud = {
        mode: "local",
        database: null,
        entriesRef: null,
        user: null,
        valueListener: null
      };

      // --- Google Sign-In integration (client-side) ---
      const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"; // replace with your Client ID

      function decodeJwtResponse(token) {
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          return JSON.parse(jsonPayload);
        } catch {
          return null;
        }
      }

      function onGoogleCredential(response) {
        const payload = decodeJwtResponse(response.credential);
        if (!payload) return;
        const profile = {
          id: payload.sub,
          name: payload.name,
          email: payload.email,
          picture: payload.picture
        };
        localStorage.setItem('satrlarim-user', JSON.stringify(profile));
        showUser(profile);
      }

      function showUser(profile) {
        const signinBox = document.getElementById('g_id_signin');
        if (signinBox) signinBox.hidden = true;
        const ui = document.getElementById('user-info');
        const nameEl = document.getElementById('user-name');
        const pic = document.getElementById('user-pic');
        if (nameEl) nameEl.textContent = profile.name || profile.email;
        if (profile.picture && pic) { pic.src = profile.picture; pic.alt = profile.name || 'User picture'; pic.hidden = false; }
        if (ui) ui.hidden = false;
      }

      function signOut() {
        localStorage.removeItem('satrlarim-user');
        const ui = document.getElementById('user-info');
        const signinBox = document.getElementById('g_id_signin');
        if (ui) ui.hidden = true;
        if (signinBox) signinBox.hidden = false;
        try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch {}
      }

      function initGoogleSignIn() {
        try {
          const signinContainer = document.getElementById('g_id_signin');
          if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID') || GOOGLE_CLIENT_ID.includes('SIZNING_CLIENT_ID')) {
            // Don't attempt to initialize GSI with the placeholder client ID.
            if (signinContainer) signinContainer.hidden = true;
            return;
          }
          if (window.google && google.accounts && google.accounts.id) {
            google.accounts.id.initialize({
              client_id: GOOGLE_CLIENT_ID,
              callback: onGoogleCredential,
              auto_select: false
            });
            google.accounts.id.renderButton(
              signinContainer,
              { theme: 'outline', size: 'large', text: 'signin_with' }
            );
          }
        } catch (e) {
          // Google Identity not available or initialization failed
        }
      }
      

      function loadEntries() {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
          if (Array.isArray(saved)) return saved;
        } catch (error) {
          console.warn("Yozuvlarni o‘qib bo‘lmadi", error);
        }
        return starterEntries.map((entry) => ({ ...entry, tags: [...entry.tags] }));
      }

      function saveEntries() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        } catch (error) {
          showToast("Yozuvni saqlash uchun brauzer xotirasi mavjud emas.");
        }
      }

      function firebaseConfig() {
        const config = window.SATRALARIM_FIREBASE_CONFIG;
        const required = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];
        if (!config || typeof config !== "object") return null;
        return required.every((key) => typeof config[key] === "string" && config[key].trim()) ? config : null;
      }

      function setSyncStatus(message, mode = "local") {
        if (syncStatusText) syncStatusText.textContent = message;
        if (syncStatus) {
          syncStatus.dataset.mode = mode;
          syncStatus.classList.toggle("is-online", mode === "online");
          syncStatus.classList.toggle("is-connecting", mode === "connecting");
          syncStatus.classList.toggle("is-offline", mode === "offline");
        }
        if (storageNote) {
          storageNote.textContent = mode === "online"
            ? "Yozuvlar umumiy bulutli xotirada saqlanadi va barcha qurilmalarda darhol yangilanadi. Ularni faqat yozuv qo'shilgan brauzerdan tahrirlash yoki o'chirish mumkin."
            : mode === "offline"
              ? "Bulutga ulanish ishlamayapti. Yangi yozuvlar hozir yuborilmaydi. Ulanishni tekshirib, sahifani yangilang."
              : "Yozuvlaringiz shu brauzer xotirasida saqlanadi. Bulutli sinxronlash yoqilganda ular barcha qurilmalarda ham ko'rinadi.";
        }
      }

      function isCloudConnecting() {
        return cloud.mode === "connecting";
      }

      function isCloudOnline() {
        return cloud.mode === "online";
      }

      function canManageEntry(entry) {
        return !isCloudOnline() || Boolean(cloud.user && entry.ownerId === cloud.user.uid);
      }

      function createEntryId() {
        return window.crypto?.randomUUID ? window.crypto.randomUUID() : `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }

      function isValidDatabaseKey(value) {
        return typeof value === "string" && value.length > 0 && !/[.#$\[\]/]/.test(value);
      }

      function normalizeCloudEntry(value, key) {
        if (!value || typeof value !== "object") return null;
        const id = isValidDatabaseKey(value.id) ? value.id : key;
        if (!isValidDatabaseKey(id) || typeof value.text !== "string") return null;
        const tags = Array.isArray(value.tags)
          ? value.tags
          : (value.tags && typeof value.tags === "object" ? Object.values(value.tags) : []);
        return {
          id,
          type: value.type === "quote" ? "quote" : "poem",
          text: value.text,
          author: typeof value.author === "string" ? value.author : "",
          tags: tags.filter((tag) => typeof tag === "string").slice(0, 8),
          favorite: Boolean(value.favorite),
          createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
          ownerId: typeof value.ownerId === "string" ? value.ownerId : "",
          encryption: value.encryption && typeof value.encryption === "object" ? value.encryption : null
        };
      }

      function isProtectedEntry(entry) {
        return Boolean(entry.encryption);
      }

      function getUnlockedContent(entry) {
        if (!isProtectedEntry(entry)) return entry;
        const unlocked = unlockedEntries.get(entry.id);
        return unlocked?.ciphertext === entry.encryption.ciphertext ? unlocked.content : null;
      }

      function requireWebCrypto() {
        if (!window.crypto?.subtle || !window.crypto?.getRandomValues) {
          throw new Error("Maxfiy kod uchun HTTPS yoki localhost orqali saytni oching.");
        }
        return window.crypto;
      }

      function bytesToBase64(bytes) {
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return btoa(binary);
      }

      function base64ToBytes(value) {
        return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
      }

      async function deriveEntryKey(passphrase, salt, iterations, usage) {
        const crypto = requireWebCrypto();
        const material = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(passphrase),
          "PBKDF2",
          false,
          ["deriveKey"]
        );
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
          material,
          { name: "AES-GCM", length: 256 },
          false,
          [usage]
        );
      }

      async function encryptEntryContent(content, passphrase) {
        const crypto = requireWebCrypto();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveEntryKey(passphrase, salt, ENCRYPTION_ITERATIONS, "encrypt");
        const plaintext = new TextEncoder().encode(JSON.stringify(content));
        const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
        return {
          version: 1,
          iterations: ENCRYPTION_ITERATIONS,
          salt: bytesToBase64(salt),
          iv: bytesToBase64(iv),
          ciphertext: bytesToBase64(new Uint8Array(ciphertext))
        };
      }

      async function decryptEntryContent(entry, passphrase) {
        const crypto = requireWebCrypto();
        const encryption = entry.encryption;
        if (!encryption || encryption.version !== 1 || encryption.iterations !== ENCRYPTION_ITERATIONS) {
          throw new Error("Bu kodlangan yozuv formati qo'llab-quvvatlanmaydi.");
        }
        const salt = base64ToBytes(encryption.salt);
        const iv = base64ToBytes(encryption.iv);
        if (salt.length !== 16 || iv.length !== 12) throw new Error("Kodlangan yozuv buzilgan.");
        const key = await deriveEntryKey(passphrase, salt, encryption.iterations, "decrypt");
        const plaintext = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          key,
          base64ToBytes(encryption.ciphertext)
        );
        const content = JSON.parse(new TextDecoder().decode(plaintext));
        if (!content || typeof content.text !== "string" || typeof content.author !== "string" || !Array.isArray(content.tags)) {
          throw new Error("Kodlangan yozuv buzilgan.");
        }
        return content;
      }

      function handleCloudFailure(error) {
        if (cloud.entriesRef && cloud.valueListener) {
          cloud.entriesRef.off("value", cloud.valueListener);
        }
        cloud.mode = "offline";
        cloud.entriesRef = null;
        cloud.valueListener = null;
        setSyncStatus("Bulutli ulanish ishlamadi — yangi yozuvlar yuborilmaydi", "offline");
        console.warn("Bulutli sinxronlashda xatolik", error);
      }

      async function initializeCloudSync() {
        const config = firebaseConfig();
        if (!config) {
          setSyncStatus("Bulutli sinxronlash sozlanmagan — yozuvlar faqat shu qurilmada saqlanadi", "local");
          return;
        }

        cloud.mode = "connecting";
        setSyncStatus("Bulutli xotiraga ulanmoqda...", "connecting");

        try {
          if (!window.firebase || !window.firebase.auth || !window.firebase.database) {
            throw new Error("Firebase kutubxonasi yuklanmadi");
          }
          if (!window.firebase.apps.length) window.firebase.initializeApp(config);

          const credential = await window.firebase.auth().signInAnonymously();
          cloud.user = credential.user;
          cloud.database = window.firebase.database();

          // Local browser notes are intentionally not uploaded automatically.
          // A person must save a new entry after cloud sync is enabled to share it.
          cloud.entriesRef = cloud.database.ref(`${CLOUD_ROOT}/entries`);
          cloud.valueListener = (snapshot) => {
            const remoteEntries = snapshot.val() || {};
            entries = Object.entries(remoteEntries)
              .map(([key, value]) => normalizeCloudEntry(value, key))
              .filter(Boolean)
              .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
            // Keep local-only notes separate instead of replacing their browser storage.
            cloud.mode = "online";
            setSyncStatus("Yozuvlar barcha qurilmalarda sinxronlanmoqda", "online");
            render();
          };
          cloud.entriesRef.on("value", cloud.valueListener, handleCloudFailure);
        } catch (error) {
          handleCloudFailure(error);
        }
      }

      function ensureCloudReady() {
        if (isCloudConnecting()) {
          showToast("Bulutli ulanish tugashini kuting.");
          return false;
        }
        if (cloud.mode === "offline") {
          showToast("Bulutga ulanmadi. Ulanishni tekshirib, sahifani yangilang.");
          return false;
        }
        return true;
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      function formatDate(value) {
        // Numeric format: DD.MM.YYYY (e.g., 20.09.2026)
        try {
          const d = new Date(value);
          if (isNaN(d)) return "00.00.0000";
          const pad = (n) => String(n).padStart(2, "0");
          return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
        } catch {
          return "00.00.0000";
        }
      }

      function getFilteredEntries() {
        const query = searchInput.value.trim().toLocaleLowerCase("uz-UZ");
        return entries.filter((entry) => {
          const matchesFilter = activeFilter === "all"
            || (activeFilter === "favorite" && entry.favorite)
            || entry.type === activeFilter;
          const content = getUnlockedContent(entry);
          const searchable = content
            ? [content.text, content.author, ...(content.tags || [])].join(" ").toLocaleLowerCase("uz-UZ")
            : "";
          return matchesFilter && (!query || searchable.includes(query));
        });
      }

      function cardMarkup(entry) {
        const isPoem = entry.type === "poem";
        const typeName = isPoem ? "She’r" : "Qalbdagi so'zlar";
        const protectedEntry = isProtectedEntry(entry);
        const content = getUnlockedContent(entry);
        const locked = protectedEntry && !content;
        const safeAuthor = content?.author ? escapeHtml(content.author) : "Muallif ko‘rsatilmagan";
        const tags = (content?.tags || []).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");
        const favoriteText = entry.favorite ? "Sevimlidan olish" : "Sevimliga qo‘shish";
        return `
          <article class="entry-card reveal-card ${isPoem ? "poem" : "quote"}" data-id="${escapeHtml(entry.id)}">
            <div class="card-topline">
              <span class="type-label"><span class="type-dot" aria-hidden="true"></span>${typeName}${protectedEntry ? '<span class="lock-badge">Kodli</span>' : ""}</span>
              <time class="date" datetime="${escapeHtml(entry.createdAt)}">${formatDate(entry.createdAt)}</time>
            </div>
            <p class="entry-text ${locked ? "is-locked" : ""}">${locked ? "Bu matn maxfiy kod bilan himoyalangan." : escapeHtml(content.text)}</p>
            ${locked ? "" : `<p class="entry-author">${safeAuthor}</p>`}
            <div class="card-footer">
              <div class="tag-list">${tags}</div>
              <div class="card-actions">
                ${protectedEntry ? `<button class="small-button" type="button" data-action="${locked ? "unlock" : "lock"}">${locked ? "Kod bilan ochish" : "Yashirish"}</button>` : ""}
                <button class="small-button ${entry.favorite ? "is-favorite" : ""}" type="button" data-action="favorite" aria-label="${favoriteText}">${entry.favorite ? "♥ Sevimli" : "♡ Sevimli"}</button>
                ${locked ? "" : '<button class="small-button" type="button" data-action="copy">Nusxa olish</button>'}
                <button class="small-button" type="button" data-action="edit">Tahrirlash</button>
                <button class="small-button delete" type="button" data-action="delete">O‘chirish</button>
              </div>
            </div>
          </article>`;
      }

      function applyEntryPermissions() {
        entryList.querySelectorAll("[data-id]").forEach((card) => {
          const entry = entries.find((item) => item.id === card.dataset.id);
          if (!entry || canManageEntry(entry)) return;
          card.querySelectorAll('[data-action="favorite"], [data-action="edit"], [data-action="delete"]').forEach((button) => {
            button.hidden = true;
          });
        });
      }

      function revealEntryCards() {
        if (entryCardObserver) {
          entryCardObserver.disconnect();
          entryCardObserver = undefined;
        }

        const cards = [...entryList.querySelectorAll(".reveal-card")];
        if (!cards.length) return;

        const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        if (prefersReducedMotion || !("IntersectionObserver" in window)) {
          cards.forEach((card) => card.classList.add("is-visible"));
          return;
        }

        entryCardObserver = new IntersectionObserver((observedCards, observer) => {
          observedCards.forEach((observedCard) => {
            if (!observedCard.isIntersecting) return;
            observedCard.target.classList.add("is-visible");
            observer.unobserve(observedCard.target);
          });
        }, { threshold: 0.01, rootMargin: "0px 0px -6% 0px" });

        cards.forEach((card, index) => {
          card.style.setProperty("--card-delay", `${Math.min(index, 5) * 90}ms`);
          entryCardObserver.observe(card);
        });
      }

      function render() {
        const visibleEntries = getFilteredEntries();
        entryCount.textContent = `${visibleEntries.length} ta yozuv`;
        if (visibleEntries.length) {
          entryList.innerHTML = visibleEntries.map(cardMarkup).join("");
        } else {
          entryList.innerHTML = `
            <section class="empty-state">
              <h3>Bu yer hali jim.</h3>
              <p>Qidiruv so‘zingizga mos yozuv topilmadi yoki bu bo‘lim hali bo‘sh.</p>
              <button class="button button-secondary" type="button" data-action="open-add">Birinchi satrni saqlash</button>
            </section>`;
        }
        applyEntryPermissions();
        revealEntryCards();
        document.getElementById("total-count").textContent = entries.length;
        document.getElementById("poem-count").textContent = entries.filter((entry) => entry.type === "poem").length;
        document.getElementById("favorite-count").textContent = entries.filter((entry) => entry.favorite).length;
      }

      function showToast(message) {
        window.clearTimeout(toastTimer);
        toast.textContent = message;
        toast.classList.add("show");
        toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
      }

      

      function openAddDialog() {
        form.reset();
        editingId.value = "";
        errorMessage.textContent = "";
        dialogTitle.textContent = "Yangi yozuv";
        dialogDescription.textContent = "Yuragingizga yaqin satrni saqlab qo‘ying.";
        updateProtectedFields();
        dialog.showModal();
        window.setTimeout(() => textField.focus(), 50);
      }

      function openEditDialog(id) {
        const entry = entries.find((item) => item.id === id);
        if (!entry) return;
        const content = getUnlockedContent(entry);
        if (!content) {
          openUnlockDialog(id, true);
          return;
        }
        form.reset();
        editingId.value = entry.id;
        document.querySelector(`input[name="entry-type"][value="${entry.type}"]`).checked = true;
        textField.value = content.text;
        authorField.value = content.author || "";
        tagsField.value = (content.tags || []).join(", ");
        protectedField.checked = isProtectedEntry(entry);
        updateProtectedFields();
        errorMessage.textContent = "";
        dialogTitle.textContent = "Yozuvni tahrirlash";
        dialogDescription.textContent = protectedField.checked
          ? "Saqlash uchun kodni qayta kiriting. Yangi kod kiritsangiz, kod o'zgaradi."
          : "Kerakli joylarini yangilang va qayta saqlang.";
        dialog.showModal();
        window.setTimeout(() => textField.focus(), 50);
      }

      function updateProtectedFields() {
        protectedFields.hidden = !protectedField.checked;
        passphraseField.required = protectedField.checked;
        passphraseConfirmField.required = protectedField.checked;
        if (!protectedField.checked) {
          passphraseField.value = "";
          passphraseConfirmField.value = "";
        }
      }

      function openUnlockDialog(id, forEdit = false) {
        const entry = entries.find((item) => item.id === id);
        if (!entry || !isProtectedEntry(entry)) return;
        try {
          requireWebCrypto();
        } catch (error) {
          showToast(error.message);
          return;
        }
        unlockTargetId = id;
        unlockForEdit = forEdit;
        unlockForm.reset();
        unlockError.textContent = "";
        unlockDialog.showModal();
        window.setTimeout(() => unlockPassphraseField.focus(), 50);
      }

      function closeUnlockDialog() {
        if (unlockDialog.open) unlockDialog.close();
        unlockForm.reset();
        unlockTargetId = "";
        unlockForEdit = false;
      }

      function closeDialog() {
        if (dialog.open) dialog.close();
      }

      function normalizeTags(value) {
        return [...new Set(value.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean))].slice(0, 8);
      }

      async function copyEntry(entry) {
        const visible = getUnlockedContent(entry);
        if (!visible) {
          showToast("Avval matnni maxfiy kod bilan oching.");
          return;
        }
        const content = `${visible.text}${visible.author ? `\n— ${visible.author}` : ""}`;
        try {
          await navigator.clipboard.writeText(content);
          showToast("Yozuv nusxalandi.");
        } catch {
          const helper = document.createElement("textarea");
          helper.value = content;
          helper.style.position = "fixed";
          helper.style.opacity = "0";
          document.body.appendChild(helper);
          helper.select();
          document.execCommand("copy");
          helper.remove();
          showToast("Yozuv nusxalandi.");
        }
      }

      document.querySelectorAll("#open-add-dialog, #open-add-dialog-secondary").forEach((button) => {
        button.addEventListener("click", openAddDialog);
      });
      // wire sign-out button (if present)
      const signoutBtn = document.getElementById('signout-button');
      if (signoutBtn) signoutBtn.addEventListener('click', signOut);
      document.getElementById("close-dialog").addEventListener("click", closeDialog);
      document.getElementById("cancel-dialog").addEventListener("click", closeDialog);
      document.getElementById("close-unlock-dialog").addEventListener("click", closeUnlockDialog);
      document.getElementById("cancel-unlock-dialog").addEventListener("click", closeUnlockDialog);
      dialog.addEventListener("close", () => {
        passphraseField.value = "";
        passphraseConfirmField.value = "";
      });
      unlockDialog.addEventListener("close", () => {
        unlockForm.reset();
        unlockTargetId = "";
        unlockForEdit = false;
      });
      protectedField.addEventListener("change", updateProtectedFields);
      searchInput.addEventListener("input", render);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && unlockedEntries.size) {
          unlockedEntries.clear();
          render();
        }
      });

      unlockForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const entry = entries.find((item) => item.id === unlockTargetId);
        if (!entry || !isProtectedEntry(entry)) {
          closeUnlockDialog();
          return;
        }
        const unlockButton = document.getElementById("unlock-submit");
        unlockButton.disabled = true;
        unlockError.textContent = "";
        try {
          const content = await decryptEntryContent(entry, unlockPassphraseField.value);
          const forEdit = unlockForEdit;
          unlockedEntries.set(entry.id, { ciphertext: entry.encryption.ciphertext, content });
          closeUnlockDialog();
          render();
          if (forEdit) openEditDialog(entry.id);
        } catch (error) {
          unlockError.textContent = error.message?.startsWith("Bu kodlangan yozuv") || error.message?.startsWith("Kodlangan yozuv")
            ? error.message
            : "Kod noto‘g‘ri yoki yozuvni ochib bo‘lmadi.";
          unlockPassphraseField.focus();
        } finally {
          unlockButton.disabled = false;
        }
      });

      document.querySelectorAll(".filter-chip").forEach((button) => {
        button.addEventListener("click", () => {
          activeFilter = button.dataset.filter;
          document.querySelectorAll(".filter-chip").forEach((chip) => {
            const active = chip === button;
            chip.classList.toggle("is-active", active);
            chip.setAttribute("aria-pressed", String(active));
          });
          render();
        });
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const text = textField.value.trim();
        if (!text) {
          errorMessage.textContent = "Avval saqlamoqchi bo‘lgan satringizni yozing.";
          textField.focus();
          return;
        }
        if (!ensureCloudReady()) return;

        const selectedType = document.querySelector('input[name="entry-type"]:checked').value;
        const tags = normalizeTags(tagsField.value);
        if (tags.some((tag) => tag.length > 40)) {
          errorMessage.textContent = "Har bir teg 40 belgidan oshmasin.";
          tagsField.focus();
          return;
        }
        const existingId = editingId.value;
        const existingEntry = existingId ? entries.find((entry) => entry.id === existingId) : null;
        const wantsProtection = protectedField.checked;
        const passphrase = passphraseField.value;
        if (existingId && !existingEntry) {
          errorMessage.textContent = "Tahrirlanayotgan yozuv topilmadi.";
          return;
        }
        if (existingEntry && isProtectedEntry(existingEntry) && !getUnlockedContent(existingEntry)) {
          errorMessage.textContent = "Avval yozuvni maxfiy kod bilan oching.";
          return;
        }
        if (wantsProtection && (passphrase.length < 8 || passphrase.length > 128)) {
          errorMessage.textContent = "Maxfiy kod 8–128 belgidan iborat bo‘lsin.";
          passphraseField.focus();
          return;
        }
        if (wantsProtection && passphrase !== passphraseConfirmField.value) {
          errorMessage.textContent = "Ikkala maxfiy kod bir xil emas.";
          passphraseConfirmField.focus();
          return;
        }
        if (existingEntry && isProtectedEntry(existingEntry) && !wantsProtection
          && !window.confirm("Himoyani olib tashlasangiz, matn hammaga ochiq ko‘rinadi. Davom etasizmi?")) {
          return;
        }
        const saveButton = document.getElementById("save-entry");
        saveButton.disabled = true;
        errorMessage.textContent = "";

        try {
          const entryData = wantsProtection
            ? {
                type: selectedType,
                text: LOCKED_TEXT,
                author: null,
                tags: null,
                encryption: await encryptEntryContent({ text, author: authorField.value.trim(), tags }, passphrase)
              }
            : {
                type: selectedType,
                text,
                author: authorField.value.trim(),
                tags: tags.length ? tags : null,
                encryption: null
              };
          if (isCloudOnline()) {
            if (!cloud.entriesRef || !cloud.user) throw new Error("Bulutli ulanish tayyor emas");
            if (existingId) {
              if (!existingEntry || !canManageEntry(existingEntry)) {
                throw new Error("Bu yozuvni faqat uni kiritgan kishi tahrirlashi mumkin");
              }
              await cloud.entriesRef.child(existingId).update(entryData);
              unlockedEntries.delete(existingId);
              showToast("Yozuv yangilandi.");
            } else {
              const newEntry = {
                id: createEntryId(),
                ...entryData,
                favorite: false,
                createdAt: new Date().toISOString(),
                ownerId: cloud.user.uid
              };
              await cloud.entriesRef.child(newEntry.id).set(newEntry);
              showToast("Yangi yozuv barcha qurilmalarga saqlandi.");
            }
          } else if (existingId) {
            const index = entries.findIndex((entry) => entry.id === existingId);
            if (index !== -1) entries[index] = { ...entries[index], ...entryData };
            unlockedEntries.delete(existingId);
            saveEntries();
            render();
            showToast("Yozuv faqat shu qurilmada yangilandi.");
          } else {
            entries.unshift({ id: createEntryId(), ...entryData, favorite: false, createdAt: new Date().toISOString() });
            saveEntries();
            render();
            showToast("Yozuv faqat shu qurilmada saqlandi; boshqalarga ko'rinmaydi.");
          }
          closeDialog();
        } catch (error) {
          errorMessage.textContent = error.message || "Yozuvni saqlab bo‘lmadi. Qayta urinib ko‘ring.";
          console.warn("Yozuvni saqlashda xatolik", error);
        } finally {
          saveButton.disabled = false;
        }
      });

      entryList.addEventListener("click", async (event) => {
        const target = event.target.closest("button");
        if (!target) return;
        if (target.dataset.action === "open-add") {
          openAddDialog();
          return;
        }
        const card = target.closest("[data-id]");
        if (!card) return;
        const id = card.dataset.id;
        const entry = entries.find((item) => item.id === id);
        if (!entry) return;
        const action = target.dataset.action;
        if (action === "unlock") {
          openUnlockDialog(id);
          return;
        }
        if (action === "lock") {
          unlockedEntries.delete(id);
          render();
          return;
        }
        if (action === "copy") {
          await copyEntry(entry);
          return;
        }
        if (!ensureCloudReady()) return;
        if (!canManageEntry(entry)) {
          showToast("Bu yozuvni faqat uni kiritgan kishi o‘zgartira oladi.");
          return;
        }

        try {
          if (action === "favorite") {
            const favorite = !entry.favorite;
            if (isCloudOnline()) {
              await cloud.entriesRef.child(id).update({ favorite });
            } else {
              entry.favorite = favorite;
              saveEntries();
              render();
            }
            showToast(favorite ? "Sevimlilarga qo‘shildi." : "Sevimlilardan olindi.");
            return;
          }

          if (action === "edit") {
            openEditDialog(id);
            return;
          }

          if (action === "delete" && window.confirm("Bu yozuvni o‘chirmoqchimisiz?")) {
            if (isCloudOnline()) {
              await cloud.entriesRef.child(id).remove();
            } else {
              entries = entries.filter((item) => item.id !== id);
              saveEntries();
              render();
            }
            unlockedEntries.delete(id);
            showToast("Yozuv o‘chirildi.");
          }
        } catch (error) {
          showToast("O‘zgarishni saqlab bo‘lmadi. Qayta urinib ko‘ring.");
          console.warn("Yozuvni yangilashda xatolik", error);
        }
      });

      render();
      initializeCloudSync();
      // Restore signed-in user if present
      try {
        const savedUser = JSON.parse(localStorage.getItem('satrlarim-user') || 'null');
        if (savedUser) showUser(savedUser);
      } catch {}
      // Initialize Google Sign-In (will only render if GSI script loaded)
      initGoogleSignIn();

      // --- Logo picker: load saved logo and wire dialog ---
      const brandLogo = document.getElementById('brand-logo');
      const logoDialog = document.getElementById('logo-dialog');
      const closeLogoBtn = document.getElementById('close-logo-dialog');

      function loadSavedLogo() {
        try {
          const saved = localStorage.getItem('satrlarim-logo');
          if (saved && brandLogo) brandLogo.src = saved;
        } catch {}
      }

      function openLogoDialog() {
        if (logoDialog) logoDialog.showModal();
      }

      function closeLogoDialog() {
        if (logoDialog && logoDialog.open) logoDialog.close();
      }

      document.querySelectorAll('.logo-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          const src = btn.dataset.src;
          if (brandLogo) brandLogo.src = src;
          try { localStorage.setItem('satrlarim-logo', src); } catch {}
          closeLogoDialog();
        });
      });

      if (closeLogoBtn) closeLogoBtn.addEventListener('click', closeLogoDialog);
      loadSavedLogo();
    })();
