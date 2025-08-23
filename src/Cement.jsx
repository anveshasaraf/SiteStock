import React, { useState, useEffect } from 'react';
import { Package, Truck, BarChart3, AlertTriangle, CheckCircle, Plus, Minus, Download, Upload, ChevronDown, ChevronRight, Users, ArrowLeft, Eye, X, FileText, Image, Trash2, Calendar, Filter } from 'lucide-react';
import { supabase } from './supabaseClient';

const SiteAwareCementInventorySystem = ({ selectedSite, onBackToSites, currentUser = null }) => {
  const CEMENT_SPECS = {
    'OPC 43 Grade': 50,
    'OPC 53 Grade': 50,
    'PPC': 50,
    'Slag Cement': 50,
    'White Cement': 50,
    'Other': 50
  };

  // Check if current user is super admin
  const isSuperAdmin = currentUser?.role === 'super_admin';
  
  // TEMPORARY: Force show delete buttons for testing - REMOVE THIS LATER
  // const isSuperAdmin = true;
  
  // Debug logging - remove this after testing
  console.log('Current user:', currentUser);
  console.log('Is super admin:', isSuperAdmin);

  const [cementInventory, setCementInventory] = useState({});
  const [cementTransactions, setCementTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('inventory');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expandedSummary, setExpandedSummary] = useState({});
  const [expandedContractor, setExpandedContractor] = useState({});

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
    type: 'last30days',
    startDate: '',
    endDate: ''
  });

  const [cementIncomingForm, setCementIncomingForm] = useState({
    type: '',
    bags: '',
    importedFrom: '',
    billFile: null,
    billFileName: ''
  });

  const [cementOutgoingForm, setCementOutgoingForm] = useState({
    type: '',
    bags: '',
    recipient: '',
    issueSlipFile: null,
    issueSlipFileName: ''
  });

  // Get filtered transactions based on period
  const getFilteredTransactions = () => {
    if (!periodFilter.type) {
      return cementTransactions;
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
          endDate.setHours(23, 59, 59, 999);
          return cementTransactions.filter(t => {
            const timestampToUse = t.rawTimestamp || t.timestamp;
            const transactionDate = new Date(timestampToUse);
            
            if (isNaN(transactionDate.getTime())) {
              console.warn('Failed to parse transaction date:', timestampToUse);
              return true;
            }
            
            return transactionDate >= startDate && transactionDate <= endDate;
          });
        }
        return cementTransactions;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    return cementTransactions.filter(t => {
      const timestampToUse = t.rawTimestamp || t.timestamp;
      const transactionDate = new Date(timestampToUse);
      
      if (isNaN(transactionDate.getTime())) {
        console.warn('Failed to parse transaction date:', timestampToUse);
        return true;
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
                  ? 'bg-green-600 text-white'
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

  // File upload helper function
  const uploadFileToStorage = async (file, folder = 'cement-bills') => {
    try {
      if (!file) return null;

      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${selectedSite.site_code}_${Date.now()}.${fileExt}`;

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
        .createSignedUrl(fileName, 3600);

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

          <div className="p-4 max-h-[calc(90vh-80px)] overflow-auto">
            {fileLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
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
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
                    >
                      <Download size={16} />
                      Download File
                    </a>
                  </div>
                )}

                {(isImage || isPdf) && (
                  <div className="text-center mt-4 pt-4 border-t">
                    <a
                      href={fileUrl}
                      download={selectedFile.originalName}
                      className="text-green-600 hover:text-green-800 inline-flex items-center gap-1 text-sm"
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
              <div><strong>Cement Type:</strong> {transaction.cementType}</div>
              <div><strong>Bags:</strong> {transaction.bags}</div>
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
      
      const { error: deleteError } = await supabase
        .from('cement_transactions')
        .delete()
        .eq('id', transaction.id);

      if (deleteError) throw deleteError;

      const currentInventory = cementInventory[transaction.cementType] || { bags: 0, totalWeight: 0 };
      
      let newBags, newTotalWeight;
      
      if (transaction.type === 'incoming') {
        newBags = Math.max(0, currentInventory.bags - transaction.bags);
        newTotalWeight = Math.max(0, currentInventory.totalWeight - transaction.weight);
      } else {
        newBags = currentInventory.bags + transaction.bags;
        newTotalWeight = currentInventory.totalWeight + transaction.weight;
      }

      await updateCementInventoryInDB(transaction.cementType, newBags, newTotalWeight);

      setCementInventory(prev => ({
        ...prev,
        [transaction.cementType]: {
          bags: newBags,
          totalWeight: newTotalWeight
        }
      }));

      await loadCementTransactionsData();

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

  // Handle file upload for incoming bills
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        addAlert('File size must be less than 10MB', 'error');
        return;
      }
      
      setCementIncomingForm(prev => ({ 
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
      if (file.size > 10 * 1024 * 1024) {
        addAlert('File size must be less than 10MB', 'error');
        return;
      }
      
      setCementOutgoingForm(prev => ({ 
        ...prev, 
        issueSlipFile: file,
        issueSlipFileName: file.name 
      }));
    }
  };

  const addAlert = (message, type) => {
    const alert = { id: Date.now(), message, type };
    setAlerts(prev => [alert, ...prev.slice(0, 4)]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== alert.id)), 5000);
  };

  const calculateWeightFromCementBags = (cementType, bags) => {
    const weightPerBag = CEMENT_SPECS[cementType] || 50;
    return (bags * weightPerBag) / 1000;
  };

  const loadCementInventoryData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cement_inventory')
        .select('*')
        .eq('site_id', selectedSite.id)
        .order('cement_type');

      if (error && error.code !== 'PGRST116') throw error;

      const inventoryMap = {};
      if (data) {
        data.forEach(item => {
          inventoryMap[item.cement_type] = {
            bags: item.bags,
            totalWeight: parseFloat(item.total_weight)
          };
        });
      }
      setCementInventory(inventoryMap);
    } catch (error) {
      addAlert('Error loading cement inventory: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCementTransactionsData = async () => {
    try {
      const { data, error } = await supabase
        .from('cement_transactions')
        .select('*')
        .eq('site_id', selectedSite.id)
        .order('timestamp', { ascending: false });

      if (error && error.code !== 'PGRST116') throw error;

      const formattedTransactions = data ? data.map((transaction, index) => ({
        id: transaction.id,
        uniqueKey: `${transaction.id}-${index}`,
        type: transaction.type,
        cementType: transaction.cement_type,
        bags: transaction.bags,
        weight: parseFloat(transaction.weight),
        timestamp: new Date(transaction.timestamp).toLocaleString(),
        rawTimestamp: transaction.timestamp,
        recipient: transaction.recipient,
        importedFrom: transaction.imported_from,
        billFileName: transaction.bill_file_name,
        billFileOriginalName: transaction.bill_file_original_name,
        issueSlipFileName: transaction.issue_slip_file_name,
        issueSlipFileOriginalName: transaction.issue_slip_file_original_name
      })) : [];

      setCementTransactions(formattedTransactions);
    } catch (error) {
      addAlert('Error loading cement transactions: ' + error.message, 'error');
    }
  };

  const updateCementInventoryInDB = async (cementType, bags, totalWeight) => {
    try {
      const { error } = await supabase
        .from('cement_inventory')
        .upsert({
          cement_type: cementType,
          bags: bags,
          total_weight: totalWeight,
          site_id: selectedSite.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'cement_type,site_id'
        });

      if (error) throw error;
    } catch (error) {
      addAlert('Error updating cement inventory: ' + error.message, 'error');
    }
  };

  const saveCementTransactionToDB = async (transaction) => {
    try {
      const { error } = await supabase
        .from('cement_transactions')
        .insert([{
          type: transaction.type,
          cement_type: transaction.cementType,
          bags: transaction.bags,
          weight: transaction.weight,
          recipient: transaction.recipient || null,
          imported_from: transaction.importedFrom || null,
          bill_file_name: transaction.billFileName || null,
          bill_file_original_name: transaction.billFileOriginalName || null,
          issue_slip_file_name: transaction.issueSlipFileName || null,
          issue_slip_file_original_name: transaction.issueSlipFileOriginalName || null,
          site_id: selectedSite.id
        }]);

      if (error) throw error;
    } catch (error) {
      addAlert('Error saving cement transaction: ' + error.message, 'error');
    }
  };

  useEffect(() => {
    if (selectedSite) {
      loadCementInventoryData();
      loadCementTransactionsData();
    }
  }, [selectedSite]);

  const handleCementIncomingShipment = async () => {
    const { type, bags, importedFrom, billFile, billFileName } = cementIncomingForm;
    
    if (!type || !bags || !importedFrom.trim()) {
      addAlert('Please fill all required fields including supplier/vendor information', 'error');
      return;
    }

    setUploading(true);

    try {
      let fileInfo = null;
      if (billFile) {
        fileInfo = await uploadFileToStorage(billFile, 'cement-bills');
        if (!fileInfo) {
          addAlert('File upload failed, but transaction will be saved without file', 'warning');
        }
      }

      const bagsNum = parseInt(bags);
      const weight = calculateWeightFromCementBags(type, bagsNum);
      const newBags = (cementInventory[type]?.bags || 0) + bagsNum;
      const newTotalWeight = (cementInventory[type]?.totalWeight || 0) + weight;
      
      setCementInventory(prev => ({ 
        ...prev, 
        [type]: { bags: newBags, totalWeight: newTotalWeight } 
      }));

      await updateCementInventoryInDB(type, newBags, newTotalWeight);

      const transaction = {
        type: 'incoming',
        cementType: type,
        bags: bagsNum,
        weight: weight,
        importedFrom: importedFrom.trim(),
        billFileName: fileInfo?.fileName || null,
        billFileOriginalName: fileInfo?.originalName || billFileName || null
      };

      await saveCementTransactionToDB(transaction);
      await loadCementTransactionsData();

      addAlert(`Added ${bagsNum} bags of ${type} cement to ${selectedSite.site_name} from ${importedFrom.trim()} (${weight.toFixed(3)} tonnes)`, 'success');
      setCementIncomingForm({ 
        type: '', 
        bags: '', 
        importedFrom: '',
        billFile: null, 
        billFileName: '' 
      });
    } catch (error) {
      addAlert('Error processing cement shipment: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleCementOutgoingShipment = async () => {
    const { type, bags, recipient, issueSlipFile, issueSlipFileName } = cementOutgoingForm;
    
    if (!type || !bags || !recipient.trim()) {
      addAlert('Please fill all required fields including recipient', 'error');
      return;
    }

    const requestedBags = parseInt(bags);
    const currentStock = cementInventory[type]?.bags || 0;

    if (requestedBags > currentStock) {
      addAlert(`Insufficient cement stock at ${selectedSite.site_name}! Available: ${currentStock} bags`, 'error');
      return;
    }

    setUploading(true);

    try {
      let fileInfo = null;
      if (issueSlipFile) {
        fileInfo = await uploadFileToStorage(issueSlipFile, 'cement-issue-slips');
        if (!fileInfo) {
          addAlert('File upload failed, but transaction will be saved without file', 'warning');
        }
      }

      const shippedWeight = calculateWeightFromCementBags(type, requestedBags);
      const newBags = currentStock - requestedBags;
      const newTotalWeight = (cementInventory[type]?.totalWeight || 0) - shippedWeight;
      
      setCementInventory(prev => ({ 
        ...prev, 
        [type]: { bags: newBags, totalWeight: newTotalWeight } 
      }));

      await updateCementInventoryInDB(type, newBags, newTotalWeight);

      const transaction = {
        type: 'outgoing',
        cementType: type,
        bags: requestedBags,
        weight: shippedWeight,
        recipient: recipient.trim(),
        issueSlipFileName: fileInfo?.fileName || null,
        issueSlipFileOriginalName: fileInfo?.originalName || issueSlipFileName || null
      };

      await saveCementTransactionToDB(transaction);
      await loadCementTransactionsData();

      addAlert(`Shipped ${requestedBags} bags of ${type} cement from ${selectedSite.site_name} to ${recipient.trim()} (${shippedWeight.toFixed(3)} tonnes)`, 'success');
      setCementOutgoingForm({ 
        type: '', 
        bags: '', 
        recipient: '', 
        issueSlipFile: null, 
        issueSlipFileName: '' 
      });
    } catch (error) {
      addAlert('Error processing cement shipment: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const exportToExcel = (filename) => {
    let csvContent = `Site: ${selectedSite.site_name} (${selectedSite.site_code})\n`;
    csvContent += 'Date,Type,Cement Type,Bags,Weight,Imported From,Shipped To,Bill File,Issue Slip File\n';
    getFilteredTransactions().forEach(t => {
      csvContent += `${t.timestamp},${t.type},${t.cementType},${t.bags},${t.weight.toFixed(3)},${t.importedFrom || ''},${t.recipient || ''},${t.billFileOriginalName || ''},${t.issueSlipFileOriginalName || ''}\n`;
    });
    
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

  const getCementTotalWeight = () => Object.values(cementInventory).reduce((total, item) => total + item.totalWeight, 0);
  
  const getCementLowStockItems = () => {
    const threshold = selectedSite?.cement_low_stock_threshold || 10;
    return Object.entries(cementInventory).filter(([type, data]) => data.bags < threshold);
  };

  const getStockSummary = () => {
    const summary = {};
    const filteredTransactions = getFilteredTransactions();
    
    Object.keys(CEMENT_SPECS).forEach(type => {
      summary[type] = {
        opening: 0,
        incoming: 0,
        outgoing: 0,
        closing: cementInventory[type]?.bags || 0,
        incomingWeight: 0,
        outgoingWeight: 0,
        transactions: []
      };
    });

    filteredTransactions.forEach(transaction => {
      if (summary[transaction.cementType]) {
        if (transaction.type === 'incoming') {
          summary[transaction.cementType].incoming += transaction.bags;
          summary[transaction.cementType].incomingWeight += transaction.weight;
        } else {
          summary[transaction.cementType].outgoing += transaction.bags;
          summary[transaction.cementType].outgoingWeight += transaction.weight;
        }
        summary[transaction.cementType].transactions.push(transaction);
      }
    });

    Object.keys(summary).forEach(type => {
      summary[type].opening = summary[type].closing - summary[type].incoming + summary[type].outgoing;
      if (summary[type].opening < 0) summary[type].opening = 0;
    });

    return summary;
  };

  const getContractorSummary = () => {
    const contractorSummary = {};
    const filteredTransactions = getFilteredTransactions();
    
    filteredTransactions
      .filter(t => t.type === 'outgoing' && t.recipient)
      .forEach(transaction => {
        const contractor = transaction.recipient;
        if (!contractorSummary[contractor]) {
          contractorSummary[contractor] = {
            totalBags: 0,
            totalWeight: 0,
            cementTypes: {},
            transactions: []
          };
        }
        
        contractorSummary[contractor].totalBags += transaction.bags;
        contractorSummary[contractor].totalWeight += transaction.weight;
        contractorSummary[contractor].transactions.push(transaction);
        
        if (!contractorSummary[contractor].cementTypes[transaction.cementType]) {
          contractorSummary[contractor].cementTypes[transaction.cementType] = {
            bags: 0,
            weight: 0
          };
        }
        
        contractorSummary[contractor].cementTypes[transaction.cementType].bags += transaction.bags;
        contractorSummary[contractor].cementTypes[transaction.cementType].weight += transaction.weight;
      });
    
    return contractorSummary;
  };

  const getSupplierSummary = () => {
    const summary = {};
    const filteredTransactions = getFilteredTransactions();
    
    filteredTransactions.forEach(transaction => {
      if (transaction.type === 'incoming' && transaction.importedFrom) {
        const supplier = transaction.importedFrom;
        const cementType = transaction.cementType;
        
        if (!summary[supplier]) {
          summary[supplier] = {};
        }
        
        if (!summary[supplier][cementType]) {
          summary[supplier][cementType] = {
            bags: 0,
            weight: 0,
            transactions: []
          };
        }
        
        summary[supplier][cementType].bags += transaction.bags;
        summary[supplier][cementType].weight += transaction.weight;
        summary[supplier][cementType].transactions.push(transaction);
      }
    });
    
    return summary;
  };

  const toggleSummaryExpansion = (type) => {
    setExpandedSummary(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const toggleContractorExpansion = (contractor) => {
    setExpandedContractor(prev => ({
      ...prev,
      [contractor]: !prev[contractor]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading cement inventory data for {selectedSite?.site_name}...</p>
        </div>
      </div>
    );
  }

  const stockSummary = getStockSummary();
  const contractorSummary = getContractorSummary();
  const supplierSummary = getSupplierSummary();

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* File Viewer Modal */}
      <FileViewer />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal />

      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBackToSites}
            className="flex items-center gap-2 text-green-600 hover:text-green-800 font-medium"
          >
            <ArrowLeft size={20} />
            Back to Sites
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">🏗️ Cement Inventory Management</h1>
              <p className="text-lg text-green-600 font-medium">{selectedSite.site_name} ({selectedSite.site_code})</p>
            </div>
            <div className="text-right">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-gray-600">
                <span>Total Stock: {getCementTotalWeight().toFixed(3)} tonnes</span>
                <span>Low Stock Items: {getCementLowStockItems().length}</span>
              </div>
              <span className="text-green-600 text-sm">🔄 Live Database</span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed top-4 right-4 z-40 space-y-2">
        {alerts.map((alert, index) => (
          <div key={`alert-${alert.id}-${index}`} className={`p-3 rounded-lg shadow-lg max-w-sm ${
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

      <div className="bg-white rounded-lg shadow mb-4 sm:mb-6">
        <div className="flex border-b overflow-x-auto">
          {[
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'summary', label: 'Stock Summary', icon: BarChart3 },
            { id: 'incoming', label: 'Incoming', icon: Upload },
            { id: 'outgoing', label: 'Outgoing', icon: Download },
            { id: 'transactions', label: 'History', icon: Truck }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap ${
                activeTab === tab.id ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'inventory' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Object.entries(cementInventory).map(([type, data], index) => {
            const threshold = selectedSite?.cement_low_stock_threshold || 10;
            const isLowStock = data.bags < threshold;
            
            return (
              <div key={`cement-inventory-${type}-${selectedSite?.id || 'no-site'}-${index}`} className={`bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 ${
                isLowStock ? 'border-red-500' : 'border-green-500'
              }`}>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{type}</h3>
                  {isLowStock && <AlertTriangle className="text-red-500" size={16} />}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bags:</span>
                    <span className="font-medium">{data.bags}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Weight:</span>
                    <span className="font-medium">{data.totalWeight.toFixed(3)}t</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Per bag:</span>
                    <span>{CEMENT_SPECS[type] || 50}kg</span>
                  </div>
                  {isLowStock && (
                    <div className="text-xs text-red-600 mt-2 pt-2 border-t border-red-200">
                      ⚠ Low stock alert (below {threshold} bags)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {Object.keys(cementInventory).length === 0 && (
            <div className="col-span-full text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No cement inventory at this site</h3>
              <p className="text-gray-600 mb-4">
                Start by adding your first cement shipment to {selectedSite.site_name}.
              </p>
              <button
                onClick={() => setActiveTab('incoming')}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
              >
                <Plus size={16} />
                Add Cement Shipment
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Period Selector */}
          <PeriodSelector />

          {/* Grade-wise Stock Summary */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                <BarChart3 className="text-purple-600" size={24} />
                Grade-wise Stock Summary - {selectedSite.site_name}
              </h2>
              <button
                onClick={() => exportToExcel(`cement_stock_summary_${selectedSite.site_code}.csv`)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Export Excel</span>
                <span className="sm:hidden">Export</span>
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Cement Grade</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Opening</th>
                    <th className="text-center py-3 px-4 font-semibold text-green-700">Incoming</th>
                    <th className="text-center py-3 px-4 font-semibold text-red-700">Outgoing</th>
                    <th className="text-center py-3 px-4 font-semibold text-blue-700">Closing</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Weight (T)</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stockSummary).map(([type, data], index) => (
                    <React.Fragment key={`cement-summary-${type}-${selectedSite?.id || 'no-site'}-${index}`}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{type}</td>
                        <td className="py-3 px-4 text-center">{data.opening}</td>
                        <td className="py-3 px-4 text-center text-green-600 font-medium">{data.incoming}</td>
                        <td className="py-3 px-4 text-center text-red-600 font-medium">{data.outgoing}</td>
                        <td className="py-3 px-4 text-center text-blue-600 font-medium">{data.closing}</td>
                        <td className="py-3 px-4 text-center text-gray-600">
                          {((data.closing * (CEMENT_SPECS[type] || 50)) / 1000).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => toggleSummaryExpansion(type)}
                            className="text-purple-600 hover:text-purple-800 flex items-center gap-1 mx-auto"
                          >
                            {expandedSummary[type] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            View
                          </button>
                        </td>
                      </tr>
                      {expandedSummary[type] && (
                        <tr>
                          <td colSpan="7" className="py-4 px-4 bg-gray-50">
                            <div className="space-y-3">
                              <h4 className="font-semibold text-gray-800">Transaction Details for {type}</h4>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                  <h5 className="font-medium text-green-700 mb-2">Incoming Transactions</h5>
                                  <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {data.transactions
                                      .filter(t => t.type === 'incoming')
                                      .map((t, idx) => (
                                        <div key={`incoming-${t.id}-${idx}`} className="text-xs bg-green-50 p-2 rounded">
                                          {t.timestamp}: +{t.bags} bags from {t.importedFrom || 'Unknown'} ({t.weight.toFixed(2)}t)
                                        </div>
                                      ))}
                                  </div>
                                </div>
                                <div>
                                  <h5 className="font-medium text-red-700 mb-2">Outgoing Transactions</h5>
                                  <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {data.transactions
                                      .filter(t => t.type === 'outgoing')
                                      .map((t, idx) => (
                                        <div key={`outgoing-${t.id}-${idx}`} className="text-xs bg-red-50 p-2 rounded">
                                          {t.timestamp}: -{t.bags} bags to {t.recipient} ({t.weight.toFixed(2)}t)
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Supplier-wise Summary */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-6">
              <Upload className="text-purple-600" size={24} />
              <h2 className="text-xl font-semibold">Supplier Inwards to {selectedSite.site_name}</h2>
            </div>
            
            {Object.keys(supplierSummary).length === 0 ? (
              <p className="text-gray-500 text-center py-8">No supplier deliveries recorded for this period</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(supplierSummary).map(([supplier, cementTypes], supplierIndex) => (
                  <div key={`supplier-${supplier}-${supplierIndex}`} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3 text-purple-700">{supplier}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Cement Type</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Bags Received</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Weight Received (t)</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Deliveries</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(cementTypes).map(([cementType, data], typeIndex) => (
                            <tr key={`type-${supplier}-${cementType}-${typeIndex}`} className="border-b border-gray-100">
                              <td className="py-2 px-2 font-medium">{cementType}</td>
                              <td className="py-2 px-2">{data.bags}</td>
                              <td className="py-2 px-2">{data.weight.toFixed(3)}</td>
                              <td className="py-2 px-2">{data.transactions.length}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
                            <td className="py-2 px-2">Total</td>
                            <td className="py-2 px-2">
                              {Object.values(cementTypes).reduce((sum, data) => sum + data.bags, 0)}
                            </td>
                            <td className="py-2 px-2">
                              {Object.values(cementTypes).reduce((sum, data) => sum + data.weight, 0).toFixed(3)}
                            </td>
                            <td className="py-2 px-2">
                              {Object.values(cementTypes).reduce((sum, data) => sum + data.transactions.length, 0)}
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
            <div className="flex items-center gap-2 mb-6">
              <Users className="text-orange-600" size={24} />
              <h2 className="text-xl font-semibold">Contractor Issues from {selectedSite.site_name}</h2>
            </div>
            
            {Object.keys(contractorSummary).length === 0 ? (
              <p className="text-gray-500 text-center py-8">No contractor issues recorded for this period</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(contractorSummary).map(([contractor, data], contractorIndex) => (
                  <React.Fragment key={`contractor-${contractor}-${contractorIndex}`}>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-lg text-blue-700">{contractor}</h3>
                        <button
                          onClick={() => toggleContractorExpansion(contractor)}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          {expandedContractor[contractor] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          Details
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Total Bags:</span>
                          <span className="font-medium ml-2">{data.totalBags}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Weight:</span>
                          <span className="font-medium ml-2">{data.totalWeight.toFixed(3)}t</span>
                        </div>
                      </div>

                      {expandedContractor[contractor] && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="font-medium text-gray-800 mb-3">Cement Type Breakdown</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {Object.entries(data.cementTypes).map(([type, typeData], typeIndex) => (
                              <div key={`type-${contractor}-${type}-${typeIndex}`} className="bg-blue-50 p-3 rounded">
                                <div className="font-medium text-blue-800">{type}</div>
                                <div className="text-sm text-blue-600">
                                  {typeData.bags} bags • {typeData.weight.toFixed(2)}t
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <h5 className="font-medium text-gray-700 mt-4 mb-2">Recent Transactions</h5>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {data.transactions
                              .slice(0, 10)
                              .map((t, transIndex) => (
                                <div key={`trans-${contractor}-${t.id}-${transIndex}`} className="text-xs bg-orange-50 p-2 rounded flex justify-between">
                                  <span>{t.timestamp}: {t.cementType}</span>
                                  <span className="font-medium">{t.bags} bags ({t.weight.toFixed(2)}t)</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'incoming' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <Upload className="text-green-600" size={24} />
            <h2 className="text-lg sm:text-xl font-semibold">Add Cement to {selectedSite.site_name}</h2>
            {uploading && (
              <div className="flex items-center gap-2 text-green-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cement Type *</label>
                <select
                  value={cementIncomingForm.type}
                  onChange={(e) => setCementIncomingForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={uploading}
                >
                  <option value="">Select cement type</option>
                  {Object.keys(CEMENT_SPECS).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Bags *</label>
                <input
                  type="number"
                  value={cementIncomingForm.bags}
                  onChange={(e) => setCementIncomingForm(prev => ({ ...prev, bags: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., 100"
                  disabled={uploading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Imported From (Supplier/Vendor) *
              </label>
              <input
                type="text"
                value={cementIncomingForm.importedFrom}
                onChange={(e) => setCementIncomingForm(prev => ({ ...prev, importedFrom: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g., ABC Cement Industries"
                disabled={uploading}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attach Bill/Invoice (Max 10MB)
              </label>
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                disabled={uploading}
              />
              {cementIncomingForm.billFileName && (
                <p className="text-xs text-green-600 mt-1">✓ {cementIncomingForm.billFileName}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: Images (JPG, PNG), PDF, Word documents
              </p>
            </div>
          </div>

          {cementIncomingForm.type && cementIncomingForm.bags && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-green-800 mb-2">Calculation Preview:</h3>
              <div className="text-sm text-green-700">
                Total weight: {calculateWeightFromCementBags(
                  cementIncomingForm.type,
                  parseInt(cementIncomingForm.bags) || 0
                ).toFixed(3)} tonnes
              </div>
              <div className="text-sm text-green-700">
                Weight per bag: {CEMENT_SPECS[cementIncomingForm.type] || 50} kg
              </div>
              <div className="text-sm text-green-700">
                Site: {selectedSite.site_name}
                {cementIncomingForm.importedFrom && ` | From: ${cementIncomingForm.importedFrom}`}
              </div>
            </div>
          )}

          <button
            onClick={handleCementIncomingShipment}
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

      {activeTab === 'outgoing' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <Download className="text-blue-600" size={24} />
            <h2 className="text-lg sm:text-xl font-semibold">Ship Cement from {selectedSite.site_name}</h2>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Cement Type *</label>
                <select
                  value={cementOutgoingForm.type}
                  onChange={(e) => setCementOutgoingForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={uploading}
                >
                  <option value="">Select cement type</option>
                  {Object.keys(CEMENT_SPECS).map(type => (
                    <option key={type} value={type}>
                      {type} (Available: {cementInventory[type]?.bags || 0} bags)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Bags *</label>
                <input
                  type="number"
                  value={cementOutgoingForm.bags}
                  onChange={(e) => setCementOutgoingForm(prev => ({ ...prev, bags: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 50"
                  disabled={uploading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ship To (Contractor/Site) *</label>
              <input
                type="text"
                value={cementOutgoingForm.recipient}
                onChange={(e) => setCementOutgoingForm(prev => ({ ...prev, recipient: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., ABC Construction Co."
                disabled={uploading}
                required
              />
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
              {cementOutgoingForm.issueSlipFileName && (
                <p className="text-xs text-green-600 mt-1">✓ {cementOutgoingForm.issueSlipFileName}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: Images (JPG, PNG), PDF, Word documents
              </p>
            </div>
          </div>

          {cementOutgoingForm.type && cementOutgoingForm.bags && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-orange-800 mb-2">Shipment Preview:</h3>
              <div className="text-sm text-orange-700">
                Weight: {calculateWeightFromCementBags(
                  cementOutgoingForm.type,
                  parseInt(cementOutgoingForm.bags) || 0
                ).toFixed(3)} tonnes
              </div>
              <div className="text-sm text-orange-700">
                From: {selectedSite.site_name} → To: {cementOutgoingForm.recipient || 'Not specified'}
              </div>
              <div className="text-sm text-orange-700">
                Remaining stock: {(cementInventory[cementOutgoingForm.type]?.bags || 0) - (parseInt(cementOutgoingForm.bags) || 0)} bags
              </div>
            </div>
          )}

          <button
            onClick={handleCementOutgoingShipment}
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

      {activeTab === 'transactions' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <Truck className="text-purple-600" size={24} />
              <h2 className="text-lg sm:text-xl font-semibold">Cement Transactions - {selectedSite.site_name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportToExcel(`cement_transactions_${selectedSite.site_code}.csv`)}
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
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Cement Type</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Bags</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Weight</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Details</th>
                  {isSuperAdmin && (
                    <th className="text-left py-3 px-2 font-medium text-gray-600">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {getFilteredTransactions().map((transaction, index) => {
                  const uniqueKey = `cement-transaction-${transaction.id || 'no-id'}-${transaction.type}-${transaction.cementType}-${index}-${transaction.timestamp?.replace(/[^0-9]/g, '') || Date.now()}`;
                  
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
                      <td className="py-3 px-2 font-medium">{transaction.cementType}</td>
                      <td className="py-3 px-2">{transaction.bags}</td>
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
                      No cement transactions recorded for the selected period at {selectedSite.site_name}
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

export default SiteAwareCementInventorySystem;