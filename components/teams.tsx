"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

// Teams & Collaboration — work on exhibitions together. Create a team,
// invite members by email (they must already have a SANAA account),
// share exhibitions with view or edit permission, comment and run a
// review workflow on shared exhibitions, and read the activity log.
// Roles are enforced server-side in the teams API routes and in the
// editor save path; the UI only reflects what the server allows.
//
// Approval workflow: review requests, approvals and change requests are
// TeamComment rows whose body starts with a visible marker — [REVIEW],
// [APPROVED], [CHANGES REQUESTED] — so the thread stays readable in the
// database too, with no schema changes.
//
// Design: the existing white-gallery luxury language only. Component
// styles live in the <style> block at the bottom of this file so
// globals.css stays untouched.

export type TeamMemberRow = { userId: string; name: string; email: string; role: string };
export type TeamSummary = {
  id: string;
  name: string;
  ownerId: string;
  myRole: string;
  createdAt: string;
  updatedAt: string;
  shareCount: number;
  commentCount: number;
  members: TeamMemberRow[];
};
export type TeamExhibition = { id: string; title: string; slug: string; status: string };
export type TeamShare = {
  id: string;
  exhibitionId: string;
  permission: string;
  createdAt: string;
  exhibitionTitle: string;
  exhibitionSlug: string;
  exhibitionStatus: string;
  exhibitionOwnerName: string;
};
export type TeamCommentRow = {
  id: string;
  exhibitionId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  status: string;
  createdAt: string;
};
export type TeamActivityRow = {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  createdAt: string;
};
export type TeamVersionRow = { id: string; exhibitionId: string; title: string; createdAt: string };
export type TeamDetail = {
  id: string;
  name: string;
  ownerId: string;
  myRole: string;
  createdAt: string;
  updatedAt: string;
  members: TeamMemberRow[];
  shares: TeamShare[];
  comments: TeamCommentRow[];
  activity: TeamActivityRow[];
  versions: TeamVersionRow[];
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result as T;
}

function commentKind(body: string): "review" | "approve" | "changes" | "comment" {
  if (body.startsWith("[REVIEW] ")) return "review";
  if (body.startsWith("[APPROVED] ")) return "approve";
  if (body.startsWith("[CHANGES REQUESTED] ")) return "changes";
  return "comment";
}

function commentText(body: string): string {
  for (const prefix of ["[REVIEW] ", "[APPROVED] ", "[CHANGES REQUESTED] "]) {
    if (body.startsWith(prefix)) return body.slice(prefix.length);
  }
  return body;
}

// Latest review state for one exhibition's thread.
function reviewState(comments: TeamCommentRow[]): "none" | "pending" | "approved" | "changes" {
  const workflow = comments.filter((c) => commentKind(c.body) !== "comment");
  if (workflow.length === 0) return "none";
  const latest = workflow[workflow.length - 1];
  const kind = commentKind(latest.body);
  return kind === "review" ? "pending" : kind === "approve" ? "approved" : "changes";
}

