/* ========== DOGGOMEAL • dm-app-pack.js (alles aus Webflow Footer ausgelagert) ========== */
(function () {
  // ====== KONFIG =======================================================
  const SUPA_URL = "https://doidleouyznvfryzzaqw.supabase.co";
  const SUPA_ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaWRsZW91eXpudmZyeXp6YXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNjk4NjUsImV4cCI6MjA2Mzk0NTg2NX0.iq1bHOsXueKqsSyGMxFgDEVbV7FM2-dlS0hv-UR6v2s";

  const PUSH_FUNC_URL =
    "https://doidleouyznvfryzzaqw.functions.supabase.co/dm-push-notification";

  // ====== SUPABASE (Library sichern + Client bauen) ====================
  (function initSupabase() {
    const existing = window.supabase;

    // library erkennen (hat createClient)
    if (existing && typeof existing.createClient === "function") {
      window.supabaseLib = window.supabaseLib || existing;
    }

    // client erkennen (hat from)
    if (existing && typeof existing.from === "function") {
      window.supabaseClient = window.supabaseClient || existing;
    }

    // falls library noch nicht gespeichert ist, aber global supabase verfügbar ist
    if (!window.supabaseLib && window.supabase && typeof window.supabase.createClient === "function") {
      window.supabaseLib = window.supabase;
    }

    // client erstellen, falls fehlt
    if (!window.supabaseClient) {
      const lib = window.supabaseLib;
      if (lib && typeof lib.createClient === "function") {
        window.supabaseClient = lib.createClient(SUPA_URL, SUPA_ANON);
      }
    }

    // Backwards-Compat: window.supabase soll Client sein
    if (window.supabaseClient) {
      window.supabase = window.supabaseClient;
    }
  })();

  // ====== HELPERS ======================================================
  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function waitFor(check, { tries = 200, delay = 150 } = {}) {
    return new Promise((resolve) => {
      let n = 0;
      (function loop() {
        try {
          const v = check();
          if (v) return resolve(v);
        } catch (_) {}
        if (++n >= tries) return resolve(null);
        setTimeout(loop, delay);
      })();
    });
  }

  async function waitMemberstack() {
    return await waitFor(
      () => window.$memberstackDom && typeof window.$memberstackDom.getCurrentMember === "function" && window.$memberstackDom,
      { tries: 220, delay: 150 }
    );
  }

  // ====== REPORT MODAL (HTML jetzt per JS injizieren) ===================
  function ensureReportModalDOM() {
    if (document.getElementById("dgm-report-modal")) return;

    const html = `
<div id="dgm-report-modal" style="display:none; position:fixed; z-index:99999; left:0; top:0; width:100vw; height:100vh; background:#0002; align-items:center; justify-content:center;">
  <div style="background:#fff9f1; padding:26px 19px 20px 19px; border-radius:14px; min-width:240px; max-width:90vw;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;">
      <div style="font-weight:bold; color:#d77f47; font-size:18px;">Beitrag melden</div>
      <button onclick="closeReportDialog()" style="background:none;border:none;font-size:22px;line-height:1;cursor:pointer;color:#b36c2e;">&times;</button>
    </div>

    <select id="dgm-report-reason" style="margin:8px 0 9px 0; width:100%; border-radius:7px; padding:8px; border:1.5px solid #efb876;">
      <option value="">Grund wählen...</option>
      <option value="Illegal">Illegale Inhalte</option>
      <option value="Spam">Spam/Werbung</option>
      <option value="Hate">Hassrede/Gewalt</option>
      <option value="Copyright">Urheberrechtsverletzung</option>
      <option value="Other">Anderes</option>
    </select>

    <textarea id="dgm-report-details" style="width:100%; border-radius:7px; min-height:44px; margin-bottom:12px; padding:8px; border:1.5px solid #efb876;" placeholder="Zusätzliche Details (optional)"></textarea>

    <div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;">
      <button id="dgm-report-cancel" onclick="closeReportDialog()" style="background:none; border:none; color:#b36c2e;">Abbrechen</button>
      <button id="dgm-report-submit" onclick="submitReport()" style="background:#d77f47; color:#fff; font-weight:800; border:none; border-radius:7px; padding:10px 17px; min-width:140px;">Melden</button>
    </div>
  </div>
</div>`.trim();

    document.body.insertAdjacentHTML("beforeend", html);
  }

  window._reportType = null;
  window._reportRefId = null;
  window._reportSubmitLock = false;

  window.openReportDialog = function (type, refId) {
    ensureReportModalDOM();
    window._reportType = type;
    window._reportRefId = refId;

    const modal = document.getElementById("dgm-report-modal");
    if (modal) modal.style.display = "flex";

    const reason = document.getElementById("dgm-report-reason");
    const details = document.getElementById("dgm-report-details");
    if (reason) reason.value = "";
    if (details) details.value = "";

    window._reportSubmitLock = false;
    const btn = document.getElementById("dgm-report-submit");
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = "";
      btn.textContent = "Melden";
    }
  };

  window.closeReportDialog = function () {
    const modal = document.getElementById("dgm-report-modal");
    if (modal) modal.style.display = "none";
  };

  window.submitReport = async function () {
    ensureReportModalDOM();

    if (window._reportSubmitLock) return;

    const btn = document.getElementById("dgm-report-submit");
    const reason = (document.getElementById("dgm-report-reason")?.value || "").trim();
    const details = (document.getElementById("dgm-report-details")?.value || "").trim();

    if (!reason) {
      alert("Bitte wähle einen Grund!");
      return;
    }

    const supa = window.supabase;
    if (!supa) {
      alert("Supabase nicht gefunden");
      return;
    }

    window._reportSubmitLock = true;
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = "0.6";
      btn.textContent = "Sende...";
    }

    try {
      let memberstack_id = null;
      const ms = await waitMemberstack();
      if (ms) {
        const { data } = await ms.getCurrentMember();
        memberstack_id = data?.id || data?.member?.id || null;
      }

      const { error } = await supa.from("reports").insert({
        type: window._reportType,
        ref_id: window._reportRefId,
        report_reason: reason,
        report_details: details,
        reported_by: memberstack_id,
        status: "offen",
      });

      if (error) {
        console.error("Supabase Insert Error:", error);
        alert("Fehler beim Melden: " + error.message);
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = "";
          btn.textContent = "Melden";
        }
        window._reportSubmitLock = false;
        return;
      }

      window.dispatchEvent(
        new CustomEvent("doggomeal:report:done", {
          detail: { type: window._reportType, id: window._reportRefId },
        })
      );

      window.closeReportDialog();
      alert("Beitrag wurde gemeldet");
    } catch (err) {
      console.error("Report Error:", err);
      alert("Fehler beim Melden.");
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "";
        btn.textContent = "Melden";
      }
      window._reportSubmitLock = false;
    }
  };

  // Modal bei DOM ready einmal injizieren (damit ID immer existiert)
  onReady(ensureReportModalDOM);

  // ====== KOMMENTARE (dein Code 1:1, ohne <script> Hülle) ==============
  window.DGMcomments = window.DGMcomments || {
    init: async function (box, { type, refId }) {
      ensureStyles();

      box.classList.add("dgm-comments-box", "dgm-comments-wide");
      box.innerHTML = `
        <div class="dgm-comments-title">Kommentare</div>
        <form class="dgm-comments-form">
          <textarea maxlength="420" placeholder="Schreibe einen Kommentar... ✍️"></textarea>
          <button type="submit" disabled>Posten</button>
        </form>
        <ul class="dgm-comments-list" role="list"></ul>
        <div class="dgm-comments-empty" style="display:none;">Noch keine Kommentare.</div>
      `;

      const input = box.querySelector("textarea");
      const send = box.querySelector('button[type="submit"]');
      const form = box.querySelector(".dgm-comments-form");
      const list = box.querySelector(".dgm-comments-list");
      const empty = box.querySelector(".dgm-comments-empty");

      const supabase = window.supabase;
      const $memberstack = window.$memberstackDom;

      async function getCurrentMember() {
        try {
          const { data } = await $memberstack.getCurrentMember();
          const d = data?.member || data || {};
          return {
            id: d.id || null,
            hundename: d.customFields?.hundename || d.profile?.name || "Doggo",
            profilbild: d.customFields?.profilbild || d.profile?.image || null,
          };
        } catch {
          return { id: null };
        }
      }

      async function getContentOwnerAndDeepLink() {
        try {
          if (type === "hund_des_monats") {
            const { data, error } = await supabase
              .from("hund_des_monats")
              .select("memberstack_id")
              .eq("id", refId)
              .maybeSingle();

            if (!error && data && data.memberstack_id) {
              return {
                ownerId: data.memberstack_id,
                deepLink: `/rezepte?post=${encodeURIComponent(refId)}`,
              };
            }
          } else if (type === "profile_gallery") {
            const parts = String(refId || "").split("/");
            const ownerId = parts[0] || null;
            const file = parts[1] || null;
            if (ownerId && file) {
              return {
                ownerId,
                deepLink: `/user?uid=${encodeURIComponent(ownerId)}&photo=${encodeURIComponent(file)}`,
              };
            }
          }
        } catch (err) {
          console.warn("[comments owner lookup]", err);
        }
        return { ownerId: null, deepLink: null };
      }

      async function sendCommentNotification(newComment, parentComment) {
        if (!window._doggo || typeof window._doggo.sendPush !== "function") return;

        const me = await getCurrentMember();
        if (!me || !me.id) return;

        const actorId = me.id;
        const actorName = me.hundename || "Ein DoggoMeal Nutzer";
        const preview = String(newComment?.content || "").slice(0, 80);

        const { ownerId, deepLink } = await getContentOwnerAndDeepLink();
        const targetIds = new Set();

        if (parentComment && parentComment.memberstack_id && parentComment.memberstack_id !== actorId) {
          targetIds.add(String(parentComment.memberstack_id));
        }
        if (ownerId && ownerId !== actorId) {
          targetIds.add(String(ownerId));
        }
        if (!targetIds.size) return;

        const isReply = !!parentComment;
        const title = isReply ? "Neue Antwort auf deinen Kommentar" : "Neuer Kommentar zu deinem Beitrag";
        const body = preview ? `${actorName}: "${preview}"` : `${actorName} hat einen Kommentar hinterlassen 🐾`;

        for (const target of targetIds) {
          try {
            await window._doggo.sendPush(target, title, body, deepLink || null);
          } catch (err) {
            console.warn("[comment push]", err);
          }
        }
      }

      async function loadComments() {
        const me = await getCurrentMember();
        const viewerId = me.id;

        const { data: rows, error } = await supabase
          .from("comments")
          .select("*")
          .eq("type", type)
          .eq("ref_id", refId)
          .is("deleted_at", null)
          .order("created_at", { ascending: true });

        list.innerHTML = "";
        if (error) {
          list.innerHTML = '<li style="color:#c00">Fehler beim Laden.</li>';
          empty.style.display = "none";
          return;
        }
        const comments = Array.isArray(rows) ? rows : [];
        empty.style.display = comments.length ? "none" : "";

        const byId = new Map();
        comments.forEach((c) => {
          c.children = [];
          byId.set(c.id, c);
        });
        const roots = [];
        comments.forEach((c) => {
          if (c.parent_id && byId.has(c.parent_id)) {
            byId.get(c.parent_id).children.push(c);
          } else {
            roots.push(c);
          }
        });

        roots.forEach((root) => list.appendChild(renderCommentItem(root, viewerId)));
      }

      function bindAvatarNav(imgEl, authorId) {
        if (!imgEl) return;
        imgEl.style.cursor = "pointer";
        imgEl.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const meId = window._DM_MY_ID || null;
          const isSelf = String(authorId || "") === String(meId || "");
          if (isSelf) {
            location.assign("/rezepte#hundeprofil");
          } else {
            location.assign(`/user?uid=${encodeURIComponent(authorId || "")}`);
          }
        });
      }

      function renderCommentItem(c, viewerId) {
        const own = String(c.memberstack_id || "") === String(viewerId || "");
        const li = document.createElement("li");
        li.className = "dgm-comment" + (own ? " dgm-comment-own" : "");
        li.dataset.commentId = c.id;
        li.dataset.authorId = c.memberstack_id || "";

        const profileImg = c.profilbild || "https://i.imgur.com/ZcLLrkY.png";
        const username = c.username || "Doggo";
        const when = formatTimeCompact(c.created_at);

        li.innerHTML = `
          <img class="dgm-comment-profile" src="${profileImg}" alt="Profilbild">
          <div class="dgm-comment-main">
            <div class="dgm-comment-headline">
              <span class="dgm-comment-username">${escapeHTML(username)}</span>
              <span class="dgm-comment-dot">•</span>
              <time class="dgm-comment-time" datetime="${c.created_at}">${when}</time>
            </div>
            <div class="dgm-comment-content">${escapeHTML(c.content)}</div>
            <div class="dgm-comment-actions">
              <button class="dgm-reply-btn" type="button">Antworten</button>
            </div>
            <form class="dgm-reply-form" style="display:none">
              <textarea maxlength="420" placeholder="Antworte…"></textarea>
              <button type="submit" disabled>Posten</button>
            </form>
            <div class="dgm-replies-wrap">
              <button class="dgm-replies-toggle" style="display:none" type="button"></button>
              <ul class="dgm-replies" role="list"></ul>
            </div>
          </div>
          ${
            own
              ? `<button class="dgm-comment-delete" title="Löschen" data-id="${c.id}" aria-label="Löschen">&times;</button>`
              : `<button class="dgm-comment-report" title="Melden" data-id="${c.id}" aria-label="Melden">🚩</button>`
          }
        `;

        bindAvatarNav(li.querySelector(".dgm-comment-profile"), c.memberstack_id);

        if (own) {
          li.querySelector(".dgm-comment-delete").onclick = async (e) => {
            e.preventDefault();
            if (confirm("Kommentar wirklich löschen?")) {
              await supabase.from("comments").update({ deleted_at: new Date().toISOString() }).eq("id", c.id);
              loadComments();
            }
          };
        } else {
          const rb = li.querySelector(".dgm-comment-report");
          if (rb) {
            rb.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (typeof openReportDialog === "function") openReportDialog("kommentar", c.id);
            };
          }
        }

        const repliesUl = li.querySelector(".dgm-replies");
        const toggleBtn = li.querySelector(".dgm-replies-toggle");
        const replies = (c.children || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        let expanded = false;
        function updateReplies() {
          repliesUl.innerHTML = "";
          if (!replies.length) {
            toggleBtn.style.display = "none";
            return;
          }
          if (!expanded) {
            toggleBtn.textContent = `– ${replies.length} weitere antworten ansehen`;
            toggleBtn.style.display = "inline-block";
          } else {
            toggleBtn.textContent = "– antworten verbergen";
            toggleBtn.style.display = "inline-block";
            replies.forEach((r) => repliesUl.appendChild(renderReplyItem(r, viewerId)));
          }
        }
        toggleBtn.onclick = () => {
          expanded = !expanded;
          updateReplies();
        };
        updateReplies();

        const replyBtn = li.querySelector(".dgm-reply-btn");
        const replyForm = li.querySelector(".dgm-reply-form");
        const replyTa = replyForm.querySelector("textarea");
        const replySend = replyForm.querySelector('button[type="submit"]');

        replyBtn.onclick = () => {
          replyForm.style.display = replyForm.style.display === "none" ? "grid" : "none";
          if (replyForm.style.display !== "none") replyTa.focus();
        };
        replyTa.oninput = () => (replySend.disabled = !replyTa.value.trim());

        replyForm.onsubmit = async (e) => {
          e.preventDefault();
          const me = await getCurrentMember();
          const val = replyTa.value.trim();
          if (!val || !me.id) return;

          const payload = {
            memberstack_id: me.id,
            username: me.hundename,
            profilbild: me.profilbild || null,
            type,
            ref_id: refId,
            content: val,
            parent_id: c.id,
            created_at: new Date().toISOString(),
            edited_at: null,
            deleted_at: null,
          };

          const { error } = await supabase.from("comments").insert(payload);
          if (error) {
            console.error("[reply insert]", error);
            window.showDoggoSnackbar?.("❌ Antwort konnte nicht gespeichert werden.");
            return;
          }

          replyTa.value = "";
          replySend.disabled = true;
          expanded = true;

          sendCommentNotification(payload, c);

          await loadComments();
          li.scrollIntoView({ behavior: "smooth", block: "nearest" });
        };

        return li;
      }

      function renderReplyItem(r, viewerId) {
        const own = String(r.memberstack_id || "") === String(viewerId || "");
        const li = document.createElement("li");
        li.className = "dgm-reply";
        li.dataset.commentId = r.id;

        const when = formatTimeCompact(r.created_at);

        li.innerHTML = `
          <img class="dgm-comment-profile small" src="${r.profilbild || "https://i.imgur.com/ZcLLrkY.png"}" alt="Profilbild">
          <div class="dgm-comment-main">
            <div class="dgm-comment-headline">
              <span class="dgm-comment-username">${escapeHTML(r.username || "Doggo")}</span>
              <span class="dgm-comment-dot">•</span>
              <time class="dgm-comment-time" datetime="${r.created_at}">${when}</time>
            </div>
            <div class="dgm-comment-content">${escapeHTML(r.content)}</div>
          </div>
          ${
            own
              ? `<button class="dgm-comment-delete" title="Löschen" data-id="${r.id}" aria-label="Löschen">&times;</button>`
              : `<button class="dgm-comment-report" title="Melden" data-id="${r.id}" aria-label="Melden">🚩</button>`
          }
        `;

        bindAvatarNav(li.querySelector(".dgm-comment-profile"), r.memberstack_id);

        const delBtn = li.querySelector(".dgm-comment-delete");
        if (delBtn) {
          delBtn.onclick = async (e) => {
            e.preventDefault();
            if (confirm("Kommentar wirklich löschen?")) {
              await supabase.from("comments").update({ deleted_at: new Date().toISOString() }).eq("id", r.id);
              loadComments();
            }
          };
        } else {
          const rb = li.querySelector(".dgm-comment-report");
          if (rb) {
            rb.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (typeof openReportDialog === "function") openReportDialog("kommentar", r.id);
            };
          }
        }

        return li;
      }

      function escapeHTML(str) {
        return String(str).replace(/[&<>"']/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
      }

      function formatTimeCompact(dateString) {
        const now = new Date();
        const d = new Date(dateString);
        let sec = Math.max(1, Math.floor((now - d) / 1000));
        if (sec < 60) return `${sec}Sek.`;
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}Min.`;
        const hrs = Math.floor(min / 60);
        if (hrs < 24) return `${hrs}Std.`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return days === 1 ? "1 Tag" : `${days}Tage`;
        const weeks = Math.floor(days / 7);
        if (weeks < 52) return weeks === 1 ? "1 Woche" : `${weeks}Wochen`;
        const years = Math.floor(days / 365);
        return years <= 1 ? "1 Jahr" : `${years}Jahre`;
      }

      function ensureStyles() {
        if (document.getElementById("dgm-comments-styles-v2")) return;
        const css = `
:root{
  --dgm-ink: var(--dm-ink, #3a2d1a);
  --dgm-muted: var(--dm-muted, #8a6f57);
  --dgm-accent: var(--dm-brand, #cc7255);
  --dgm-br: var(--dm-br, #ead8bd);
  --dgm-bg: var(--dm-panel, #fff9f1);
}
.dgm-comments-box.dgm-comments-wide{ margin-left:-8px; margin-right:-8px; position:relative; z-index:auto; }
.dgm-comments-title{ font-weight:900; margin:8px 2px 8px; color:var(--dgm-ink); }
.dgm-comments-form{
  display:grid; grid-template-columns:1fr auto; gap:8px; align-items:start;
  background:var(--dgm-bg); border:1.5px solid var(--dgm-br); border-radius:12px; padding:8px;
}
.dgm-comments-form textarea{
  width:100%; min-height:68px; resize:vertical; box-sizing:border-box;
  border:1.5px solid var(--dgm-br); border-radius:10px; padding:8px 10px; background:#fffdf8;
}
.dgm-comments-form button{ border:2px solid var(--dgm-accent); background:var(--dgm-accent); color:#fff; border-radius:10px; padding:10px 12px; font-weight:900; }
.dgm-comments-form button:disabled{ opacity:.55; filter:grayscale(.1); }
.dgm-reply-form{
  margin-top:6px;
  display:grid;
  grid-template-columns:1fr auto;
  gap:8px;
  align-items:start;
}
.dgm-reply-form textarea{
  min-height:48px;
  resize:vertical;
  border:1.5px solid var(--dgm-br);
  border-radius:10px;
  padding:8px 10px;
  background:#fffdf8;
}
.dgm-reply-form button[type="submit"]{
  appearance:none; -webkit-appearance:none;
  border:2px solid var(--dgm-accent);
  background:var(--dgm-accent);
  color:#fff;
  border-radius:10px;
  padding:10px 12px;
  line-height:1;
  font-weight:900;
  font-size:13px;
}
.dgm-reply-form button[type="submit"]:disabled{
  opacity:.55;
  filter:grayscale(.05);
}
.dgm-comments-list{ list-style:none; margin:10px 0 0; padding:0; display:flex; flex-direction:column; gap:10px; }
.dgm-comment{
  position:relative; display:grid; grid-template-columns:40px 1fr auto;
  gap:10px; padding:8px 8px; border:1.5px solid var(--dgm-br); border-radius:12px; background:#fffdf8;
}
.dgm-comment-profile{ width:36px; height:36px; border-radius:50%; object-fit:cover; border:2px solid var(--dgm-br); }
.dgm-comment-profile.small{ width:28px; height:28px; }
.dgm-comment-main{ min-width:0; }
.dgm-comment-headline{ display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; }
.dgm-comment-username{ font-weight:900; font-size:13.5px; color:var(--dgm-ink); }
.dgm-comment-time{ font-size:12px; color:color-mix(in oklab, var(--dgm-muted) 83%, #000 0%); }
.dgm-comment-dot{ color:color-mix(in oklab, var(--dgm-muted) 83%, #000 0%); }
.dgm-comment-content{
  margin-top:2px; font-size:14.5px; line-height:1.35; color:var(--dgm-ink);
  white-space:pre-wrap; overflow-wrap:anywhere;
}
.dgm-comment-actions{ margin-top:6px; }
.dgm-comment-actions .dgm-reply-btn{
  background:none; border:none; padding:0; cursor:pointer; font-weight:800;
  color:color-mix(in oklab, var(--dgm-muted) 75%, #000 0%); font-size:12.5px;
}
.dgm-replies-wrap{ margin-top:4px; }
.dgm-replies-toggle{
  background:none; border:none; padding:0; cursor:pointer; font-weight:800;
  color:color-mix(in oklab, var(--dgm-muted) 75%, #000 0%); font-size:12.5px;
}
.dgm-replies{ list-style:none; margin:6px 0 0 0; padding:0 0 0 0; display:flex; flex-direction:column; gap:8px; }
.dgm-reply{ display:grid; grid-template-columns:40px 1fr auto; gap:10px; }
.dgm-reply .dgm-comment-content{ font-size:14.5px; }
.dgm-comment-delete{
  align-self:start; background:none; border:none; color:#b83b3b; font-size:18px; line-height:1; cursor:pointer;
}
.dgm-comment-report{
  align-self:start; background:none; border:none; font-size:15px; line-height:1; cursor:pointer;
  filter:grayscale(0); opacity:.8; color:#d84a4a;
}
.dgm-comment-report:hover{ opacity:1; }
.dgm-comments-empty{ opacity:.65; padding:6px 2px; }
`;
        const el = document.createElement("style");
        el.id = "dgm-comments-styles-v2";
        el.textContent = css;
        document.head.appendChild(el);
      }

      input.oninput = () => (send.disabled = !input.value.trim());
      form.onsubmit = async (e) => {
        e.preventDefault();
        const val = input.value.trim();
        if (!val) return;

        const me = await getCurrentMember();
        if (!me.id) {
          window.showDoggoSnackbar?.("Bitte einloggen, um zu kommentieren.");
          return;
        }

        const payload = {
          memberstack_id: me.id,
          username: me.hundename,
          profilbild: me.profilbild || null,
          type,
          ref_id: refId,
          content: val,
          parent_id: null,
          created_at: new Date().toISOString(),
          edited_at: null,
          deleted_at: null,
        };

        const { error } = await supabase.from("comments").insert(payload);
        if (error) {
          console.error("[comment insert]", error);
          window.showDoggoSnackbar?.("❌ Kommentar konnte nicht gespeichert werden.");
          return;
        }

        input.value = "";
        send.disabled = true;

        sendCommentNotification(payload, null);
        loadComments();
      };

      loadComments();
    },
  };

  // ====== Abo Sync (dein Block) =======================================
  (function () {
    async function syncAboFields() {
      try {
        const ms = await waitMemberstack();
        if (!ms) return;

        const res = await ms.getCurrentMember();
        const raw = res && res.data;
        const member = (raw && (raw.member || raw)) || null;
        if (!member) return;

        const cf = member.customFields || {};

        let status = String(cf["abo-status"] || "none").toLowerCase().trim() || "none";
        let startedAt = cf["abo-started-at"] || "";
        let plan = cf["abo-plan"] || "";

        const cancelRaw = cf["cancel-at-period-end"];
        let cancelAtPeriodEnd =
          cancelRaw === true || cancelRaw === "true" || cancelRaw === 1 || cancelRaw === "1";

        let originalTx = cf["apple-original-transaction-id"] || "";

        let sub = null;
        if (Array.isArray(member.memberships) && member.memberships.length > 0) sub = member.memberships[0];
        else if (member.membership) sub = member.membership;
        else if (Array.isArray(member.planConnections) && member.planConnections.length > 0) sub = member.planConnections[0];

        if (sub) {
          const rawStatus = sub.status || sub.planStatus || member.status || "";
          status = String(rawStatus || "active").toLowerCase().trim() || "active";

          const rawDate =
            sub.startDate ||
            sub.startedAt ||
            sub.createdAt ||
            (sub.subscription &&
              (sub.subscription.startDate || sub.subscription.startedAt || sub.subscription.createdAt)) ||
            "";

          if (rawDate) {
            const d = new Date(rawDate);
            startedAt = isNaN(d.getTime()) ? String(rawDate) : d.toISOString();
          }

          plan = sub.planId || sub.priceId || sub.plan || sub.id || plan;

          cancelAtPeriodEnd = !!(
            sub.cancelAtPeriodEnd ||
            sub.cancel_at_period_end ||
            (sub.subscription &&
              (sub.subscription.cancelAtPeriodEnd || sub.subscription.cancel_at_period_end))
          );
        }

        if (!startedAt && status === "active") startedAt = new Date().toISOString();

        const payload = {
          customFields: {
            "abo-status": status,
            "abo-started-at": startedAt,
            "abo-plan": plan,
            "cancel-at-period-end": cancelAtPeriodEnd ? "true" : "false",
            "apple-original-transaction-id": originalTx || "",
          },
        };

        const isApplePlan =
          String(plan || "").toLowerCase().startsWith("apple_") ||
          String(cf["abo-plan"] || "").toLowerCase().startsWith("apple_");

        if (isApplePlan) delete payload.customFields["cancel-at-period-end"];

        const updateFn = ms.updateCurrentMember || ms.updateMember || ms.updateProfile;
        if (!updateFn) return;

        await updateFn(payload);
      } catch (e) {
        console.warn("[DoggoMeal] Abo-Feld-Sync Fehler:", e);
      }
    }

    onReady(() => setTimeout(syncAboFields, 800));
  })();

  // ====== Apple Abo Verknüpfen ========================================
  window.DoggoMealAppleSubscription = async function (originalTxId) {
    try {
      const ms = await waitMemberstack();
      if (!ms) return;

      const res = await ms.getCurrentMember();
      const raw = res && res.data;
      const member = raw && (raw.member || raw);

      if (!member || !member.id) {
        alert("Bitte eingeloggt bleiben, damit dein Abo verknüpft wird.");
        return;
      }

      const updateFn = ms.updateCurrentMember || ms.updateMember || ms.updateProfile;
      if (!updateFn) return;

      await updateFn({
        customFields: {
          "apple-original-transaction-id": originalTxId || "",
          "abo-status": "active",
          "abo-plan": "apple_monthly",
          "abo-started-at": new Date().toISOString(),
          "cancel-at-period-end": "false",
        },
      });

      if (window._doggo && typeof window._doggo.syncDoggoMember === "function") {
        window._doggo.syncDoggoMember();
      }

      if (typeof window.Capacitor !== "undefined") {
        window.location.href = "/rezepte?apple=1";
      }
    } catch (e) {
      console.log("[DoggoMeal] Apple-Abo-Verknüpfung Fehler:", e);
    }
  };

  // ====== Apple Status Sync ===========================================
  (function () {
    async function applyAppleStatus(payload) {
      try {
        const endMsRaw =
          payload.currentPeriodEndMs ?? payload.current_period_end_ms ?? payload.endMs ?? payload.end_ms ?? null;

        let endMs = 0;
        if (endMsRaw != null) {
          endMs = Number(endMsRaw);
          if (endMs > 0 && endMs < 10_000_000_000) endMs = endMs * 1000;
        }

        const willRenewRaw =
          payload.willRenew ?? payload.will_renew ?? payload.autoRenew ?? payload.auto_renew ?? null;

        const willRenew = willRenewRaw === true || willRenewRaw === 1 || String(willRenewRaw).toLowerCase() === "true";

        const endDate = endMs > 0 ? new Date(endMs) : null;
        const endIso = endDate && !isNaN(endDate.getTime()) ? endDate.toISOString() : "";

        const ms = await waitMemberstack();
        if (!ms) return;

        let member;
        try {
          const res = await ms.getCurrentMember();
          member = res?.data?.member || res?.data;
        } catch {
          return;
        }
        if (!member || !member.id) return;

        const nowMs = Date.now();
        const cf = {};
        const isInCurrentPeriod = endMs > nowMs + 60_000;

        if (isInCurrentPeriod && willRenew) {
          cf["abo-status"] = "active";
          cf["abo-plan"] = "apple_monthly";
          cf["cancel-at-period-end"] = "false";
          cf["abo-renews-at"] = endIso;
          cf["abo-ends-at"] = "";
        } else if (isInCurrentPeriod && !willRenew) {
          cf["abo-status"] = "active";
          cf["abo-plan"] = "apple_monthly";
          cf["cancel-at-period-end"] = "true";
          cf["abo-renews-at"] = "";
          cf["abo-ends-at"] = endIso;
        } else {
          cf["abo-status"] = "none";
          cf["abo-plan"] = "";
          cf["cancel-at-period-end"] = "false";
          cf["abo-renews-at"] = "";
          cf["abo-ends-at"] = endIso;
        }

        if (payload.originalTransactionId || payload.originalTxId || payload.original_transaction_id) {
          cf["apple-original-transaction-id"] = String(
            payload.originalTransactionId || payload.originalTxId || payload.original_transaction_id
          );
        }

        const updateFn = ms.updateCurrentMember || ms.updateMember || ms.updateProfile;
        if (!updateFn) return;

        await updateFn({ customFields: cf });

        if (window._doggo && typeof window._doggo.syncDoggoMember === "function") {
          window._doggo.syncDoggoMember();
        }
      } catch (e) {
        console.error("[DoggoMeal] AppleStatus apply Fehler:", e);
      }
    }

    window.DoggoMealAppleStatus = function (payload) {
      window.__DoggoAppleStatusBuffer = window.__DoggoAppleStatusBuffer || [];
      if (payload) window.__DoggoAppleStatusBuffer.push(payload);
      const latest = window.__DoggoAppleStatusBuffer[window.__DoggoAppleStatusBuffer.length - 1];
      if (latest) applyAppleStatus(latest);
    };

    if (window.__DoggoAppleStatusBuffer && Array.isArray(window.__DoggoAppleStatusBuffer)) {
      const last = window.__DoggoAppleStatusBuffer[window.__DoggoAppleStatusBuffer.length - 1];
      if (last) applyAppleStatus(last);
    }
  })();

  // ====== Supabase Sync doggo_members ==================================
  (function () {
    function whenMemberstackReady() {
      return waitMemberstack();
    }

    async function syncDoggoMember() {
      try {
        await whenMemberstackReady();

        const ms = window.$memberstackDom;
        const res = await ms.getCurrentMember();
        const raw = res && res.data;
        const m = (raw && (raw.member || raw)) || null;
        if (!m || !m.id) return;

        const cf = m.customFields || {};
        const auth = m.auth || {};

        const member_id = m.id;
        const email = auth.email || cf.email || null;
        const stripe_customer_id = m.stripeCustomerId || m.stripeCustomerID || null;

        const hundename = cf.hundename || cf["hundename"] || null;
        const rasse = cf.rasse || null;

        let gewicht = null;
        if (cf.gewicht != null && cf.gewicht !== "") {
          const g = parseFloat(String(cf.gewicht).replace(",", "."));
          if (!isNaN(g)) gewicht = g;
        }

        const abo_status = cf["abo-status"] || null;
        const abo_plan = cf["abo-plan"] || null;

        const cancelRaw = cf["cancel-at-period-end"];
        const cancelFlag = cancelRaw === true || cancelRaw === "true" || cancelRaw === 1 || cancelRaw === "1";

        const appleTxId = cf["apple-original-transaction-id"] || null;

        let abo_started_at = null;
        if (cf["abo-started-at"]) {
          const d = new Date(cf["abo-started-at"]);
          abo_started_at = isNaN(d.getTime()) ? cf["abo-started-at"] : d.toISOString();
        }

        let abo_renews_at = null;
        if (cf["abo-renews-at"]) {
          const d = new Date(cf["abo-renews-at"]);
          abo_renews_at = isNaN(d.getTime()) ? cf["abo-renews-at"] : d.toISOString();
        }

        let abo_ends_at = null;
        if (cf["abo-ends-at"]) {
          const d = new Date(cf["abo-ends-at"]);
          abo_ends_at = isNaN(d.getTime()) ? cf["abo-ends-at"] : d.toISOString();
        }

        const row = {
          member_id,
          email,
          stripe_customer_id,
          hundename,
          rasse,
          gewicht,
          abo_status,
          abo_started_at,
          abo_plan,
          cancel_at_period_end: cancelFlag,
          apple_original_transaction_id: appleTxId,
          abo_renews_at,
          abo_ends_at,
        };

        await window.supabase.from("doggo_members").upsert(row, { onConflict: "member_id" });
      } catch (e) {
        console.warn("[DoggoMeal] syncDoggoMember Fehler:", e);
      }
    }

    window._doggo = window._doggo || {};
    window._doggo.syncDoggoMember = syncDoggoMember;

    onReady(() => setTimeout(syncDoggoMember, 1000));
  })();

  // ====== In-App: Google Button ausblenden =============================
  (function () {
    if (typeof window.Capacitor === "undefined") return;

    function hideGoogleButtons() {
      var googleBtns = document.querySelectorAll('[data-ms-auth-provider="google"]');
      googleBtns.forEach(function (btn) {
        btn.style.display = "none";
      });
    }

    onReady(hideGoogleButtons);

    var observer = new MutationObserver(hideGoogleButtons);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  })();

  // ====== In-App: interne Links ohne target ============================
  (function () {
    if (typeof window.Capacitor === "undefined") return;

    function fixInternalLinks() {
      var links = document.querySelectorAll("a[href]");
      links.forEach(function (a) {
        var href = a.getAttribute("href");
        if (!href) return;

        var isInternal =
          href.startsWith("/") ||
          href.indexOf("doggomeal.de") !== -1 ||
          href.indexOf("doggomeal.webflow.io") !== -1;

        if (isInternal) a.removeAttribute("target");
      });
    }

    onReady(fixInternalLinks);

    var observer = new MutationObserver(fixInternalLinks);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  })();

  // ====== Capacitor Plugin Listener (DoggoSubscription) =================
  (function () {
    if (typeof window.Capacitor === "undefined") return;

    if (typeof window.Capacitor.registerPlugin === "function") {
      window.Capacitor.Plugins = window.Capacitor.Plugins || {};
      if (!window.Capacitor.Plugins.DoggoSubscription) {
        window.Capacitor.Plugins.DoggoSubscription = window.Capacitor.registerPlugin("DoggoSubscription");
      }
    }

    var plugin = window.Capacitor.Plugins && window.Capacitor.Plugins.DoggoSubscription;
    if (!plugin || !plugin.addListener) return;

    plugin.addListener("appleSubscriptionActive", function (event) {
      var txId = event && event.originalTransactionId;
      if (typeof window.DoggoMealAppleSubscription === "function") {
        window.DoggoMealAppleSubscription(txId || "");
      }
    });

    plugin.addListener("appleSubscriptionStatus", function (event) {
      if (typeof window.DoggoMealAppleStatus === "function") {
        window.DoggoMealAppleStatus(event || {});
      }
    });
  })();

  // ====== Push: sendPush ===============================================
  (function () {
    async function sendPush(recipientId, title, body, deepLink) {
      try {
        const res = await fetch(PUSH_FUNC_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPA_ANON,
            Authorization: "Bearer " + SUPA_ANON,
          },
          body: JSON.stringify({
            recipient_id: String(recipientId),
            title: String(title || ""),
            body: String(body || ""),
            deep_link: deepLink || null,
          }),
        });

        return res;
      } catch (e) {
        console.warn("[DoggoMeal] Push-Request fehlgeschlagen", e);
        return null;
      }
    }

    window._doggo = window._doggo || {};
    window._doggo.sendPush = sendPush;
  })();

  // ====== Push: init (Token holen) + registerPushDevice =================
  (function () {
    if (typeof window.Capacitor === "undefined") return;

    if (window.__DM_PUSH_INIT_DONE) return;
    window.__DM_PUSH_INIT_DONE = true;

    const Push =
      (window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) ||
      window.Capacitor.PushNotifications;

    if (!Push) return;

    window.DoggoMealNative = window.DoggoMealNative || {};
    window.DoggoMealNative.onPushToken = function (token) {
      window._dmPushToken = token;
    };

    async function initPush() {
      try {
        await Push.addListener("registration", (data) => {
          const newToken = data.value;
          if (window._dmPushToken === newToken) return;
          window._dmPushToken = newToken;
          if (window._doggo && typeof window._doggo.registerPushDevice === "function") {
            window._doggo.registerPushDevice();
          }
        });

        await Push.addListener("registrationError", (err) => {
          console.error("[DM Push] registrationError:", err);
        });

        const perm = await Push.requestPermissions();
        if (perm.receive !== "granted") return;

        await Push.register();
      } catch (e) {
        console.error("[DM Push] initPush Fehler:", e);
      }
    }

    async function waitForTokenAndMember() {
      let tries = 0;
      while (tries < 60) {
        const hasToken = typeof window._dmPushToken === "string" && window._dmPushToken.length > 0;
        const hasMS = !!(window.$memberstackDom && window.$memberstackDom.getCurrentMember);
        const hasSupa = !!window.supabase;
        if (hasToken && hasMS && hasSupa) return true;
        tries++;
        await new Promise((r) => setTimeout(r, 500));
      }
      return false;
    }

    async function registerPushDevice() {
      try {
        const ok = await waitForTokenAndMember();
        if (!ok) return;

        const token = window._dmPushToken;
        const ms = window.$memberstackDom;

        const { data } = await ms.getCurrentMember();
        const raw = (data && (data.member || data)) || {};
        if (!raw.id) return;

        const cf = raw.customFields || {};
        const userId = cf.user_id || cf["user_id"] || raw.id;

        const platform = document.documentElement.classList.contains("dm-android") ? "android" : "ios";

        const { error } = await window.supabase
          .from("push_devices")
          .upsert(
            {
              user_id: userId,
              platform: platform,
              token: token,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "token" }
          );

        if (!error) {
          await window.supabase
            .from("push_devices")
            .delete()
            .eq("user_id", userId)
            .eq("platform", platform)
            .neq("token", token);
        }
      } catch (e) {
        console.error("[DoggoMeal] PushDevice register Fehler:", e);
      }
    }

    window._doggo = window._doggo || {};
    window._doggo.registerPushDevice = registerPushDevice;

    onReady(() => {
      initPush();
      registerPushDevice();
    });
  })();
})();
