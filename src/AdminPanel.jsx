import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, XCircle, Clock, Building, Mail, Phone, MessageSquare, Settings, Eye, Shield, UserCheck, UserX, Plus, Trash2, Package } from 'lucide-react';
import { supabase } from './supabaseClient';
import CustomMaterialsManager from './custommaterialsmanager';

const AdminPanel = ({ currentUser, sites }) => {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [siteAccess, setSiteAccess] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showSiteAccessModal, setShowSiteAccessModal] = useState(false);

  const addAlert = (message, type) => {
    const alert = { id: Date.now(), message, type };
    setAlerts(prev => [alert, ...prev.slice(0, 3)]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== alert.id)), 5000);
  };

  const loadPendingUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingUsers(data || []);
    } catch (error) {
      addAlert('Error loading pending users: ' + error.message, 'error');
    }
  };

  const loadAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error) {
      addAlert('Error loading users: ' + error.message, 'error');
    }
  };

  const loadSiteAccess = async () => {
    try {
      console.log('Loading site access...');
      
      // Simplified query to avoid relationship issues
      const { data: accessData, error: accessError } = await supabase
        .from('user_site_access')
        .select('*');

      if (accessError) {
        console.log('Access error:', accessError);
        throw accessError;
      }

      // Get user profiles separately
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email');

      if (profilesError) {
        console.log('Profiles error:', profilesError);
        throw profilesError;
      }

      // Get sites separately
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('id, site_name, site_code');

      if (sitesError) {
        console.log('Sites error:', sitesError);
        throw sitesError;
      }

      // Combine the data manually
      const combinedData = accessData.map(access => {
        const userProfile = profilesData.find(p => p.id === access.user_id);
        const site = sitesData.find(s => s.id === access.site_id);
        
        return {
          ...access,
          user_profiles: userProfile,
          sites: site
        };
      });

      console.log('Site access loaded:', combinedData);
      setSiteAccess(combinedData);
    } catch (error) {
      console.log('Error loading site access:', error);
      addAlert('Error loading site access: ' + error.message, 'error');
      setSiteAccess([]); // Set empty array on error
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadPendingUsers(),
      loadAllUsers(),
      loadSiteAccess()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const approveUser = async (userId) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          status: 'approved',
          approved_by: currentUser.profileId,
          approved_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      addAlert('User approved successfully!', 'success');
      loadData();
    } catch (error) {
      addAlert('Error approving user: ' + error.message, 'error');
    }
  };

  const rejectUser = async (userId) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          status: 'rejected',
          approved_by: currentUser.profileId,
          approved_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      addAlert('User rejected', 'success');
      loadData();
    } catch (error) {
      addAlert('Error rejecting user: ' + error.message, 'error');
    }
  };

  const suspendUser = async (userId) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ status: 'suspended' })
        .eq('id', userId);

      if (error) throw error;
      addAlert('User suspended successfully', 'success');
      loadData();
    } catch (error) {
      addAlert('Error suspending user: ' + error.message, 'error');
    }
  };

  const unsuspendUser = async (userId) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ status: 'approved' })
        .eq('id', userId);

      if (error) throw error;
      addAlert('User unsuspended successfully', 'success');
      loadData();
    } catch (error) {
      addAlert('Error unsuspending user: ' + error.message, 'error');
    }
  };

  const grantSiteAccess = async (userId, siteId, accessLevel = 'read') => {
    try {
      console.log('Granting access:', { userId, siteId, accessLevel });

      // Use upsert to handle both insert and update
      const { error } = await supabase
        .from('user_site_access')
        .upsert({
          user_id: userId,
          site_id: siteId,
          access_level: accessLevel,
          granted_by: currentUser.profileId,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,site_id'
        });

      if (error) {
        console.log('Upsert error:', error);
        throw error;
      }

      addAlert('Site access granted!', 'success');
      loadSiteAccess();
    } catch (error) {
      console.log('Error in grantSiteAccess:', error);
      addAlert('Error managing site access: ' + error.message, 'error');
    }
  };

  const revokeSiteAccess = async (accessId) => {
    try {
      const { error } = await supabase
        .from('user_site_access')
        .delete()
        .eq('id', accessId);

      if (error) throw error;
      addAlert('Site access revoked', 'success');
      loadSiteAccess();
    } catch (error) {
      addAlert('Error revoking site access: ' + error.message, 'error');
    }
  };

  // Handle materials updated - callback for when materials are added/updated
  const handleMaterialsUpdated = () => {
    // This would trigger a refresh in the parent App component
    // to reload the navigation with new custom materials
    addAlert('Materials updated! Please refresh the page to see changes in navigation.', 'success');
  };

  const SiteAccessModal = () => {
    const [selectedSites, setSelectedSites] = useState([]);
    const [accessLevel, setAccessLevel] = useState('read');

    const handleAddSiteAccess = async () => {
      console.log('Adding site access for sites:', selectedSites);
      console.log('Selected user:', selectedUser);
      console.log('Access level:', accessLevel);
      
      for (const siteId of selectedSites) {
        console.log('Granting access to site:', siteId);
        await grantSiteAccess(selectedUser.id, siteId, accessLevel);
      }
      setShowSiteAccessModal(false);
      setSelectedUser(null);
      setSelectedSites([]);
    };

    const userCurrentSites = siteAccess
      .filter(access => access.user_id === selectedUser?.id)
      .map(access => access.site_id);

    const availableSites = sites?.filter(site => !userCurrentSites.includes(site.id)) || [];
    const userExistingSites = siteAccess
      .filter(access => access.user_id === selectedUser?.id)
      .map(access => ({
        site_id: access.site_id,
        site_name: access.sites?.site_name || 'Unknown Site',
        access_level: access.access_level
      }));

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Manage Site Access for {selectedUser?.full_name}</h3>
          
          {/* Show existing access */}
          {userExistingSites.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Current Access:</h4>
              <div className="space-y-1">
                {userExistingSites.map(site => (
                  <div key={site.site_id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                    <span className="text-sm">{site.site_name}</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{site.access_level}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            {availableSites.length > 0 ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Access Level</label>
                  <select
                    value={accessLevel}
                    onChange={(e) => setAccessLevel(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="read">Read Only</option>
                    <option value="write">Read & Write</option>
                    <option value="admin">Admin Access</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Grant Access to Additional Sites</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {availableSites.map(site => (
                      <label key={site.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedSites.includes(site.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSites(prev => [...prev, site.id]);
                            } else {
                              setSelectedSites(prev => prev.filter(id => id !== site.id));
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">{site.site_name} ({site.site_code})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600">User already has access to all available sites.</p>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleAddSiteAccess}
              disabled={selectedSites.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            >
              Grant Access
            </button>
            <button
              onClick={() => {
                setShowSiteAccessModal(false);
                setSelectedUser(null);
                setSelectedSites([]);
              }}
              className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">🔐 Admin Panel</h1>
        <p className="text-gray-600">Manage user access, site permissions, and custom materials</p>
      </div>

      {/* Alerts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {alerts.map(alert => (
          <div key={alert.id} className={`p-3 rounded-lg shadow-lg max-w-sm ${
            alert.type === 'success' ? 'bg-green-500 text-white' :
            alert.type === 'error' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'
          }`}>
            <div className="flex items-center gap-2">
              {alert.type === 'success' ? <CheckCircle size={16} /> : <Users size={16} />}
              <span className="text-sm">{alert.message}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="flex border-b overflow-x-auto">
          {[
            { id: 'pending', label: 'Pending Approvals', icon: Clock, count: pendingUsers.length },
            { id: 'users', label: 'All Users', icon: Users, count: allUsers.length },
            { id: 'access', label: 'Site Access', icon: Shield, count: siteAccess.length },
            { id: 'materials', label: 'Custom Materials', icon: Package, count: null }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap ${
                activeTab === tab.id ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Pending Approvals Tab */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingUsers.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Approvals</h3>
              <p className="text-gray-600">All users have been reviewed</p>
            </div>
          ) : (
            pendingUsers.map(user => (
              <div key={user.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{user.full_name}</h3>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {user.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone size={14} />
                          <span>{user.phone}</span>
                        </div>
                      )}
                      {user.company_name && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Building size={14} />
                          <span>{user.company_name}</span>
                        </div>
                      )}
                    </div>

                    {user.requested_access_reason && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <div className="flex items-start gap-2">
                          <MessageSquare size={14} className="text-gray-500 mt-1" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">Access Request Reason:</p>
                            <p className="text-sm text-gray-600 mt-1">{user.requested_access_reason}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-500">
                      Requested on: {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => approveUser(user.id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                    >
                      <CheckCircle size={16} />
                      Approve
                    </button>
                    <button
                      onClick={() => rejectUser(user.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* All Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Company</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Last Login</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map(user => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-gray-900">{user.full_name}</div>
                        <div className="text-gray-600">{user.email}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{user.company_name || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.status === 'approved' ? 'bg-green-100 text-green-800' :
                        user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        user.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowSiteAccessModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="Manage Site Access"
                        >
                          <Building size={16} />
                        </button>
                        {user.status === 'approved' && (
                          <button
                            onClick={() => suspendUser(user.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Suspend User"
                          >
                            <UserX size={16} />
                          </button>
                        )}
                        {user.status === 'suspended' && (
                          <button
                            onClick={() => unsuspendUser(user.id)}
                            className="text-green-600 hover:text-green-800"
                            title="Unsuspend User"
                          >
                            <UserCheck size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Site Access Tab */}
      {activeTab === 'access' && (
        <div className="space-y-6">
          {/* Site Access Overview */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Site Access Overview</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">User</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Site</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Access Level</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Granted</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {siteAccess.map(access => (
                    <tr key={access.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{access.user_profiles?.full_name}</div>
                          <div className="text-gray-600 text-xs">{access.user_profiles?.email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{access.sites?.site_name}</div>
                          <div className="text-gray-600 text-xs">{access.sites?.site_code}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          access.access_level === 'admin' ? 'bg-purple-100 text-purple-800' :
                          access.access_level === 'write' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {access.access_level}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {new Date(access.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => revokeSiteAccess(access.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Revoke Access"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {siteAccess.length === 0 && (
              <div className="text-center py-8">
                <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Site Access Granted</h3>
                <p className="text-gray-600">Start by approving users and granting them site access</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Materials Tab */}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          {/* Check if user is super admin */}
          {currentUser?.role === 'super_admin' ? (
            <CustomMaterialsManager 
              currentUser={currentUser} 
              onMaterialsUpdated={handleMaterialsUpdated}
            />
          ) : (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Super Admin Access Required</h3>
              <p className="text-gray-600">Only super administrators can manage custom materials.</p>
            </div>
          )}
        </div>
      )}

      {/* Site Access Modal */}
      {showSiteAccessModal && <SiteAccessModal />}
    </div>
  );
};

export default AdminPanel;