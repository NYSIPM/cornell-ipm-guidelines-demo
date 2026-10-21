(function () {
  // =========================================================
  // Comments for the pesticide table builder
  //  - Comment editor shown in the comment row while editing a treatment
  //  - Comment search / edit modal
  //  - Comment button click handling
  // Helpers from pesticide-table-builder.js are passed in with setHelpers().
  // =========================================================
  let helpers = {};

  function setHelpers(injectedHelpers) {
    helpers = injectedHelpers || helpers;
  }

  function escapeHtml(str) {
    return helpers.escapeHtml(str);
  }

  function clean(value) {
    return helpers.clean(value);
  }

  function getRowKey(row) {
    return helpers.getRowKey(row);
  }

  function findRowByElement(tr, container) {
    return helpers.findRowByElement(tr, container);
  }

  // =========================================================
  // Comment Editor (inside the table row)
  // =========================================================

  //Added 4/14/2026
  function renderCommentEditor(row) {
    const comments = row?.treatment?.comments || [];
    const siteId = row?.siteId ?? row?.treatment?.siteId ?? "";
    const guidelineId = row?.treatment?.guidelineId ?? "";
    const pestId = row?.pestId ?? row?.treatment?.pestId ?? "";

    const existingBlocks = comments.length
      ? comments.map((comment, index) => `
          <div class="comment-editor-block"
            data-comment-index="${index}"
            data-comment-id="${escapeHtml(comment.commentId ?? 0)}"
            data-index-number="${escapeHtml(comment.indexNumber ?? "")}"
            data-comment-text="${escapeHtml(comment.commentText || comment.comment || "")}"
            style="border:1px solid #ddd; padding:10px; margin-bottom:8px; background:#fafafa;">

            <div style="font-size:12px; color:#666; margin-bottom:8px;">
              <strong>CommentId:</strong> ${escapeHtml(comment.commentId ?? 0)}
              ${comment.indexNumber ? ` 
              &nbsp; | &nbsp; 
              <strong>Index:</strong> ${escapeHtml(comment.indexNumber)}` : ""}
              &nbsp; | &nbsp;
              <strong>SiteId:</strong> ${escapeHtml(siteId)}
              &nbsp; | &nbsp;
              <strong>GuidelineId:</strong> ${escapeHtml(guidelineId)}
              &nbsp; | &nbsp;
              <strong>PestId:</strong> ${escapeHtml(pestId)}
            </div>

            <div style="margin-bottom:8px"><!-- ; white-space:pre-wrap; -->
              ${escapeHtml(comment.commentText || "") || "<em>No comment text</em>"}
            </div>

            <div style="display:flex; gap:8px;">
              <button type="button" class="edit-linked-comment-btn">Edit</button>
              <button type="button" class="remove-comment-block-btn">Remove</button>
            </div>
          </div>
        `).join("")
      : `
        <div style="font-size:12px; color:#666; margin-bottom:8px;">
          No comments yet for this treatment.
        </div>
      `;

    return `
      <div class="comment-editor-area">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <strong>Comments</strong>
          <div style="display:flex; gap:8px;">
            <button type="button" class="open-comment-search-btn">Add Comment</button>
          </div>
        </div>

        <div class="comment-editor-list">
          ${existingBlocks}
        </div>
      </div>
    `;
  }

  
  function renderBlankCommentEditorBlock(row) {
    const siteId = row?.siteId ?? row?.treatment?.siteId ?? "";
    const guidelineId = row?.treatment?.guidelineId ?? "";
    const pestId = row?.pestId ?? row?.treatment?.pestId ?? "";

    return `
      <div class="comment-editor-block"
          data-comment-index="new"
          data-comment-id="0"
          data-index-number=""
          data-comment-text=""
          style="border:1px solid #ddd; padding:10px; margin-bottom:8px; background:#fafafa;">

        <div style="font-size:12px; color:#666; margin-bottom:8px;">
          <strong>CommentId:</strong> 0
        </div>

        <div style="font-size:12px; color:#666; margin-bottom:8px;">
          <strong>SiteId:</strong> ${escapeHtml(siteId)}
          &nbsp; | &nbsp;
          <strong>GuidelineId:</strong> ${escapeHtml(guidelineId)}
          &nbsp; | &nbsp;
          <strong>PestId:</strong> ${escapeHtml(pestId)}
        </div>

        <div style="margin-bottom:8px;">
          <label style="display:block; font-size:12px;">Index Number</label>
          <input type="text" data-field="comment-indexNumber" value="" style="width:100%;">
        </div>

        <div style="margin-bottom:8px;">
          <label style="display:block; font-size:12px;">Comment Text</label>
          <textarea data-field="comment-commentText" rows="3" style="width:100%;"></textarea>
        </div>

        <div style="display:flex; gap:8px;">
          <button type="button" class="link-existing-comment-btn">Link Existing</button>
          <button type="button" class="remove-comment-block-btn">Remove</button>
        </div>
      </div>
    `;
  }

  // Handles clicks on the comment buttons (Add / Edit / Remove / Link).
  // row is passed in by the edit modal; without it the row is found from the table rows.
  // Returns true if the click was a comment action so the click handler can stop there.
  async function handleCommentClick(e, container, rowOverride = null) {
    //const addCommentBlockBtn = e.target.closest(".add-comment-block-btn");
    const removeCommentBlockBtn = e.target.closest(".remove-comment-block-btn");
    //const showLinkCommentPlaceholderBtn = e.target.closest(".show-link-comment-placeholder-btn"); //No Longer Neded
    const linkExistingCommentBtn = e.target.closest(".link-existing-comment-btn");
    //Comment Modol
    const openCommentSearchBtn = e.target.closest(".open-comment-search-btn");
    //Add 4-22-2026
    const editLinkedCommentBtn = e.target.closest(".edit-linked-comment-btn");

    if (editLinkedCommentBtn) {
      const block = editLinkedCommentBtn.closest(".comment-editor-block");
      const commentRow = editLinkedCommentBtn.closest("tr.comment-row");
      const dataRow = commentRow?.previousElementSibling?.previousElementSibling;
      const row = rowOverride || (dataRow ? findRowByElement(dataRow, container) : null);
      const editorArea = editLinkedCommentBtn.closest(".comment-editor-area");
      const list = editorArea?.querySelector(".comment-editor-list");

      if (!block || !row || !list) return true;

      const existingComment = {
        commentId: parseInt(block.dataset.commentId, 10) || 0,
        indexNumber: block.dataset.indexNumber || "",
        commentText: block.dataset.commentText || "",
        siteId: row?.siteId ?? row?.treatment?.siteId ?? null,
        guidelineId: row?.treatment?.guidelineId ?? null,
        pests: [
          {
            pestId: parseInt(row?.pestId ?? row?.treatment?.pestId ?? 0, 10) || 0,
            name: null
          }
        ].filter(p => p.pestId > 0)
      };

      await openCommentSearchModal(row, container, list, existingComment);
      return true;
    }

    if (removeCommentBlockBtn) {
      const block = removeCommentBlockBtn.closest(".comment-editor-block");
      if (block) {
        block.remove();
      }
      return true;
    }

    /*
    if (showLinkCommentPlaceholderBtn) {
      const editorArea = showLinkCommentPlaceholderBtn.closest(".comment-editor-area");
      const placeholder = editorArea?.querySelector(".comment-link-placeholder");
      if (placeholder) {
        placeholder.style.display = placeholder.style.display === "none" ? "block" : "none";
      }
      return true;
    }

    if (linkExistingCommentBtn) {
      alert("Existing comment linking UI can be added here later.");
      return true;
    }
    */

    if (openCommentSearchBtn) {
      const commentRow = openCommentSearchBtn.closest("tr.comment-row");
      const dataRow = commentRow?.previousElementSibling?.previousElementSibling;
      const row = rowOverride || (dataRow ? findRowByElement(dataRow, container) : null);
      const editorArea = openCommentSearchBtn.closest(".comment-editor-area");
      const list = editorArea?.querySelector(".comment-editor-list");

      if (row && list) {
        await openCommentSearchModal(row, container, list);
      }
      return true;
    }

    if (linkExistingCommentBtn) {
      const commentRow = linkExistingCommentBtn.closest("tr.comment-row");
      const dataRow = commentRow?.previousElementSibling?.previousElementSibling;
      const row = rowOverride || (dataRow ? findRowByElement(dataRow, container) : null);
      const editorArea = linkExistingCommentBtn.closest(".comment-editor-area");
      const list = editorArea?.querySelector(".comment-editor-list");

      if (row && list) {
        await openCommentSearchModal(row, container, list);
      }
      return true;
    }

    return false;
  }

  // =========================================================
  // Comment Modal
  // =========================================================

  function ensureCommentSearchModal() {
    let modal = document.getElementById("comment-search-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "comment-search-modal";
    modal.style.cssText = `
      display:none;
      position:fixed;
      inset:0;
      background:rgba(0,0,0,0.45);
      z-index:9999;
      align-items:center;
      justify-content:center;
      padding:24px;
      box-sizing:border-box;
    `;

    modal.innerHTML = `
      <div style="
        background:#fff;
        width:min(1100px, 96vw);
        height:min(88vh, 900px);
        border-radius:8px;
        box-shadow:0 10px 30px rgba(0,0,0,0.2);
        display:flex;
        flex-direction:column;
        overflow:hidden;
        min-height:0;
      ">
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding:16px 16px 12px 16px;
          border-bottom:1px solid #ddd;
          flex:0 0 auto;
        ">
          <h3 style="margin:0;">Comments</h3>
          <button type="button" class="close-comment-search-modal-btn">Close</button>
        </div>

        <div style="
          padding:12px 16px 0 16px;
          flex:1 1 auto;
          min-height:0;
          display:grid;
          grid-template-columns:minmax(0, 1.2fr) minmax(320px, 1fr);
          gap:16px;
          overflow:hidden;
        ">
          <!-- LEFT SIDE -->
          <div style="
            display:flex;
            flex-direction:column;
            min-height:0;
            overflow:hidden;
          ">
            <div id="comment-search-context" style="
              font-size:12px;
              color:#666;
              margin-bottom:12px;
              padding:8px 10px;
              background:#f8f8f8;
              border:1px solid #e3e3e3;
              border-radius:4px;
              flex:0 0 auto;
            "></div>

            <div style="
              display:grid;
              grid-template-columns:2fr 1fr;
              gap:8px;
              margin-bottom:12px;
              flex:0 0 auto;
            ">
              <div>
                <label style="display:block; font-size:12px;">Search Comment Text</label>
                <input type="text"
                      id="comment-search-text"
                      placeholder="Search within comment text..."
                      style="width:100%; padding:8px; box-sizing:border-box;">
              </div>
              <div>
                <label style="display:block; font-size:12px;">Search CommentId</label>
                <input type="text"
                      id="comment-search-id"
                      placeholder="e.g. 123"
                      style="width:100%; padding:8px; box-sizing:border-box;">
              </div>
            </div>

            <div style="
              display:flex;
              gap:8px;
              margin-bottom:12px;
              flex:0 0 auto;
            ">
              <button type="button" class="start-new-comment-btn">New Comment</button>
              <button type="button" class="use-selected-comment-btn">Use Selected Comment</button>
            </div>

            <div id="comment-search-results" style="
              flex:1 1 auto;
              min-height:0;
              overflow-y:auto;
              overflow-x:hidden;
              border:1px solid #ddd;
              padding:8px;
              background:#fafafa;
              border-radius:4px;
            ">
              Loading comments...
            </div>
          </div>

          <!-- RIGHT SIDE -->
          <div style="
            border-left:1px solid #ddd;
            padding-left:16px;
            min-height:0;
            overflow-y:auto;
          ">
            <div style="font-weight:600; margin-bottom:8px;">Comment Editor</div>

            <div style="font-size:12px; color:#666; margin-bottom:8px;" id="comment-form-status">
              Select a comment or create a new one.
            </div>

            <div style="margin-bottom:8px;">
              <label style="display:block; font-size:12px;">CommentId</label>
              <input type="text" id="comment-form-id" disabled style="width:100%; padding:8px; box-sizing:border-box; background:#f5f5f5;">
            </div>

            <div style="margin-bottom:8px;">
              <label style="display:block; font-size:12px;">Index Number (Optional)</label>
              <input type="text" id="comment-form-indexNumber" style="width:100%; padding:8px; box-sizing:border-box;">
            </div>

            <div style="margin-bottom:8px;">
              <label style="display:block; font-size:12px;">Comment Text</label>
              <textarea id="comment-form-text" rows="28" style="width:100%; padding:8px; box-sizing:border-box;"></textarea>
            </div>

            <div style="display:flex; gap:8px; margin-bottom:8px;">
              <button type="button" class="save-comment-modal-btn">Save Comment</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", function (e) {
      if (e.target.closest(".close-comment-search-modal-btn")) {
        closeCommentSearchModal();
      }
    });

    return modal;
  }

  function closeCommentSearchModal() {
    const modal = document.getElementById("comment-search-modal");
    if (!modal) return;

    modal.style.display = "none";
    modal.__selectedComment = null;
    modal.__targetRowKey = null;
    modal.__targetContainer = null;
    modal.__targetCommentList = null;
  }

  async function fetchCommentOptions(guidelineId) {
    const url = window.TreatmentApiUrl(
      `/api/Treatments/comment-options?guidelineId=${encodeURIComponent(guidelineId)}`
    );

    const authHeaders = await window.TreatmentAuth.authHeaders();

    const response = await fetch(url, {
      headers: {
        ...authHeaders
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch comments: ${response.status}`);
    }

    return await response.json();
  }

  function filterCommentOptions(items, textTerm, idTerm) {
    const textSearch = clean(textTerm).toLowerCase();
    const idSearch = clean(idTerm);

    return (items || []).filter(item => {
      const commentText = clean(item.commentText).toLowerCase();
      const indexNumber = clean(item.indexNumber).toLowerCase();
      const commentIdText = String(item.commentId ?? "");

      const matchesText = !textSearch ||
        commentText.includes(textSearch) ||
        indexNumber.includes(textSearch);

      const matchesId = !idSearch ||
        commentIdText.includes(idSearch);

      return matchesText && matchesId;
    });
  }

  function renderCommentSearchResults(items) {
    if (!items.length) {
      return `<div style="color:#666;">No comments found.</div>`;
    }

    return items.map(item => {
      const pests = (item.pests || [])
        .map(p => p.name ? `${p.name} (${p.pestId})` : `Pest ${p.pestId}`)
        .join(", ");

      return `
        <div class="comment-search-option"
            data-comment-id="${escapeHtml(item.commentId)}"
            style="border:1px solid #ddd; padding:10px; margin-bottom:8px; cursor:pointer;">
          <div style="font-size:12px; color:#666; margin-bottom:4px;">
            <strong>CommentId:</strong> ${escapeHtml(item.commentId)}
            ${item.indexNumber ? ` | <strong>Index:</strong> ${escapeHtml(item.indexNumber)}` : ""}
            ${item.siteId ? ` | <strong>SiteId:</strong> ${escapeHtml(item.siteId)}` : ""}
          </div>
          <div style="margin-bottom:6px;">
            ${escapeHtml(item.commentText || "")}
          </div>
          <div style="font-size:12px; color:#666;">
            <strong>Pests:</strong> ${escapeHtml(pests || "None")}
          </div>
        </div>
      `;
    }).join("");
  }

  async function openCommentSearchModal(row, container, targetListEl, existingComment = null) {
    //async function openCommentSearchModal(row, container, targetListEl) {
    const modal = ensureCommentSearchModal();
    modal.style.display = "flex";

    modal.__selectedComment = null;
    modal.__editingComment = null;
    modal.__targetRowKey = getRowKey(row);
    modal.__targetContainer = container;
    modal.__targetCommentList = targetListEl;

    const guidelineId = row?.treatment?.guidelineId ?? container?.dataset?.guidelineId ?? "";
    const siteId = row?.siteId ?? row?.treatment?.siteId ?? "";
    const pestId = row?.pestId ?? row?.treatment?.pestId ?? "";

    modal.querySelector("#comment-search-context").innerHTML = `
      <strong>GuidelineId:</strong> ${escapeHtml(guidelineId)}
      &nbsp; | &nbsp;
      <strong>SiteId:</strong> ${escapeHtml(siteId)}
      &nbsp; | &nbsp;
      <strong>PestId:</strong> ${escapeHtml(pestId)}
    `;

    const resultsEl = modal.querySelector("#comment-search-results");
    const textInput = modal.querySelector("#comment-search-text");
    const idInput = modal.querySelector("#comment-search-id");

    textInput.value = "";
    idInput.value = "";
    resultsEl.innerHTML = "Loading comments...";

    resetCommentForm(modal, row);

    try {
      const items = await fetchCommentOptions(guidelineId);
      modal.__commentOptions = items || [];
      modal.__filteredCommentOptions = items || [];
      resultsEl.innerHTML = renderCommentSearchResults(modal.__commentOptions);
    } catch (err) {
      console.error(err);
      resultsEl.innerHTML = `<div style="color:#900;">Failed to load comments.</div>`;
    }

    if (existingComment) {
      modal.__selectedComment = existingComment;
      modal.__editingComment = existingComment;
      loadCommentIntoForm(modal, existingComment);

      requestAnimationFrame(() => {
        focusCommentSearchOption(resultsEl, existingComment.commentId);
      });

      const selectedId = Number(existingComment.commentId);
      const selectedOption = Array.from(
        resultsEl.querySelectorAll(".comment-search-option")
      ).find(el => Number(el.dataset.commentId) === selectedId);

      if (selectedOption) {
        resultsEl.querySelectorAll(".comment-search-option").forEach(el => {
          el.style.background = "";
          el.style.borderColor = "#ddd";
        });

        selectedOption.style.background = "#eef6ff";
        selectedOption.style.borderColor = "#66a3ff";
      }
    }

    wireCommentSearchModal(modal);
  }

  function wireCommentSearchModal(modal) {
    if (modal.__commentSearchBound) return;
    modal.__commentSearchBound = true;

    const textInput = modal.querySelector("#comment-search-text");
    const idInput = modal.querySelector("#comment-search-id");
    const resultsEl = modal.querySelector("#comment-search-results");
    const useBtn = modal.querySelector(".use-selected-comment-btn");
    const newBtn = modal.querySelector(".start-new-comment-btn");
    const saveBtn = modal.querySelector(".save-comment-modal-btn");

    function refreshResults() {
      const filtered = filterCommentOptions(
        modal.__commentOptions || [],
        textInput.value,
        idInput.value
      );

      modal.__filteredCommentOptions = filtered;
      resultsEl.innerHTML = renderCommentSearchResults(filtered);
    }

    textInput.addEventListener("input", refreshResults);
    idInput.addEventListener("input", refreshResults);

    newBtn.addEventListener("click", function () {
      const container = modal.__targetContainer;
      const rowKey = modal.__targetRowKey;
      const row = (container?.__pesticideRows || []).find(r => getRowKey(r) === rowKey) || null;
      resetCommentForm(modal, row);
    });

    resultsEl.addEventListener("click", function (e) {
      const option = e.target.closest(".comment-search-option");
      if (!option) return;

      const commentId = parseInt(option.dataset.commentId, 10);
      const item = (modal.__filteredCommentOptions || modal.__commentOptions || [])
        .find(x => Number(x.commentId) === commentId);

      if (!item) return;

      modal.__selectedComment = item;
      loadCommentIntoForm(modal, item);

      resultsEl.querySelectorAll(".comment-search-option").forEach(el => {
        el.style.background = "";
        el.style.borderColor = "#ddd";
      });

      option.style.background = "#eef6ff";
      option.style.borderColor = "#66a3ff";
    });

    saveBtn.addEventListener("click", async function () {
      const defaults = modal.__commentFormDefaults || {};
      const editing = modal.__editingComment || null;

      const payload = {
        commentId: editing?.commentId ?? null,
        siteId: editing?.siteId ?? defaults.siteId ?? null,
        guidelineId: editing?.guidelineId ?? defaults.guidelineId ?? null,
        indexNumber: clean(modal.querySelector("#comment-form-indexNumber").value),
        commentText: clean(modal.querySelector("#comment-form-text").value),
        pestComment: Array.isArray(editing?.pests) && editing.pests.length
          ? editing.pests.map(p => p.pestId)
          : (defaults.pestIds || [])
      };

      if (!payload.commentText) {
        alert("Comment text is required.");
        return;
      }

      try {
        saveBtn.disabled = true;

        const saved = await saveComment(payload);
        const savedCommentId = saved?.commentId;

        if (!savedCommentId) {
          alert("Comment saved, but no CommentId was returned.");
          return;
        }

        const refreshed = {
          commentId: savedCommentId,
          siteId: payload.siteId,
          guidelineId: payload.guidelineId,
          indexNumber: payload.indexNumber,
          commentText: payload.commentText,
          pests: (payload.pestComment || []).map(id => ({ pestId: id, name: null }))
        };

        // update modal selection
        modal.__selectedComment = refreshed;
        modal.__editingComment = refreshed;

        // merge/update local option list
        const existing = (modal.__commentOptions || []).find(x => Number(x.commentId) === Number(savedCommentId));
        if (existing) {
          Object.assign(existing, refreshed);
        } else {
          modal.__commentOptions = [refreshed, ...(modal.__commentOptions || [])];
        }

        refreshResults();
        loadCommentIntoForm(modal, refreshed);
        requestAnimationFrame(() => {
          focusCommentSearchOption(resultsEl, refreshed.commentId);
        });
        syncEditedCommentBlock(modal.__targetCommentList, refreshed);

        alert("Comment saved.");
      } catch (err) {
        console.error(err);
        alert("Failed to save comment. Check console for details.");
      } finally {
        saveBtn.disabled = false;
      }
    });

    useBtn.addEventListener("click", function () {
      const selected = modal.__selectedComment;
      const targetList = modal.__targetCommentList;

      if (!selected || !targetList) {
        alert("Please select or save a comment first.");
        return;
      }

      // prevent duplicate insert in the same row editor
      const alreadyThere = Array.from(targetList.querySelectorAll(".comment-editor-block"))
        .some(el => Number(el.dataset.commentId) === Number(selected.commentId));

      if (!alreadyThere) {
        targetList.insertAdjacentHTML("beforeend", renderExistingCommentEditorBlock(selected));
      }

      closeCommentSearchModal();
    });
  }

  





  function renderExistingCommentEditorBlock(comment) {
  const pests = (comment.pests || [])
    .map(p => p.name ? `${p.name} (${p.pestId})` : `Pest ${p.pestId}`)
    .join(", ");

  return `
      <div class="comment-editor-block existing-linked-comment"
          data-comment-index="linked"
          data-comment-id="${escapeHtml(comment.commentId ?? 0)}"
          data-index-number="${escapeHtml(comment.indexNumber ?? "")}"
          data-comment-text="${escapeHtml(comment.commentText || comment.comment || "")}"
          style="border:1px solid #66a3ff; padding:6px 8px; margin-bottom:6px; background:#f5faff;">

        <div style="font-size:12px; color:#666; margin-bottom:4px;">
          <strong>CommentId:</strong> ${escapeHtml(comment.commentId ?? 0)}
          ${comment.indexNumber ? ` &nbsp; | &nbsp; <strong>Index:</strong> ${escapeHtml(comment.indexNumber)}` : ""}
          &nbsp; | &nbsp;
          <strong>SiteId:</strong> ${escapeHtml(comment.siteId ?? "")}
          &nbsp; | &nbsp;
          <strong>GuidelineId:</strong> ${escapeHtml(comment.guidelineId ?? "")}
          ${pests ? ` &nbsp; | &nbsp; <strong>Pests:</strong> ${escapeHtml(pests)}` : ""}
        </div>

        <div style="margin-bottom:4px; line-height:1.2;">
          ${escapeHtml(comment.commentText || comment.comment || "") || "<em>No comment text</em>"}
        </div>

        <div style="display:flex; gap:8px;">
          <button type="button" class="edit-linked-comment-btn">Edit</button>
          <button type="button" class="remove-comment-block-btn">Remove</button>
        </div>
      </div>
    `;
  }

  //Added 4/20/2026
  function resetCommentForm(modal, row) {
    modal.__editingComment = null;

    const guidelineId = row?.treatment?.guidelineId ?? row?.guidelineId ?? null;
    const siteId = row?.siteId ?? row?.treatment?.siteId ?? null;
    const pestId = row?.pestId ?? row?.treatment?.pestId ?? null;

    modal.querySelector("#comment-form-id").value = "";
    modal.querySelector("#comment-form-indexNumber").value = "";
    modal.querySelector("#comment-form-text").value = "";
    modal.querySelector("#comment-form-status").textContent = "Creating a new comment.";

    modal.__commentFormDefaults = {
      guidelineId,
      siteId,
      pestIds: pestId ? [Number(pestId)] : []
    };
  }

  function loadCommentIntoForm(modal, comment) {
    modal.__editingComment = comment || null;

    modal.querySelector("#comment-form-id").value = comment?.commentId ?? "";
    modal.querySelector("#comment-form-indexNumber").value = comment?.indexNumber ?? "";
    modal.querySelector("#comment-form-text").value = comment?.commentText ?? "";
    modal.querySelector("#comment-form-status").textContent =
      comment?.commentId ? `Editing Comment ${comment.commentId}` : "Creating a new comment.";
  }

  async function saveComment(payload) {
    /*
    const response = await fetch(window.TreatmentApiUrl("/api/Treatments/save-comment"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    */
    // POST: save-comment
    const authHeaders = await window.TreatmentAuth.authHeaders();

    const response = await fetch(window.TreatmentApiUrl("/api/Treatments/save-comment"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Save comment failed: ${response.status} ${text}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  //Added 4/23/2026
  function syncEditedCommentBlock(targetList, comment) {
    if (!targetList || !comment?.commentId) return;

    const block = Array.from(targetList.querySelectorAll(".comment-editor-block"))
      .find(el => Number(el.dataset.commentId) === Number(comment.commentId));

    if (!block) return;

    block.outerHTML = renderExistingCommentEditorBlock(comment);
  }

  function focusCommentSearchOption(resultsEl, commentId) {
    if (!resultsEl || !commentId) return;

    const selectedId = Number(commentId);

    const selectedOption = Array.from(
      resultsEl.querySelectorAll(".comment-search-option")
    ).find(el => Number(el.dataset.commentId) === selectedId);

    if (!selectedOption) return;

    resultsEl.querySelectorAll(".comment-search-option").forEach(el => {
      el.style.background = "";
      el.style.borderColor = "#ddd";
    });

    selectedOption.style.background = "#eef6ff";
    selectedOption.style.borderColor = "#66a3ff";

    selectedOption.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  window.PesticideTableBuilderComments = {
    setHelpers,
    renderCommentEditor,
    handleCommentClick
  };
})();
