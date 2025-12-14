import React, { useState, useEffect, useCallback } from 'react';

// API helper with logging
const api = {
  async get(url) {
    console.log(`[API] GET ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[API] GET ${url} failed:`, res.status, errText);
      throw new Error(errText);
    }
    const data = await res.json();
    console.log(`[API] GET ${url} response:`, data);
    return data;
  },
  async post(url, data) {
    console.log(`[API] POST ${url}`, data);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[API] POST ${url} failed:`, res.status, errText);
      throw new Error(errText);
    }
    const responseData = await res.json();
    console.log(`[API] POST ${url} response:`, responseData);
    return responseData;
  },
  async patch(url, data) {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async delete(url) {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

// Status badge component
function StatusBadge({ status }) {
  const colors = {
    pending: 'badge-gray',
    emailed: 'badge-blue',
    responded: 'badge-yellow',
    converted: 'badge-green',
    expired: 'badge-red'
  };
  return (
    <span
      className={`badge ${colors[status] || 'badge-gray'}`}
      role="status"
      aria-label={`Status: ${status}`}
    >
      {status}
    </span>
  );
}

// Loading spinner component
function LoadingSpinner({ size = 'md' }) {
  return (
    <div className={`spinner spinner-${size}`} role="status" aria-label="Loading">
      <div className="spinner-circle"></div>
    </div>
  );
}

// Toast notification component
function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type}`} role="alert" aria-live="polite">
      <span>{message}</span>
      <button onClick={onClose} aria-label="Dismiss notification">×</button>
    </div>
  );
}

// Stats cards component
function StatsCards({ stats }) {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-value">{stats.total}</div>
        <div className="stat-label">Total Leads</div>
      </div>
      <div className="stat-card stat-blue">
        <div className="stat-value">{stats.emailed}</div>
        <div className="stat-label">Emailed</div>
      </div>
      <div className="stat-card stat-yellow">
        <div className="stat-value">{stats.responded}</div>
        <div className="stat-label">Responded</div>
      </div>
      <div className="stat-card stat-green">
        <div className="stat-value">{stats.converted}</div>
        <div className="stat-label">Converted</div>
      </div>
      <div className="stat-card stat-purple">
        <div className="stat-value">{stats.conversionRate}%</div>
        <div className="stat-label">Conversion Rate</div>
      </div>
      <div className="stat-card stat-money">
        <div className="stat-value">${stats.revenue.toLocaleString()}</div>
        <div className="stat-label">Revenue</div>
      </div>
    </div>
  );
}

