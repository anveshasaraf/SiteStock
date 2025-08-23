import React, { useState, useEffect } from 'react';
import { MapPin, Building, Users, Phone, Mail, Calendar, AlertTriangle, CheckCircle, Plus, Edit3, Trash2, Search, Filter, Download, Eye, ArrowRight, Package, Hammer, BarChart3, Mountain } from 'lucide-react';
import { supabase } from './supabaseClient';

const SitesManagement = ({ onSiteSelect, userSites = [], isAdmin = false }) => {
  // State management
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedSite, setSelectedSite] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [siteInventoryStats, setSiteInventoryStats] = useState({});

  // Simplified form state - only essential fields
  const [siteForm, setSiteForm] = useState({
    site_name: '',
    location: '',
    manager_name: '',
    notes: '',
    steel_low_stock_threshold: 50,
    cement_low_stock_threshold: 10,
    sand_low_stock_threshold: 10,
    stone_chips_low_stock_threshold: 5,
    diesel_low_stock_threshold: 100,
    // Auto-generated and default fields
    site_code: '',
    status: 'active'
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const STATUS_OPTIONS = [
    { value: 'active', label: 'Active', color: 'green' },
    { value: 'completed', label: 'Completed', color: 'blue' },
    { value: 'on_hold', label: 'On Hold', color: 'yellow' },
    { value: 'cancelled', label: 'Cancelled', color: 'red' }
  ];

  // Utility functions
  const addAlert = (message, type) => {
    const alert = { id: Date.now(), message, type };
    setAlerts(prev => [alert, ...prev.slice(0, 4)]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== alert.id)), 5000);
  };

  // Generate site code automatically
  const generateSiteCode = (siteName) => {
    const words = siteName.trim().split(' ');
    let code = '';
    
    if (words.length === 1) {
      // Single word: take first 3 characters
      code = words[0].substring(0, 3).toUpperCase();
    } else {
      // Multiple words: take first letter of each word (max 3)
      code = words.slice(0, 3).map(word => word.charAt(0)).join('').toUpperCase();
    }
    
    // Add timestamp to ensure uniqueness
    const timestamp = Date.now().toString().slice(-3);
    return `${code}-${timestamp}`;
  };

  const resetForm = () => {
    setSiteForm({
      site_name: '',
      location: '',
      manager_name: '',
      notes: '',
      steel_low_stock_threshold: 50,
      cement_low_stock_threshold: 10,
      sand_low_stock_threshold: 10,
      stone_chips_low_stock_threshold: 5,
      diesel_low_stock_threshold: 100,
      site_code: '',
      status: 'active'
    });
    setIsEditing(false);
    setEditingId(null);
  };

  // Enhanced delete function with cascading deletes
  const deleteSiteWithCascade = async (siteId) => {
    if (!isAdmin) {
      addAlert('You do not have permission to delete sites', 'error');
      return;
    }

    setDeleteLoading(true);
    
    try {
      // Get site info for logging
      const { data: siteInfo } = await supabase
        .from('sites')
        .select('site_name, site_code')
        .eq('id', siteId)
        .single();

      addAlert(`Starting deletion of ${siteInfo?.site_name || 'site'}...`, 'info');

      // Step 1: Delete from inventory-related tables in correct order
      const tablesToClean = [
        'transactions',
        'cement_transactions', 
        'sand_transactions',
        'stone_chips_transactions',
        'inventory',
        'cement_inventory',
        'sand_inventory', 
        'stone_chips_inventory',
        'user_site_access'
      ];

      let deletedRecords = 0;

      for (const table of tablesToClean) {
        try {
          const { data, error } = await supabase
            .from(table)
            .delete()
            .eq('site_id', siteId)
            .select();

          if (error) {
            // Log error but continue - table might not exist or might be empty
            console.warn(`Warning deleting from ${table}:`, error.message);
          } else if (data) {
            deletedRecords += data.length;
            console.log(`Deleted ${data.length} records from ${table}`);
          }
        } catch (tableError) {
          console.warn(`Error with table ${table}:`, tableError.message);
          // Continue with other tables
        }
      }

      // Step 2: Delete the site itself
      const { error: siteError } = await supabase
        .from('sites')
        .delete()
        .eq('id', siteId);

      if (siteError) {
        throw new Error(`Failed to delete site: ${siteError.message}`);
      }

      addAlert(
        `Successfully deleted site "${siteInfo?.site_name}" and ${deletedRecords} related records`, 
        'success'
      );
      
      await loadSites();
      setShowDeleteConfirm(null);

    } catch (error) {
      console.error('Delete operation failed:', error);
      addAlert(`Error deleting site: ${error.message}`, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Database operations
  const loadSites = async () => {
    try {
      setLoading(true);
      
      let sitesToLoad = [];
      
      if (isAdmin) {
        // Admin can see all sites
        const { data, error } = await supabase
          .from('sites')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        sitesToLoad = data || [];
      } else {
        // Regular users only see their authorized sites
        sitesToLoad = userSites || [];
      }

      setSites(sitesToLoad);
      
      // Update selectedSite if it's currently being viewed
      if (selectedSite) {
        const updatedSelectedSite = sitesToLoad.find(site => site.id === selectedSite.id);
        if (updatedSelectedSite) {
          setSelectedSite(updatedSelectedSite);
        }
      }
      
      // Load inventory stats for accessible sites
      await loadSiteInventoryStats(sitesToLoad);
    } catch (error) {
      addAlert('Error loading sites: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSiteInventoryStats = async (sitesData) => {
    const stats = {};
    
    for (const site of sitesData) {
      try {
        // Get steel inventory stats
        const { data: steelData, error: steelError } = await supabase
          .from('inventory')
          .select('pieces, total_weight')
          .eq('site_id', site.id);

        // Get cement inventory stats
        const { data: cementData, error: cementError } = await supabase
          .from('cement_inventory')
          .select('bags, total_weight')
          .eq('site_id', site.id);

        // Get sand inventory stats
        const { data: sandData, error: sandError } = await supabase
          .from('sand_inventory')
          .select('weight')
          .eq('site_id', site.id);

        // Get stone chips inventory stats
        const { data: stoneChipsData, error: stoneChipsError } = await supabase
          .from('stone_chips_inventory')
          .select('weight')
          .eq('site_id', site.id);

        // Get diesel inventory stats
        const { data: dieselData, error: dieselError } = await supabase
          .from('diesel_inventory')
          .select('total_weight')
          .eq('site_id', site.id);

        if (!steelError && !cementError && !sandError && !stoneChipsError && !dieselError) {
          const steelWeight = steelData?.reduce((sum, item) => sum + (item.total_weight || 0), 0) || 0;
          const steelPieces = steelData?.reduce((sum, item) => sum + (item.pieces || 0), 0) || 0;
          const cementWeight = cementData?.reduce((sum, item) => sum + (item.total_weight || 0), 0) || 0;
          const cementBags = cementData?.reduce((sum, item) => sum + (item.bags || 0), 0) || 0;
          const sandWeight = sandData?.reduce((sum, item) => sum + (item.weight || 0), 0) || 0;
          const stoneChipsWeight = stoneChipsData?.reduce((sum, item) => sum + (item.weight || 0), 0) || 0;
          const dieselWeight = dieselData?.reduce((sum, item) => sum + (item.total_weight || 0), 0) || 0;

          stats[site.id] = {
            steel: { weight: steelWeight, pieces: steelPieces },
            cement: { weight: cementWeight, bags: cementBags },
            sand: { weight: sandWeight },
            stoneChips: { weight: stoneChipsWeight },
            diesel: { weight: dieselWeight },
            totalWeight: steelWeight + cementWeight + sandWeight + stoneChipsWeight + dieselWeight
          };
        }
      } catch (error) {
        console.log(`Error loading stats for site ${site.id}:`, error);
      }
    }
    
    setSiteInventoryStats(stats);
  };

  const saveSite = async () => {
    try {
      // Validation - only check essential fields
      if (!siteForm.site_name.trim()) {
        addAlert('Site name is required', 'error');
        return;
      }
  
      if (!siteForm.location.trim()) {
        addAlert('Location is required', 'error');
        return;
      }
  
      if (!siteForm.manager_name.trim()) {
        addAlert('Manager name is required', 'error');
        return;
      }
  
      // Prepare data for saving - INCLUDE ALL THRESHOLD FIELDS
      const siteData = {
        site_name: siteForm.site_name.trim(),
        location: siteForm.location.trim(),
        manager_name: siteForm.manager_name.trim(),
        notes: siteForm.notes.trim(),
        status: siteForm.status,
        // Add ALL the threshold fields
        steel_low_stock_threshold: parseInt(siteForm.steel_low_stock_threshold) || 50,
        cement_low_stock_threshold: parseInt(siteForm.cement_low_stock_threshold) || 10,
        sand_low_stock_threshold: parseInt(siteForm.sand_low_stock_threshold) || 10,
        stone_chips_low_stock_threshold: parseInt(siteForm.stone_chips_low_stock_threshold) || 5,
        diesel_low_stock_threshold: parseInt(siteForm.diesel_low_stock_threshold) || 100
      };
  
      console.log('Saving site data with thresholds:', siteData);
  
      if (isEditing) {
        // Update existing site
        const { data: updatedData, error } = await supabase
          .from('sites')
          .update({
            ...siteData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId)
          .select();
  
        if (error) throw error;
        addAlert('Site updated successfully!', 'success');
      } else {
        // Generate site code for new site
        siteData.site_code = generateSiteCode(siteData.site_name);
        
        // Create new site
        const { error } = await supabase
          .from('sites')
          .insert([siteData]);
  
        if (error) throw error;
        addAlert('Site created successfully!', 'success');
      }
  
      await loadSites();
      
      // If we're viewing details of the edited site, update the selected site data
      if (isEditing && selectedSite && selectedSite.id === editingId) {
        const updatedSite = sites.find(site => site.id === editingId);
        if (updatedSite) {
          setSelectedSite(updatedSite);
        }
      }
      
      resetForm();
      setActiveTab('list');
    } catch (error) {
      if (error.code === '23505') {
        addAlert('Site code already exists. Please try again.', 'error');
      } else {
        addAlert('Error saving site: ' + error.message, 'error');
      }
    }
  };

  const editSite = (site) => {
    if (!isAdmin) {
      addAlert('You do not have permission to edit sites', 'error');
      return;
    }
    
    console.log('Editing site with data:', site);
    
    setSiteForm({
      site_name: site.site_name,
      location: site.location,
      manager_name: site.manager_name || site.contact_person || '',
      notes: site.notes || '',
      steel_low_stock_threshold: site.steel_low_stock_threshold || 50,
      cement_low_stock_threshold: site.cement_low_stock_threshold || 10,
      sand_low_stock_threshold: site.sand_low_stock_threshold || 10,
      stone_chips_low_stock_threshold: site.stone_chips_low_stock_threshold || 5,
      diesel_low_stock_threshold: site.diesel_low_stock_threshold || 100,
      site_code: site.site_code,
      status: site.status
    });
    setIsEditing(true);
    setEditingId(site.id);
    setActiveTab('form');
  };

  const viewSiteDetails = (site) => {
    setSelectedSite(site);
    setActiveTab('details');
  };

  const handleSiteSelect = (site) => {
    // Call the parent function to switch to site-specific inventory
    onSiteSelect(site);
  };

  // Load sites on component mount
  useEffect(() => {
    loadSites();
  }, []);

  // Filter and search sites
  const filteredSites = sites.filter(site => {
    const matchesSearch = site.site_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         site.site_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (site.manager_name || site.contact_person || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         site.location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || site.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  // Export to CSV
  const exportToCSV = () => {
    const csvData = sites.map(site => {
      const stats = siteInventoryStats[site.id] || { 
        steel: { weight: 0, pieces: 0 }, 
        cement: { weight: 0, bags: 0 },
        sand: { weight: 0 },
        stoneChips: { weight: 0 }
      };
      return {
        'Site Name': site.site_name,
        'Site Code': site.site_code,
        'Location': site.location || '',
        'Manager': site.manager_name || site.contact_person || '',
        'Status': site.status,
        'Steel Weight (t)': stats.steel.weight.toFixed(3),
        'Steel Pieces': stats.steel.pieces,
        'Cement Weight (t)': stats.cement.weight.toFixed(3),
        'Cement Bags': stats.cement.bags,
        'Sand Weight (t)': stats.sand.weight.toFixed(3),
        'Stone Chips Weight (t)': stats.stoneChips.weight.toFixed(3),
        'Total Weight (t)': stats.totalWeight.toFixed(3),
        'Notes': site.notes || '',
        'Created': new Date(site.created_at).toLocaleDateString()
      };
    });

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'sites_with_inventory.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addAlert('Sites data exported successfully!', 'success');
  };

  // Get status color
  const getStatusColor = (status) => {
    const statusObj = STATUS_OPTIONS.find(s => s.value === status);
    return statusObj ? statusObj.color : 'gray';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sites data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">🏗️ Construction Sites</h1>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-gray-600">
          <span>Accessible Sites: {sites.length}</span>
          <span>Active Sites: {sites.filter(s => s.status === 'active').length}</span>
          <span>Completed Sites: {sites.filter(s => s.status === 'completed').length}</span>
          {!isAdmin && <span className="text-blue-600">👤 Limited Access</span>}
          {isAdmin && <span className="text-green-600">🔑 Admin Access</span>}
        </div>
      </div>

      {/* Alerts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {alerts.map(alert => (
          <div key={alert.id} className={`p-3 rounded-lg shadow-lg max-w-sm ${
            alert.type === 'success' ? 'bg-green-500 text-white' :
            alert.type === 'error' ? 'bg-red-500 text-white' : 
            alert.type === 'info' ? 'bg-blue-500 text-white' :
            'bg-yellow-500 text-white'
          }`}>
            <div className="flex items-center gap-2">
              {alert.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span className="text-sm">{alert.message}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow mb-4 sm:mb-6">
        <div className="flex border-b overflow-x-auto">
          {[
            { id: 'list', label: 'Sites List', icon: Building },
            { id: 'form', label: isEditing ? 'Edit Site' : 'Add Site', icon: Plus, hidden: !isAdmin },
            { id: 'details', label: 'Site Details', icon: Eye, hidden: !selectedSite }
          ].filter(tab => !tab.hidden).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap ${
                activeTab === tab.id ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sites List Tab */}
      {activeTab === 'list' && (
        <div className="space-y-6">
          {/* Search and Filter Bar */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search sites..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 w-full sm:w-64"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 appearance-none bg-white"
                  >
                    <option value="all">All Status</option>
                    {STATUS_OPTIONS.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <button
                    onClick={() => {
                      resetForm();
                      setActiveTab('form');
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add Site
                  </button>
                )}
                <button
                  onClick={exportToCSV}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Download size={16} />
                  Export
                </button>
              </div>
            </div>
          </div>

          {/* Sites Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSites.map(site => {
              const stats = siteInventoryStats[site.id] || { 
                steel: { weight: 0, pieces: 0 }, 
                cement: { weight: 0, bags: 0 },
                sand: { weight: 0 },
                stoneChips: { weight: 0 },
                diesel: { weight: 0 },
                totalWeight: 0 
              };
              
              return (
                <div key={site.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{site.site_name}</h3>
                      <p className="text-sm text-gray-600">Code: {site.site_code}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      getStatusColor(site.status) === 'green' ? 'bg-green-100 text-green-800' :
                      getStatusColor(site.status) === 'blue' ? 'bg-blue-100 text-blue-800' :
                      getStatusColor(site.status) === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {STATUS_OPTIONS.find(s => s.value === site.status)?.label || site.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    {site.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin size={14} />
                        <span>{site.location}</span>
                      </div>
                    )}
                    {(site.manager_name || site.contact_person) && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users size={14} />
                        <span>{site.manager_name || site.contact_person}</span>
                      </div>
                    )}
                  </div>

                  {/* Inventory Summary */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Material Inventory</h4>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className="flex items-center gap-1">
                        <Hammer size={12} className="text-blue-500" />
                        <span className="text-gray-600">Steel: {stats.steel.weight.toFixed(1)}t</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package size={12} className="text-green-500" />
                        <span className="text-gray-600">Cement: {stats.cement.bags}b</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span className="text-gray-600">Sand: {stats.sand.weight.toFixed(1)}t</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Mountain size={12} className="text-orange-500" />
                        <span className="text-gray-600">Stone: {stats.stoneChips.weight.toFixed(1)}t</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-gray-600">Diesel: {stats.diesel.weight.toFixed(1)}L</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <span className="text-xs font-medium text-gray-700">
                        Total: {stats.totalWeight.toFixed(1)} tonnes
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleSiteSelect(site)}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium"
                    >
                      <BarChart3 size={16} />
                      Manage Inventory
                      <ArrowRight size={16} />
                    </button>
                    
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => viewSiteDetails(site)}
                        className="text-orange-600 hover:text-orange-800 text-sm font-medium"
                      >
                        View Details
                      </button>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => editSite(site)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(site.id)}
                            className="text-red-600 hover:text-red-800"
                            disabled={deleteLoading}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredSites.length === 0 && (
            <div className="text-center py-12">
              <Building className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sites available</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filterStatus !== 'all' 
                  ? 'No sites match your search criteria.' 
                  : isAdmin 
                    ? 'Get started by adding your first construction site.'
                    : 'No sites have been assigned to you yet. Please contact your administrator.'}
              </p>
              {isAdmin && (
                <button
                  onClick={() => {
                    resetForm();
                    setActiveTab('form');
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
                >
                  <Plus size={16} />
                  Add First Site
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Enhanced Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
            </div>
            <p className="text-gray-600 mb-2">
              Are you sure you want to delete this site and all its data?
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-800 text-sm font-medium mb-2">
                ⚠️ This will permanently delete:
              </p>
              <ul className="text-red-700 text-sm space-y-1 ml-4">
                <li>• All steel inventory and transactions</li>
                <li>• All cement inventory and transactions</li>
                <li>• All sand inventory and transactions</li>
                <li>• All stone chips inventory and transactions</li>
                <li>• All user access permissions for this site</li>
                <li>• The site record itself</li>
              </ul>
              <p className="text-red-800 text-xs mt-2 font-medium">
                This action cannot be undone!
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteSiteWithCascade(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Site & All Data'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form and Details tabs remain the same as in your original code */}
      {/* Simplified Add/Edit Site Form Tab */}
      {activeTab === 'form' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <Plus className="text-orange-600" size={24} />
            <h2 className="text-xl font-semibold">{isEditing ? 'Edit Site' : 'Add New Site'}</h2>
          </div>

          <div className="space-y-6">
            {/* Essential Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Site Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site Name *
                  </label>
                  <input
                    type="text"
                    value={siteForm.site_name}
                    onChange={(e) => setSiteForm(prev => ({ ...prev, site_name: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., Downtown Office Complex"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <input
                    type="text"
                    value={siteForm.location}
                    onChange={(e) => setSiteForm(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., 123 Main Street, City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Manager Name *
                  </label>
                  <input
                    type="text"
                    value={siteForm.manager_name}
                    onChange={(e) => setSiteForm(prev => ({ ...prev, manager_name: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={siteForm.status}
                    onChange={(e) => setSiteForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {STATUS_OPTIONS.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Low Stock Settings */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Alert Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Steel Low Stock Alert (pieces)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={siteForm.steel_low_stock_threshold || 50}
                    onChange={(e) => setSiteForm(prev => ({ 
                      ...prev, 
                      steel_low_stock_threshold: parseInt(e.target.value) || 50 
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., 50"
                  />
                  <p className="text-xs text-gray-500 mt-1">Alert when steel pieces fall below this number</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cement Low Stock Alert (bags)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={siteForm.cement_low_stock_threshold || 10}
                    onChange={(e) => setSiteForm(prev => ({ 
                      ...prev, 
                      cement_low_stock_threshold: parseInt(e.target.value) || 10 
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., 10"
                  />
                  <p className="text-xs text-gray-500 mt-1">Alert when cement bags fall below this number</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sand Low Stock Alert (tonnes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={siteForm.sand_low_stock_threshold || 10}
                    onChange={(e) => setSiteForm(prev => ({ 
                      ...prev, 
                      sand_low_stock_threshold: parseInt(e.target.value) || 10 
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., 10"
                  />
                  <p className="text-xs text-gray-500 mt-1">Alert when sand weight falls below this amount</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stone Chips Low Stock Alert (tonnes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={siteForm.stone_chips_low_stock_threshold || 5}
                    onChange={(e) => setSiteForm(prev => ({ 
                      ...prev, 
                      stone_chips_low_stock_threshold: parseInt(e.target.value) || 5 
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., 5"
                  />
                  <p className="text-xs text-gray-500 mt-1">Alert when stone chips weight falls below this amount</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Diesel Low Stock Alert (litres)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={siteForm.diesel_low_stock_threshold || 100}
                    onChange={(e) => setSiteForm(prev => ({ 
                      ...prev, 
                      diesel_low_stock_threshold: parseInt(e.target.value) || 100 
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., 100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Alert when diesel fuel falls below this amount</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={siteForm.notes}
                onChange={(e) => setSiteForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Additional notes about the site..."
              />
            </div>

            {/* Auto-generated code info */}
            {!isEditing && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Building className="text-blue-600 mt-1" size={16} />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Site Code</p>
                    <p className="text-sm text-blue-600">
                      A unique site code will be automatically generated based on the site name
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-4 pt-6 border-t">
              <button
                onClick={saveSite}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium"
              >
                {isEditing ? 'Update Site' : 'Create Site'}
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setActiveTab('list');
                }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-3 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Site Details Tab - Keep your existing implementation */}
      {activeTab === 'details' && selectedSite && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('list')}
                className="text-orange-600 hover:text-orange-800 flex items-center gap-1"
              >
                ← Back to Sites List
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSiteSelect(selectedSite)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <BarChart3 size={16} />
                Manage Inventory
              </button>
              {isAdmin && (
                <button
                  onClick={() => editSite(selectedSite)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Edit3 size={16} />
                  Edit Site
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Site Header */}
            <div className="border-b pb-6">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-gray-900">{selectedSite.site_name}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  getStatusColor(selectedSite.status) === 'green' ? 'bg-green-100 text-green-800' :
                  getStatusColor(selectedSite.status) === 'blue' ? 'bg-blue-100 text-blue-800' :
                  getStatusColor(selectedSite.status) === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {STATUS_OPTIONS.find(s => s.value === selectedSite.status)?.label || selectedSite.status}
                </span>
              </div>
              <p className="text-lg text-gray-600">Site Code: {selectedSite.site_code}</p>
            </div>

            {/* Site Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Site Information</h3>
                
                {selectedSite.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="text-gray-400 mt-1" size={16} />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Location</p>
                      <p className="text-gray-600">{selectedSite.location}</p>
                    </div>
                  </div>
                )}

                {(selectedSite.manager_name || selectedSite.contact_person) && (
                  <div className="flex items-start gap-3">
                    <Users className="text-gray-400 mt-1" size={16} />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Manager</p>
                      <p className="text-gray-600">{selectedSite.manager_name || selectedSite.contact_person}</p>
                    </div>
                  </div>
                )}

                {/* Legacy fields - only show if they exist */}
                {selectedSite.contractor_name && (
                  <div className="flex items-start gap-3">
                    <Building className="text-gray-400 mt-1" size={16} />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Contractor</p>
                      <p className="text-gray-600">{selectedSite.contractor_name}</p>
                    </div>
                  </div>
                )}

                {selectedSite.project_type && (
                  <div className="flex items-start gap-3">
                    <Building className="text-gray-400 mt-1" size={16} />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Project Type</p>
                      <p className="text-gray-600">{selectedSite.project_type}</p>
                    </div>
                  </div>
                )}

                {selectedSite.start_date && (
                  <div className="flex items-start gap-3">
                    <Calendar className="text-gray-400 mt-1" size={16} />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Start Date</p>
                      <p className="text-gray-600">{new Date(selectedSite.start_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                
                {/* Legacy contact fields - only show if they exist */}
                {selectedSite.contact_phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="text-gray-400 mt-1" size={16} />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Phone</p>
                      <p className="text-gray-600">
                        <a href={`tel:${selectedSite.contact_phone}`} className="text-orange-600 hover:text-orange-800">
                          {selectedSite.contact_phone}
                        </a>
                      </p>
                    </div>
                  </div>
                )}

                {selectedSite.contact_email && (
                  <div className="flex items-start gap-3">
                    <Mail className="text-gray-400 mt-1" size={16} />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Email</p>
                      <p className="text-gray-600">
                        <a href={`mailto:${selectedSite.contact_email}`} className="text-orange-600 hover:text-orange-800">
                          {selectedSite.contact_email}
                        </a>
                      </p>
                    </div>
                  </div>
                )}

                {!selectedSite.contact_phone && !selectedSite.contact_email && (
                  <p className="text-gray-500 text-sm">No additional contact information available</p>
                )}
              </div>
            </div>

            {/* Notes Section */}
            {selectedSite.notes && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedSite.notes}</p>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">System Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Created:</span> {new Date(selectedSite.created_at).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Last Updated:</span> {new Date(selectedSite.updated_at).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SitesManagement;