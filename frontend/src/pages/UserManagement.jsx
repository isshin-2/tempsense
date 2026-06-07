import { useState, useEffect } from 'react';
import { fetchUsers, fetchSites, fetchRooms, registerUser, updateUser, updateUserRole, deleteUser } from '../services/api';
import { Users, UserPlus, Trash2, Pencil, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLE_CONFIG = {
  admin: { label: 'Admin', color: '#3b82f6' },
  site_manager: { label: 'Site Manager', color: '#f59e0b' },
  customer: { label: 'Customer', color: '#64748b' },
};

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [sites, setSites] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'customer', siteIds: [], roomIds: [] });
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: '', siteIds: [], roomIds: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [invitedInfo, setInvitedInfo] = useState(null);

  useEffect(() => {
    loadUsers();
    fetchSites().then(setSites).catch(console.error);
    fetchRooms().then(setRooms).catch(console.error);
  }, []);

  async function loadUsers() {
    setLoading(true);
    try { setUsers(await fetchUsers()); } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await registerUser(inviteForm);
      setInvitedInfo(res);
      setInviteForm({ name: '', email: '', role: 'customer', siteIds: [], roomIds: [] });
      loadUsers();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  function openEdit(u) {
    setEditTarget(u);
    setEditForm({
      name: u.name, email: u.email, phone: u.phone || '',
      role: u.role, siteIds: u.site_ids || [], roomIds: u.room_ids || [],
    });
    setError('');
    setShowEdit(true);
  }

  async function handleEdit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await updateUser(editTarget.id, editForm);
      setShowEdit(false);
      loadUsers();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(userId, userName) {
    if (!confirm(`Delete user "${userName}"? This cannot be undone.`)) return;
    try { await deleteUser(userId); loadUsers(); } catch (err) { alert(err.message); }
  }

  function toggleArray(arr, val) {
    const v = parseInt(val);
    return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  }

  function renderAccessSelector(role, siteIds, setSiteIds, roomIds, setRoomIds) {
    if (role === 'site_manager') {
      return (
        <div className="form-group">
          <label>Assigned Sites</label>
          <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px' }}>
            {sites.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No sites available</span> : sites.map(s => (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={siteIds.includes(s.id)} onChange={() => setSiteIds(toggleArray(siteIds, s.id))} />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      );
    }
    if (role === 'customer') {
      return (
        <div className="form-group">
          <label>Assigned Rooms</label>
          <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px' }}>
            {rooms.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No rooms available</span> : rooms.map(r => (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={roomIds.includes(r.id)} onChange={() => setRoomIds(toggleArray(roomIds, r.id))} />
                {r.name} <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({r.site_name})</span>
              </label>
            ))}
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <h2>User Management</h2>
          <p>Manage team members and access roles</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setError(''); setInvitedInfo(null); setShowInvite(true); }}>
          <UserPlus size={16} /> Invite User
        </button>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ marginBottom: '8px' }} />
            <p>Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <Users size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p>No users found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Access</th>
                  <th>Phone</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.customer;
                  const isSelf = u.id === currentUser?.id;
                  const accessInfo = u.role === 'site_manager'
                    ? `${(u.site_ids || []).length} site(s)`
                    : u.role === 'customer'
                    ? `${(u.room_ids || []).length} room(s)`
                    : 'Full access';
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {u.name} {isSelf && <span style={{ fontSize: '10px', color: 'var(--accent-blue)', marginLeft: '6px' }}>(you)</span>}
                      </td>
                      <td style={{ fontSize: '13px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={12} style={{ color: 'var(--text-muted)' }} /> {u.email}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px', padding: '3px 10px', borderRadius: '10px', fontWeight: 600,
                          background: `${rc.color}20`, color: rc.color,
                        }}>
                          {rc.label}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{accessInfo}</td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{u.phone || '—'}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(u.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!isSelf && (
                            <>
                              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>
                                <Pencil size={14} />
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id, u.name)}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="modal-overlay" onClick={() => { setShowInvite(false); setInvitedInfo(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3>Invite New User</h3>
            {error && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
            
            {invitedInfo ? (
              <div style={{ padding: '8px 0' }}>
                <div style={{
                  background: invitedInfo.emailSent ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                  color: invitedInfo.emailSent ? 'var(--accent-green)' : 'var(--accent-amber)',
                  padding: '16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  border: invitedInfo.emailSent ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(245,158,11,0.2)',
                  lineHeight: 1.5,
                  fontSize: '13.5px'
                }}>
                  <strong style={{ display: 'block', marginBottom: '4px', fontSize: '14.5px' }}>
                    {invitedInfo.emailSent ? 'Invitation Sent!' : 'User Created Successfully'}
                  </strong>
                  {invitedInfo.emailSent
                    ? `An invitation email has been sent to ${invitedInfo.user.email} with instructions to set their password.`
                    : 'The user was created, but we could not send the invitation email. Please verify your SMTP settings in Settings.'
                  }
                </div>

                <div className="form-group">
                  <label>Share Setup Link</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      className="form-input"
                      readOnly
                      value={`${window.location.origin}/accept-invite?token=${invitedInfo.inviteToken}`}
                      style={{ fontSize: '12px', fontFamily: 'monospace', flex: 1, background: 'var(--bg-primary)' }}
                      onClick={e => e.target.select()}
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/accept-invite?token=${invitedInfo.inviteToken}`);
                        alert('Link copied to clipboard!');
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="modal-actions" style={{ marginTop: '24px' }}>
                  <button className="btn btn-primary" type="button" onClick={() => { setShowInvite(false); setInvitedInfo(null); }}>
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInvite}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input className="form-input" placeholder="e.g. Ravi Kumar"
                    value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input className="form-input" type="email" placeholder="ravi@company.com"
                    value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select className="form-input" value={inviteForm.role}
                    onChange={e => setInviteForm({ ...inviteForm, role: e.target.value, siteIds: [], roomIds: [] })}>
                    <option value="customer">Customer (Room-level access)</option>
                    <option value="site_manager">Site Manager (Site-level access)</option>
                    <option value="admin">Admin (Full access)</option>
                  </select>
                </div>
                {renderAccessSelector(
                  inviteForm.role,
                  inviteForm.siteIds, (ids) => setInviteForm({ ...inviteForm, siteIds: ids }),
                  inviteForm.roomIds, (ids) => setInviteForm({ ...inviteForm, roomIds: ids })
                )}
                <div className="modal-actions">
                  <button className="btn btn-ghost" type="button" onClick={() => { setShowInvite(false); setInvitedInfo(null); }}>Cancel</button>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving && <Loader2 size={14} className="animate-spin" style={{ marginRight: '6px' }} />}
                    Send Invite
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && editTarget && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3>Edit User</h3>
            {error && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label>Full Name</label>
                <input className="form-input" value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input className="form-input" type="email" value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="form-input" type="tel" value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select className="form-input" value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value, siteIds: [], roomIds: [] })}>
                  <option value="customer">Customer</option>
                  <option value="site_manager">Site Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {renderAccessSelector(
                editForm.role,
                editForm.siteIds, (ids) => setEditForm({ ...editForm, siteIds: ids }),
                editForm.roomIds, (ids) => setEditForm({ ...editForm, roomIds: ids })
              )}
              <div className="modal-actions">
                <button className="btn btn-ghost" type="button" onClick={() => setShowEdit(false)}>Cancel</button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" style={{ marginRight: '6px' }} />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