export default function TeamsTool({
  teams: initialTeams,
  exhibitions,
  currentUserId,
}: {
  teams: TeamSummary[];
  exhibitions: TeamExhibition[];
  currentUserId: string;
}) {
  const [teams, setTeams] = useState<TeamSummary[]>(initialTeams);
  const [selectedId, setSelectedId] = useState<string | null>(initialTeams[0]?.id ?? null);
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [newTeamName, setNewTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [shareExhibitionId, setShareExhibitionId] = useState("");
  const [sharePermission, setSharePermission] = useState("view");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmingDeleteTeam, setConfirmingDeleteTeam] = useState(false);

  const selected = useMemo(() => teams.find((t) => t.id === selectedId) ?? null, [teams, selectedId]);
  const canEdit = detail !== null && (detail.myRole === "owner" || detail.myRole === "editor");
  const isOwner = detail !== null && detail.myRole === "owner";
  const unsharedExhibitions = useMemo(
    () => exhibitions.filter((e) => detail && !detail.shares.some((s) => s.exhibitionId === e.id)),
    [exhibitions, detail],
  );

  const loadDetail = useCallback(async (teamId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const result = await api<{ team: TeamDetail }>(`/api/teams/${encodeURIComponent(teamId)}`);
      setDetail(result.team);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Could not load the team.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function createTeam(event: React.FormEvent) {
    event.preventDefault();
    if (!newTeamName.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await api<{ team: TeamSummary }>("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTeamName.trim() }),
      });
      setTeams((current) => [result.team, ...current]);
      setSelectedId(result.team.id);
      setNewTeamName("");
      setNotice({ kind: "ok", text: `Team “${result.team.name}” created. Invite members by email below.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not create the team." });
    } finally {
      setBusy(false);
    }
  }

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !inviteEmail.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await api<{ member: TeamMemberRow }>(`/api/teams/${encodeURIComponent(detail.id)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setInviteEmail("");
      setNotice({ kind: "ok", text: `${result.member.name} joined the team as ${result.member.role}.` });
      await loadDetail(detail.id);
      setTeams((current) =>
        current.map((t) => (t.id === detail.id ? { ...t, members: [...t.members, result.member] } : t)),
      );
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not invite that member." });
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberUserId: string, memberName: string) {
    if (!detail) return;
    setBusy(true);
    setNotice(null);
    try {
      await api(`/api/teams/${encodeURIComponent(detail.id)}/members?userId=${encodeURIComponent(memberUserId)}`, { method: "DELETE" });
      if (memberUserId === currentUserId) {
        setTeams((current) => current.filter((t) => t.id !== detail.id));
        setSelectedId(teams.find((t) => t.id !== detail.id)?.id ?? null);
        setDetail(null);
        setNotice({ kind: "ok", text: "You left the team." });
      } else {
        setNotice({ kind: "ok", text: `${memberName} removed from the team.` });
        await loadDetail(detail.id);
      }
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not remove that member." });
    } finally {
      setBusy(false);
    }
  }

  async function shareExhibition(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !shareExhibitionId) return;
    setBusy(true);
    setNotice(null);
    try {
      await api(`/api/teams/${encodeURIComponent(detail.id)}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exhibitionId: shareExhibitionId, permission: sharePermission }),
      });
      setShareExhibitionId("");
      setNotice({ kind: "ok", text: "Exhibition shared with the team." });
      await loadDetail(detail.id);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not share the exhibition." });
    } finally {
      setBusy(false);
    }
  }

  async function unshare(exhibitionId: string, exhibitionTitle: string) {
    if (!detail) return;
    setBusy(true);
    setNotice(null);
    try {
      await api(`/api/teams/${encodeURIComponent(detail.id)}/shares?exhibitionId=${encodeURIComponent(exhibitionId)}`, { method: "DELETE" });
      setNotice({ kind: "ok", text: `“${exhibitionTitle}” is no longer shared with the team.` });
      await loadDetail(detail.id);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not remove the share." });
    } finally {
      setBusy(false);
    }
  }

  async function postComment(exhibitionId: string | null, kind: "comment" | "review" | "approve" | "changes") {
    if (!detail) return;
    const key = exhibitionId ?? "team";
    const text = (commentDrafts[key] ?? "").trim();
    if (kind === "comment" && !text) {
      setNotice({ kind: "error", text: "Write a comment first." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await api(`/api/teams/${encodeURIComponent(detail.id)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(exhibitionId ? { exhibitionId } : {}),
          body: text || (kind === "approve" ? "Approved." : kind === "changes" ? "Changes requested — see the comment." : "Please review this exhibition."),
          kind,
        }),
      });
      setCommentDrafts((current) => ({ ...current, [key]: "" }));
      await loadDetail(detail.id);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not post the comment." });
    } finally {
      setBusy(false);
    }
  }

  async function resolveComment(commentId: string, status: "open" | "resolved") {
    if (!detail) return;
    setBusy(true);
    try {
      await api(`/api/teams/${encodeURIComponent(detail.id)}/comments/${encodeURIComponent(commentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadDetail(detail.id);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not update the comment." });
    } finally {
      setBusy(false);
    }
  }

  async function renameTeam(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !renameDraft.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await api<{ team: { id: string; name: string } }>(`/api/teams/${encodeURIComponent(detail.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameDraft.trim() }),
      });
      setTeams((current) => current.map((t) => (t.id === detail.id ? { ...t, name: result.team.name } : t)));
      setRenameDraft("");
      setNotice({ kind: "ok", text: "Team renamed." });
      await loadDetail(detail.id);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not rename the team." });
    } finally {
      setBusy(false);
    }
  }

  async function deleteTeam() {
    if (!detail) return;
    setBusy(true);
    try {
      await api(`/api/teams/${encodeURIComponent(detail.id)}`, { method: "DELETE" });
      setTeams((current) => current.filter((t) => t.id !== detail.id));
      setSelectedId(teams.find((t) => t.id !== detail.id)?.id ?? null);
      setDetail(null);
      setConfirmingDeleteTeam(false);
      setNotice({ kind: "ok", text: "Team deleted." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not delete the team." });
    } finally {
      setBusy(false);
    }
  }

  const teamComments = detail?.comments.filter((c) => !c.exhibitionId) ?? [];

  return (
    <div className="tm-wrap">
      {notice && (
        <p className={`tm-notice ${notice.kind === "error" ? "tm-notice-error" : ""}`} role="status">
          {notice.text}
        </p>
      )}

      <section className="tm-section">
        <h2>Your teams</h2>
        <form onSubmit={createTeam} className="tm-inline-form">
          <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="New team name, e.g. Dakar curators" maxLength={120} aria-label="New team name" />
          <button type="submit" className="primary-button" disabled={busy || !newTeamName.trim()}>
            Create team
          </button>
        </form>
        {teams.length === 0 ? (
          <div className="tm-empty">
            <strong>No teams yet.</strong>
            <p>Create one to share an exhibition with a curator, a collaborator or a gallery — they need a SANAA account to be invited.</p>
          </div>
        ) : (
          <ul className="tm-team-list">
            {teams.map((team) => (
              <li key={team.id}>
                <button type="button" className={`tm-team-button ${team.id === selectedId ? "tm-team-button-active" : ""}`} onClick={() => setSelectedId(team.id)}>
                  <strong>{team.name}</strong>
                  <span>
                    {team.members.length} {team.members.length === 1 ? "member" : "members"} · {team.shareCount}{" "}
                    {team.shareCount === 1 ? "share" : "shares"} · your role: {team.myRole}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detailLoading && (
        <p className="tm-loading" role="status">
          Loading the team…
        </p>
      )}
      {detailError && (
        <p className="tm-notice tm-notice-error" role="alert">
          {detailError}
        </p>
      )}

      {detail && selected && (
        <div className="tm-detail">
          <section className="tm-section">
            <h2>
              {detail.name} <span className="tm-count">you are {detail.myRole}</span>
            </h2>

            <h3>Members</h3>
            <ul className="tm-members">
              {detail.members.map((member) => (
                <li key={member.userId}>
                  <strong>{member.name}</strong>
                  <span>{member.email}</span>
                  <span className="tm-role">{member.role}</span>
                  {member.role !== "owner" && (isOwner || member.userId === currentUserId) && (
                    <button type="button" className="tm-small-button tm-small-button-quiet" disabled={busy} onClick={() => void removeMember(member.userId, member.name)}>
                      {member.userId === currentUserId ? "Leave team" : "Remove"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isOwner ? (
              <form onSubmit={inviteMember} className="tm-inline-form">
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Invite by email — they need a SANAA account" aria-label="Invite by email" />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} aria-label="Role for the invited member">
                  <option value="editor">Editor — can share and edit</option>
                  <option value="viewer">Viewer — read-only</option>
                </select>
                <button type="submit" className="primary-button" disabled={busy || !inviteEmail.trim()}>
                  Invite
                </button>
              </form>
            ) : (
              <p className="tm-hint">Only the team owner can invite members. Editors share exhibitions and comment; viewers read only.</p>
            )}
          </section>

          <section className="tm-section">
            <h3>Shared exhibitions</h3>
            {detail.shares.length === 0 ? (
              <div className="tm-empty">
                <strong>Nothing shared yet.</strong>
                <p>Share one of your exhibitions and the team can comment on it — with edit permission, editors can also open it in the editor and save changes.</p>
              </div>
            ) : (
              <div className="tm-shares">
                {detail.shares.map((share) => {
                  const comments = detail.comments.filter((c) => c.exhibitionId === share.exhibitionId);
                  const state = reviewState(comments);
                  const versions = detail.versions.filter((v) => v.exhibitionId === share.exhibitionId);
                  const key = share.exhibitionId;
                  return (
                    <article key={share.id} className="tm-share">
                      <div className="tm-share-head">
                        <h4>{share.exhibitionTitle}</h4>
                        <span className={`tm-badge tm-badge-${share.permission}`}>{share.permission === "edit" ? "Can edit" : "View only"}</span>
                      </div>
                      <p className="tm-share-meta">
                        Shared by {share.exhibitionOwnerName}
                        {share.exhibitionStatus ? ` · exhibition ${share.exhibitionStatus}` : ""}
                      </p>
                      <p className="tm-review-line">
                        Review:{" "}
                        {state === "none" && "not requested"}
                        {state === "pending" && <strong className="tm-review-pending">awaiting review</strong>}
                        {state === "approved" && <strong className="tm-review-approved">approved</strong>}
                        {state === "changes" && <strong className="tm-review-changes">changes requested</strong>}
                      </p>
                      <div className="tm-share-actions">
                        {share.exhibitionSlug && (
                          <Link href={`/exhibition/${share.exhibitionSlug}`} className="tm-small-button tm-small-button-link">
                            View exhibition
                          </Link>
                        )}
                        {share.permission === "edit" && canEdit && (
                          <Link href={`/editor/${share.exhibitionId}`} className="tm-small-button tm-small-button-link">
                            Open in editor
                          </Link>
                        )}
                        {canEdit && (
                          <button type="button" className="tm-small-button tm-small-button-quiet" disabled={busy} onClick={() => void unshare(share.exhibitionId, share.exhibitionTitle)}>
                            Stop sharing
                          </button>
                        )}
                      </div>

                      {versions.length > 0 && (
                        <div className="tm-versions">
                          <strong>Version history</strong>
                          <ul>
                            {versions.slice(0, 5).map((v) => (
                              <li key={v.id}>
                                {v.title} · {new Date(v.createdAt).toLocaleString()}
                              </li>
                            ))}
                          </ul>
                          <p>Restore a version from the editor&apos;s history panel.</p>
                        </div>
                      )}

                      <ul className="tm-comments">
                        {comments.length === 0 && <li className="tm-comment-empty">No comments on this exhibition yet.</li>}
                        {comments.map((comment) => {
                          const kind = commentKind(comment.body);
                          return (
                            <li key={comment.id} className={`tm-comment tm-comment-${kind} ${comment.status === "resolved" ? "tm-comment-resolved" : ""}`}>
                              <div className="tm-comment-head">
                                <strong>{comment.authorName}</strong>
                                <span className="tm-comment-kind">
                                  {kind === "review" && "Review request"}
                                  {kind === "approve" && "Approved"}
                                  {kind === "changes" && "Changes requested"}
                                  {kind === "comment" && "Comment"}
                                </span>
                                <span>{new Date(comment.createdAt).toLocaleString()}</span>
                                {comment.status === "resolved" && <span>· resolved</span>}
                              </div>
                              <p>{commentText(comment.body)}</p>
                              {comment.status === "open" ? (
                                <button type="button" className="tm-small-button tm-small-button-quiet" disabled={busy} onClick={() => void resolveComment(comment.id, "resolved")}>
                                  Resolve
                                </button>
                              ) : (
                                <button type="button" className="tm-small-button tm-small-button-quiet" disabled={busy} onClick={() => void resolveComment(comment.id, "open")}>
                                  Reopen
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>

                      <div className="tm-comment-form">
                        <textarea
                          value={commentDrafts[key] ?? ""}
                          onChange={(e) => setCommentDrafts((current) => ({ ...current, [key]: e.target.value }))}
                          rows={2}
                          placeholder="Comment, or write the review note…"
                          aria-label={`Comment on ${share.exhibitionTitle}`}
                        />
                        <div className="tm-actions">
                          <button type="button" className="tm-small-button" disabled={busy} onClick={() => void postComment(share.exhibitionId, "comment")}>
                            Comment
                          </button>
                          <button type="button" className="tm-small-button" disabled={busy} onClick={() => void postComment(share.exhibitionId, "review")}>
                            Request review
                          </button>
                          {(state === "pending" || state === "changes") && (
                            <>
                              <button type="button" className="tm-small-button tm-small-button-approve" disabled={busy} onClick={() => void postComment(share.exhibitionId, "approve")}>
                                Approve
                              </button>
                              <button type="button" className="tm-small-button tm-small-button-changes" disabled={busy} onClick={() => void postComment(share.exhibitionId, "changes")}>
                                Request changes
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {canEdit && unsharedExhibitions.length > 0 && (
              <form onSubmit={shareExhibition} className="tm-inline-form">
                <select value={shareExhibitionId} onChange={(e) => setShareExhibitionId(e.target.value)} aria-label="Exhibition to share">
                  <option value="">— Share one of your exhibitions —</option>
                  {unsharedExhibitions.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.status})
                    </option>
                  ))}
                </select>
                <select value={sharePermission} onChange={(e) => setSharePermission(e.target.value)} aria-label="Share permission">
                  <option value="view">View only</option>
                  <option value="edit">Can edit</option>
                </select>
                <button type="submit" className="primary-button" disabled={busy || !shareExhibitionId}>
                  Share
                </button>
              </form>
            )}
            {!canEdit && <p className="tm-hint">Viewers cannot share exhibitions — ask an editor or the owner.</p>}
          </section>

          <section className="tm-section">
            <h3>Team discussion</h3>
            {teamComments.length === 0 ? (
              <p className="tm-hint">No team-wide comments yet. Use the boxes above to discuss a shared exhibition.</p>
            ) : (
              <ul className="tm-comments">
                {teamComments.map((comment) => (
                  <li key={comment.id} className={`tm-comment ${comment.status === "resolved" ? "tm-comment-resolved" : ""}`}>
                    <div className="tm-comment-head">
                      <strong>{comment.authorName}</strong>
                      <span>{new Date(comment.createdAt).toLocaleString()}</span>
                      {comment.status === "resolved" && <span>· resolved</span>}
                    </div>
                    <p>{comment.body}</p>
                    {comment.status === "open" ? (
                      <button type="button" className="tm-small-button tm-small-button-quiet" disabled={busy} onClick={() => void resolveComment(comment.id, "resolved")}>
                        Resolve
                      </button>
                    ) : (
                      <button type="button" className="tm-small-button tm-small-button-quiet" disabled={busy} onClick={() => void resolveComment(comment.id, "open")}>
                        Reopen
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="tm-comment-form">
              <textarea
                value={commentDrafts.team ?? ""}
                onChange={(e) => setCommentDrafts((current) => ({ ...current, team: e.target.value }))}
                rows={2}
                placeholder="A note for the whole team…"
                aria-label="Comment for the whole team"
              />
              <div className="tm-actions">
                <button type="button" className="tm-small-button" disabled={busy} onClick={() => void postComment(null, "comment")}>
                  Post to the team
                </button>
              </div>
            </div>
          </section>

          <section className="tm-section">
            <h3>Activity</h3>
            {detail.activity.length === 0 ? (
              <p className="tm-hint">Nothing logged yet — invites, shares, reviews and comments appear here.</p>
            ) : (
              <ul className="tm-activity">
                {detail.activity.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.actorName}</strong> {entry.action}
                    <span> · {new Date(entry.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {isOwner && (
            <section className="tm-section tm-settings">
              <h3>Team settings</h3>
              <form onSubmit={renameTeam} className="tm-inline-form">
                <input value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} placeholder={`Rename “${detail.name}”`} maxLength={120} aria-label="New team name" />
                <button type="submit" className="primary-button" disabled={busy || !renameDraft.trim()}>
                  Rename
                </button>
              </form>
              {confirmingDeleteTeam ? (
                <div className="tm-actions">
                  <button type="button" className="tm-small-button tm-small-button-danger" disabled={busy} onClick={() => void deleteTeam()}>
                    Delete this team for good?
                  </button>
                  <button type="button" className="tm-small-button tm-small-button-quiet" onClick={() => setConfirmingDeleteTeam(false)}>
                    Keep it
                  </button>
                </div>
              ) : (
                <button type="button" className="tm-small-button tm-small-button-quiet" disabled={busy} onClick={() => setConfirmingDeleteTeam(true)}>
                  Delete team
                </button>
              )}
            </section>
          )}
        </div>
      )}

      <style>{`
        .tm-wrap { display: grid; gap: 36px; }
        .tm-section h2 { margin: 0 0 8px; font: 450 22px/1.2 var(--font-display), Georgia, serif; }
        .tm-section h3 { margin: 24px 0 10px; font-size: 15px; }
        .tm-section h3:first-child { margin-top: 0; }
        .tm-count { font: 600 12px/1 var(--font-body, inherit); color: var(--muted); }
        .tm-hint { color: var(--muted); line-height: 1.6; font-size: 13px; max-width: 720px; }
        .tm-notice { margin: 0; padding: 12px 14px; border: 1px solid #c8b98a; border-radius: 8px; background: #f7f1e3; color: #5c4a1e; }
        .tm-notice-error { border-color: #d8a49a; background: #f9ecea; color: #7a2e22; }
        .tm-loading { color: var(--muted); }
        .tm-inline-form { display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0; }
        .tm-inline-form input, .tm-inline-form select { flex: 1 1 220px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--ink); font: inherit; font-size: 13px; }
        .tm-inline-form select { flex: 0 1 220px; }
        .tm-empty { padding: 20px; border: 1px dashed var(--line); border-radius: 12px; background: var(--surface-3); }
        .tm-empty p { margin: 6px 0 0; color: var(--muted); line-height: 1.6; }
        .tm-team-list { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 10px; }
        .tm-team-button { display: grid; gap: 4px; width: 100%; text-align: left; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-3); color: var(--ink); font: inherit; cursor: pointer; }
        .tm-team-button:hover { background: var(--surface-2); }
        .tm-team-button-active { border-color: var(--accent); outline: 2px solid var(--accent); outline-offset: 1px; }
        .tm-team-button span { color: var(--muted); font-size: 12px; }
        .tm-detail { display: grid; gap: 8px; }
        .tm-members { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
        .tm-members li { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-3); font-size: 13px; }
        .tm-members li span { color: var(--muted); font-size: 12px; }
        .tm-role { padding: 2px 8px; border-radius: 999px; background: var(--surface-2); font-size: 11px; font-weight: 600; text-transform: capitalize; }
        .tm-shares { display: grid; gap: 16px; }
        .tm-share { padding: 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-3); }
        .tm-share-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .tm-share-head h4 { margin: 0; font-size: 16px; }
        .tm-share-meta { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
        .tm-review-line { margin: 10px 0 0; font-size: 13px; }
        .tm-review-pending { color: #7a5c17; }
        .tm-review-approved { color: #3f5a2e; }
        .tm-review-changes { color: #7a2e22; }
        .tm-share-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .tm-badge { display: inline-block; flex-shrink: 0; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--surface-2); color: var(--muted); }
        .tm-badge-edit { background: #e7ecdf; color: #3f5a2e; }
        .tm-versions { margin-top: 14px; padding: 12px; border: 1px dashed var(--line); border-radius: 8px; font-size: 12px; }
        .tm-versions ul { margin: 6px 0; padding-left: 18px; color: var(--muted); line-height: 1.6; }
        .tm-versions p { margin: 0; color: var(--muted); }
        .tm-comments { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 10px; }
        .tm-comment { padding: 12px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); }
        .tm-comment-review { border-left: 3px solid #a67c37; }
        .tm-comment-approve { border-left: 3px solid #3f5a2e; }
        .tm-comment-changes { border-left: 3px solid #7a2e22; }
        .tm-comment-resolved { opacity: .65; }
        .tm-comment-head { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--muted); }
        .tm-comment-head strong { color: var(--ink); font-size: 13px; }
        .tm-comment-kind { font-weight: 600; }
        .tm-comment p { margin: 8px 0; line-height: 1.6; white-space: pre-wrap; }
        .tm-comment-empty { color: var(--muted); font-size: 13px; }
        .tm-comment-form { display: grid; gap: 8px; margin-top: 12px; }
        .tm-comment-form textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--ink); font: inherit; font-size: 13px; resize: vertical; }
        .tm-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .tm-small-button { display: inline-flex; align-items: center; padding: 7px 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font-size: 11px; font-weight: 600; cursor: pointer; text-decoration: none; }
        .tm-small-button:hover { background: var(--surface-2); }
        .tm-small-button:disabled { opacity: .5; cursor: not-allowed; }
        .tm-small-button-quiet { background: transparent; border-color: transparent; color: var(--muted); }
        .tm-small-button-danger { border-color: #d8a49a; color: #7a2e22; }
        .tm-small-button-approve { border-color: #3f5a2e; color: #3f5a2e; }
        .tm-small-button-changes { border-color: #7a2e22; color: #7a2e22; }
        .tm-small-button-link { text-decoration: none; }
        .tm-activity { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: 13px; line-height: 1.6; }
        .tm-activity li span { color: var(--muted); font-size: 12px; }
        .tm-settings { padding-top: 20px; border-top: 1px solid var(--line); }
      `}</style>
    </div>
  );
}
