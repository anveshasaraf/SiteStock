import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, AlertTriangle, CheckCircle, Save, X, Settings } from 'lucide-react';
import { supabase } from './supabaseClient';

const CustomMaterialsManager = ({ currentUser, onMaterialsUpdated }) => {
  const [customMaterials, setCustomMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const [materialForm, setMaterialForm] = useState({
    name: '',
    description: '',
    unit_type: 'weight', // 'weight', 'pieces', 'bags', 'volume'
    unit_label: 'tonnes',
    conversion_factor: 1,
    low_stock_threshold: 10,
    material_types: ['Standard'] // Array of dropdown options
  });

  const addAlert = (message, type) => {
    const alert = { id: Date.now(), message, type };
    setAlerts(prev => [alert, ...prev.slice(0, 3)]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== alert.id)), 5000);
  };

  const loadCustomMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_materials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomMaterials(data || []);
    } catch (error) {
      addAlert('Error loading custom materials: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomMaterials();
  }, []);

  const resetForm = () => {
    setMaterialForm({
      name: '',
      description: '',
      unit_type: 'weight',
      unit_label: 'tonnes',
      conversion_factor: 1,
      low_stock_threshold: 10,
      material_types: ['Standard']
    });
  };

  const handleCreateMaterial = async () => {
    try {
      if (!materialForm.name.trim()) {
        addAlert('Material name is required', 'error');
        return;
      }

      // Create the material record
      const materialData = {
        name: materialForm.name.trim(),
        description: materialForm.description.trim(),
        unit_type: materialForm.unit_type,
        unit_label: materialForm.unit_label.trim(),
        conversion_factor: parseFloat(materialForm.conversion_factor),
        low_stock_threshold: parseFloat(materialForm.low_stock_threshold),
        material_types: materialForm.material_types.filter(type => type.trim()),
        created_by: currentUser.id,
        status: 'active'
      };

      const { data: newMaterial, error: materialError } = await supabase
        .from('custom_materials')
        .insert([materialData])
        .select()
        .single();

      if (materialError) throw materialError;

      // Create the database tables for this material
      await createMaterialTables(newMaterial.id, materialForm.name);

      addAlert(`Custom material "${materialForm.name}" created successfully!`, 'success');
      setShowCreateModal(false);
      resetForm();
      loadCustomMaterials();
      
      // Notify parent component to refresh navigation
      if (onMaterialsUpdated) {
        onMaterialsUpdated();
      }
    } catch (error) {
      addAlert('Error creating material: ' + error.message, 'error');
    }
  };

  const handleUpdateMaterial = async () => {
    try {
      if (!materialForm.name.trim()) {
        addAlert('Material name is required', 'error');
        return;
      }

      const materialData = {
        name: materialForm.name.trim(),
        description: materialForm.description.trim(),
        unit_type: materialForm.unit_type,
        unit_label: materialForm.unit_label.trim(),
        conversion_factor: parseFloat(materialForm.conversion_factor),
        low_stock_threshold: parseFloat(materialForm.low_stock_threshold),
        material_types: materialForm.material_types.filter(type => type.trim()),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('custom_materials')
        .update(materialData)
        .eq('id', editingMaterial.id);

      if (error) throw error;

      addAlert(`Material "${materialForm.name}" updated successfully!`, 'success');
      setEditingMaterial(null);
      resetForm();
      loadCustomMaterials();
      
      if (onMaterialsUpdated) {
        onMaterialsUpdated();
      }
    } catch (error) {
      addAlert('Error updating material: ' + error.message, 'error');
    }
  };

  const createMaterialTables = async (materialId, materialName) => {
    try {
      const tableName = `material_${materialId}`;
      
      // Create inventory table
      const inventoryTableSQL = `
        CREATE TABLE IF NOT EXISTS ${tableName}_inventory (
          id BIGSERIAL PRIMARY KEY,
          site_id BIGINT REFERENCES sites(id) ON DELETE CASCADE,
          material_type TEXT NOT NULL,
          quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
          weight DECIMAL(10,3),
          unit_label TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(site_id, material_type)
        );
      `;

      // Create transactions table
      const transactionsTableSQL = `
        CREATE TABLE IF NOT EXISTS ${tableName}_transactions (
          id BIGSERIAL PRIMARY KEY,
          site_id BIGINT REFERENCES sites(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('incoming', 'outgoing')),
          material_type TEXT NOT NULL,
          quantity DECIMAL(10,3) NOT NULL,
          weight DECIMAL(10,3),
          unit_label TEXT,
          recipient TEXT,
          imported_from TEXT,
          bill_file_name TEXT,
          bill_file_original_name TEXT,
          issue_slip_file_name TEXT,
          issue_slip_file_original_name TEXT,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;

      // Create indexes
      const indexesSQL = `
        CREATE INDEX IF NOT EXISTS idx_${tableName}_inventory_site_id ON ${tableName}_inventory(site_id);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_transactions_site_id ON ${tableName}_transactions(site_id);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_transactions_timestamp ON ${tableName}_transactions(timestamp);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_transactions_type ON ${tableName}_transactions(type);
      `;

      // Execute the SQL
      const { error: inventoryError } = await supabase.rpc('execute_sql', { 
        sql_query: inventoryTableSQL 
      });
      if (inventoryError) throw inventoryError;

      const { error: transactionsError } = await supabase.rpc('execute_sql', { 
        sql_query: transactionsTableSQL 
      });
      if (transactionsError) throw transactionsError;

      const { error: indexesError } = await supabase.rpc('execute_sql', { 
        sql_query: indexesSQL 
      });
      if (indexesError) throw indexesError;

    } catch (error) {
      console.error('Error creating material tables:', error);
      // Don't throw - the material record is already created
      addAlert('Material created but database setup may need manual configuration', 'warning');
    }
  };

  const handleDeleteMaterial = async (material) => {
    if (!window.confirm(`Are you sure you want to delete "${material.name}"? This will permanently delete all inventory and transaction data for this material.`)) {
      return;
    }

    try {
      // First check if there's any data in the tables
      const tableName = `material_${material.id}`;
      
      // Delete the material record
      const { error: deleteError } = await supabase
        .from('custom_materials')
        .delete()
        .eq('id', material.id);

      if (deleteError) throw deleteError;

      // Optionally drop the tables (commented out for safety)
      // You might want to keep the data or handle this differently
      /*
      const dropTablesSQL = `
        DROP TABLE IF EXISTS ${tableName}_transactions;
        DROP TABLE IF EXISTS ${tableName}_inventory;
      `;
      
      await supabase.rpc('execute_sql', { sql_query: dropTablesSQL });
      */

      addAlert(`Material "${material.name}" deleted successfully!`, 'success');
      loadCustomMaterials();
      
      if (onMaterialsUpdated) {
        onMaterialsUpdated();
      }
    } catch (error) {
      addAlert('Error deleting material: ' + error.message, 'error');
    }
  };

  const handleEditMaterial = (material) => {
    setEditingMaterial(material);
    setMaterialForm({
      name: material.name,
      description: material.description || '',
      unit_type: material.unit_type,
      unit_label: material.unit_label,
      conversion_factor: material.conversion_factor,
      low_stock_threshold: material.low_stock_threshold,
      material_types: material.material_types || ['Standard']
    });
    setShowCreateModal(true);
  };

  const addMaterialType = () => {
    setMaterialForm(prev => ({
      ...prev,
      material_types: [...prev.material_types, '']
    }));
  };

  const removeMaterialType = (index) => {
    setMaterialForm(prev => ({
      ...prev,
      material_types: prev.material_types.filter((_, i) => i !== index)
    }));
  };

  const updateMaterialType = (index, value) => {
    setMaterialForm(prev => ({
      ...prev,
      material_types: prev.material_types.map((type, i) => i === index ? value : type)
    }));
  };

  const CreateMaterialModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">
            {editingMaterial ? 'Edit Material' : 'Create New Material'}
          </h3>
          <button
            onClick={() => {
              setShowCreateModal(false);
              setEditingMaterial(null);
              resetForm();
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Material Name *
              </label>
              <input
                type="text"
                value={materialForm.name}
                onChange={(e) => setMaterialForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Bricks, Paint, Steel Pipes"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Low Stock Threshold
              </label>
              <input
                type="number"
                step="0.001"
                value={materialForm.low_stock_threshold}
                onChange={(e) => setMaterialForm(prev => ({ ...prev, low_stock_threshold: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={materialForm.description}
              onChange={(e) => setMaterialForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of this material..."
            />
          </div>

          {/* Unit Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit Type *
              </label>
              <select
                value={materialForm.unit_type}
                onChange={(e) => setMaterialForm(prev => ({ 
                  ...prev, 
                  unit_type: e.target.value,
                  unit_label: e.target.value === 'weight' ? 'tonnes' :
                             e.target.value === 'pieces' ? 'pieces' :
                             e.target.value === 'bags' ? 'bags' :
                             e.target.value === 'volume' ? 'liters' : 'units'
                }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="weight">Weight-based (like Sand)</option>
                <option value="pieces">Pieces-based (like Steel)</option>
                <option value="bags">Bags-based (like Cement)</option>
                <option value="volume">Volume-based</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit Label *
              </label>
              <input
                type="text"
                value={materialForm.unit_label}
                onChange={(e) => setMaterialForm(prev => ({ ...prev, unit_label: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="tonnes, pieces, bags, liters"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conversion Factor
              </label>
              <input
                type="number"
                step="0.001"
                value={materialForm.conversion_factor}
                onChange={(e) => setMaterialForm(prev => ({ ...prev, conversion_factor: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="1.0"
              />
              <p className="text-xs text-gray-500 mt-1">For unit conversions (e.g., kg to tonnes = 0.001)</p>
            </div>
          </div>

          {/* Material Types/Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Material Types/Variants
              </label>
              <button
                onClick={addMaterialType}
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
              >
                <Plus size={14} />
                Add Type
              </button>
            </div>
            <div className="space-y-2">
              {materialForm.material_types.map((type, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={type}
                    onChange={(e) => updateMaterialType(index, e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={`Type ${index + 1} (e.g., Standard, Premium, Heavy Duty)`}
                  />
                  {materialForm.material_types.length > 1 && (
                    <button
                      onClick={() => removeMaterialType(index)}
                      className="text-red-600 hover:text-red-800 p-2"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-2">Preview:</h4>
            <div className="text-sm text-gray-600">
              <p><strong>Name:</strong> {materialForm.name || 'New Material'}</p>
              <p><strong>Unit:</strong> {materialForm.unit_label}</p>
              <p><strong>Types:</strong> {materialForm.material_types.filter(t => t.trim()).join(', ')}</p>
              <p><strong>Low Stock Alert:</strong> Below {materialForm.low_stock_threshold} {materialForm.unit_label}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t">
          <button
            onClick={() => {
              setShowCreateModal(false);
              setEditingMaterial(null);
              resetForm();
            }}
            className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={editingMaterial ? handleUpdateMaterial : handleCreateMaterial}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
          >
            <Save size={16} />
            {editingMaterial ? 'Update Material' : 'Create Material'}
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading custom materials...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      <div className="fixed top-4 right-4 z-40 space-y-2">
        {alerts.map(alert => (
          <div key={alert.id} className={`p-3 rounded-lg shadow-lg max-w-sm ${
            alert.type === 'success' ? 'bg-green-500 text-white' :
            alert.type === 'error' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'
          }`}>
            <div className="flex items-center gap-2">
              {alert.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span className="text-sm">{alert.message}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Custom Materials</h2>
          <p className="text-gray-600">Create and manage custom material types for your sites</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={16} />
          Add Material
        </button>
      </div>

      {/* Materials Grid */}
      {customMaterials.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Custom Materials</h3>
          <p className="text-gray-600 mb-4">Create your first custom material to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
          >
            <Plus size={16} />
            Create First Material
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customMaterials.map(material => (
            <div key={material.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{material.name}</h3>
                    <p className="text-sm text-gray-600">{material.description}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditMaterial(material)}
                    className="text-blue-600 hover:text-blue-800 p-1"
                    title="Edit Material"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteMaterial(material)}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Delete Material"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Unit Type:</span>
                  <span className="font-medium capitalize">{material.unit_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Unit Label:</span>
                  <span className="font-medium">{material.unit_label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Low Stock:</span>
                  <span className="font-medium">{material.low_stock_threshold} {material.unit_label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Types:</span>
                  <span className="font-medium">{material.material_types?.length || 0} variants</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    material.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {material.status}
                  </span>
                </div>
              </div>

              {material.material_types && material.material_types.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-700 mb-2">Available Types:</p>
                  <div className="flex flex-wrap gap-1">
                    {material.material_types.slice(0, 3).map((type, index) => (
                      <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                        {type}
                      </span>
                    ))}
                    {material.material_types.length > 3 && (
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                        +{material.material_types.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && <CreateMaterialModal />}
    </div>
  );
};

export default CustomMaterialsManager;