// Deployment row component
function DeploymentRow({ deployment, onUpdate, onDelete, onSendEmail }) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(deployment.notes || '');
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus) => {
    setLoading(true);
    try {
      await onUpdate(deployment.siteId, { status: newStatus });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    setLoading(true);
    try {
      await onUpdate(deployment.siteId, { notes });
      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  };

  const timeAgo = (date) => {
    if (!date) return 'N/A';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <tr className={loading ? 'loading' : ''}>
      <td>
        <div className="business-name">{deployment.businessName || 'Unknown'}</div>
        <div className="business-meta">{deployment.industry || 'N/A'}</div>
      </td>
      <td>
        <StatusBadge status={deployment.status} />
      </td>
      <td>
        <div className="contact-info">
          {deployment.email && <div className="email">{deployment.email}</div>}
          {deployment.phone && <div className="phone">{deployment.phone}</div>}
          {!deployment.email && !deployment.phone && <span className="muted">No contact</span>}
        </div>
      </td>
      <td>
        <a href={deployment.preview} target="_blank" rel="noopener noreferrer" className="preview-link">
          View Preview ↗
        </a>
      </td>
      <td>
        <div className="date">{timeAgo(deployment.createdAt)}</div>
        {deployment.emailSentAt && (
          <div className="email-sent">Emailed {timeAgo(deployment.emailSentAt)}</div>
        )}
      </td>
      <td>
        <div className="actions">
          <select 
            value={deployment.status} 
            onChange={(e) => handleStatusChange(e.target.value)}
            className="status-select"
          >
            <option value="pending">Pending</option>
            <option value="emailed">Emailed</option>
            <option value="responded">Responded</option>
            <option value="converted">Converted</option>
            <option value="expired">Expired</option>
          </select>
          
          {deployment.email && deployment.status === 'pending' && (
            <button 
              className="btn btn-sm btn-primary"
              onClick={() => onSendEmail(deployment.siteId)}
              disabled={loading}
            >
              Send Email
            </button>
          )}
          
          <button 
            className="btn btn-sm btn-ghost"
            onClick={() => setIsEditing(!isEditing)}
          >
            Notes
          </button>
          
          <button
            className="btn btn-sm btn-danger"
            onClick={() => onDelete(deployment.siteId)}
            disabled={loading}
            aria-label={`Delete ${deployment.businessName || 'deployment'}`}
          >
            ×
          </button>
        </div>
        
        {isEditing && (
          <div className="notes-editor">
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
            />
            <button className="btn btn-sm btn-primary" onClick={handleSaveNotes}>Save</button>
          </div>
        )}
      </td>
    </tr>
  );
}

// New lead form component
function NewLeadForm({ onSubmit, onSuccess, onError }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [skipEmail, setSkipEmail] = useState(false);
  const [validationError, setValidationError] = useState('');

  const validateUrl = (value) => {
    if (!value) {
      return 'URL is required';
    }
    try {
      const urlObj = new URL(value);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return 'URL must start with http:// or https://';
      }
      if (!urlObj.hostname.includes('.')) {
        return 'Please enter a valid domain';
      }
    } catch {
      return 'Please enter a valid URL';
    }
    return '';
  };

  const handleUrlChange = (e) => {
    const value = e.target.value;
    setUrl(value);
    if (validationError) {
      setValidationError(validateUrl(value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validateUrl(url);
    if (error) {
      setValidationError(error);
      return;
    }

    setLoading(true);
    setValidationError('');
    try {
      await onSubmit(url, { skipEmail });
      setUrl('');
      if (onSuccess) onSuccess('Pipeline started! Processing your lead...');
    } catch (err) {
      if (onError) onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="new-lead-form" noValidate>
      <div className="form-field">
        <label htmlFor="lead-url" className="sr-only">Website URL</label>
        <input
          id="lead-url"
          type="url"
          value={url}
          onChange={handleUrlChange}
          onBlur={() => url && setValidationError(validateUrl(url))}
          placeholder="https://example-business.com"
          aria-describedby={validationError ? 'url-error' : undefined}
          aria-invalid={!!validationError}
          className={validationError ? 'input-error' : ''}
          disabled={loading}
        />
        {validationError && (
          <span id="url-error" className="field-error" role="alert">
            {validationError}
          </span>
        )}
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={skipEmail}
          onChange={(e) => setSkipEmail(e.target.checked)}
          aria-label="Skip sending email after processing"
        />
        Skip email
      </label>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <LoadingSpinner size="sm" />
            <span>Processing...</span>
          </>
        ) : 'Add Lead'}
      </button>
    </form>
  );
}

// Main App component
export default function App() {
  const [deployments, setDeployments] = useState([]);
  const [stats, setStats] = useState({
    total: 0, pending: 0, emailed: 0, responded: 0, converted: 0, expired: 0,
    conversionRate: 0, revenue: 0, byIndustry: {}, recentActivity: []
  });
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (search) params.set('search', search);
      
      const [deploymentsData, statsData] = await Promise.all([
        api.get(`/api/deployments?${params}`),
        api.get('/api/stats')
      ]);
      
      setDeployments(deploymentsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleUpdate = async (siteId, updates) => {
    await api.patch(`/api/deployments/${siteId}`, updates);
    fetchData();
  };

  const handleDelete = async (siteId) => {
    if (!confirm('Delete this deployment?')) return;
    await api.delete(`/api/deployments/${siteId}?deleteNetlify=true`);
    fetchData();
  };

  const handleSendEmail = async (siteId) => {
    try {
      await api.post(`/api/deployments/${siteId}/send-email`);
      fetchData();
    } catch (err) {
      alert('Failed to send email: ' + err.message);
    }
  };

  const handleNewLead = async (url, options) => {
    console.log('[Pipeline] Starting pipeline for:', url, options);
    const result = await api.post('/api/pipeline', { url, ...options });
    console.log('[Pipeline] Pipeline initiated:', result);
    // Poll for updates
    console.log('[Pipeline] Will poll for updates at 5s, 15s, 30s');
    setTimeout(() => { console.log('[Pipeline] Polling at 5s...'); fetchData(); }, 5000);
    setTimeout(() => { console.log('[Pipeline] Polling at 15s...'); fetchData(); }, 15000);
    setTimeout(() => { console.log('[Pipeline] Polling at 30s...'); fetchData(); }, 30000);
  };

  return (
    <div className="app">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <header className="header">
        <div className="header-content">
          <h1>Site Improver</h1>
          <span className="header-subtitle">Lead Dashboard</span>
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            <span className="hamburger-icon"></span>
          </button>
        </div>
        <nav className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`} aria-label="Main navigation">
          <a href="#stats" onClick={() => setMobileMenuOpen(false)}>Stats</a>
          <a href="#add-lead" onClick={() => setMobileMenuOpen(false)}>Add Lead</a>
          <a href="#deployments" onClick={() => setMobileMenuOpen(false)}>Deployments</a>
        </nav>
      </header>

      <main className="main">
        {error && (
          <div className="error-banner">
            Error loading data: {error}
            <button onClick={fetchData}>Retry</button>
          </div>
        )}

        <section id="stats" aria-label="Statistics">
          <StatsCards stats={stats} />
        </section>

        <section id="add-lead" className="section">
          <div className="section-header">
            <h2>Add New Lead</h2>
          </div>
          <NewLeadForm
            onSubmit={handleNewLead}
            onSuccess={(msg) => showToast(msg, 'success')}
            onError={(msg) => showToast(msg, 'error')}
          />
        </section>

        <section id="deployments" className="section">
          <div className="section-header">
            <h2>Deployments</h2>
            <div className="filters">
              <label htmlFor="search-deployments" className="sr-only">Search deployments</label>
              <input
                id="search-deployments"
                type="search"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input"
                aria-label="Search deployments by name, email, or industry"
              />
              <label htmlFor="filter-status" className="sr-only">Filter by status</label>
              <select
                id="filter-status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="filter-select"
                aria-label="Filter deployments by status"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="emailed">Emailed</option>
                <option value="responded">Responded</option>
                <option value="converted">Converted</option>
                <option value="expired">Expired</option>
              </select>
              <button
                onClick={fetchData}
                className="btn btn-ghost"
                aria-label="Refresh deployments list"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-state" aria-live="polite">
              <LoadingSpinner />
              <span>Loading deployments...</span>
            </div>
          ) : deployments.length === 0 ? (
            <div className="empty-state">
              <p>No deployments found</p>
              <p className="muted">Add a new lead above to get started</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="deployments-table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Status</th>
                    <th>Contact</th>
                    <th>Preview</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map(d => (
                    <DeploymentRow
                      key={d.siteId}
                      deployment={d}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onSendEmail={handleSendEmail}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {stats.byIndustry && Object.keys(stats.byIndustry).length > 0 && (
          <section className="section">
            <div className="section-header">
              <h2>By Industry</h2>
            </div>
            <div className="industry-grid">
              {Object.entries(stats.byIndustry).map(([industry, count]) => (
                <div key={industry} className="industry-card">
                  <div className="industry-name">{industry}</div>
                  <div className="industry-count">{count}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>Site Improver Dashboard • {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
