import React, { useState, useEffect } from 'react';
import { LogOut, Building, Package, Hammer, Users, Mountain, Waves, Menu, X, ArrowLeft, BarChart3, Fuel } from 'lucide-react';
import { supabase } from './supabaseClient';

// Import your existing components
import SitesManagement from './Sites';
import SiteAwareSteelInventorySystem from './Steel';
import SiteAwareCementInventorySystem from './Cement';
import SiteAwareStoneChipsInventorySystem from './StoneChips';
import SiteAwareSandInventorySystem from './Sand';
import SiteAwareDieselInventorySystem from './Diesel';

// Import new auth components
import AuthSystem from './AuthSystem';
import AdminPanel from './AdminPanel';

const App = () => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userSites, setUserSites] = useState([]);
  const [allSites, setAllSites] = useState([]);
  const [currentView, setCurrentView] = useState('sites');
  const [selectedSite, setSelectedSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check for existing session on app load
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        await handleAuthSuccess(session.user);
      }
    } catch (error) {
      console.log('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = async (authUser, profile = null) => {
    try {
      console.log('handleAuthSuccess called with:', { authUser, profile });
      setUser(authUser);

      // Get user profile if not provided
      if (!profile) {
        console.log('Fetching profile for user:', authUser.id);
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('auth_user_id', authUser.id)
          .single();

        if (profileError) {
          console.log('Profile error:', profileError);
          throw profileError;
        }
        profile = profileData;
      }

      console.log('Setting user profile:', profile);
      setUserProfile(profile);

      // Load user's accessible sites
      await loadUserSites(profile.id);
      
      // Load all sites if admin
      if (profile.role === 'admin' || profile.role === 'super_admin') {
        await loadAllSites();
      }

      console.log('Auth success completed');
    } catch (error) {
      console.log('Auth success error:', error);
      handleLogout();
    }
  };

  const loadUserSites = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_site_access')
        .select(`
          site_id,
          access_level,
          sites:site_id (*)
        `)
        .eq('user_id', userId);

      if (error) throw error;

      const sites = data.map(access => ({
        ...access.sites,
        access_level: access.access_level
      }));

      setUserSites(sites);
    } catch (error) {
      console.log('Error loading user sites:', error);
    }
  };

  const loadAllSites = async () => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('site_name');

      if (error) throw error;
      setAllSites(data);
    } catch (error) {
      console.log('Error loading all sites:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      setUser(null);
      setUserProfile(null);
      setUserSites([]);
      setAllSites([]);
      setCurrentView('sites');
      setSelectedSite(null);
      setMobileMenuOpen(false);
    }
  };

  const handleSiteSelect = (site) => {
    console.log('Site selected for inventory:', site);
    setSelectedSite(site);
    setCurrentView('site-overview'); // Show overview first instead of going directly to steel
    setMobileMenuOpen(false);
  };

  const handleBackToSites = () => {
    setCurrentView('sites');
    setSelectedSite(null);
    setMobileMenuOpen(false);
  };

  const canAccessAdmin = () => {
    return userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
  };

  const getAccessibleSites = () => {
    if (canAccessAdmin()) {
      return allSites;
    }
    return userSites;
  };

  const materialTabs = [
    { id: 'steel', label: 'Steel', icon: Hammer, color: 'blue' },
    { id: 'cement', label: 'Cement', icon: Package, color: 'green' },
    { id: 'stone-chips', label: 'Stone Chips', icon: Mountain, color: 'orange' },
    { id: 'sand', label: 'Sand', icon: Waves, color: 'yellow' },
    { id: 'diesel', label: 'Diesel', icon: Fuel, color: 'red' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  // Show auth system if not logged in
  if (!user || !userProfile) {
    return <AuthSystem onAuthSuccess={handleAuthSuccess} />;
  }

  // Mobile-friendly navigation component
  const MobileNavigation = () => (
    <>
      {/* Mobile Header */}
      <div className="bg-white shadow-sm border-b lg:hidden">
        <div className="px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-gray-900">Construction Manager</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl overflow-y-auto">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="w-6 h-6 text-blue-600" />
                  <span className="font-bold text-gray-900">Menu</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)}>
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* User Info */}
              <div className="pb-4 border-b">
                <div className="text-sm font-medium text-gray-900">{userProfile.full_name}</div>
                <div className="text-xs text-gray-500">{userProfile.role}</div>
              </div>

              {/* Main Navigation */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setCurrentView('sites');
                    setSelectedSite(null);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-lg flex items-center gap-3 ${
                    currentView === 'sites' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Building size={20} />
                  <span>Sites</span>
                </button>

                {canAccessAdmin() && (
                  <button
                    onClick={() => {
                      setCurrentView('admin');
                      setSelectedSite(null);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-lg flex items-center gap-3 ${
                      currentView === 'admin' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Users size={20} />
                    <span>Admin Panel</span>
                  </button>
                )}
              </div>

              {/* Site Selection (if site selected) */}
              {selectedSite && (
                <div className="border-t pt-4">
                  <div className="mb-3">
                    <div className="text-sm font-medium text-gray-900">Selected Site:</div>
                    <div className="text-sm text-blue-600">{selectedSite.site_name}</div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setCurrentView('site-overview');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-lg flex items-center gap-3 mb-2 ${
                      currentView === 'site-overview' ? 'bg-orange-100 text-orange-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <BarChart3 size={20} />
                    <span>Site Overview</span>
                  </button>

                  <div className="space-y-2">
                    {materialTabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setCurrentView(tab.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left p-3 rounded-lg flex items-center gap-3 ${
                          currentView === tab.id 
                            ? `bg-${tab.color}-100 text-${tab.color}-700` 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <tab.icon size={20} />
                        <span>{tab.label} Inventory</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Logout */}
              <div className="border-t pt-4">
                <button
                  onClick={handleLogout}
                  className="w-full text-left p-3 rounded-lg flex items-center gap-3 text-red-600 hover:bg-red-50"
                >
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Desktop navigation (unchanged)
  const DesktopNavigation = () => (
    <div className="bg-white shadow-sm border-b hidden lg:block">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Building className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Construction Manager</span>
            </div>

            <nav className="flex space-x-8">
              <button
                onClick={() => {
                  setCurrentView('sites');
                  setSelectedSite(null);
                }}
                className={`${
                  currentView === 'sites' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                } border-b-2 py-2 px-1 text-sm font-medium`}
              >
                <Building className="w-4 h-4 inline mr-2" />
                Sites
              </button>

              {canAccessAdmin() && (
                <button
                  onClick={() => {
                    setCurrentView('admin');
                    setSelectedSite(null);
                  }}
                  className={`${
                    currentView === 'admin' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } border-b-2 py-2 px-1 text-sm font-medium`}
                >
                  <Users className="w-4 h-4 inline mr-2" />
                  Admin Panel
                </button>
              )}

              {selectedSite && (
                <>
                  <button
                    onClick={() => setCurrentView('site-overview')}
                    className={`${
                      currentView === 'site-overview' 
                        ? 'border-orange-500 text-orange-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    } border-b-2 py-2 px-1 text-sm font-medium`}
                  >
                    <BarChart3 className="w-4 h-4 inline mr-2" />
                    Site Overview
                  </button>

                  {materialTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setCurrentView(tab.id)}
                      className={`${
                        currentView === tab.id 
                          ? `border-${tab.color}-500 text-${tab.color}-600` 
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      } border-b-2 py-2 px-1 text-sm font-medium`}
                    >
                      <tab.icon className="w-4 h-4 inline mr-2" />
                      {tab.label}
                    </button>
                  ))}
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{userProfile.full_name}</div>
              <div className="text-xs text-gray-500">{userProfile.role}</div>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 p-2"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Site Overview Component (new)
  const SiteOverview = () => (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleBackToSites}
            className="flex items-center gap-2 text-orange-600 hover:text-orange-800 font-medium"
          >
            <ArrowLeft size={20} />
            Back to Sites
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            📊 {selectedSite.site_name} Overview
          </h1>
          <p className="text-gray-600">Select a material type to manage inventory</p>
        </div>
      </div>

      {/* Material Type Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {materialTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setCurrentView(tab.id)}
            className={`bg-white rounded-lg shadow-md p-6 border-l-4 border-${tab.color}-500 hover:shadow-lg transition-shadow text-left`}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-3 bg-${tab.color}-100 rounded-lg`}>
                <tab.icon className={`w-8 h-8 text-${tab.color}-600`} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{tab.label} Inventory</h3>
                <p className="text-gray-600">Manage {tab.label.toLowerCase()} stock</p>
              </div>
            </div>
            <div className={`text-${tab.color}-600 font-medium`}>
              Click to manage →
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // Render current view
  const renderCurrentView = () => {
    const accessibleSites = getAccessibleSites();

    switch (currentView) {
      case 'sites':
        return (
          <SitesManagement 
            onSiteSelect={handleSiteSelect}
            userSites={accessibleSites}
            isAdmin={canAccessAdmin()}
          />
        );

      case 'admin':
        if (!canAccessAdmin()) {
          return (
            <div className="max-w-7xl mx-auto p-6 text-center">
              <div className="bg-red-50 border border-red-200 rounded-lg p-8">
                <h2 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h2>
                <p className="text-red-600">You don't have permission to access the admin panel.</p>
              </div>
            </div>
          );
        }
        return (
          <AdminPanel 
            currentUser={{ profileId: userProfile.id, ...userProfile }}
            sites={allSites}
          />
        );

      case 'site-overview':
        if (!selectedSite) {
          setCurrentView('sites');
          return null;
        }
        return <SiteOverview />;

        case 'steel':
          if (!selectedSite) {
            setCurrentView('sites');
            return null;
          }
          return (
            <SiteAwareSteelInventorySystem 
              selectedSite={selectedSite}
              onBackToSites={handleBackToSites}
              currentUser={userProfile}
            />
          );

      case 'cement':
        if (!selectedSite) {
          setCurrentView('sites');
          return null;
        }
        return (
          <SiteAwareCementInventorySystem 
            selectedSite={selectedSite}
            onBackToSites={handleBackToSites}
            currentUser={userProfile} 
          />
        );

      case 'stone-chips':
        if (!selectedSite) {
          setCurrentView('sites');
          return null;
        }
        return (
          <SiteAwareStoneChipsInventorySystem 
            selectedSite={selectedSite}
            onBackToSites={handleBackToSites}
            currentUser={userProfile} 
          />
        );

      case 'sand':
        if (!selectedSite) {
          setCurrentView('sites');
          return null;
        }
        return (
          <SiteAwareSandInventorySystem 
            selectedSite={selectedSite}
            onBackToSites={handleBackToSites}
            currentUser={userProfile}
          />
        );

      case 'diesel':
        if (!selectedSite) {
          setCurrentView('sites');
          return null;
        }
        return (
          <SiteAwareDieselInventorySystem 
            selectedSite={selectedSite}
            onBackToSites={handleBackToSites}
            currentUser={userProfile}
          />
        );

      default:
        return (
          <div className="max-w-7xl mx-auto p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Construction Manager</h2>
            <p className="text-gray-600">Select a site to begin managing inventory.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNavigation />
      <DesktopNavigation />
      {renderCurrentView()}
    </div>
  );
};

export default App;