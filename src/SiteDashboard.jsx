import React, { useState, useEffect } from 'react';
import { ArrowLeft, Hammer, Package, BarChart3, TrendingUp, Calendar, MapPin, Users, Building } from 'lucide-react';
import { supabase } from './supabaseClient';
import SiteAwareCementInventorySystem from './Cement';
import SiteAwareSteelInventorySystem from './Steel';
import SiteAwareDieselInventorySystem from './Diesel';

const SiteDashboard = ({ selectedSite, onBackToSites }) => {
  const [activeSystem, setActiveSystem] = useState('dashboard');
  const [siteStats, setSiteStats] = useState({
    steel: { weight: 0, pieces: 0, types: 0 },
    cement: { weight: 0, bags: 0, types: 0 },
    diesel: { weight: 0 },
    recentTransactions: [],
    lowStockAlerts: []
  });
  const [loading, setLoading] = useState(true);

  // Load site-specific statistics
  const loadSiteStats = async () => {
    try {
      setLoading(true);
      
      // Load steel data
      const { data: steelData, error: steelError } = await supabase
        .from('inventory')
        .select('pieces, total_weight, diameter')
        .eq('site_id', selectedSite.id);

      // Load cement data
      const { data: cementData, error: cementError } = await supabase
        .from('cement_inventory')
        .select('bags, total_weight, cement_type')
        .eq('site_id', selectedSite.id);

      // Load diesel data
      const { data: dieselData, error: dieselError } = await supabase
        .from('diesel_inventory')
        .select('total_weight')
        .eq('site_id', selectedSite.id);

      // Load recent transactions (steel + cement)
      const { data: steelTransactions } = await supabase
        .from('transactions')
        .select('*, type, diameter, pieces, weight, timestamp, recipient')
        .eq('site_id', selectedSite.id)
        .order('timestamp', { ascending: false })
        .limit(5);

      const { data: cementTransactions } = await supabase
        .from('cement_transactions')
        .select('*, type, cement_type, bags, weight, timestamp, recipient')
        .eq('site_id', selectedSite.id)
        .order('timestamp', { ascending: false })
        .limit(5);

      const { data: dieselTransactions } = await supabase
        .from('diesel_transactions')
        .select('*, type, weight, timestamp, recipient')
        .eq('site_id', selectedSite.id)
        .order('timestamp', { ascending: false })
        .limit(5);

      // Process steel stats
      const steelWeight = steelData?.reduce((sum, item) => sum + (item.total_weight || 0), 0) || 0;
      const steelPieces = steelData?.reduce((sum, item) => sum + (item.pieces || 0), 0) || 0;
      const steelTypes = steelData?.length || 0;

      // Process cement stats
      const cementWeight = cementData?.reduce((sum, item) => sum + (item.total_weight || 0), 0) || 0;
      const cementBags = cementData?.reduce((sum, item) => sum + (item.bags || 0), 0) || 0;
      const cementTypes = cementData?.length || 0;

      // Process diesel stats
      const dieselWeight = dieselData?.reduce((sum, item) => sum + (item.total_weight || 0), 0) || 0;

      // Combine recent transactions
      const allTransactions = [
        ...(steelTransactions || []).map(t => ({
          ...t,
          material: 'Steel',
          materialType: `${t.diameter}mm TMT`,
          quantity: `${t.pieces} pieces`,
          weight: t.weight
        })),
        ...(cementTransactions || []).map(t => ({
          ...t,
          material: 'Cement',
          materialType: t.cement_type,
          quantity: `${t.bags} bags`,
          weight: t.weight
        })),
        ...(dieselTransactions || []).map(t => ({
          ...t,
          material: 'Diesel',
          materialType: 'Diesel Fuel',
          quantity: `${t.weight.toFixed(2)} litres`,
          weight: t.weight
        }))
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

      // Check for low stock alerts
      const lowStockAlerts = [];
      
      // Steel low stock (< 50 pieces)
      steelData?.forEach(item => {
        if (item.pieces < 50) {
          lowStockAlerts.push({
            material: 'Steel',
            type: `${item.diameter}mm TMT`,
            current: item.pieces,
            unit: 'pieces',
            severity: item.pieces < 20 ? 'high' : 'medium'
          });
        }
      });

      // Cement low stock (< 10 bags)
      cementData?.forEach(item => {
        if (item.bags < 10) {
          lowStockAlerts.push({
            material: 'Cement',
            type: item.cement_type,
            current: item.bags,
            unit: 'bags',
            severity: item.bags < 5 ? 'high' : 'medium'
          });
        }
      });

      // Diesel low stock (< threshold)
      const dieselThreshold = selectedSite?.diesel_low_stock_threshold || 100;
      if (dieselWeight < dieselThreshold) {
        lowStockAlerts.push({
          material: 'Diesel',
          type: 'Diesel Fuel',
          current: dieselWeight,
          unit: 'litres',
          severity: dieselWeight < dieselThreshold / 2 ? 'high' : 'medium'
        });
      }

      setSiteStats({
        steel: { weight: steelWeight, pieces: steelPieces, types: steelTypes },
        cement: { weight: cementWeight, bags: cementBags, types: cementTypes },
        diesel: { weight: dieselWeight },
        recentTransactions: allTransactions,
        lowStockAlerts
      });

    } catch (error) {
      console.error('Error loading site stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSite) {
      loadSiteStats();
    }
  }, [selectedSite]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading site dashboard for {selectedSite?.site_name}...</p>
        </div>
      </div>
    );
  }

  // Render specific inventory system
  if (activeSystem === 'steel') {
    return (
      <SiteAwareSteelInventorySystem 
        selectedSite={selectedSite} 
        onBackToSites={() => setActiveSystem('dashboard')} 
      />
    );
  }

  if (activeSystem === 'cement') {
    return (
      <SiteAwareCementInventorySystem 
        selectedSite={selectedSite} 
        onBackToSites={() => setActiveSystem('dashboard')} 
      />
    );
  }

  if (activeSystem === 'diesel') {
    return (
      <SiteAwareDieselInventorySystem 
        selectedSite={selectedSite} 
        onBackToSites={() => setActiveSystem('dashboard')} 
        currentUser={null}
      />
    );
  }

  // Main site dashboard
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBackToSites}
            className="flex items-center gap-2 text-orange-600 hover:text-orange-800 font-medium"
          >
            <ArrowLeft size={20} />
            Back to Sites
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-4 lg:mb-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                📊 {selectedSite.site_name} Dashboard
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Building size={14} />
                  {selectedSite.site_code}
                </span>
                {selectedSite.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {selectedSite.location}
                  </span>
                )}
                {selectedSite.contractor_name && (
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {selectedSite.contractor_name}
                  </span>
                )}
                {selectedSite.start_date && (
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    Started: {new Date(selectedSite.start_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedSite.status === 'active' ? 'bg-green-100 text-green-800' :
                selectedSite.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                selectedSite.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {selectedSite.status === 'active' ? 'Active' :
                 selectedSite.status === 'completed' ? 'Completed' :
                 selectedSite.status === 'on_hold' ? 'On Hold' : 'Cancelled'}
              </span>
              <span className="text-green-600 text-sm">🔄 Live Data</span>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {siteStats.lowStockAlerts.length > 0 && (
        <div className="mb-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <TrendingUp className="text-yellow-600 mr-2" size={20} />
              <h3 className="text-lg font-semibold text-yellow-800">Low Stock Alerts</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {siteStats.lowStockAlerts.map((alert, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg ${
                    alert.severity === 'high' ? 'bg-red-100 border border-red-300' : 'bg-yellow-100 border border-yellow-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">
                    {alert.material}: {alert.type}
                  </div>
                  <div className={`text-sm ${alert.severity === 'high' ? 'text-red-700' : 'text-yellow-700'}`}>
                    Only {alert.current} {alert.unit} remaining
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Steel Card */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">🔧 Steel TMT Bars</h2>
            <Hammer className="text-blue-500" size={24} />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Weight:</span>
              <span className="font-medium">{siteStats.steel.weight.toFixed(3)} tonnes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Pieces:</span>
              <span className="font-medium">{siteStats.steel.pieces}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Diameter Types:</span>
              <span className="font-medium">{siteStats.steel.types}</span>
            </div>
          </div>
          <button
            onClick={() => setActiveSystem('steel')}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Manage Steel Inventory
          </button>
        </div>

        {/* Cement Card */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">🏗️ Cement</h2>
            <Package className="text-green-500" size={24} />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Weight:</span>
              <span className="font-medium">{siteStats.cement.weight.toFixed(3)} tonnes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Bags:</span>
              <span className="font-medium">{siteStats.cement.bags}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cement Types:</span>
              <span className="font-medium">{siteStats.cement.types}</span>
            </div>
          </div>
          <button
            onClick={() => setActiveSystem('cement')}
            className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Manage Cement Inventory
          </button>
        </div>

        {/* Diesel Card */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">⛽ Diesel Fuel</h2>
            <Package className="text-yellow-500" size={24} />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Stock:</span>
              <span className="font-medium">{siteStats.diesel.weight.toFixed(3)} litres</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${
                siteStats.diesel.weight < (selectedSite?.diesel_low_stock_threshold || 100) 
                  ? 'text-red-600' 
                  : 'text-green-600'
              }`}>
                {siteStats.diesel.weight < (selectedSite?.diesel_low_stock_threshold || 100) 
                  ? 'Low Stock' 
                  : 'Good Stock'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setActiveSystem('diesel')}
            className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Manage Diesel Inventory
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 size={20} />
          Site Material Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {(siteStats.steel.weight + siteStats.cement.weight + siteStats.diesel.weight).toFixed(1)}
            </div>
            <div className="text-sm text-blue-700">Total Material (tonnes)</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{siteStats.steel.pieces}</div>
            <div className="text-sm text-green-700">Steel Pieces</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{siteStats.cement.bags}</div>
            <div className="text-sm text-purple-700">Cement Bags</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{siteStats.diesel.weight.toFixed(1)}</div>
            <div className="text-sm text-yellow-700">Diesel (litres)</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{siteStats.lowStockAlerts.length}</div>
            <div className="text-sm text-orange-700">Low Stock Items</div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp size={20} />
          Recent Activity
        </h3>
        
        {siteStats.recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p>No recent transactions for this site</p>
            <p className="text-sm mt-2">Start by adding steel or cement inventory</p>
          </div>
        ) : (
          <div className="space-y-3">
            {siteStats.recentTransactions.map((transaction, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${
                  transaction.type === 'incoming' ? 'bg-green-600' : 'bg-blue-600'
                }`}></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{transaction.material}:</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      transaction.type === 'incoming' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {transaction.type === 'incoming' ? 'Added' : 'Shipped'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700">
                    {transaction.materialType} - {transaction.quantity} ({transaction.weight.toFixed(2)}t)
                    {transaction.recipient && (
                      <span className="text-blue-600"> → {transaction.recipient}</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(transaction.timestamp).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SiteDashboard;