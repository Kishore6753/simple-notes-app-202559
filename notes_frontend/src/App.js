import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:3001';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// PUBLIC_INTERFACE
function App() {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const selectedNote = useMemo(
    () => notes.find(n => n.id === selectedId) || null,
    [notes, selectedId]
  );

  const isDirty = useMemo(() => {
    if (!selectedNote) return draftTitle.trim().length > 0 || draftContent.length > 0;
    return (
      draftTitle !== selectedNote.title ||
      draftContent !== selectedNote.content
    );
  }, [selectedNote, draftTitle, draftContent]);

  async function apiFetch(path, options) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.detail || 'Request failed';
      throw new Error(msg);
    }
    return data;
  }

  async function loadNotes({ selectFirstIfNone = true } = {}) {
    setError('');
    setIsLoading(true);
    try {
      const data = await apiFetch('/notes', { method: 'GET' });
      setNotes(data);
      if (selectFirstIfNone) {
        if (selectedId == null && data.length > 0) setSelectedId(data[0].id);
        if (data.length === 0) setSelectedId(null);
      }
    } catch (e) {
      setError(e.message || 'Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep draft in sync with selection
  useEffect(() => {
    if (!selectedNote) {
      setDraftTitle('');
      setDraftContent('');
      return;
    }
    setDraftTitle(selectedNote.title);
    setDraftContent(selectedNote.content);
  }, [selectedNote]);

  async function onCreateNew() {
    setError('');
    setIsSaving(true);
    try {
      const created = await apiFetch('/notes', {
        method: 'POST',
        body: JSON.stringify({ title: 'Untitled', content: '' })
      });
      // Put created note at top (API already sorts by updated_at, but this keeps UI snappy).
      setNotes(prev => [created, ...prev.filter(n => n.id !== created.id)]);
      setSelectedId(created.id);
    } catch (e) {
      setError(e.message || 'Failed to create note');
    } finally {
      setIsSaving(false);
    }
  }

  async function onSave() {
    if (!selectedNote) return;
    if (draftTitle.trim().length === 0) {
      setError('Title is required.');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      const updated = await apiFetch(`/notes/${selectedNote.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: draftTitle.trim(), content: draftContent })
      });

      // Refresh list ordering: move updated note to top.
      setNotes(prev => [updated, ...prev.filter(n => n.id !== updated.id)]);
      setSelectedId(updated.id);
    } catch (e) {
      setError(e.message || 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  }

  async function onDelete() {
    if (!selectedNote) return;
    const ok = window.confirm('Delete this note? This cannot be undone.');
    if (!ok) return;

    setError('');
    setIsDeleting(true);
    try {
      await apiFetch(`/notes/${selectedNote.id}`, { method: 'DELETE' });
      const remaining = notes.filter(n => n.id !== selectedNote.id);
      setNotes(remaining);
      setSelectedId(remaining.length ? remaining[0].id : null);
    } catch (e) {
      setError(e.message || 'Failed to delete note');
    } finally {
      setIsDeleting(false);
    }
  }

  function onSelectNote(id) {
    if (id === selectedId) return;

    if (isDirty) {
      const ok = window.confirm('You have unsaved changes. Discard them?');
      if (!ok) return;
    }
    setSelectedId(id);
  }

  return (
    <div className="appShell">
      <header className="topBar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true" />
          <div className="brandText">
            <div className="brandTitle">Notes</div>
            <div className="brandSubtitle">Simple, fast, and persistent</div>
          </div>
        </div>

        <div className="topActions">
          <button className="btn btnSecondary" onClick={() => loadNotes({ selectFirstIfNone: false })} disabled={isLoading}>
            Refresh
          </button>
          <button className="btn btnPrimary" onClick={onCreateNew} disabled={isSaving || isLoading}>
            + New Note
          </button>
        </div>
      </header>

      <main className="contentGrid">
        <aside className="leftPane" aria-label="Notes list">
          <div className="paneHeader">
            <div className="paneTitle">Your notes</div>
            <div className="paneMeta">{notes.length} total</div>
          </div>

          {isLoading ? (
            <div className="emptyState">Loading…</div>
          ) : notes.length === 0 ? (
            <div className="emptyState">
              <div className="emptyTitle">No notes yet</div>
              <div className="emptyText">Create your first note to get started.</div>
              <button className="btn btnPrimary" onClick={onCreateNew} disabled={isSaving}>
                + New Note
              </button>
            </div>
          ) : (
            <ul className="notesList">
              {notes.map(note => (
                <li key={note.id}>
                  <button
                    className={`noteRow ${note.id === selectedId ? 'isActive' : ''}`}
                    onClick={() => onSelectNote(note.id)}
                    aria-current={note.id === selectedId ? 'true' : 'false'}
                  >
                    <div className="noteRowTop">
                      <div className="noteTitle">{note.title}</div>
                      <div className="noteUpdated">{formatDate(note.updated_at)}</div>
                    </div>
                    <div className="notePreview">
                      {(note.content || '').trim().slice(0, 90) || '—'}
                      {(note.content || '').trim().length > 90 ? '…' : ''}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="rightPane" aria-label="Note editor">
          <div className="paneHeader rightHeader">
            <div>
              <div className="paneTitle">{selectedNote ? 'Editor' : 'Select a note'}</div>
              {selectedNote ? (
                <div className="paneMeta">
                  Created {formatDate(selectedNote.created_at)} · Updated {formatDate(selectedNote.updated_at)}
                </div>
              ) : (
                <div className="paneMeta">Pick a note from the list, or create a new one.</div>
              )}
            </div>

            {selectedNote ? (
              <div className="editorActions">
                <button className="btn btnDanger" onClick={onDelete} disabled={isDeleting || isSaving}>
                  Delete
                </button>
                <button className="btn btnPrimary" onClick={onSave} disabled={!isDirty || isSaving}>
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="errorBanner" role="alert">
              {error}
            </div>
          ) : null}

          {selectedNote ? (
            <div className="editorBody">
              <label className="fieldLabel" htmlFor="titleInput">Title</label>
              <input
                id="titleInput"
                className="textInput"
                value={draftTitle}
                onChange={e => setDraftTitle(e.target.value)}
                placeholder="Note title…"
              />

              <label className="fieldLabel" htmlFor="contentInput">Content</label>
              <textarea
                id="contentInput"
                className="textArea"
                value={draftContent}
                onChange={e => setDraftContent(e.target.value)}
                placeholder="Write your note…"
              />

              <div className="hintRow">
                <div className={`dirtyPill ${isDirty ? 'isDirty' : ''}`}>
                  {isDirty ? 'Unsaved changes' : 'All changes saved'}
                </div>
              </div>
            </div>
          ) : (
            <div className="emptyEditor">
              <div className="emptyTitle">No note selected</div>
              <div className="emptyText">Choose a note on the left or create a new one.</div>
              <button className="btn btnPrimary" onClick={onCreateNew} disabled={isSaving}>
                + New Note
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
