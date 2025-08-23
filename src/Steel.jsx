import React, { useState, useEffect } from 'react';
import { Package, Truck, BarChart3, AlertTriangle, CheckCircle, Plus, Minus, Download, Upload, ArrowLeft, Eye, X, FileText, Image, Trash2, ChevronDown, ChevronRight, Calendar, Filter } from 'lucide-react';
import { supabase } from './supabaseClient';

const SiteAwareSteelInventorySystem = ({ selectedSite, onBackToSites, currentUser = null }) => {
  // Standard TMT bar specifications (diameter in mm : weight per meter in kg)
  const TMT_SPECS = {
    6: 0.222,
    8: 0.395,
    10: 0.617,
    12: 0.888,
    14: 1.208,
    16: 1.578,
    18: 2.000,
    20: 2.469,
    22: 2.984,
    25: 3.853,
    28: 4.834,
    32: 6.313,
    36: 7.990,
    40: 9.864
  };

  const STANDARD_LENGTH = 12; // Standard TMT bar length in meters
  const DEFAULT_BRAND = "Standard"; // Default brand

  // Check if current user is super admin
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [inventory, setInventory] = useState({});
  const [incomingForm, setIncomingForm] = useState({
    diameter: '',
    totalWeight: '',
    weightUnit: 'tonnes',
    length: STANDARD_LENGTH,
    importedFrom: '', // Now required
    billFile: null,
    billFileName: ''
  });
  const [outgoingForm, setOutgoingForm] = useState({
    diameter: '',
    pieces: '',
    length: STANDARD_LENGTH,
    recipient: '',
    issueSlipFile: null,
    issueSlipFileName: ''
  });
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('inventory');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // File viewer state
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    transaction: null,
    isDeleting: false
  });

  // Period filter state
  const [periodFilter, setPeriodFilter] = useState({
    type: 'last30days', // 'last7days', 'last30days', 'last90days', 'lastYear', 'custom'
    startDate: '',
    endDate: ''
  });

  // Expandable table state
  const [expandedRows, setExpandedRows] = useState({});

  // Get filtered transactions based on period
  const getFilteredTransactions = () => {
    // If no period filter is set or it's not working, return all transactions
    if (!periodFilter.type) {
      return transactions;
    }

    const now = new Date();
    let startDate = new Date();

    switch (periodFilter.type) {
      case 'last7days':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'last90days':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'lastYear':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'custom':
        if (periodFilter.startDate && periodFilter.endDate) {
          startDate = new Date(periodFilter.startDate);
          const endDate = new Date(periodFilter.endDate);
          endDate.setHours(23, 59, 59, 999); // Include full end date
          return transactions.filter(t => {
            // Use raw timestamp if available, otherwise use formatted timestamp
            const timestampToUse = t.rawTimestamp || t.timestamp;
            const transactionDate = new Date(timestampToUse);
            
            // Fallback: if date parsing fails, include the transaction
            if (isNaN(transactionDate.getTime())) {
              console.warn('Failed to parse transaction date:', timestampToUse);
              return true;
            }
            
            return transactionDate >= startDate && transactionDate <= endDate;
          });
        }
        return transactions; // Return all if custom dates not set
      default:
        startDate.setDate(now.getDate() - 30);
    }

    return transactions.filter(t => {
      // Use raw timestamp if available, otherwise use formatted timestamp
      const timestampToUse = t.rawTimestamp || t.timestamp;
      const transactionDate = new Date(timestampToUse);
      
      // Fallback: if date parsing fails, include the transaction
      if (isNaN(transactionDate.getTime())) {
        console.warn('Failed to parse transaction date:', timestampToUse);
        return true; // Include transaction if we can't parse the date
      }
      
      return transactionDate >= startDate;
    });
  };

  // Period selector component
  const PeriodSelector = () => (
    <div className="bg-gray-50 p-4 rounded-lg mb-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Period:</span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'last7days', label: 'Last 7 Days' },
            { value: 'last30days', label: 'Last 30 Days' },
            { value: 'last90days', label: 'Last 90 Days' },
            { value: 'lastYear', label: 'Last Year' },
            { value: 'custom', label: 'Custom' }
          ].map(period => (
            <button
              key={period.value}
              onClick={() => setPeriodFilter(prev => ({ ...prev, type: period.value }))}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                periodFilter.type === period.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>

        {periodFilter.type === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={periodFilter.startDate}
              onChange={(e) => setPeriodFilter(prev => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={periodFilter.endDate}
              onChange={(e) => setPeriodFilter(prev => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );

  // Toggle row expansion
  const toggleRowExpansion = (diameter) => {
    setExpandedRows(prev => ({
      ...prev,
      [diameter]: !prev[diameter]
    }));
  };

  // Get supplier summary
  const getSupplierSummary = () => {
    const filteredTransactions = getFilteredTransactions();
    const summary = {};
    
    filteredTransactions.forEach(transaction => {
      if (transaction.type === 'incoming' && transaction.importedFrom) {
        const supplier = transaction.importedFrom;
        const diameter = transaction.diameter;
        
        if (!summary[supplier]) {
          summary[supplier] = {};
        }
        
        if (!summary[supplier][diameter]) {
          summary[supplier][diameter] = {
            pieces: 0,
            weight: 0,
            transactions: []
          };
        }
        
        summary[supplier][diameter].pieces += transaction.pieces;
        summary[supplier][diameter].weight += transaction.weight;
        summary[supplier][diameter].transactions.push(transaction);
      }
    });
    
    return summary;
  };

  // Get detailed transactions for a diameter
  const getDiameterTransactionDetails = (diameter) => {
    const filteredTransactions = getFilteredTransactions();
    return filteredTransactions.filter(t => t.diameter === parseInt(diameter));
  };

  // Delete Confirmation Modal
  const DeleteConfirmationModal = () => {
    if (!deleteConfirmation.isOpen || !deleteConfirmation.transaction) return null;

    const transaction = deleteConfirmation.transaction;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Transaction</h3>
              <p className="text-sm text-gray-600">This action cannot be undone</p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm space-y-1">
              <div><strong>Type:</strong> {transaction.type === 'incoming' ? 'Incoming' : 'Outgoing'}</div>
              <div><strong>Diameter:</strong> {transaction.diameter}mm</div>
              <div><strong>Pieces:</strong> {transaction.pieces}</div>
              <div><strong>Weight:</strong> {transaction.weight.toFixed(3)} tonnes</div>
              <div><strong>Date:</strong> {transaction.timestamp}</div>
              {transaction.importedFrom && <div><strong>From:</strong> {transaction.importedFrom}</div>}
              {transaction.recipient && <div><strong>To:</strong> {transaction.recipient}</div>}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setDeleteConfirmation({ isOpen: false, transaction: null, isDeleting: false })}
              disabled={deleteConfirmation.isDeleting}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleteConfirmation.isDeleting}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {deleteConfirmation.isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.transaction) return;

    setDeleteConfirmation(prev => ({ ...prev, isDeleting: true }));

    try {
      const transaction = deleteConfirmation.transaction;
      
      // Delete from database
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id);

      if (deleteError) throw deleteError;

      // Update inventory based on transaction type
      const currentInventory = inventory[transaction.diameter] || { pieces: 0, totalWeight: 0, length: transaction.length };
      
      let newPieces, newTotalWeight;
      
      if (transaction.type === 'incoming') {
        // Removing an incoming transaction - subtract from inventory
        newPieces = Math.max(0, currentInventory.pieces - transaction.pieces);
        newTotalWeight = Math.max(0, currentInventory.totalWeight - transaction.weight);
      } else {
        // Removing an outgoing transaction - add back to inventory
        newPieces = currentInventory.pieces + transaction.pieces;
        newTotalWeight = currentInventory.totalWeight + transaction.weight;
      }

      // Update inventory in database
      await updateInventoryInDB(transaction.diameter, transaction.length, newPieces, newTotalWeight);

      // Update local state
      setInventory(prev => ({
        ...prev,
        [transaction.diameter]: {
          pieces: newPieces,
          totalWeight: newTotalWeight,
          length: transaction.length
        }
      }));

      // Reload transactions
      await loadTransactionsData();

      addAlert(`Transaction deleted successfully. Inventory updated.`, 'success');
      
    } catch (error) {
      addAlert('Error deleting transaction: ' + error.message, 'error');
    } finally {
      setDeleteConfirmation({ isOpen: false, transaction: null, isDeleting: false });
    }
  };

  // Handle delete button click
  const handleDeleteTransaction = (transaction) => {
    setDeleteConfirmation({
      isOpen: true,
      transaction: transaction,
      isDeleting: false
    });
  };

  // File upload helper function
  const uploadFileToStorage = async (file, folder = 'bills') => {
    try {
      if (!file) return null;

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${selectedSite.site_code}_${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('construction-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      return {
        fileName: data.path,
        originalName: file.name,
        size: file.size,
        type: file.type
      };
    } catch (error) {
      addAlert('Error uploading file: ' + error.message, 'error');
      return null;
    }
  };

  // Get file URL from storage
  const getFileUrl = async (fileName) => {
    try {
      const { data, error } = await supabase.storage
        .from('construction-files')
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting file URL:', error);
      return null;
    }
  };

  // File viewer component
  const FileViewer = () => {
    const [fileUrl, setFileUrl] = useState(null);
    const [fileError, setFileError] = useState(false);

    useEffect(() => {
      if (selectedFile && fileViewerOpen) {
        setFileLoading(true);
        setFileError(false);
        
        getFileUrl(selectedFile.fileName)
          .then(url => {
            if (url) {
              setFileUrl(url);
            } else {
              setFileError(true);
            }
          })
          .catch(() => setFileError(true))
          .finally(() => setFileLoading(false));
      }
    }, [selectedFile, fileViewerOpen]);

    if (!fileViewerOpen || !selectedFile) return null;

    const isImage = selectedFile.originalName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/);
    const isPdf = selectedFile.originalName?.toLowerCase().endsWith('.pdf');

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              {isImage ? <Image size={20} /> : <FileText size={20} />}
              <h3 className="font-semibold text-gray-900">
                {selectedFile.originalName || selectedFile.fileName}
              </h3>
            </div>
            <button
              onClick={() => {
                setFileViewerOpen(false);
                setSelectedFile(null);
                setFileUrl(null);
                setFileError(false);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 max-h-[calc(90vh-80px)] overflow-auto">
            {fileLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading file...</span>
              </div>
            )}

            {fileError && (
              <div className="text-center py-12">
                <AlertTriangle className="mx-auto h-12 w-12 text-red-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">File Not Found</h3>
                <p className="text-gray-600">The file could not be loaded. It may have been moved or deleted.</p>
              </div>
            )}

            {fileUrl && !fileLoading && !fileError && (
              <>
                {isImage && (
                  <div className="text-center">
                    <img 
                      src={fileUrl} 
                      alt={selectedFile.originalName}
                      className="max-w-full h-auto rounded-lg shadow-lg"
                      onError={() => setFileError(true)}
                    />
                  </div>
                )}

                {isPdf && (
                  <div className="w-full h-96">
                    <iframe
                      src={fileUrl}
                      className="w-full h-full border rounded-lg"
                      title={selectedFile.originalName}
                      onError={() => setFileError(true)}
                    />
                  </div>
                )}

                {!isImage && !isPdf && (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Not Available</h3>
                    <p className="text-gray-600 mb-4">
                      This file type cannot be previewed in the browser.
                    </p>
                    <a
                      href={fileUrl}
                      download={selectedFile.originalName}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
                    >
                      <Download size={16} />
                      Download File
                    </a>
                  </div>
                )}

                {/* Download option for all files */}
                {(isImage || isPdf) && (
                  <div className="text-center mt-4 pt-4 border-t">
                    <a
                      href={fileUrl}
                      download={selectedFile.originalName}
                      className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-sm"
                    >
                      <Download size={14} />
                      Download File
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Handle file view
  const handleFileView = async (fileName, originalName) => {
    if (!fileName) {
      addAlert('File not found', 'error');
      return;
    }

    setSelectedFile({
      fileName: fileName,
      originalName: originalName || fileName
    });
    setFileViewerOpen(true);
  };

  // Add a function to export to Excel
  const exportToExcel = (data, filename) => {
    // Create CSV content
    let csvContent = '';
    
    if (filename.includes('stock_summary')) {
      csvContent = `Site: ${selectedSite.site_name} (${selectedSite.site_code})\n`;
      csvContent += 'Particulars,Inwards Qty,Inwards Weight,Outwards Qty,Outwards Weight,Closing Qty,Closing Weight\n';
      Object.entries(diameterTotals).forEach(([diameter, data]) => {
        const filteredTransactions = getFilteredTransactions();
        const totalInwards = filteredTransactions
          .filter(t => t.type === 'incoming' && t.diameter === parseInt(diameter))
          .reduce((sum, t) => sum + t.pieces, 0);
        const totalInwardsWeight = filteredTransactions
          .filter(t => t.type === 'incoming' && t.diameter === parseInt(diameter))
          .reduce((sum, t) => sum + t.weight, 0);
        
        csvContent += `TMT Bar ${diameter}mm,${totalInwards},${totalInwardsWeight.toFixed(3)},${data.totalIssued},${data.totalIssuedWeight.toFixed(3)},${data.currentStock},${data.currentWeight.toFixed(3)}\n`;
      });
      
      // Add totals row
      csvContent += `Grand Total,${getFilteredTransactions().filter(t => t.type === 'incoming').reduce((sum, t) => sum + t.pieces, 0)},${getFilteredTransactions().filter(t => t.type === 'incoming').reduce((sum, t) => sum + t.weight, 0).toFixed(3)},${Object.values(diameterTotals).reduce((sum, data) => sum + data.totalIssued, 0)},${Object.values(diameterTotals).reduce((sum, data) => sum + data.totalIssuedWeight, 0).toFixed(3)},${Object.values(diameterTotals).reduce((sum, data) => sum + data.currentStock, 0)},${getTotalInventoryWeight().toFixed(3)}\n`;
    } else if (filename.includes('contractor_summary')) {
      csvContent = `Site: ${selectedSite.site_name} (${selectedSite.site_code})\n`;
      csvContent += 'Contractor,Diameter,Pieces Issued,Weight Issued\n';
      Object.entries(contractorSummary).forEach(([contractor, diameters]) => {
        Object.entries(diameters).forEach(([diameter, data]) => {
          csvContent += `${contractor},${diameter}mm,${data.pieces},${data.weight.toFixed(3)}\n`;
        });
      });
    } else if (filename.includes('supplier_summary')) {
      csvContent = `Site: ${selectedSite.site_name} (${selectedSite.site_code})\n`;
      csvContent += 'Supplier,Diameter,Pieces Received,Weight Received\n';
      Object.entries(supplierSummary).forEach(([supplier, diameters]) => {
        Object.entries(diameters).forEach(([diameter, data]) => {
          csvContent += `${supplier},${diameter}mm,${data.pieces},${data.weight.toFixed(3)}\n`;
        });
      });
    } else if (filename.includes('transactions')) {
      csvContent = `Site: ${selectedSite.site_name} (${selectedSite.site_code})\n`;
      csvContent += 'Date,Type,Diameter,Pieces,Weight,Imported From,Shipped To,Bill File,Issue Slip File\n';
      getFilteredTransactions().forEach(transaction => {
        csvContent += `${transaction.timestamp},${transaction.type},${transaction.diameter}mm,${transaction.pieces},${transaction.weight.toFixed(3)},${transaction.importedFrom || ''},${transaction.recipient || ''},${transaction.billFileName || ''},${transaction.issueSlipFileName || ''}\n`;
      });
    }
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addAlert(`Exported ${filename} successfully!`, 'success');
  };

  // Load data from Supabase on startup - FILTERED BY SITE
  useEffect(() => {
    if (selectedSite) {
      loadInventoryData();
      loadTransactionsData();
    }
  }, [selectedSite]);

  // Load inventory from database - SITE SPECIFIC
  const loadInventoryData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('site_id', selectedSite.id)
        .order('diameter');

      if (error) throw error;

      const inventoryMap = {};
      data.forEach(item => {
        inventoryMap[item.diameter] = {
          pieces: item.pieces,
          totalWeight: parseFloat(item.total_weight || 0),
          length: item.length
        };
      });
      setInventory(inventoryMap);
    } catch (error) {
      addAlert('Error loading inventory: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load transactions from database - SITE SPECIFIC
  const loadTransactionsData = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('site_id', selectedSite.id)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const formattedTransactions = data.map((transaction, index) => ({
        id: transaction.id,
        uniqueKey: `${transaction.id}-${index}`,
        type: transaction.type,
        diameter: transaction.diameter,
        pieces: transaction.pieces,
        weight: parseFloat(transaction.weight),
        length: parseFloat(transaction.length),
        timestamp: new Date(transaction.timestamp).toLocaleString(), // Keep formatted for display
        rawTimestamp: transaction.timestamp, // Keep raw timestamp for filtering
        recipient: transaction.recipient,
        importedFrom: transaction.imported_from,
        inputWeight: parseFloat(transaction.input_weight),
        weightUnit: transaction.weight_unit,
        wastage: parseFloat(transaction.wastage) || 0,
        billFileName: transaction.bill_file_name,
        billFileOriginalName: transaction.bill_file_original_name,
        issueSlipFileName: transaction.issue_slip_file_name,
        issueSlipFileOriginalName: transaction.issue_slip_file_original_name
      }));

      setTransactions(formattedTransactions);
    } catch (error) {
      addAlert('Error loading transactions: ' + error.message, 'error');
    }
  };

  // Update inventory in database - SITE SPECIFIC
  const updateInventoryInDB = async (diameter, length, pieces, totalWeight) => {
    try {
      const weightPerPiece = pieces > 0 ? totalWeight / pieces : 0;
      
      const { error } = await supabase
        .from('inventory')
        .upsert({
          site_id: selectedSite.id,
          diameter: parseFloat(diameter),
          length: parseFloat(length),
          brand: DEFAULT_BRAND,
          pieces: parseInt(pieces),
          weight_per_piece: weightPerPiece,
          total_weight: parseFloat(totalWeight),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'site_id,diameter,length,brand'
        });

      if (error) throw error;
    } catch (error) {
      addAlert('Error updating inventory: ' + error.message, 'error');
    }
  };

  // Save transaction to database - SITE SPECIFIC
  const saveTransactionToDB = async (transaction) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .insert([{
          type: transaction.type,
          diameter: transaction.diameter,
          pieces: transaction.pieces,
          weight: transaction.weight,
          length: transaction.length,
          recipient: transaction.recipient || null,
          imported_from: transaction.importedFrom || null,
          input_weight: transaction.inputWeight || null,
          weight_unit: transaction.weightUnit || null,
          wastage: transaction.wastage || null,
          bill_file_name: transaction.billFileName || null,
          bill_file_original_name: transaction.billFileOriginalName || null,
          issue_slip_file_name: transaction.issueSlipFileName || null,
          issue_slip_file_original_name: transaction.issueSlipFileOriginalName || null,
          site_id: selectedSite.id
        }]);

      if (error) throw error;
    } catch (error) {
      addAlert('Error saving transaction: ' + error.message, 'error');
    }
  };

  // Calculate pieces from weight
  const calculatePiecesFromWeight = (diameter, totalWeight, weightUnit = 'tonnes', length = STANDARD_LENGTH) => {
    const weightPerMeter = TMT_SPECS[diameter];
    const weightPerBar = weightPerMeter * length;
    const weightInKg = weightUnit === 'tonnes' ? totalWeight * 1000 : totalWeight;
    return Math.floor(weightInKg / weightPerBar);
  };

  // Calculate weight from pieces
  const calculateWeightFromPieces = (diameter, pieces, length = STANDARD_LENGTH) => {
    const weightPerMeter = TMT_SPECS[diameter];
    return (pieces * weightPerMeter * length) / 1000; // Always return in tonnes
  };

  // Handle file upload for incoming bills
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        addAlert('File size must be less than 10MB', 'error');
        return;
      }
      
      setIncomingForm(prev => ({ 
        ...prev, 
        billFile: file,
        billFileName: file.name 
      }));
    }
  };

  // Handle file upload for outgoing issue slips
  const handleIssueSlipUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        addAlert('File size must be less than 10MB', 'error');
        return;
      }
      
      setOutgoingForm(prev => ({ 
        ...prev, 
        issueSlipFile: file,
        issueSlipFileName: file.name 
      }));
    }
  };

  // Add alert
  const addAlert = (message, type) => {
    const alert = { id: Date.now(), message, type };
    setAlerts(prev => [alert, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== alert.id));
    }, 5000);
  };

  // Handle incoming shipment - ENHANCED WITH REQUIRED IMPORTER
  const handleIncomingShipment = async () => {
    const { diameter, totalWeight, weightUnit, length, importedFrom, billFile, billFileName } = incomingForm;
    
    // Validate required fields including importedFrom
    if (!diameter || !totalWeight || !importedFrom.trim()) {
      addAlert('Please fill all required fields including supplier/vendor information', 'error');
      return;
    }

    setUploading(true);

    try {
      // Upload file if provided
      let fileInfo = null;
      if (billFile) {
        fileInfo = await uploadFileToStorage(billFile, 'bills');
        if (!fileInfo) {
          // Upload failed, but continue without file
          addAlert('File upload failed, but transaction will be saved without file', 'warning');
        }
      }

      const pieces = calculatePiecesFromWeight(diameter, parseFloat(totalWeight), weightUnit, parseFloat(length));
      const actualWeight = calculateWeightFromPieces(diameter, pieces, parseFloat(length));
      
      // Update local state
      const newPieces = (inventory[diameter]?.pieces || 0) + pieces;
      const newTotalWeight = (inventory[diameter]?.totalWeight || 0) + actualWeight;
      
      setInventory(prev => ({
        ...prev,
        [diameter]: {
          pieces: newPieces,
          totalWeight: newTotalWeight,
          length: parseFloat(length)
        }
      }));

      // Update database
      await updateInventoryInDB(diameter, length, newPieces, newTotalWeight);

      const inputWeightInTonnes = weightUnit === 'tonnes' ? parseFloat(totalWeight) : parseFloat(totalWeight) / 1000;
      
      const transaction = {
        type: 'incoming',
        diameter: parseInt(diameter),
        pieces,
        weight: actualWeight,
        length: parseFloat(length),
        importedFrom: importedFrom.trim(),
        inputWeight: inputWeightInTonnes,
        weightUnit,
        wastage: inputWeightInTonnes - actualWeight,
        billFileName: fileInfo?.fileName || null,
        billFileOriginalName: fileInfo?.originalName || billFileName || null
      };

      // Save transaction to database
      await saveTransactionToDB(transaction);
      
      // Reload transactions to get updated list
      await loadTransactionsData();
      
      addAlert(`Added ${pieces} pieces of ${diameter}mm TMT bars to ${selectedSite.site_name} from ${importedFrom.trim()} (${actualWeight.toFixed(3)} tonnes)`, 'success');
      
      if (transaction.wastage > 0.01) {
        addAlert(`Note: ${transaction.wastage.toFixed(3)} tonnes wastage detected`, 'warning');
      }

      setIncomingForm({ 
        diameter: '', 
        totalWeight: '', 
        weightUnit: 'tonnes',
        length: STANDARD_LENGTH,
        importedFrom: '',
        billFile: null, 
        billFileName: '' 
      });
    } catch (error) {
      addAlert('Error processing shipment: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  // Handle outgoing shipment - ENHANCED WITH FILE UPLOAD
  const handleOutgoingShipment = async () => {
    const { diameter, pieces, length, recipient, issueSlipFile, issueSlipFileName } = outgoingForm;
    
    if (!diameter || !pieces || !recipient.trim()) {
      addAlert('Please fill all required fields including recipient', 'error');
      return;
    }

    const requestedPieces = parseInt(pieces);
    const currentStock = inventory[diameter]?.pieces || 0;

    if (requestedPieces > currentStock) {
      addAlert(`Insufficient stock at ${selectedSite.site_name}! Available: ${currentStock} pieces, Requested: ${requestedPieces} pieces`, 'error');
      return;
    }

    setUploading(true);

    try {
      // Upload file if provided
      let fileInfo = null;
      if (issueSlipFile) {
        fileInfo = await uploadFileToStorage(issueSlipFile, 'issue-slips');
        if (!fileInfo) {
          addAlert('File upload failed, but transaction will be saved without file', 'warning');
        }
      }

      const shippedWeight = calculateWeightFromPieces(diameter, requestedPieces, parseFloat(length));
      
      // Update local state
      const newPieces = currentStock - requestedPieces;
      const newTotalWeight = (inventory[diameter]?.totalWeight || 0) - shippedWeight;
      
      setInventory(prev => ({
        ...prev,
        [diameter]: {
          pieces: newPieces,
          totalWeight: newTotalWeight,
          length: parseFloat(length)
        }
      }));

      // Update database
      await updateInventoryInDB(diameter, length, newPieces, newTotalWeight);

      const transaction = {
        type: 'outgoing',
        diameter: parseInt(diameter),
        pieces: requestedPieces,
        weight: shippedWeight,
        length: parseFloat(length),
        recipient: recipient.trim(),
        issueSlipFileName: fileInfo?.fileName || null,
        issueSlipFileOriginalName: fileInfo?.originalName || issueSlipFileName || null
      };

      // Save transaction to database
      await saveTransactionToDB(transaction);
      
      // Reload transactions to get updated list
      await loadTransactionsData();
      
      addAlert(`Shipped ${requestedPieces} pieces of ${diameter}mm TMT bars from ${selectedSite.site_name} to ${recipient.trim()} (${shippedWeight.toFixed(3)} tonnes)`, 'success');
      
      setOutgoingForm({ 
        diameter: '', 
        pieces: '', 
        length: STANDARD_LENGTH, 
        recipient: '', 
        issueSlipFile: null, 
        issueSlipFileName: '' 
      });
    } catch (error) {
      addAlert('Error processing shipment: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  // Get contractor-wise summary
  const getContractorSummary = () => {
    const filteredTransactions = getFilteredTransactions();
    const summary = {};
    
    filteredTransactions.forEach(transaction => {
      if (transaction.type === 'outgoing' && transaction.recipient) {
        const contractor = transaction.recipient;
        const diameter = transaction.diameter;
        
        if (!summary[contractor]) {
          summary[contractor] = {};
        }
        
        if (!summary[contractor][diameter]) {
          summary[contractor][diameter] = {
            pieces: 0,
            weight: 0,
            transactions: []
          };
        }
        
        summary[contractor][diameter].pieces += transaction.pieces;
        summary[contractor][diameter].weight += transaction.weight;
        summary[contractor][diameter].transactions.push(transaction);
      }
    });
    
    return summary;
  };

  // Get diameter-wise totals
  const getDiameterTotals = () => {
    const filteredTransactions = getFilteredTransactions();
    const totals = {};
    
    Object.keys(TMT_SPECS).forEach(diameter => {
      const currentStock = inventory[diameter] || { pieces: 0, totalWeight: 0 };
      const issued = filteredTransactions
        .filter(t => t.type === 'outgoing' && t.diameter === parseInt(diameter))
        .reduce((sum, t) => sum + t.pieces, 0);
      const issuedWeight = filteredTransactions
        .filter(t => t.type === 'outgoing' && t.diameter === parseInt(diameter))
        .reduce((sum, t) => sum + t.weight, 0);
      
      totals[diameter] = {
        currentStock: currentStock.pieces,
        currentWeight: currentStock.totalWeight,
        totalIssued: issued,
        totalIssuedWeight: issuedWeight,
        netStock: currentStock.pieces,
        netWeight: currentStock.totalWeight
      };
    });
    
    return totals;
  };

  // Calculate total inventory value
  const getTotalInventoryWeight = () => {
    return Object.values(inventory).reduce((total, item) => total + item.totalWeight, 0);
  };

  // Get low stock items using site-specific threshold
  const getLowStockItems = () => {
    const threshold = selectedSite?.steel_low_stock_threshold || 50;
    return Object.entries(inventory).filter(([diameter, data]) => data.pieces < threshold);
  };

  // Tally verification
  const verifyTally = () => {
    const discrepancies = [];
    Object.entries(inventory).forEach(([diameter, data]) => {
      const calculatedWeight = calculateWeightFromPieces(diameter, data.pieces);
      const difference = Math.abs(data.totalWeight - calculatedWeight);
      if (difference > 0.001) { // 1kg tolerance
        discrepancies.push({
          diameter,
          pieces: data.pieces,
          recordedWeight: data.totalWeight,
          calculatedWeight,
          difference
        });
      }
    });
    return discrepancies;
  };

  const discrepancies = verifyTally();
  const contractorSummary = getContractorSummary();
  const supplierSummary = getSupplierSummary();
  const diameterTotals = getDiameterTotals();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading steel inventory data for {selectedSite?.site_name}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* File Viewer Modal */}
      <FileViewer />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal />

      {/* Site Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBackToSites}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            <ArrowLeft size={20} />
            Back to Sites
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🔧 Steel TMT Bar Inventory</h1>
              <p className="text-lg text-blue-600 font-medium">{selectedSite.site_name} ({selectedSite.site_code})</p>
            </div>
            <div className="text-right">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-gray-600">
                <span>Total Stock: {getTotalInventoryWeight().toFixed(3)} tonnes</span>
                <span>Low Stock Items: {getLowStockItems().length}</span>
                <span>Discrepancies: {discrepancies.length}</span>
              </div>
              <span className="text-green-600 text-sm">🔄 Live Database</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="fixed top-4 right-4 z-40 space-y-2">
        {alerts.map((alert, index) => (
          <div key={`alert-${alert.id}-${index}`} className={`p-3 rounded-lg shadow-lg max-w-sm ${
            alert.type === 'success' ? 'bg-green-500 text-white' :
            alert.type === 'error' ? 'bg-red-500 text-white' :
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
            { id: 'inventory', label: 'Inventory', fullLabel: 'Current Inventory', icon: Package },
            { id: 'summary', label: 'Summary', fullLabel: 'Stock Summary', icon: BarChart3 },
            { id: 'incoming', label: 'Incoming', fullLabel: 'Incoming Shipment', icon: Upload },
            { id: 'outgoing', label: 'Outgoing', fullLabel: 'Outgoing Shipment', icon: Download },
            { id: 'transactions', label: 'History', fullLabel: 'Transaction History', icon: Truck }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-b-2 border-blue-500 text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={18} />
              <span className="hidden sm:inline">{tab.fullLabel}</span>
              <span className="sm:hidden">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Tally Verification */}
          {discrepancies.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="text-red-500" size={20} />
                <h3 className="font-semibold text-red-700">Tally Discrepancies Detected</h3>
              </div>
              <div className="space-y-2">
                {discrepancies.map((disc, index) => (
                  <div key={`discrepancy-${disc.diameter}-${index}`} className="text-sm text-red-600">
                    {disc.diameter}mm: Recorded {disc.recordedWeight.toFixed(3)}t vs Calculated {disc.calculatedWeight.toFixed(3)}t 
                    (Diff: {disc.difference.toFixed(3)}t)
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inventory Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.entries(inventory).map(([diameter, data], index) => {
              const threshold = selectedSite?.steel_low_stock_threshold || 50;
              const isLowStock = data.pieces < threshold;
              
              return (
                <div key={`inventory-${diameter}-${selectedSite?.id || 'no-site'}-${index}`} className={`bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 ${
                  isLowStock ? 'border-red-500' : 'border-green-500'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{diameter}mm TMT</h3>
                    </div>
                    {isLowStock && <AlertTriangle className="text-red-500" size={16} />}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Pieces:</span>
                      <span className="font-medium">{data.pieces}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Weight:</span>
                      <span className="font-medium">{data.totalWeight.toFixed(3)}t</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Per piece:</span>
                      <span>{(TMT_SPECS[diameter] * (data.length || STANDARD_LENGTH)).toFixed(2)}kg</span>
                    </div>
                    {isLowStock && (
                      <div className="text-xs text-red-600 mt-2 pt-2 border-t border-red-200">
                        ⚠ Low stock alert (below {threshold} pieces)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {Object.keys(inventory).length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No steel inventory at this site</h3>
              <p className="text-gray-600 mb-4">
                Start by adding your first steel shipment to {selectedSite.site_name}.
              </p>
              <button
                onClick={() => setActiveTab('incoming')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
              >
                <Plus size={16} />
                Add Steel Shipment
              </button>
            </div>
          )}
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Period Selector */}
          <PeriodSelector />

          {/* Tally-style Stock Summary */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                <BarChart3 className="text-blue-600" size={24} />
                Stock Summary - TMT Bars at {selectedSite.site_name}
              </h2>
              <button
                onClick={() => exportToExcel(diameterTotals, `steel_stock_summary_${selectedSite.site_code}.csv`)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Export Excel</span>
                <span className="sm:hidden">Export</span>
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="border border-gray-300 text-left py-3 px-4 font-semibold">Particulars</th>
                    <th className="border border-gray-300 text-center py-3 px-4 font-semibold">Inwards</th>
                    <th className="border border-gray-300 text-center py-3 px-4 font-semibold">Outwards</th>
                    <th className="border border-gray-300 text-center py-3 px-4 font-semibold">Closing Balance</th>
                  </tr>
                  <tr className="bg-gray-50 text-xs">
                    <th className="border border-gray-300 text-left py-2 px-4"></th>
                    <th className="border border-gray-300 text-center py-2 px-4">
                      <div className="flex justify-between">
                        <span>Quantity</span>
                        <span>Value</span>
                      </div>
                    </th>
                    <th className="border border-gray-300 text-center py-2 px-4">
                      <div className="flex justify-between">
                        <span>Quantity</span>
                        <span>Value</span>
                      </div>
                    </th>
                    <th className="border border-gray-300 text-center py-2 px-4">
                      <div className="flex justify-between">
                        <span>Quantity</span>
                        <span>Value</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(diameterTotals).map(([diameter, data], index) => {
                    const filteredTransactions = getFilteredTransactions();
                    const totalInwards = filteredTransactions
                      .filter(t => t.type === 'incoming' && t.diameter === parseInt(diameter))
                      .reduce((sum, t) => sum + t.pieces, 0);
                    const totalInwardsWeight = filteredTransactions
                      .filter(t => t.type === 'incoming' && t.diameter === parseInt(diameter))
                      .reduce((sum, t) => sum + t.weight, 0);
                    
                    const threshold = selectedSite?.steel_low_stock_threshold || 50;
                    const isLowStock = data.currentStock < threshold;
                    const isExpanded = expandedRows[diameter];
                    
                    return (
                      <React.Fragment key={`summary-${diameter}-${selectedSite?.id || 'no-site'}-${index}`}>
                        <tr 
                          className="hover:bg-blue-50 transition-colors cursor-pointer"
                          onClick={() => toggleRowExpansion(diameter)}
                          style={{ minHeight: '44px' }}
                        >
                          <td className="border border-gray-300 py-4 px-4 font-medium text-blue-600">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                TMT Bar {diameter}mm
                              </span>
                            </div>
                            {isLowStock && (
                              <span className="block mt-1 text-red-500 text-xs">⚠ Low Stock (below {threshold})</span>
                            )}
                          </td>
                          <td className="border border-gray-300 py-4 px-4 text-center">
                            <div className="flex justify-between">
                              <span>{totalInwards} Nos</span>
                              <span>{totalInwardsWeight.toFixed(3)} t</span>
                            </div>
                          </td>
                          <td className="border border-gray-300 py-4 px-4 text-center">
                            <div className="flex justify-between">
                              <span>{data.totalIssued} Nos</span>
                              <span>{data.totalIssuedWeight.toFixed(3)} t</span>
                            </div>
                          </td>
                          <td className="border border-gray-300 py-4 px-4 text-center">
                            <div className="flex justify-between">
                              <span className={isLowStock ? 'text-red-600 font-semibold' : 'font-semibold'}>
                                {data.currentStock} Nos
                              </span>
                              <span className={isLowStock ? 'text-red-600 font-semibold' : 'font-semibold'}>
                                {data.currentWeight.toFixed(3)} t
                              </span>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan="4" className="border border-gray-300 p-0">
                              <div className="bg-gray-50 p-4">
                                <h4 className="font-semibold text-gray-800 mb-3">Transaction Details for {diameter}mm TMT Bars</h4>
                                <div className="max-h-60 overflow-y-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-gray-100">
                                        <th className="text-left p-2">Date</th>
                                        <th className="text-left p-2">Type</th>
                                        <th className="text-left p-2">Pieces</th>
                                        <th className="text-left p-2">Weight</th>
                                        <th className="text-left p-2">Party</th>
                                        <th className="text-left p-2">Files</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {getDiameterTransactionDetails(diameter).map((transaction, idx) => (
                                        <tr key={`detail-${transaction.id}-${idx}`} className="border-b border-gray-200">
                                          <td className="p-2">{transaction.timestamp}</td>
                                          <td className="p-2">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                              transaction.type === 'incoming' 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-blue-100 text-blue-800'
                                            }`}>
                                              {transaction.type === 'incoming' ? 'IN' : 'OUT'}
                                            </span>
                                          </td>
                                          <td className="p-2">{transaction.pieces}</td>
                                          <td className="p-2">{transaction.weight.toFixed(3)}t</td>
                                          <td className="p-2">
                                            {transaction.type === 'incoming' ? transaction.importedFrom : transaction.recipient}
                                          </td>
                                          <td className="p-2">
                                            <div className="flex gap-1">
                                              {transaction.billFileName && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleFileView(transaction.billFileName, transaction.billFileOriginalName);
                                                  }}
                                                  className="text-green-600 hover:text-green-800"
                                                  title="View bill"
                                                >
                                                  📄
                                                </button>
                                              )}
                                              {transaction.issueSlipFileName && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleFileView(transaction.issueSlipFileName, transaction.issueSlipFileOriginalName);
                                                  }}
                                                  className="text-orange-600 hover:text-orange-800"
                                                  title="View issue slip"
                                                >
                                                  📋
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
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  
                  {/* Grand Total Row */}
                  <tr className="bg-yellow-50 font-bold border-t-2 border-gray-400">
                    <td className="border border-gray-300 py-3 px-4">Grand Total</td>
                    <td className="border border-gray-300 py-3 px-4 text-center">
                      <div className="flex justify-between">
                        <span>
                          {getFilteredTransactions()
                            .filter(t => t.type === 'incoming')
                            .reduce((sum, t) => sum + t.pieces, 0)} Nos
                        </span>
                        <span>
                          {getFilteredTransactions()
                            .filter(t => t.type === 'incoming')
                            .reduce((sum, t) => sum + t.weight, 0).toFixed(3)} t
                        </span>
                      </div>
                    </td>
                    <td className="border border-gray-300 py-3 px-4 text-center">
                      <div className="flex justify-between">
                        <span>
                          {Object.values(diameterTotals).reduce((sum, data) => sum + data.totalIssued, 0)} Nos
                        </span>
                        <span>
                          {Object.values(diameterTotals).reduce((sum, data) => sum + data.totalIssuedWeight, 0).toFixed(3)} t
                        </span>
                      </div>
                    </td>
                    <td className="border border-gray-300 py-3 px-4 text-center">
                      <div className="flex justify-between">
                        <span>{Object.values(diameterTotals).reduce((sum, data) => sum + data.currentStock, 0)} Nos</span>
                        <span>{getTotalInventoryWeight().toFixed(3)} t</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Supplier-wise Summary */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                <Upload className="text-purple-600" size={24} />
                Supplier Inwards to {selectedSite.site_name}
              </h2>
              {Object.keys(supplierSummary).length > 0 && (
                <button
                  onClick={() => exportToExcel(supplierSummary, `steel_supplier_summary_${selectedSite.site_code}.csv`)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Export Excel</span>
                  <span className="sm:hidden">Export</span>
                </button>
              )}
            </div>
            {Object.keys(supplierSummary).length === 0 ? (
              <p className="text-gray-500 text-center py-8">No supplier deliveries recorded for this period</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(supplierSummary).map(([supplier, diameters], supplierIndex) => (
                  <div key={`supplier-${supplier}-${supplierIndex}`} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3 text-purple-700">{supplier}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Diameter</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Pieces Received</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Weight Received (t)</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Deliveries</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(diameters).map(([diameter, data], diameterIndex) => (
                            <tr key={`diameter-${supplier}-${diameter}-${diameterIndex}`} className="border-b border-gray-100">
                              <td className="py-2 px-2 font-medium">{diameter}mm</td>
                              <td className="py-2 px-2">{data.pieces}</td>
                              <td className="py-2 px-2">{data.weight.toFixed(3)}</td>
                              <td className="py-2 px-2">{data.transactions.length}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
                            <td className="py-2 px-2">Total</td>
                            <td className="py-2 px-2">
                              {Object.values(diameters).reduce((sum, data) => sum + data.pieces, 0)}
                            </td>
                            <td className="py-2 px-2">
                              {Object.values(diameters).reduce((sum, data) => sum + data.weight, 0).toFixed(3)}
                            </td>
                            <td className="py-2 px-2">
                              {Object.values(diameters).reduce((sum, data) => sum + data.transactions.length, 0)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contractor-wise Summary */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                <Truck className="text-green-600" size={24} />
                Contractor Issues from {selectedSite.site_name}
              </h2>
              {Object.keys(contractorSummary).length > 0 && (
                <button
                  onClick={() => exportToExcel(contractorSummary, `steel_contractor_summary_${selectedSite.site_code}.csv`)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Export Excel</span>
                  <span className="sm:hidden">Export</span>
                </button>
              )}
            </div>
            {Object.keys(contractorSummary).length === 0 ? (
              <p className="text-gray-500 text-center py-8">No contractor issues recorded for this period</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(contractorSummary).map(([contractor, diameters], contractorIndex) => (
                  <div key={`contractor-${contractor}-${contractorIndex}`} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3 text-blue-700">{contractor}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Diameter</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Pieces Issued</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Weight Issued (t)</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Issues</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(diameters).map(([diameter, data], diameterIndex) => (
                            <tr key={`diameter-${contractor}-${diameter}-${diameterIndex}`} className="border-b border-gray-100">
                              <td className="py-2 px-2 font-medium">{diameter}mm</td>
                              <td className="py-2 px-2">{data.pieces}</td>
                              <td className="py-2 px-2">{data.weight.toFixed(3)}</td>
                              <td className="py-2 px-2">{data.transactions.length}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
                            <td className="py-2 px-2">Total</td>
                            <td className="py-2 px-2">
                              {Object.values(diameters).reduce((sum, data) => sum + data.pieces, 0)}
                            </td>
                            <td className="py-2 px-2">
                              {Object.values(diameters).reduce((sum, data) => sum + data.weight, 0).toFixed(3)}
                            </td>
                            <td className="py-2 px-2">
                              {Object.values(diameters).reduce((sum, data) => sum + data.transactions.length, 0)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incoming Shipment Tab */}
      {activeTab === 'incoming' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <Upload className="text-green-600" size={24} />
            <h2 className="text-lg sm:text-xl font-semibold">Add Steel to {selectedSite.site_name}</h2>
            {uploading && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  TMT Bar Diameter (mm) *
                </label>
                <select
                  value={incomingForm.diameter}
                  onChange={(e) => setIncomingForm(prev => ({ ...prev, diameter: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={uploading}
                >
                  <option value="">Select diameter</option>
                  {Object.keys(TMT_SPECS).map(diameter => (
                    <option key={diameter} value={diameter}>{diameter}mm</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rod Length (meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={incomingForm.length}
                  onChange={(e) => setIncomingForm(prev => ({ ...prev, length: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={uploading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Weight *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    value={incomingForm.totalWeight}
                    onChange={(e) => setIncomingForm(prev => ({ ...prev, totalWeight: e.target.value }))}
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 5.250"
                    disabled={uploading}
                  />
                  <select
                    value={incomingForm.weightUnit}
                    onChange={(e) => setIncomingForm(prev => ({ ...prev, weightUnit: e.target.value }))}
                    className="w-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={uploading}
                  >
                    <option value="tonnes">Tonnes</option>
                    <option value="kg">Kg</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imported From (Supplier/Vendor) *
                </label>
                <input
                  type="text"
                  value={incomingForm.importedFrom}
                  onChange={(e) => setIncomingForm(prev => ({ ...prev, importedFrom: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., ABC Steel Industries"
                  disabled={uploading}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attach Bill/Invoice (Max 10MB)
              </label>
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={uploading}
              />
              {incomingForm.billFileName && (
                <p className="text-xs text-green-600 mt-1">✓ {incomingForm.billFileName}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: Images (JPG, PNG), PDF, Word documents
              </p>
            </div>
          </div>

          {/* Preview Calculation */}
          {incomingForm.diameter && incomingForm.totalWeight && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-800 mb-2">Calculation Preview:</h3>
              <div className="text-sm text-blue-700">
                Estimated pieces: {calculatePiecesFromWeight(
                  incomingForm.diameter, 
                  parseFloat(incomingForm.totalWeight) || 0,
                  incomingForm.weightUnit,
                  parseFloat(incomingForm.length) || STANDARD_LENGTH
                )} bars
              </div>
              <div className="text-sm text-blue-700">
                Length: {incomingForm.length}m | Site: {selectedSite.site_name}
                {incomingForm.importedFrom && ` | From: ${incomingForm.importedFrom}`}
              </div>
            </div>
          )}

          <button
            onClick={handleIncomingShipment}
            disabled={uploading}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Plus size={18} />
                Add to {selectedSite.site_name} Inventory
              </>
            )}
          </button>
        </div>
      )}

      {/* Outgoing Shipment Tab */}
      {activeTab === 'outgoing' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <Download className="text-blue-600" size={24} />
            <h2 className="text-lg sm:text-xl font-semibold">Ship Steel from {selectedSite.site_name}</h2>
            {uploading && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  TMT Bar Diameter (mm) *
                </label>
                <select
                  value={outgoingForm.diameter}
                  onChange={(e) => setOutgoingForm(prev => ({ ...prev, diameter: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={uploading}
                >
                  <option value="">Select diameter</option>
                  {Object.keys(TMT_SPECS).map(diameter => (
                    <option key={diameter} value={diameter}>
                      {diameter}mm (Available: {inventory[diameter]?.pieces || 0} pieces)
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rod Length (meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={outgoingForm.length}
                  onChange={(e) => setOutgoingForm(prev => ({ ...prev, length: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={uploading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Pieces *
                </label>
                <input
                  type="number"
                  value={outgoingForm.pieces}
                  onChange={(e) => setOutgoingForm(prev => ({ ...prev, pieces: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 100"
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ship to (Contractor/Site) *
                </label>
                <input
                  type="text"
                  value={outgoingForm.recipient}
                  onChange={(e) => setOutgoingForm(prev => ({ ...prev, recipient: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., ABC Construction Co."
                  disabled={uploading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attach Issue Slip (Max 10MB)
              </label>
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleIssueSlipUpload}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={uploading}
              />
              {outgoingForm.issueSlipFileName && (
                <p className="text-xs text-green-600 mt-1">✓ {outgoingForm.issueSlipFileName}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: Images (JPG, PNG), PDF, Word documents
              </p>
            </div>
          </div>

          {/* Preview Calculation */}
          {outgoingForm.diameter && outgoingForm.pieces && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-orange-800 mb-2">Shipment Preview:</h3>
              <div className="text-sm text-orange-700">
                Weight: {calculateWeightFromPieces(
                  outgoingForm.diameter,
                  parseInt(outgoingForm.pieces) || 0,
                  parseFloat(outgoingForm.length) || STANDARD_LENGTH
                ).toFixed(3)} tonnes
              </div>
              <div className="text-sm text-orange-700">
                Length: {outgoingForm.length}m | From: {selectedSite.site_name} → To: {outgoingForm.recipient || 'Not specified'}
              </div>
              <div className="text-sm text-orange-700">
                Remaining stock: {(inventory[outgoingForm.diameter]?.pieces || 0) - (parseInt(outgoingForm.pieces) || 0)} pieces
              </div>
            </div>
          )}

          <button
            onClick={handleOutgoingShipment}
            disabled={uploading}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Minus size={18} />
                Ship from {selectedSite.site_name}
              </>
            )}
          </button>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <Truck className="text-purple-600" size={24} />
              <h2 className="text-lg sm:text-xl font-semibold">Steel Transactions - {selectedSite.site_name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportToExcel(getFilteredTransactions(), `steel_transactions_${selectedSite.site_code}.csv`)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Export Excel</span>
                <span className="sm:hidden">Export</span>
              </button>
              <div className="text-sm text-gray-500">
                {getFilteredTransactions().length} transactions
              </div>
            </div>
          </div>

          {/* Period Selector */}
          <PeriodSelector />
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Date & Time</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Type</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Size</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Pieces</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Weight</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Details</th>
                  {isSuperAdmin && (
                    <th className="text-left py-3 px-2 font-medium text-gray-600">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {getFilteredTransactions().map((transaction, index) => {
                  const uniqueKey = `transaction-${transaction.id || 'no-id'}-${transaction.type}-${transaction.diameter}-${index}-${transaction.timestamp?.replace(/[^0-9]/g, '') || Date.now()}`;
                  
                  return (
                    <tr key={uniqueKey} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 text-xs">{transaction.timestamp}</td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.type === 'incoming' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {transaction.type === 'incoming' ? <Plus size={10} /> : <Minus size={10} />}
                          {transaction.type === 'incoming' ? 'IN' : 'OUT'}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-medium">{transaction.diameter}mm</td>
                      <td className="py-3 px-2">{transaction.pieces}</td>
                      <td className="py-3 px-2">{transaction.weight.toFixed(2)}t</td>
                      <td className="py-3 px-2 text-xs">
                        {transaction.type === 'incoming' && transaction.importedFrom && (
                          <div className="font-medium text-green-700 mb-1">From: {transaction.importedFrom}</div>
                        )}
                        {transaction.type === 'outgoing' && transaction.recipient && (
                          <div className="font-medium text-blue-700 mb-1">To: {transaction.recipient}</div>
                        )}
                        
                        {/* Clickable Files */}
                        {transaction.billFileName && (
                          <div className="mb-1">
                            <button
                              onClick={() => handleFileView(transaction.billFileName, transaction.billFileOriginalName)}
                              className="text-green-600 hover:text-green-800 hover:underline flex items-center gap-1 cursor-pointer"
                              title="Click to view bill/invoice"
                            >
                              <Eye size={12} />
                              📄 {transaction.billFileOriginalName && transaction.billFileOriginalName.length > 15 
                                ? transaction.billFileOriginalName.substring(0, 15) + '...' 
                                : transaction.billFileOriginalName || 'Bill'}
                            </button>
                          </div>
                        )}
                        {transaction.issueSlipFileName && (
                          <div className="mb-1">
                            <button
                              onClick={() => handleFileView(transaction.issueSlipFileName, transaction.issueSlipFileOriginalName)}
                              className="text-orange-600 hover:text-orange-800 hover:underline flex items-center gap-1 cursor-pointer"
                              title="Click to view issue slip"
                            >
                              <Eye size={12} />
                              📋 {transaction.issueSlipFileOriginalName && transaction.issueSlipFileOriginalName.length > 15 
                                ? transaction.issueSlipFileOriginalName.substring(0, 15) + '...' 
                                : transaction.issueSlipFileOriginalName || 'Issue Slip'}
                            </button>
                          </div>
                        )}
                        
                        {transaction.wastage > 0.01 && (
                          <span className="text-yellow-600">Wastage: {transaction.wastage.toFixed(3)}t</span>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td className="py-3 px-2">
                          <button
                            onClick={() => handleDeleteTransaction(transaction)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 rounded-lg transition-colors"
                            title="Delete transaction (Super Admin only)"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {getFilteredTransactions().length === 0 && (
                  <tr>
                    <td colSpan={isSuperAdmin ? "7" : "6"} className="py-8 text-center text-gray-500">
                      No steel transactions recorded for the selected period at {selectedSite.site_name}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteAwareSteelInventorySystem;